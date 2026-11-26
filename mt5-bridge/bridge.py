#!/usr/bin/env python3
"""Trading Brain local MT5 bridge.

Runs ONLY on 127.0.0.1. The Chrome extension sends TBSIG orders here; this
process forwards them to an already-logged-in MetaTrader 5 desktop terminal.

Safety design:
  * Dry-run is the default. Real orders need three separate opt-in flags.
  * A shared token is required for every state-changing request.
  * Symbol allowlist, max volume and max daily loss are enforced here.
  * A kill-switch file blocks all orders immediately.
  * Repeated event ids are ignored for 60 seconds.

This is a research tool, not a verified trading system. Use a demo account
first and review every log line before enabling real execution.
"""
from __future__ import annotations

import hmac
import json
import os
import threading
import time
from datetime import date, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

HOST = os.getenv("TB_BIND", "127.0.0.1")
PORT = int(os.getenv("TB_PORT", "8765"))
TOKEN = os.getenv("TB_BRIDGE_TOKEN", "")
AUTO_TRADE = os.getenv("TB_AUTO_TRADE", "0") == "1"
DRY_RUN = os.getenv("TB_DRY_RUN", "1") == "1"
ACK_REAL = os.getenv("TB_ACKNOWLEDGE_REAL", "0") == "1"
MAX_VOLUME = float(os.getenv("TB_MAX_VOLUME", "0.10"))
MAX_DAILY_LOSS = float(os.getenv("TB_MAX_DAILY_LOSS", "50"))
ALLOWED_SYMBOLS = {
    item.strip().upper()
    for item in os.getenv("TB_ALLOWED_SYMBOLS", "").split(",")
    if item.strip()
}
KILL_SWITCH = Path(os.getenv("TB_KILL_SWITCH", str(Path.home() / ".tradingbrain" / "KILL")))
DEVIATION = int(os.getenv("TB_DEVIATION", "20"))
MAGIC = int(os.getenv("TB_MAGIC", "20261126"))

_lock = threading.Lock()
_seen: dict[str, float] = {}
_mt5: Any = None


def log(message: str) -> None:
    print(f"[{datetime.now().isoformat(timespec='seconds')}] {message}", flush=True)


def mt5_module() -> Any:
    global _mt5
    if _mt5 is None:
        try:
            import MetaTrader5 as mt5  # type: ignore
        except ImportError as exc:
            raise RuntimeError("MetaTrader5 Python package is not installed") from exc
        _mt5 = mt5
    return _mt5


def authorized(token: str) -> bool:
    return bool(TOKEN) and hmac.compare_digest(token, TOKEN)


def kill_switch_active() -> bool:
    return KILL_SWITCH.exists()


def daily_realized_pnl(mt5: Any) -> float:
    today = date.today()
    start = datetime(today.year, today.month, today.day)
    deals = mt5.history_deals_get(start, datetime.now())
    if not deals:
        return 0.0
    return float(sum(deal.profit + deal.swap + deal.commission for deal in deals))


def validate_order(payload: dict[str, Any]) -> str | None:
    if kill_switch_active():
        return "blocked: kill switch is active"
    symbol = str(payload.get("symbol", "")).strip().upper()
    side = str(payload.get("side", "")).strip().upper()
    if side not in {"BUY", "SELL"}:
        return "side must be BUY or SELL"
    if not symbol or len(symbol) > 32:
        return "invalid symbol"
    if ALLOWED_SYMBOLS and symbol not in ALLOWED_SYMBOLS:
        return f"symbol {symbol} is not in TB_ALLOWED_SYMBOLS"
    try:
        volume = float(payload.get("volume", 0))
    except (TypeError, ValueError):
        return "invalid volume"
    if volume <= 0 or volume > MAX_VOLUME:
        return f"volume must be between 0 and {MAX_VOLUME}"
    for key in ("sl", "tp"):
        try:
            value = float(payload.get(key) or 0)
        except (TypeError, ValueError):
            return f"invalid {key}"
        payload[key] = value
    return None


def duplicate_event(event_id: str) -> bool:
    if not event_id:
        return False
    now = time.time()
    with _lock:
        for key, stamp in list(_seen.items()):
            if now - stamp > 60:
                del _seen[key]
        if event_id in _seen:
            return True
        _seen[event_id] = now
        return False


