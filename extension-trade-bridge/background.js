const DEFAULTS = {
  enabled: false,
  bridgeUrl: 'http://127.0.0.1:8765',
  token: '',
  maxVolume: 0.1,
  allowedSymbols: 'XAUUSD,EURUSD',
};

let settings = { ...DEFAULTS };

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULTS, (saved) => {
    settings = { ...DEFAULTS, ...saved };
    chrome.storage.sync.set(settings);
  });
});

chrome.storage.sync.get(DEFAULTS, (saved) => {
  settings = { ...DEFAULTS, ...saved };
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  for (const key of Object.keys(DEFAULTS)) {
    if (changes[key]) settings[key] = changes[key].newValue;
  }
});

function parseSignal(text) {
  const match = /TBSIG\|(BUY|SELL)\|([A-Za-z0-9._]{1,32})\|([0-9]*\.?[0-9]+)/i.exec(String(text || ''));
  if (!match) return null;
  const volume = Number(match[3]);
  if (!Number.isFinite(volume) || volume <= 0) return null;
  return { side: match[1].toUpperCase(), symbol: match[2].toUpperCase(), volume };
}

function eventId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function post(path, body) {
  const url = `${String(settings.bridgeUrl).replace(/\/$/, '')}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bridge-Token': settings.token },
    body: JSON.stringify({ ...body, token: settings.token }),
  });
  const data = await response.json().catch(() => ({ ok: false, error: 'Bridge returned non-JSON response' }));
  return { httpStatus: response.status, ...data };
}

async function sendSignal(raw) {
  const signal = parseSignal(raw);
  if (!signal) return { ok: false, error: 'Not a valid TBSIG token' };
  if (!settings.enabled) return { ok: false, error: 'Bridge is disabled in the extension popup' };

  const allowed = String(settings.allowedSymbols || '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  if (allowed.length && !allowed.includes(signal.symbol)) {
    return { ok: false, error: `${signal.symbol} is not in your allowed symbols` };
  }
  if (signal.volume > Number(settings.maxVolume)) {
    return { ok: false, error: `Volume ${signal.volume} exceeds popup cap ${settings.maxVolume}` };
  }

  const result = await post('/order', {
    ...signal,
    event_id: eventId(),
    sl: 0,
    tp: 0,
    source: 'TBSIG',
  });

  const title = result.ok ? 'Trading Brain order sent' : 'Trading Brain order blocked';
  const message = result.dry_run
    ? 'Bridge validated the signal in DRY-RUN mode. No real order was sent.'
    : result.ok
      ? `${signal.side} ${signal.volume} ${signal.symbol} accepted by MT5.`
      : String(result.error || result.message || 'Bridge rejected the order.');
  chrome.notifications.create({ type: 'basic', iconUrl: 'icon.png', title, message });

  return result;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = message && message.type;

  if (type === 'TBSIG_SIGNAL' || type === 'MANUAL_SIGNAL') {
    sendSignal(message.text).then(sendResponse).catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }

  if (type === 'GET_STATUS') {
    fetch(`${String(settings.bridgeUrl).replace(/\/$/, '')}/status`)
      .then((response) => response.json())
      .then((data) => sendResponse({ ok: true, status: data }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (type === 'GET_SETTINGS') {
    sendResponse(settings);
    return false;
  }

  if (type === 'SAVE_SETTINGS') {
    settings = { ...settings, ...message.settings };
    chrome.storage.sync.set(settings, () => sendResponse({ ok: true }));
    return true;
  }

  if (type === 'KILL' || type === 'UNKILL') {
    post(type === 'KILL' ? '/kill' : '/unkill', {})
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});
