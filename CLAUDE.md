# CLAUDE.md

這份檔案提供 Claude Code 在此專案中工作時的指引。

## 專案概述

「丼步喱・絆」(DongBuLi) 是一個好友間玩笑性質的單房民宿網站（27 樓的「絆」房間），包含訂房、留言板與簡易後台。介面文字皆為繁體中文（`lang="zh-TW"`），文案語氣是帶點自嘲的日系侘寂風格。

**專案定位：純粹做好玩，不是真的要對外營運。優先順序是「有趣」＞ 功能 ＞ 資安。** 不需要主動提出資安強化（寫死的帳密、前端登入、`innerHTML` 等都是刻意從簡），除非使用者問起。新功能與文案歡迎玩梗、維持幽默感。

## 技術架構

- **純靜態 HTML**：沒有建置工具、套件管理或測試框架。每個頁面是獨立的 `.html`，CSS 與 JS 都寫在檔案內。
- **Tailwind CSS（Play CDN）**：透過 `https://cdn.tailwindcss.com` 載入，每頁都在 `<head>` 內各自宣告一份 `tailwind.config`。
- **後端**：Google Apps Script Web App（`API_URL`，在 `index.html`、`reviews.html`、`admin_dashboard.html` 中各自寫死同一個網址）。資料存在對應的 Google Sheet。後端程式碼不在此 repo 內。
- **部署**：GitHub repo `Tingyu333/dongbuli4fun`，有 `404.html`，推測透過 GitHub Pages 發布。

## 頁面

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 首頁 + 訂房 Modal。用 flatpickr（zh_tw 語系）選日期，已訂日期從 API 載入後設為不可選。 |
| `reviews.html` | 留言板。`GET ?action=getReviews` 讀取、POST `type: 'review'` 新增。 |
| `about.html` | 關於頁。 |
| `404.html` | 找不到頁面。 |
| `admin_login.html` | 後台登入（帳密寫死在前端，成功後設 `localStorage.isAdmin`）。 |
| `admin_dashboard.html` | 後台預約列表，分「即將入住」與「歷史紀錄」，各自前端分頁（每頁 10 筆）。 |

## API 約定（Google Apps Script）

- `GET API_URL` → 回傳訂房陣列，欄位 `guest_name`、`phone`、`check_in`、`check_out`（後台也相容 `name`、`checkIn`、`checkOut` 及 ISO 時間字串）。
- `GET API_URL?action=getReviews` → 回傳留言陣列，欄位 `name`、`rating`、`message`、`timestamp`。
- `POST API_URL`，body 為 JSON 字串：
  - 訂房：`{ room_name, guest_name, phone, check_in, check_out }`
  - 留言：`{ type: 'review', name, rating, message }`
- POST 一律使用 `mode: 'no-cors'`（GAS 限制），因此**拿不到回應內容**，前端只能假設成功後 `alert` 並重新整理。
- 若要改 API 欄位，記得後端（GAS）也要同步修改，且三個頁面的 `API_URL` 要一起更新。

## 設計規範

修改或新增頁面時請保持一致的視覺風格：

- 色彩（`tailwind.config` 中的自訂色）：
  - `wabi-bg` `#fcfaf8` 米白紙張色
  - `wabi-text` `#4a4a4a` 墨色
  - `wabi-accent` `#8e8070` 枯茶色
  - `wabi-sub` `#dcdcdc` 淺灰
  - `wabi-dark` `#2c2c2c` 深岩灰
- 字體：Noto Serif TC（`font-serif`，內文預設）與 Noto Sans TC（`font-sans`，標籤、按鈕、數字）。
- `body` 背景使用米白色 + SVG noise 紋理（data URI），各頁都有複製一份。
- 常用元素：寬字距（`tracking-widest`、`tracking-[0.2em]`）、細字重（`font-light`）、底線式 input、`.vertical-rl` 直書標題、「XX・X」格式的標題（如「首頁・歸」「留言・絆」）。
- 導覽列在 `index.html`、`reviews.html`、`about.html` 三頁各自重複，新增前台頁面時需同步更新每一頁的 nav，目前頁面用 `<span>` 加底線標示、其他用 `<a>`。

## 開發注意事項

- 共用設定（`tailwind.config`、body 背景、nav、`API_URL`）是**每頁複製貼上**，改一處時請檢查其他頁面是否也要改。
- 本機預覽：直接用瀏覽器開檔，或在專案根目錄跑 `python3 -m http.server` 後開 `http://localhost:8000`。
- 後台登入是前端寫死帳密 + `localStorage.isAdmin`，僅做樣子用。
- 動態內容（留言、後台列表）以 template string 塞入 `innerHTML`。
- `.DS_Store` 未列入 `.gitignore`，不要提交它。
- commit message 目前多為簡短英文（如 `update admin page`、`add 404 page`）。
