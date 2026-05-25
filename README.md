<div align="center">

<img src="src/icons/icon128.png" alt="Cangjie Dictionary" width="80">

# Cangjie Dictionary

**在任何網頁上查詢中文字的倉頡碼分解 — 選取、輸入、右鍵都能用。**

[![Chrome Extension](https://img.shields.io/badge/Chrome-擴充功能-4285f4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34a853?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

</div>

---

## 功能特色

- **多種查詢入口** — 選取網頁文字、工具列圖示輸入、右鍵選單、側邊欄持續輸入
- **離線查表** — 字庫打包進擴充功能，無需網路、無外部 API 呼叫
- **完整字庫** — 涵蓋常用字 + CJK 擴充區罕用字（約 7.4 萬字）
- **多字分解** — 一次選取或輸入多字，逐字顯示倉頡碼與字根
- **側邊欄持續查詢** — 開啟側邊欄邊看網頁邊查，未來預留手寫板擴充
- **Shadow DOM 隔離** — 浮動 UI 不受網頁樣式影響
- **深淺色主題** — 側邊欄可切換淺色 / 深色 / 跟隨系統，所有介面同步套用

## 使用示範

```
輸入「好友」
─────────────────
好  VND  女弓木
友  KE   大水
```

字母與字根**靠順序對齊**：`V→女`、`N→弓`、`D→木`。

## 安裝方式

1. Clone 此專案
2. 開啟 Chrome → 前往 `chrome://extensions/`
3. 開啟右上角 **開發者模式**
4. 點擊 **載入未封裝項目** → 選擇 `src` 資料夾

## 使用方法

擴充功能提供四種互補的查詢入口：

### 1. 選取網頁文字（最輕量）

選取任意中文字 → 旁邊出現藍色 **倉** 圖示 → 點擊查看分解卡片。卡片底部有「在側邊欄開啟 →」可升級到側邊欄。

### 2. 點擊工具列圖示（快速輸入）

點擊工具列上的倉圖示 → 開啟小型輸入框 → 即時拆字。底部「在側邊欄開啟 →」可帶著當前輸入跳到側邊欄。

### 3. 右鍵選單

- 選取中文字後右鍵 → **在倉頡側邊欄查詢「xxx」** → 側邊欄開啟並預填
- 無選取時右鍵 → **開啟倉頡側邊欄** → 開啟空白側邊欄

### 4. 側邊欄（持續查詢）

從上述任一入口開啟側邊欄後，可在 textarea 內持續輸入，結果即時更新。側邊欄會在分頁切換時自動跟隨，適合邊看網頁邊查字。

側邊欄頂部還提供 **淺色 / 深色 / 系統** 三段主題切換，設定透過 `chrome.storage.sync` 跨裝置同步，工具列 popup 與網頁浮動小卡會即時跟進。

關閉浮動卡片：`ESC` 或點擊外部。

## 倉頡 24 字根

| 鍵 | 字根 | 鍵 | 字根 | 鍵 | 字根 | 鍵 | 字根 |
|---|---|---|---|---|---|---|---|
| A | 日 | H | 竹 | O | 人 | U | 山 |
| B | 月 | I | 戈 | P | 心 | V | 女 |
| C | 金 | J | 十 | Q | 手 | W | 田 |
| D | 木 | K | 大 | R | 口 | X | 難 |
| E | 水 | L | 中 | S | 尸 | Y | 卜 |
| F | 火 | M | 一 | T | 廿 |   |   |
| G | 土 | N | 弓 |   |   |   |   |

## 專案結構

```
cangjie-dictionary/
├── src/
│   ├── manifest.json       # Manifest V3 設定
│   ├── background.js       # Service worker：右鍵選單、開啟側邊欄
│   ├── content.js          # 選取偵測、浮動卡片
│   ├── content.css         # Host 元素定位
│   ├── popup.html          # 工具列圖示 → 輕量輸入框
│   ├── popup.js
│   ├── sidepanel.html      # 側邊欄輸入介面
│   ├── sidepanel.js
│   ├── sidepanel.css
│   ├── lib/
│   │   └── cangjie-core.js # 共用模組：字典、拆字、HTML 渲染
│   ├── data/
│   │   └── cangjie5.json   # 字 → 倉頡碼對照表
│   └── icons/
├── scripts/
│   └── build-data.mjs      # 從 rime-cangjie 產生 cangjie5.json
├── LICENSE
└── README.md
```

## 重建字庫

```bash
node scripts/build-data.mjs            # 從 GitHub 抓最新資料
node scripts/build-data.mjs --offline  # 用 scripts/raw/ 的快取
```

## 資料來源與授權

字庫資料衍生自 [rime/rime-cangjie](https://github.com/rime/rime-cangjie)（GPL-3.0），原始碼來自《五倉世紀》by chinesecj.com。因引用 GPL 資料，本專案亦採 [GPL-3.0-or-later](LICENSE) 授權。

UX 模式參考 [pinyin-to-chinese](https://gitlab.com/zac15987/pinyin-to-chinese)（MIT）。
