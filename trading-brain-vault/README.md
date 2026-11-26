# Trading Brain — Indicator Vault (drop-in page)

This folder contains a professional **Indicator Vault** page designed to be copied into your existing
[`trading-brain-vercel`](https://github.com/phiwepay-lgtm/trading-brain-vercel) Next.js site. It matches the
site's current dark green/serif design and adds a searchable library of indicator downloads.

This Arena session is locked to the `chrome-extensions` repository, so the files are staged here rather than
pushed directly into `trading-brain-vercel`. See **Integration** below.

## Files

| File | Copy to in `trading-brain-vercel` |
| --- | --- |
| `app/indicators/page.tsx` | `app/indicators/page.tsx` |
| `app/indicators/indicator-vault.tsx` | `app/indicators/indicator-vault.tsx` |
| `app/globals.css.append` | append its contents to `app/globals.css` |
| `public/ea/Heikin_Ashi_Overlay.indie.txt` | `public/ea/Heikin_Ashi_Overlay.indie.txt` |
| `README.md` (this file) | optional — keep as documentation |

## Integration

1. Clone/copy the `trading-brain-vercel` repo locally.
2. Copy the files using the table above. Do **not** overwrite existing files — append the CSS.
3. Add a link to `/indicators` in `app/ea/download-center.tsx` (or whichever navigation you use):

   ```tsx
   <Link className="button secondary" href="/indicators">Open Indicator Vault</Link>
   ```

4. Run `npm ci && npm run dev`, then open `http://localhost:3000/indicators`.
5. Check `npm run typecheck` and `npm run build` before committing.

## Indicator protocol (TBSIG)

The Heikin Ashi Overlay can optionally emit machine-readable markers on confirmed candle closes:

```
TBSIG|BUY|SYMBOL|VOLUME
TBSIG|SELL|SYMBOL|VOLUME
```

Example: `TBSIG|BUY|XAUUSD|0.01`

The Chrome extension in `../extension-trade-bridge/` reads those markers (or a pasted token) and forwards
them to the local MT5 bridge in `../mt5-bridge/`.

> **Risk warning:** auto-execution on a real MT5 account can lose money. The bridge is dry-run by default
> and requires multiple explicit environment flags before a real order can be sent. Read its README first.
