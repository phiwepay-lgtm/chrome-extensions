const defaults = { copyEnabled: true, pasteEnabled: true };
const copyToggle = document.querySelector('#copy-toggle');
const pasteToggle = document.querySelector('#paste-toggle');

chrome.storage.sync.get(defaults, (settings) => {
  copyToggle.checked = settings.copyEnabled;
  pasteToggle.checked = settings.pasteEnabled;
});

copyToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ copyEnabled: copyToggle.checked });
});

pasteToggle.addEventListener('change', () => {
  chrome.storage.sync.set({ pasteEnabled: pasteToggle.checked });
});
