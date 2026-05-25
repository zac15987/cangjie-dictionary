(function () {
  'use strict';

  const RADICAL_MAP = {
    a: '日', b: '月', c: '金', d: '木', e: '水', f: '火', g: '土',
    h: '竹', i: '戈', j: '十', k: '大', l: '中', m: '一', n: '弓',
    o: '人', p: '心', q: '手', r: '口', s: '尸', t: '廿',
    u: '山', v: '女', w: '田', x: '難', y: '卜'
  };

  const HAN_RE = /\p{Script=Han}/u;
  const MAX_SELECTION_LENGTH = 200;

  let dict = null;
  let dictLoading = null;

  function loadDict() {
    if (dict) return Promise.resolve(dict);
    if (dictLoading) return dictLoading;
    dictLoading = (async () => {
      const url = chrome.runtime.getURL('data/cangjie5.json');
      const res = await fetch(url);
      const obj = await res.json();
      dict = new Map(Object.entries(obj));
      return dict;
    })();
    return dictLoading;
  }

  function hasCJK(text) {
    if (!text || text.length > MAX_SELECTION_LENGTH) return false;
    return HAN_RE.test(text);
  }

  function decompose(char) {
    if (!dict) return null;
    const code = dict.get(char);
    if (!code) return null;
    const upper = code.toUpperCase();
    const roots = [...code].map((c) => RADICAL_MAP[c] || '?').join('');
    return { code: upper, roots };
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function uniqueHanChars(text) {
    const chars = [...text].filter((c) => HAN_RE.test(c));
    const seen = new Set();
    return chars.filter((c) => {
      if (seen.has(c)) return false;
      seen.add(c);
      return true;
    });
  }

  function renderRowsHtml(text) {
    const unique = uniqueHanChars(text);
    if (unique.length === 0) return '';

    let html = '';
    for (const ch of unique) {
      const parts = decompose(ch);
      if (parts) {
        html += `<div class="cj-row">
          <span class="cj-char">${escapeHtml(ch)}</span>
          <span class="cj-code">${escapeHtml(parts.code)}</span>
          <span class="cj-roots">${escapeHtml(parts.roots)}</span>
        </div>`;
      } else {
        html += `<div class="cj-row">
          <span class="cj-char">${escapeHtml(ch)}</span>
          <span class="cj-missing">無倉頡碼</span>
        </div>`;
      }
    }
    return html;
  }

  globalThis.CangjieCore = {
    RADICAL_MAP,
    HAN_RE,
    MAX_SELECTION_LENGTH,
    loadDict,
    hasCJK,
    decompose,
    renderRowsHtml,
    uniqueHanChars,
    escapeHtml,
    isDictReady: () => dict !== null
  };
})();
