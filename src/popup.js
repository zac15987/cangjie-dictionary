(function () {
  'use strict';

  const inputEl = document.getElementById('cj-input');
  const resultsEl = document.getElementById('cj-results');
  const openBtn = document.getElementById('cj-open-sidepanel');

  CangjieCore.initTheme(document.documentElement);

  function render(text) {
    resultsEl.innerHTML = CangjieCore.renderRowsHtml(text || '');
  }

  inputEl.addEventListener('input', () => {
    render(inputEl.value);
  });

  openBtn.addEventListener('click', async () => {
    const text = inputEl.value.trim();
    try {
      if (text) {
        await chrome.storage.session.set({
          pendingQuery: { text, ts: Date.now() }
        });
      }
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id !== undefined) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
      window.close();
    } catch (err) {
      console.error('[cangjie] open side panel failed', err);
    }
  });

  (async () => {
    try {
      await CangjieCore.loadDict();
    } catch (err) {
      resultsEl.innerHTML = '<div class="cj-error">字典載入失敗</div>';
      return;
    }
    inputEl.focus();
  })();
})();
