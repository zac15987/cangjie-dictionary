'use strict';

const MENU_ID_LOOKUP = 'cangjie-lookup';
const MENU_ID_OPEN = 'cangjie-open';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID_LOOKUP,
      title: '在倉頡側邊欄查詢「%s」',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: MENU_ID_OPEN,
      title: '開啟倉頡側邊欄',
      contexts: ['page', 'frame', 'editable', 'link', 'image', 'video', 'audio']
    });
  });
});

function openWithQuery(tabId, text) {
  const trimmed = (text || '').trim();
  const writePromise = trimmed
    ? chrome.storage.session.set({ pendingQuery: { text: trimmed, ts: Date.now() } })
    : Promise.resolve();
  // Call sidePanel.open synchronously to preserve the user gesture context.
  const openPromise = chrome.sidePanel.open({ tabId });
  return Promise.all([writePromise, openPromise]);
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || tab.id === undefined) return;
  if (info.menuItemId === MENU_ID_LOOKUP) {
    openWithQuery(tab.id, info.selectionText).catch((err) => {
      console.error('[cangjie] context menu lookup failed', err);
    });
  } else if (info.menuItemId === MENU_ID_OPEN) {
    openWithQuery(tab.id, '').catch((err) => {
      console.error('[cangjie] context menu open failed', err);
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'openSidePanel') return;
  const tabId = sender.tab && sender.tab.id;
  if (tabId === undefined) {
    sendResponse({ ok: false, reason: 'no-tab' });
    return;
  }
  openWithQuery(tabId, msg.text)
    .then(() => sendResponse({ ok: true }))
    .catch((err) => {
      console.error('[cangjie] sendMessage open failed', err);
      sendResponse({ ok: false, reason: String(err) });
    });
  return true;
});