def execute_order(payload: dict[str, Any]) -> dict[str, Any]:
    if not (AUTO_TRADE and ACK_REAL) or DRY_RUN:
        return {
            "ok": True,
            "dry_run": True,
            "message": "Validated but not sent. Set TB_AUTO_TRADE=1, TB_DRY_RUN=0 and "
            "TB_ACKNOWLEDGE_REAL=1 to send real orders.",
            "received": {
                "symbol": str(payload.get("symbol", "")).upper(),
                "side": str(payload.get("side", "")).upper(),
                "volume": payload.get("volume"),
                "source": str(payload.get("source", "unknown")),
            },
        }

    mt5 = mt5_module()
    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialize failed: {mt5.last_error()}")
    try:
        terminal = mt5.terminal_info()
        if not terminal or not terminal.connected:
            raise RuntimeError("MT5 terminal is not connected to a broker")
        symbol = str(payload["symbol"]).upper()
        if not mt5.symbol_select(symbol, True):
            raise RuntimeError(f"symbol_select failed for {symbol}")
        tick = mt5.symbol_info_tick(symbol)
        if not tick:
            raise RuntimeError(f"no tick for {symbol}")
        pnl = daily_realized_pnl(mt5)
        if pnl <= -MAX_DAILY_LOSS:
            raise RuntimeError(f"daily loss limit hit: {pnl:.2f}")

        side = str(payload["side"]).upper()
        is_buy = side == "BUY"
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": float(payload["volume"]),
            "type": mt5.ORDER_TYPE_BUY if is_buy else mt5.ORDER_TYPE_SELL,
            "price": float(tick.ask if is_buy else tick.bid),
            "deviation": DEVIATION,
            "magic": MAGIC,
            "comment": "Trading Brain bridge",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": getattr(mt5, "ORDER_FILLING_IOC", mt5.ORDER_FILLING_FOK),
        }
        if payload.get("sl"):
            request["sl"] = float(payload["sl"])
        if payload.get("tp"):
            request["tp"] = float(payload["tp"])
        result = mt5.order_send(request)
        if result is None:
            raise RuntimeError(f"order_send returned None: {mt5.last_error()}")
        return {
            "ok": result.retcode in (mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_PLACED),
            "dry_run": False,
            "retcode": result.retcode,
            "order": getattr(result, "order", None),
            "deal": getattr(result, "deal", None),
            "message": str(result.comment),
        }
    finally:
        mt5.shutdown()


class Handler(BaseHTTPRequestHandler):
    server_version = "TradingBrainBridge/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        log(f"{self.address_string()} {fmt % args}")

    def _send(self, status: int, body: dict[str, Any]) -> None:
        raw = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Bridge-Token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 16_384:
            raise ValueError("empty or oversized request")
        data = json.loads(self.rfile.read(length).decode("utf-8"))
        if not isinstance(data, dict):
            raise ValueError("expected a JSON object")
        return data

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send(200, {"ok": True})

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/status":
            self._send(200, {
                "ok": True,
                "service": "trading-brain-mt5-bridge",
                "time": datetime.now().isoformat(timespec="seconds"),
                "dry_run": DRY_RUN,
                "auto_trade": AUTO_TRADE,
                "real_trade_acknowledged": ACK_REAL,
                "token_required": bool(TOKEN),
                "kill_switch": kill_switch_active(),
                "max_volume": MAX_VOLUME,
                "allowed_symbols": sorted(ALLOWED_SYMBOLS),
            })
        else:
            self._send(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        try:
            payload = self._read_json()
            if not authorized(str(payload.get("token", self.headers.get("X-Bridge-Token", "")))):
                self._send(401, {"ok": False, "error": "invalid bridge token"})
                return

            if path == "/kill":
                KILL_SWITCH.parent.mkdir(parents=True, exist_ok=True)
                KILL_SWITCH.write_text("paused\n", encoding="utf-8")
                log("KILL SWITCH ACTIVATED")
                self._send(200, {"ok": True, "kill_switch": True})
                return

            if path == "/unkill":
                KILL_SWITCH.unlink(missing_ok=True)
                log("kill switch cleared")
                self._send(200, {"ok": True, "kill_switch": False})
                return

            if path != "/order":
                self._send(404, {"ok": False, "error": "not found"})
                return

            error = validate_order(payload)
            if error:
                log(f"REJECTED {error}")
                self._send(400, {"ok": False, "error": error})
                return

            event_id = str(payload.get("event_id", ""))
            if duplicate_event(event_id):
                log(f"DUPLICATE ignored {event_id}")
                self._send(200, {"ok": True, "ignored": True, "message": "duplicate event"})
                return

            log(f"ORDER {payload.get('side')} {payload.get('volume')} {payload.get('symbol')} "
                f"source={payload.get('source', 'unknown')} dry_run={DRY_RUN}")
            result = execute_order(payload)
            self._send(200 if result.get("ok") else 502, result)
        except (ValueError, json.JSONDecodeError) as exc:
            self._send(400, {"ok": False, "error": str(exc)})
        except Exception as exc:  # noqa: BLE001 - surface all bridge failures to the caller
            log(f"ERROR {exc}")
            self._send(500, {"ok": False, "error": str(exc)})


def main() -> None:
    if not TOKEN:
        log("WARNING: TB_BRIDGE_TOKEN is empty — all order requests will be rejected")
    KILL_SWITCH.parent.mkdir(parents=True, exist_ok=True)
    log(f"listening on http://{HOST}:{PORT}  dry_run={DRY_RUN} auto_trade={AUTO_TRADE}")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("stopped")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
