const DEFAULTS = {
  enabled: false,
  bridgeUrl: 'http://127.0.0.1:8765',
  token: '',
  maxVolume: 0.1,
  allowedSymbols: 'XAUUSD,EURUSD',
};

const $ = (id) => document.getElementById(id);
const log = (text) => { $('log').textContent = text; };

function currentSettings() {
  return {
    enabled: $('enabled').checked,
    bridgeUrl: $('bridge-url').value.trim() || DEFAULTS.bridgeUrl,
    token: $('token').value,
    maxVolume: Number($('max-volume').value) || DEFAULTS.maxVolume,
    allowedSymbols: $('symbols').value.trim(),
  };
}

chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (settings) => {
  const values = { ...DEFAULTS, ...settings };
  $('enabled').checked = Boolean(values.enabled);
  $('bridge-url').value = values.bridgeUrl;
  $('token').value = values.token || '';
  $('max-volume').value = values.maxVolume;
  $('symbols').value = values.allowedSymbols;
  checkStatus();
});

function checkStatus() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    const dot = $('status-dot');
    if (response && response.ok && response.status) {
      dot.classList.add('online');
      const s = response.status;
      log(`Bridge online · dry_run=${s.dry_run} · auto_trade=${s.auto_trade} · kill_switch=${s.kill_switch}\nSymbols: ${(s.allowed_symbols || []).join(', ') || 'any'}`);
    } else {
      dot.classList.remove('online');
      log(`Bridge unreachable. Start mt5-bridge/bridge.py first. ${response?.error || ''}`);
    }
  });
}

$('save').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: currentSettings() }, () => {
    log('Settings saved.');
    checkStatus();
  });
});

$('refresh').addEventListener('click', checkStatus);

$('send').addEventListener('click', () => {
  const text = $('manual').value.trim();
  if (!text) { log('Enter a TBSIG token first.'); return; }
  log('Sending…');
  chrome.runtime.sendMessage({ type: 'MANUAL_SIGNAL', text }, (response) => {
    if (!response) { log('No response from background script.'); return; }
    log(JSON.stringify(response, null, 2));
  });
});

$('kill').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'KILL' }, (response) => {
    log(response?.ok ? 'Kill switch ON — all orders blocked.' : `Kill failed: ${response?.error || 'unknown'}`);
    checkStatus();
  });
});

$('unkill').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'UNKILL' }, (response) => {
    log(response?.ok ? 'Kill switch cleared.' : `Clear failed: ${response?.error || 'unknown'}`);
    checkStatus();
  });
});
