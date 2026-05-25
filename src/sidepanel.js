(function () {
  'use strict';

  const inputEl = document.getElementById('cj-input');
  const resultsEl = document.getElementById('cj-results');
  const emptyEl = document.getElementById('cj-empty');

  let lastPendingTs = 0;

  function render(text) {
    const html = CangjieCore.renderRowsHtml(text || '');
    resultsEl.innerHTML = html;
    emptyEl.style.display = html ? 'none' : '';
  }

  function applyText(text) {
    inputEl.value = text;
    render(text);
    inputEl.focus();
  }

  inputEl.addEventListener('input', () => {
    render(inputEl.value);
  });

  (async () => {
    try {
      await CangjieCore.loadDict();
    } catch (err) {
      resultsEl.innerHTML = '<div class="cj-error">字典載入失敗</div>';
      return;
    }

    const stored = await chrome.storage.session.get('pendingQuery');
    const pending = stored.pendingQuery;
    if (pending && pending.text) {
      lastPendingTs = pending.ts || 0;
      applyText(pending.text);
      chrome.storage.session.remove('pendingQuery');
    } else {
      render('');
    }
  })();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'session') return;
    const change = changes.pendingQuery;
    if (!change || !change.newValue) return;
    const { text, ts } = change.newValue;
    if (!text || ts === lastPendingTs) return;
    lastPendingTs = ts;
    applyText(text);
    chrome.storage.session.remove('pendingQuery');
  });
})();
