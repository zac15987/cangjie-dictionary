# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Chrome MV3 extension that decomposes Chinese characters into Cangjie codes + radicals. Entirely offline; no API calls.

Four entry points exist on purpose — they target different use modes:

1. **Selection → floating 倉 icon → Shadow DOM card** (lightweight, in-page glance).
2. **Toolbar icon → popup with input box** (quick manual lookup of 1–2 chars).
3. **Right-click context menu** — two items, mutually exclusive by context:
   - On selection: "在倉頡側邊欄查詢「%s」" — opens the side panel pre-filled.
   - No selection: "開啟倉頡側邊欄" — opens the side panel empty.
4. **Side panel** — textarea + live results + reserved slot for a future handwriting canvas (heavy / persistent lookup).

The popup card and the side panel both expose an "在側邊欄開啟 →" button that promotes the current text from the lightweight surface to the persistent one.

UX pattern for the floating-icon flow is adapted from `D:\Documents\MyProjects\pinyin-to-chinese` (selection → floating icon → Shadow DOM card), but the data flow is reversed: instead of converting pinyin to Chinese via remote API, this looks up Chinese chars locally and displays their Cangjie code + radical decomposition.

## Commands

```bash
# Rebuild the character dictionary (fetches rime-cangjie yaml from GitHub):
node scripts/build-data.mjs

# Same, but reuse cached yaml in scripts/raw/ (no network):
node scripts/build-data.mjs --offline

# Regenerate icon PNGs (Windows-only, uses System.Drawing):
pwsh scripts/build-icons.ps1
```

**Loading the extension for testing**: `chrome://extensions/` → enable Developer Mode → Load unpacked → select the `src/` directory. There is no build step for the extension itself — `src/` is loaded directly.

There are no tests, no linter, no package.json.

## Architecture

### Data layer

