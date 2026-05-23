# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Chrome MV3 extension. User selects Chinese text on any page → blue **倉** icon appears → click → Shadow DOM card shows each character's Cangjie code decomposition. Entirely offline; no API calls.

UX pattern is adapted from `D:\Documents\MyProjects\pinyin-to-chinese` (selection → floating icon → Shadow DOM card), but the data flow is reversed: instead of converting pinyin to Chinese via remote API, this looks up Chinese chars locally and displays their Cangjie code + radical decomposition.

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
- Skip rime header until the `...` document-end marker before reading entries.
- Keep only **single Han characters** (`\p{Script=Han}`, surrogate-pair-aware) — drop multi-char phrases.
- Drop codes starting with `z` (collision/special prefix per the rime schema's `exclude_patterns`). Codes starting with `x` are kept — `x` is a legitimate radical key (難).
- Base entries win over extended for the same character.

### Runtime (`src/content.js`)

Single IIFE injected on every URL. Key invariants:

- **Shadow DOM**: a closed shadow root attached to a host `<div id="cangjie-dictionary-host">` isolates all extension UI from page CSS.
- **Dictionary load is lazy + cached**: `loadDict()` returns a singleton promise. It's kicked off eagerly on script init so the first icon click is usually instant, but the icon-click handler also awaits it (and shows a loading state) in case eager load failed or hasn't finished.
- **Two key constants drive rendering**:
  - `RADICAL_MAP` (a–y → 24 Chinese radical chars, hardcoded from Wikipedia's Cangjie table).
  - `dict: Map<char, lowercase_code>` (loaded from JSON).
- **Decomposition pipeline**: selected text → `[...text].filter(\p{Script=Han})` → de-dupe preserving order → for each char, `dict.get(char)` returns lowercase code → uppercase for display + each letter mapped through `RADICAL_MAP` to a concatenated radical string.

### Card layout (non-obvious requirement)

Each row renders three columns: **character / uppercase code / radical chars concatenated**. The keyboard letter ↔ radical correspondence is communicated **purely by positional alignment** — there are no per-radical chip widgets and the letter is NOT repeated next to each radical. Example: `好  VND  女弓木` means V→女, N→弓, D→木. Do not add English translations (Sun/Moon/etc.) — "the English" in the original spec refers to the keyboard letters a–y, not English names of the radicals.

### Selection detection

`mouseup` → `window.getSelection()` → `hasCJK(text)` (uses `\p{Script=Han}/u` plus a length cap). Pure Latin/pinyin selections are deliberately ignored so the icon does not pollute non-CJK pages. Dismiss triggers: mousedown outside the shadow path, `Escape`, and a debounced `scroll`.

## License constraint

Because `src/data/cangjie5.json` is derived from rime-cangjie (GPL-3.0), the entire repository is GPL-3.0-or-later. Do not propose relicensing to MIT/permissive without first removing or replacing the bundled dictionary. The build script and content script alone would be relicensable, but as long as `cangjie5.json` ships in this repo, GPL is mandatory.
