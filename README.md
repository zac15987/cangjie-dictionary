<div align="center">

<img src="src/icons/icon128.png" alt="Cangjie Dictionary" width="80">

# Cangjie Dictionary

**在任何網頁上選取中文字，一鍵查看倉頡碼分解。**

[![Chrome Extension](https://img.shields.io/badge/Chrome-擴充功能-4285f4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34a853?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

</div>

---

## 功能特色

- **選取即查詢** — 在任意網頁選取中文字，旁邊出現浮動 **倉** 圖示，點擊查看倉頡碼
- **離線查表** — 字庫打包進擴充功能，無需網路、無外部 API 呼叫
- **完整字庫** — 涵蓋常用字 + CJK 擴充區罕用字（約 7.4 萬字）
- **多字分解** — 一次選取多字，逐字顯示倉頡碼與字根
- **Shadow DOM 隔離** — UI 不受網頁樣式影響

## 使用示範

```
選取「好友」
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

1. 在任意網頁上 **選取** 中文字
2. 選取旁邊會出現藍色 **倉** 圖示
3. **點擊** 圖示顯示倉頡碼分解
4. `ESC` 或點擊外部關閉

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
│   ├── manifest.json    # Manifest V3 設定
│   ├── content.js       # 選取偵測、字典查詢、UI
│   ├── content.css      # Host 元素定位
│   ├── popup.html       # 擴充功能說明頁
│   ├── data/
│   │   └── cangjie5.json   # 字 → 倉頡碼對照表
│   └── icons/
├── scripts/
│   └── build-data.mjs   # 從 rime-cangjie 產生 cangjie5.json
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
