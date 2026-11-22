(() => {
  const DEFAULTS = { copyEnabled: true, pasteEnabled: true };
  let settings = { ...DEFAULTS };
  let lastToast;

  chrome.storage.sync.get(DEFAULTS, (saved) => {
    settings = { ...DEFAULTS, ...saved };
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const key of Object.keys(DEFAULTS)) {
      if (changes[key]) settings[key] = changes[key].newValue;
    }
  });

  function isEditable(element) {
    if (!(element instanceof Element)) return false;
    const editable = element.closest('input, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"]');
    if (!editable || editable.isContentEditable === false || editable.disabled || editable.readOnly) return false;
    if (editable instanceof HTMLInputElement) {
      return /^(text|search|url|tel|email|password)$/i.test(editable.type);
    }
    return true;
  }

  function showToast(message, isError = false, anchorRect = null) {
    if (!document.documentElement) return;
    if (lastToast) lastToast.remove();

    const toast = document.createElement('div');
    toast.textContent = message;
    toast.setAttribute('role', 'status');
    toast.style.cssText = [
      'position:fixed', 'z-index:2147483647', 'left:0', 'top:0',
      'padding:9px 12px', 'border-radius:9px', 'font:500 12px/1.3 system-ui,sans-serif',
      'letter-spacing:.01em', 'color:#fff', `background:${isError ? '#b42318' : '#172554'}`,
      'box-shadow:0 6px 20px rgba(15,23,42,.22)', 'pointer-events:none',
      'opacity:0', 'transform:translateY(4px)', 'transition:opacity .16s ease,transform .16s ease'
    ].join(';');
    document.documentElement.appendChild(toast);
    lastToast = toast;

    const width = toast.getBoundingClientRect().width;
    const height = toast.getBoundingClientRect().height;
    let left = window.innerWidth - width - 16;
    let top = window.innerHeight - height - 16;
    if (anchorRect) {
      left = anchorRect.right + 8;
      if (left + width > window.innerWidth - 8) left = anchorRect.left - width - 8;
      top = anchorRect.top + (anchorRect.height - height) / 2;
    }
    toast.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`;
    toast.style.top = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`;

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(4px)';
      window.setTimeout(() => toast.remove(), 180);
    }, 1400);
  }

  async function copySelection() {
    const selection = window.getSelection();
    const selectedText = selection?.toString();
    if (!selectedText) return;
    const rangeRect = selection.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : null;
    const anchorRect = rangeRect ? {
      left: rangeRect.left,
      right: rangeRect.right,
      top: rangeRect.top,
      height: rangeRect.height
    } : null;

    try {
      await navigator.clipboard.writeText(selectedText);
      showToast('Copied to clipboard', false, anchorRect);
    } catch {
      // Fallback for pages where the async Clipboard API is unavailable.
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      const helper = document.createElement('textarea');
      helper.value = selectedText;
      helper.setAttribute('readonly', '');
      helper.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(helper);
      helper.select();
      const copied = document.execCommand('copy');
      helper.remove();
      if (range && selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      showToast(copied ? 'Copied to clipboard' : 'Could not access clipboard', !copied, anchorRect);
    }
  }

  function fireInputEvent(element, inputType = 'insertFromPaste') {
    let event;
    try {
      event = new InputEvent('input', { bubbles: true, inputType, data: null });
    } catch {
      event = new Event('input', { bubbles: true });
    }
    element.dispatchEvent(event);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function insertIntoControl(element, text) {
    element.focus();
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    const value = element.value;
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

    if (setter) setter.call(element, value.slice(0, start) + text + value.slice(end));
    else element.value = value.slice(0, start) + text + value.slice(end);
    const caret = start + text.length;
    element.setSelectionRange(caret, caret);
    fireInputEvent(element);
  }

  function insertIntoEditable(element, text) {
    element.focus();
    // insertText respects the current selection and is the closest equivalent to a native paste.
    if (document.execCommand('insertText', false, text)) return;

    const selection = window.getSelection();
    if (!selection) return;
    const range = selection.rangeCount ? selection.getRangeAt(0) : document.createRange();
    if (!selection.rangeCount) {
      range.selectNodeContents(element);
      range.collapse(false);
    }
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    fireInputEvent(element);
  }

  async function pasteInto(element) {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        showToast('Clipboard is empty');
        return;
      }
      // The target could disappear or lose editability while clipboard access is pending.
      if (!element.isConnected || !isEditable(element)) return;
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        insertIntoControl(element, text);
      } else {
        insertIntoEditable(element, text);
      }
      showToast('Pasted from clipboard');
    } catch {
      showToast('Clipboard access was blocked', true);
    }
  }

  document.addEventListener('dblclick', (event) => {
    if (!settings.copyEnabled || event.button !== 0) return;
    void copySelection();
  }, true);

  document.addEventListener('click', (event) => {
    if (!settings.pasteEnabled || !isEditable(event.target)) return;
    if (event.button === 1) {
      event.preventDefault();
      event.stopPropagation();
      void pasteInto(event.target.closest('input, textarea, [contenteditable], [role="textbox"]'));
    } else if (event.button === 0 && event.detail >= 3) {
      event.preventDefault();
      event.stopPropagation();
      void pasteInto(event.target.closest('input, textarea, [contenteditable], [role="textbox"]'));
    }
  }, true);
})();
