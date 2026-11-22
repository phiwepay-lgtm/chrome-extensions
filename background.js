const DEFAULTS = {
  copyEnabled: true,
  pasteEnabled: true
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULTS, (settings) => {
    chrome.storage.sync.set(settings);
  });
});