`scripts/build-data.mjs` pulls two yaml files from [rime/rime-cangjie](https://github.com/rime/rime-cangjie) — `cangjie5.base.dict.yaml` (common chars) and `cangjie5.extended.dict.yaml` (CJK extension blocks) — merges them, and writes a flat `{ char: lowercase_code }` JSON to `src/data/cangjie5.json` (~1 MB, ~74k chars).

Important parsing rules baked into the build script:
- Skip the rime header until the `...` document-end marker before reading entries.
- Keep only **single Han characters** (`\p{Script=Han}`, surrogate-pair-aware) — drop multi-char phrases.
- Drop codes starting with `z` (collision/special prefix per the rime schema's `exclude_patterns`). Codes starting with `x` are kept — `x` is a legitimate radical key (難).
- Base entries win over extended for the same character.

### Shared core (`src/lib/cangjie-core.js`)

A **classic script** (not an ES module) that wraps everything in an IIFE and exposes `globalThis.CangjieCore` with `RADICAL_MAP`, `HAN_RE`, `MAX_SELECTION_LENGTH`, `loadDict()`, `hasCJK()`, `decompose()`, `renderRowsHtml()`, `uniqueHanChars()`, `escapeHtml()`, `isDictReady()`, plus the theme helpers `THEME_KEY`, `THEME_DEFAULT`, `resolveTheme()`, `applyTheme()`, `initTheme()`. Loaded into every JS context that needs lookup logic:

- Content scripts: declared as the first entry in `content_scripts.js` so it runs before `content.js`.
- Popup and side panel pages: `<script src="lib/cangjie-core.js">` before the page's own script.

Classic script + global namespace is the deliberate choice — MV3 content scripts don't directly support ES modules without `chrome.scripting.executeScript({ files: [...], world: ... })` gymnastics, and a small global namespace keeps the source identical across all three contexts.

Each context has its own `CangjieCore` instance with its own dict cache — content script per page, popup once per open, side panel once per open. The ~1 MB JSON parse takes ~50–100 ms; that's acceptable so no `chrome.storage.local` caching is layered on top.

**`renderRowsHtml(text)`** is the single source of truth for the result HTML. If the card layout changes, only this function changes.

### Card layout (non-obvious requirement)

Each row renders three columns: **character / uppercase code / radical chars concatenated**. The keyboard letter ↔ radical correspondence is communicated **purely by positional alignment** — there are no per-radical chip widgets and the letter is NOT repeated next to each radical. Example: `好  VND  女弓木` means V→女, N→弓, D→木. Do not add English translations (Sun/Moon/etc.) — "the English" in the original spec refers to the keyboard letters a–y, not English names of the radicals.

### Content script (`src/content.js`)

Single IIFE injected on every URL. Owns the floating 倉 icon and the Shadow DOM card.

- **Shadow DOM**: a closed shadow root attached to a host `<div id="cangjie-dictionary-host">` isolates extension UI from page CSS.
- **Card structure**: `#cj-popup` contains `#cj-popup-content` (loading / error / `.cj-row` results) plus `#cj-popup-footer` (the "在側邊欄開啟 →" button). The show/hide functions write to `#cj-popup-content` only — they must NOT clobber `popupEl.innerHTML`, or the footer button disappears.
- **Selection detection**: `mouseup` → `window.getSelection()` → `CangjieCore.hasCJK(text)`. Pure Latin/pinyin selections are deliberately ignored so the icon does not pollute non-CJK pages. Dismiss triggers: mousedown outside the shadow path, `Escape`, and a debounced `scroll`.
- **Side panel button** sends `chrome.runtime.sendMessage({ type: 'openSidePanel', text })` to the background. Content scripts cannot call `chrome.sidePanel.*` directly — the API is not exposed to content-script contexts.

### Background service worker (`src/background.js`)

- Registers two context-menu items on `onInstalled`, after `chrome.contextMenus.removeAll()` to avoid duplicate-id errors when the extension is reloaded.
- Both context-menu clicks and `runtime.onMessage` requests funnel through `openWithQuery(tabId, text)`, which kicks off `chrome.storage.session.set({ pendingQuery: { text, ts } })` and `chrome.sidePanel.open({ tabId })` **in parallel via `Promise.all`** — not sequentially. Awaiting `storage.set` first would consume the user-gesture activation before `sidePanel.open` is reached and Chrome would reject the open.

### Side panel (`src/sidepanel.{html,js,css}`)

textarea + results region + a hidden `#handwriting-slot` reserved for a future handwriting canvas (not implemented). On load it reads `chrome.storage.session.pendingQuery` (if any) to prefill, then removes it. While open, it listens to `chrome.storage.onChanged` so that subsequent context-menu / popup invocations update the textarea live.

### Cross-context data channel: `chrome.storage.session.pendingQuery`

This is how the background, popup, and side panel agree on "what text should I show?". Shape: `{ text: string, ts: number }`. The `ts` is necessary because if the user re-queries the same text twice, the `text` field alone wouldn't fire `onChanged` — the timestamp guarantees a distinct value each time. `chrome.runtime.sendMessage` is not used for this data path (the side panel may not be open yet when the message is sent).

### Theme mode (light / dark / system)

Stored as `chrome.storage.sync.theme` with value `'light' | 'dark' | 'system'` (default `'system'`). `sync` not `local` so the preference follows the user across devices, and separate from `storage.session.pendingQuery`.

`CangjieCore.initTheme(rootEl, onChange?)` is the single integration point used by all three UI contexts (popup, side panel, content-script Shadow DOM card). It:

1. Reads the stored value, falls back to `THEME_DEFAULT` on any error.
2. Resolves `'system'` → `'light' | 'dark'` via `matchMedia('(prefers-color-scheme: dark)')`.
3. Sets `data-theme="light"` or `data-theme="dark"` on the passed root element.
4. Registers `chrome.storage.onChanged` (area `'sync'`) so any context changing the theme propagates to all open contexts.
5. Registers `matchMedia` change listener so OS-level dark/light switches reflect when `theme === 'system'`.

Styling uses CSS custom properties (`--cj-bg`, `--cj-text`, `--cj-accent`, …) defined twice per stylesheet — under `[data-theme="light"]` and `[data-theme="dark"]`. Each surface (popup inline `<style>`, `sidepanel.css`, the inline `<style>` text in `content.js`) carries its own copy of the variable definitions because they live in three isolated CSS scopes (the Shadow DOM cannot inherit page CSS, and popup/sidepanel are separate documents).

Two non-obvious choices in the Shadow DOM card:
- The themed root is a dedicated `<div id="cj-root">` inside the shadow root (not the shadow host or the document). CSS selectors `#cj-root[data-theme="..."]` define the variables there; `#cj-icon` and `#cj-popup` are children and inherit.
- The floating 倉 icon's background is **intentionally not themed** — it stays `#4285f4` regardless of theme. The icon is the extension's visual identity on the page; consistency across themes beats matching the card chrome.

Picker UI lives only in the side panel header (radio group). Popup and the content-script card read the setting but don't show a toggle.

## License constraint

Dual-license structure:

- **Code** (everything in `src/` except the dictionary, plus `scripts/` and docs) — MIT, see `LICENSE`.
- **Dictionary `src/data/cangjie5.json`** — LGPL-3.0-or-later (derived from rime/rime-cangjie). Marked via the REUSE sidecar `src/data/cangjie5.json.license`. Full license texts live in `LICENSES/LGPL-3.0-or-later.txt` and `LICENSES/GPL-3.0-or-later.txt` (LGPL-3.0 incorporates GPL-3.0 by reference).

Practical consequences:

- Sister projects (e.g. pinyin-to-chinese) can freely borrow the UI / Shadow-DOM card / theme code under MIT without copyleft.
- If you replace or remove `cangjie5.json`, the whole repo becomes pure MIT.
- If you redistribute the dictionary (or a derivative of it), you must keep its LGPL-3.0-or-later notice, ship the LGPL text, and allow users to substitute their own dictionary build — which is naturally satisfied since the file is loaded at runtime from `src/data/`.

Do not move dictionary-derived data into the MIT-covered code (e.g. inlining the JSON into a `.js` file) — that would muddle the boundary. Keep the dictionary as a separate, replaceable runtime asset.
