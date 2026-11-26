# ClickCopy Paste

A small Manifest V3 Chrome extension for faster text entry:

- **Double-click** selected text to copy it to the system clipboard.
- **Middle-click (mouse wheel)** inside a text field to paste at the cursor.
- **Triple-click** inside a text field also pastes at the cursor.
- Turn either gesture on or off from the extension popup.

## Install in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this repository folder.
4. Pin **ClickCopy Paste** from the Extensions menu if you want quick access to the settings.

Clipboard gestures work on regular web pages, not Chrome's built-in pages (such as `chrome://extensions`, the Chrome Web Store, or the address bar). Pasting is limited to editable text fields. Sites that use unusual/custom editor surfaces may not support programmatic text insertion. Chrome may require clipboard access to be allowed for the page.

The extension reads clipboard text only after a paste gesture and does not send clipboard contents anywhere.

---

## Trading Brain — Indicator Vault, Chrome bridge and MT5 bridge

This branch now also stages three additional builds:

- `trading-brain-vault/` — a professional **Indicator Vault** page designed to be dropped into the
  `phiwepay-lgtm/trading-brain-vercel` Next.js site. Open `trading-brain-vault/preview.html` for a visual
  preview, then follow `trading-brain-vault/README.md` to integrate it into the real site.
- `extension-trade-bridge/` — a Manifest V3 Chrome extension that reads `TBSIG` signals from the Exness
  Web Terminal and forwards them to a local bridge. See `extension-trade-bridge/README.md`.
- `mt5-bridge/` — a localhost-only Python service that validates those requests and forwards them to a
  logged-in MetaTrader 5 desktop terminal. See `mt5-bridge/README.md`.

### Important safety notes

The MT5 bridge is **dry-run by default**. Real order execution requires all of
`TB_AUTO_TRADE=1`, `TB_DRY_RUN=0` and `TB_ACKNOWLEDGE_REAL=1`, a bridge token, a symbol allowlist and a
volume cap. A kill switch can block all orders immediately. The indicator is a research draft, not a
verified strategy, and nothing here is financial advice. Test on a demo account before considering live use.
