(() => {
  const PATTERN = /TBSIG\|(BUY|SELL)\|([A-Za-z0-9._]{1,32})\|([0-9]*\.?[0-9]+)/gi;
  const seen = new Set();
  const MAX_SEEN = 200;

  function handle(raw) {
    const text = String(raw || '');
    const matches = text.match(PATTERN);
    if (!matches) return;
    for (const token of matches) {
      if (seen.has(token)) continue;
      seen.add(token);
      if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value);
      chrome.runtime.sendMessage({ type: 'TBSIG_SIGNAL', text: token }).catch(() => {});
    }
  }

  // Some Indie editors render marker labels as DOM text inside the object tree.
  function scanDom() {
    if (!document.body) return;
    handle(document.body.innerText || '');
    for (const node of document.querySelectorAll('[title], [aria-label], [data-tooltip]')) {
      handle(node.getAttribute('title'));
      handle(node.getAttribute('aria-label'));
      handle(node.getAttribute('data-tooltip'));
    }
  }

  // Integration path for future Exness/TakeProfit hooks: any page script can
  // post { type: 'TBSIG', text: 'TBSIG|BUY|XAUUSD|0.01' } to window.
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'TBSIG') handle(event.data.text);
  });
  window.addEventListener('tradingbrain:tbsig', (event) => handle(event.detail));

  scanDom();
  window.setInterval(scanDom, 2000);
})();
