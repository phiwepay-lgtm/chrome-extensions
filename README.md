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
