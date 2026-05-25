(function () {
  'use strict';

  const HOST_ID = 'cangjie-dictionary-host';

  let currentSelection = '';

  // === SHADOW DOM SETUP ===
  const host = document.createElement('div');
  host.id = HOST_ID;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    #cj-root[data-theme="light"] {
      --cj-bg: #fff;
      --cj-text: #222;
      --cj-text-dim: #555;
      --cj-text-faint: #999;
      --cj-border: #e0e0e0;
      --cj-border-footer: #eee;
      --cj-border-soft: #f5f5f5;
      --cj-accent: #4285f4;
      --cj-accent-hover: #3367d6;
      --cj-error: #d93025;
      --cj-missing: #bbb;
      --cj-shadow: rgba(0, 0, 0, 0.15);
      --cj-icon-shadow: rgba(0, 0, 0, 0.3);
    }
    #cj-root[data-theme="dark"] {
      --cj-bg: #2a2a2a;
      --cj-text: #e8e8e8;
      --cj-text-dim: #a8a8a8;
      --cj-text-faint: #777;
      --cj-border: #3a3a3a;
      --cj-border-footer: #3a3a3a;
      --cj-border-soft: #333;
      --cj-accent: #8ab4f8;
      --cj-accent-hover: #a8c7fa;
      --cj-error: #f28b82;
      --cj-missing: #666;
      --cj-shadow: rgba(0, 0, 0, 0.6);
      --cj-icon-shadow: rgba(0, 0, 0, 0.7);
    }

    #cj-icon {
      position: fixed;
      display: none;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #4285f4;
      color: white;
      font-size: 14px;
      font-weight: bold;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px var(--cj-icon-shadow);
      pointer-events: auto;
      transition: transform 0.1s ease;
      font-family: 'Microsoft JhengHei', 'Microsoft YaHei', 'PingFang TC', sans-serif;
      user-select: none;
      line-height: 28px;
      text-align: center;
    }
    #cj-icon:hover {
      transform: scale(1.1);
      background: #3367d6;
    }

    #cj-popup {
      position: fixed;
      display: none;
      background: var(--cj-bg);
      border: 1px solid var(--cj-border);
      border-radius: 8px;
      box-shadow: 0 4px 16px var(--cj-shadow);
      padding: 12px 16px;
      min-width: 200px;
      max-width: 420px;
      max-height: 60vh;
      overflow-y: auto;
      pointer-events: auto;
      font-family: 'Microsoft JhengHei', 'Microsoft YaHei', 'PingFang TC', -apple-system, sans-serif;
    }

    .cj-row {
      display: grid;
      grid-template-columns: auto auto 1fr;
      column-gap: 14px;
      align-items: baseline;
      padding: 5px 0;
    }
    .cj-row + .cj-row {
      border-top: 1px solid var(--cj-border-soft);
    }
    .cj-char {
      font-size: 22px;
      color: var(--cj-text);
      line-height: 1.2;
      font-family: 'Microsoft JhengHei', 'PingFang TC', serif;
    }
    .cj-code {
      font-size: 16px;
      color: var(--cj-accent);
      font-weight: bold;
      letter-spacing: 2px;
      font-family: 'Consolas', 'Menlo', monospace;
    }
    .cj-roots {
      font-size: 17px;
      color: var(--cj-text-dim);
      letter-spacing: 4px;
    }
    .cj-missing {
      font-size: 14px;
      color: var(--cj-missing);
      grid-column: 2 / span 2;
    }

    .cj-loading, .cj-error {
      font-size: 13px;
      color: var(--cj-text-faint);
    }
    .cj-error { color: var(--cj-error); }

    #cj-popup-footer {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid var(--cj-border-footer);
      display: flex;
      justify-content: flex-end;
    }
    #cj-open-sidepanel {
      background: none;
      border: none;
      color: var(--cj-accent);
      font-size: 12px;
      cursor: pointer;
      padding: 2px 4px;
      font-family: inherit;
    }
    #cj-open-sidepanel:hover {
      text-decoration: underline;
    }
  `;
  shadow.appendChild(style);

  const rootEl = document.createElement('div');
  rootEl.id = 'cj-root';
  rootEl.setAttribute('data-theme', 'light');
  shadow.appendChild(rootEl);

  const iconEl = document.createElement('div');
  iconEl.id = 'cj-icon';
  iconEl.textContent = '倉';
  iconEl.title = '顯示倉頡碼分解';
  rootEl.appendChild(iconEl);

  const popupEl = document.createElement('div');
  popupEl.id = 'cj-popup';
  rootEl.appendChild(popupEl);

  const popupContentEl = document.createElement('div');
  popupContentEl.id = 'cj-popup-content';
  popupEl.appendChild(popupContentEl);

  const popupFooterEl = document.createElement('div');
  popupFooterEl.id = 'cj-popup-footer';
  const openSidePanelBtn = document.createElement('button');
  openSidePanelBtn.id = 'cj-open-sidepanel';
  openSidePanelBtn.type = 'button';
  openSidePanelBtn.textContent = '在側邊欄開啟 →';
  popupFooterEl.appendChild(openSidePanelBtn);
  popupEl.appendChild(popupFooterEl);

  // Kick off dict load eagerly so first click is instant.
  CangjieCore.loadDict().catch(() => { /* will retry on click */ });
  CangjieCore.initTheme(rootEl);

  // === UI FUNCTIONS ===

  function showIcon(rect, text) {
    currentSelection = text;

    let left = rect.right + 4;
    let top = rect.bottom + 4;

    if (left + 32 > window.innerWidth) {
      left = rect.left - 32;
    }
    if (top + 32 > window.innerHeight) {
      top = rect.top - 32;
    }

    iconEl.style.left = `${left}px`;
    iconEl.style.top = `${top}px`;
    iconEl.style.display = 'flex';
  }

  function hideIcon() {
    iconEl.style.display = 'none';
  }

  function hidePopup() {
    popupEl.style.display = 'none';
    popupContentEl.innerHTML = '';
  }

  function hideAll() {
    hideIcon();
    hidePopup();
  }

  function showLoading() {
    popupContentEl.innerHTML = '<div class="cj-loading">載入字典中...</div>';
    popupEl.style.display = 'block';
    positionPopup();
  }

  function showError(message) {
    popupContentEl.innerHTML = `<div class="cj-error">${CangjieCore.escapeHtml(message)}</div>`;
    popupEl.style.display = 'block';
    positionPopup();
  }

  function showResults(text) {
    const html = CangjieCore.renderRowsHtml(text);
    if (!html) {
      hidePopup();
      return;
    }
    popupContentEl.innerHTML = html;
    popupEl.style.display = 'block';
    positionPopup();
  }

  function positionPopup() {
    const iconRect = iconEl.getBoundingClientRect();

    popupEl.style.left = '-9999px';
    popupEl.style.top = '-9999px';

    const popupRect = popupEl.getBoundingClientRect();
    let top = iconRect.bottom + 6;
    let left = iconRect.left;

    if (top + popupRect.height > window.innerHeight - 8) {
      top = iconRect.top - popupRect.height - 6;
    }
    if (left + popupRect.width > window.innerWidth - 8) {
      left = window.innerWidth - popupRect.width - 8;
    }
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    popupEl.style.left = `${left}px`;
    popupEl.style.top = `${top}px`;
  }

  // === EVENT LISTENERS ===

  document.addEventListener('mouseup', (e) => {
    if (e.target === host) return;

    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const text = selection.toString().trim();
      if (!text || !CangjieCore.hasCJK(text)) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      hidePopup();
      showIcon(rect, text);
    }, 10);
  });

  document.addEventListener('mousedown', (e) => {
    if (e.target === host) return;

    const path = e.composedPath();
    if (path.includes(iconEl) || path.includes(popupEl)) return;

    hideAll();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideAll();
    }
  });

  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      hideAll();
    }, 100);
  }, true);

  openSidePanelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = currentSelection;
    if (!text) return;
    chrome.runtime.sendMessage({ type: 'openSidePanel', text }).catch((err) => {
      console.error('[cangjie] openSidePanel message failed', err);
    });
    hideAll();
  });

  iconEl.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    const text = currentSelection;
    if (!text) return;

    if (!CangjieCore.isDictReady()) {
      showLoading();
      try {
        await CangjieCore.loadDict();
      } catch (err) {
        showError('字典載入失敗');
        return;
      }
    }

    showResults(text);
  });
})();
