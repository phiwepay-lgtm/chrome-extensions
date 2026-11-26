# Trading Brain → MT5 local bridge

Small localhost-only HTTP service that receives `TBSIG` orders from the Trading Brain Chrome extension and
sends them to an **already logged-in MetaTrader 5 desktop terminal** using the official `MetaTrader5`
Python package.

> **REAL MONEY WARNING:** this can place real market orders. It is dry-run by default. Do not enable live
> trading until you have tested the whole chain on a demo account and read every guardrail below.

## What it will not do

* It does not store your MT5 password or broker credentials. MT5 must already be open and logged in.
* It does not bind to a network interface — only `127.0.0.1`.
* It does not send order requests without a shared token.
* It does not bypass broker/server-side checks (stop levels, margin, symbol trading status).

## Install (Windows, PowerShell)

```powershell
cd C:\path\to\chrome-extensions\mt5-bridge
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Make sure the MT5 desktop terminal is open and logged into the account you want to use.

## Dry-run first

```powershell
$env:TB_BRIDGE_TOKEN = "change-me-to-a-long-random-value"
$env:TB_ALLOWED_SYMBOLS = "XAUUSD,EURUSD"
$env:TB_MAX_VOLUME = "0.10"
python bridge.py
```

Check it from another PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:8765/status
```

Send a test order that will be validated but **not** executed:

```powershell
$body = @{
  token = "change-me-to-a-long-random-value"
  event_id = "test-001"
  symbol = "XAUUSD"
  side = "BUY"
  volume = 0.01
  source = "manual-test"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8765/order -Body $body -ContentType "application/json"
```

The response should contain `"dry_run": true`. Verify the terminal log line shows your symbol and volume.

## Enable real execution (only after demo testing)

All three flags must be set, in addition to a valid token:

```powershell
$env:TB_AUTO_TRADE = "1"
$env:TB_DRY_RUN = "0"
$env:TB_ACKNOWLEDGE_REAL = "1"
```

Additional limits:

| Variable | Default | Meaning |
| --- | --- | --- |
| `TB_ALLOWED_SYMBOLS` | empty (allow any) | Comma-separated symbol allowlist. Set this. |
| `TB_MAX_VOLUME` | `0.10` | Hard volume cap per order. |
| `TB_MAX_DAILY_LOSS` | `50` | Blocks new orders once today's realized PnL is at or below `-50`. |
| `TB_DEVIATION` | `20` | Maximum price deviation in points. |
| `TB_MAGIC` | `20261126` | Magic number for bridge orders. |
| `TB_PORT` | `8765` | Local port. |
| `TB_KILL_SWITCH` | `~/.tradingbrain/KILL` | File that, when present, blocks all orders. |

Restart the bridge after changing environment variables.

## Emergency stop

From the extension popup, or directly:

```powershell
$body = @{ token = "change-me-to-a-long-random-value" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8765/kill -Body $body -ContentType "application/json"
```

Clear it with `/unkill` using the same body. The popup has buttons for both.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/status` | Config summary (never returns the token). |
| `POST` | `/order` | Validate and optionally send an order. |
| `POST` | `/kill` | Create the kill-switch file. |
| `POST` | `/unkill` | Remove the kill-switch file. |

`/order` body:

```json
{
  "token": "same-token",
  "event_id": "unique-id",
  "symbol": "XAUUSD",
  "side": "BUY",
  "volume": 0.01,
  "sl": 0,
  "tp": 0,
  "source": "TBSIG"
}
```

## TBSIG protocol

The Indie indicator prints markers like `TBSIG|BUY|XAUUSD|0.01` on confirmed candle closes. The Chrome
extension parses them and fills `symbol`, `side` and `volume`. The extension **never** fills `token` from
the chart — the token stays in extension storage.

## Known limitations

* The indicator signal is a plain Heikin Ashi colour flip. It is not a tested strategy.
* Exness may render Indie marker text on a canvas, where DOM scraping cannot see it. The popup has a
  **Manual signal** field as a reliable fallback; you can paste the `TBSIG|...` token there.
* Market orders use `ORDER_FILLING_IOC` where supported, otherwise `FOK`. Some brokers reject one of these;
  check the bridge log and adjust `TB_DEVIATION` or the filling mode if needed.
* No position sizing, no trailing stop, no partial exits, no strategy backtest and no profit guarantee.
