# Trading Brain — Trade Bridge Chrome extension (MV3)

Reads `TBSIG` signals from the Exness Web Terminal and forwards them to the local MT5 bridge in
`../mt5-bridge/`. It does **not** connect to your broker directly and does not store broker credentials.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `extension-trade-bridge` folder.
4. Pin **Trading Brain Trade Bridge** from the extensions menu.

## Configure

1. Start `mt5-bridge/bridge.py` on the same Windows machine (see its README).
2. Open the extension popup and set:
   - **Bridge URL**: `http://127.0.0.1:8765`
   - **Bridge token**: the same value as `TB_BRIDGE_TOKEN`
   - **Max volume**: hard cap, e.g. `0.1`
   - **Allowed symbols**: e.g. `XAUUSD,EURUSD`
3. Click **Save settings**, then **Check bridge status**. The green dot means the bridge is reachable.
4. Leave **Auto-send enabled** OFF until you have verified dry-run behaviour.

## Signal sources

The extension accepts a signal in three ways:

1. **DOM scan of the Exness page** for text such as `TBSIG|BUY|XAUUSD|0.01` (object tree / tooltips).
2. **`window.postMessage`**: `window.postMessage({ type: 'TBSIG', text: 'TBSIG|BUY|XAUUSD|0.01' }, '*')`.
3. **Manual field** in the popup — paste the token and click **Send signal**.

Because Indie marker labels may render on a canvas, option 3 is the reliable fallback. The extension
deduplicates identical tokens so one marker is not sent repeatedly.

## Safety

| Layer | Where | Effect |
| --- | --- | --- |
| Auto-send toggle | Extension popup | No order leaves the browser while OFF. |
| Symbol allowlist | Extension + bridge | Both must accept the symbol. |
| Max volume | Extension + bridge | Both caps are enforced. |
| Shared token | Bridge | State-changing requests are rejected without it. |
| Dry-run | Bridge | Validates and logs but sends nothing by default. |
| Kill switch | Popup / bridge | Blocks all orders immediately. |
| Daily loss limit | Bridge | Stops new orders after the configured loss. |

The token never comes from the chart and is never written to the page. It stays in `chrome.storage.sync`
and in the localhost request body.

## Limitations

* This is not financial advice and the signal is not a verified strategy.
* The bridge must keep running while MT5 is open. If the PC sleeps, signals are not queued.
* Chrome may block localhost fetches if you change the bridge URL. Keep `http://127.0.0.1:8765` or add the
  new origin to `host_permissions` in `manifest.json` and reload the extension.
* Exness domain match patterns cover common regions. Add your exact terminal domain if yours is missing.
