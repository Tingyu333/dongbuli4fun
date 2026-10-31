# CLAUDE.md

這份檔案提供 Claude Code 在此專案中工作時的指引。

## 專案概述

「丼步喱・絆」(DongBuLi) 是一個好友間玩笑性質的單房民宿網站（27 樓的「絆」房間），包含訂房、留言板與簡易後台。介面文字皆為繁體中文（`lang="zh-TW"`），文案語氣是帶點自嘲的日系侘寂風格。

**專案定位：純粹做好玩，不是真的要對外營運。優先順序是「有趣」＞ 功能 ＞ 資安。** 不需要主動提出資安強化（寫死的帳密、前端登入、`innerHTML` 等都是刻意從簡），除非使用者問起。新功能與文案歡迎玩梗、維持幽默感。

**大多數使用者用手機瀏覽。** 新功能以手機（約 375px 寬、觸控操作）為主設計與測試：hover 才會觸發的互動要有觸控替代方案（例如逃跑按鈕在手機上改成抖動拒絕），長按要擋掉系統選單與文字選取，不能出現水平捲動。

## 技術架構

- **純靜態 HTML**：沒有建置工具、套件管理或測試框架。每個頁面是獨立的 `.html`，頁面專屬的 CSS 與 JS 寫在檔案內。
- **共用主題 `assets/`**：前台三頁（`index`、`reviews`、`about`）在 `<head>` 載入 `assets/theme.css` 與 `assets/theme.js`（要放在 Tailwind CDN 之後、同步載入）：
  - `theme.css`：色彩 CSS 變數、夜間模式覆寫、`body` 紙張背景、`.toast`、`.nav-solid`、晝夜切換鈕。
  - `theme.js`：`tailwind.config`、夜間模式切換、`showToast()`、`themeColor()`（給 canvas 讀 CSS 變數）。
  - `404.html` 與後台兩頁沒有接主題，仍在頁內各自宣告 `tailwind.config`（404 在 GitHub Pages 的子路徑下相對路徑會失效）。
- **Tailwind CSS（Play CDN）**：透過 `https://cdn.tailwindcss.com` 載入。
- **後端**：Google Apps Script Web App（`API_URL`，在 `index.html`、`reviews.html`、`admin_dashboard.html` 中各自寫死同一個網址）。資料存在對應的 Google Sheet。後端程式碼備份在 `apps-script/Code.gs`，改完要由使用者貼到 Apps Script 編輯器並「部署 → 管理部署作業 → 編輯 → 新版本」才會生效（Claude 無法代為部署）。
- **部署**：GitHub repo `Tingyu333/dongbuli4fun`，有 `404.html`，推測透過 GitHub Pages 發布。

## 頁面

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 首頁 + 訂房 Modal + 房況月曆 + 「我的預約」查詢取消。日期以「晚」為單位：入住日到退房前一天算有人住，退房那天可以讓下一組入住（flatpickr 入住選單擋有人住的晚上，退房選單用 maxDate 限制到下一個有人住的晚上）。 |
| `reviews.html` | 留言板。`GET ?action=getReviews` 讀取、POST `type: 'review'` 新增。 |
| `about.html` | 關於頁。 |
| `404.html` | 找不到頁面。 |
| `admin_login.html` | 後台登入（帳密寫死在前端，成功後設 `localStorage.isAdmin`）。 |
| `admin_dashboard.html` | 後台預約列表，分「即將入住」與「歷史紀錄」，各自前端分頁（每頁 10 筆）。 |

## API 約定（Google Apps Script）

- Sheet `Bookings` 欄位：A `timestamp`、B `room_name`、C `guest_name`、D `phone`、E `check_in`、F `check_out`、G `status`、H `id`。`Reviews`：A `timestamp`、B `name`、C `rating`、D `message`。
- `status`：`pending`（待確認，新訂房預設）/ `confirmed`（已確認，舊資料沒填也當作這個）/ `cancelled`（已取消，不佔日期）。
- `GET API_URL` → 回傳訂房陣列 `{ id, guest_name, phone, check_in, check_out, status }`，日期是台灣時間 `yyyy-MM-dd`（後台也相容 `name`、`checkIn`、`checkOut` 及 ISO 時間字串）。
- `GET API_URL?action=getReviews` → 回傳留言陣列，欄位 `name`、`rating`、`message`、`timestamp`。
- `POST API_URL`，body 為 JSON 字串：
  - 訂房：`{ room_name, guest_name, phone, check_in, check_out }` → `{ result: 'success', id }`、`{ result: 'conflict' }`（撞期）或 `{ result: 'error', error }`。後端會檢查撞期（退房日可接下一組入住）並寄通知信給部署帳號。
  - 改狀態（後台）：`{ type: 'updateStatus', id, status }` → `success` / `conflict`（從已取消改回來時撞期）/ `error`。
  - 查自己的預約（首頁「我的預約」）：`{ type: 'lookup', phone }` → `{ result: 'success', bookings: [{ id, check_in, check_out, status }] }`。電話只比對數字後 9 碼（舊資料開頭的 0 被 Sheet 吃掉也對得上）。
  - 自己取消：`{ type: 'cancel', id, phone }` → `success` / `error`。電話要對得上，入住日當天或之後不能取消；取消會寄信通知部署帳號。
  - 留言：`{ type: 'review', name, rating, message }`
- 首頁與後台的 POST **不用 `no-cors`**，直接 `fetch(API_URL, { method: 'POST', body: JSON.stringify(...) })`：字串 body 是 `text/plain`，不會觸發 CORS 預檢，GAS 轉址後的回應讀得到。留言頁仍是舊的 `no-cors` 寫法。
- 若要改 API 欄位，記得 `apps-script/Code.gs` 也要同步修改並請使用者重新部署，且三個頁面的 `API_URL` 要一起更新。

## 設計規範

修改或新增頁面時請保持一致的視覺風格：

- 色彩（Tailwind 的 `wabi-*`，實際值是 `assets/theme.css` 的 CSS 變數，夜間模式換一組）：
  - `wabi-bg` `#fcfaf8` 米白紙張色
  - `wabi-text` `#4a4a4a` 墨色
  - `wabi-accent` `#8e8070` 枯茶色
  - `wabi-sub` `#dcdcdc` 淺灰
  - `wabi-dark` `#2c2c2c` 深岩灰
  - `wabi-shu` `#b33a2f` **朱色**：只給「重要、被蓋章、被綁住」的東西（印章、紅線、御神籤吉、乾杯印）
- 頁內 CSS / JS 不要寫死色碼，用 `rgb(var(--wabi-xxx))`（或 `rgb(var(--wabi-xxx) / 0.5)`），夜間模式才會跟著變；canvas 用 `themeColor('--wabi-xxx')`。入住券圖片是「紙本」，刻意固定用白天的色。
- **夜間模式「夜之絆」**：晚上 10 點到早上 6 點、或系統深色模式時自動切換，左下角「夜／晝」鈕可手動切（存在 sessionStorage）。`<html>` 會加上 `night` class。頁面直接用的 `bg-white`、`text-stone-*`、`border-stone-*` 已在 `theme.css` 覆寫；新增用到其他 Tailwind 灰色時記得補。圖片加 `data-night-src` 就會在夜裡換圖（首頁大圖換成 27 樓夜景）。
- 字體：Noto Serif TC（`font-serif`，內文預設）與 Noto Sans TC（`font-sans`，標籤、按鈕、數字）。使用者不要手寫字體／手寫吐槽註解，不要再加回來。
- **不用 emoji**，跟侘寂風衝突。改用漢字或朱色印章樣式；提示訊息用 `showToast()`（紙條樣式）。
- 常用元素：寬字距（`tracking-widest`、`tracking-[0.2em]`）、細字重（`font-light`）、底線式 input、`.vertical-rl` 直書標題、「XX・X」格式的標題（如「首頁・歸」「留言・絆」）。
- 導覽列在 `index.html`、`reviews.html`、`about.html` 三頁各自重複，新增前台頁面時需同步更新每一頁的 nav，目前頁面用 `<span>` 加底線標示、其他用 `<a>`。

## 開發注意事項

- 主題相關的共用設定放 `assets/`；nav、`API_URL`、`.vertical-rl` 等仍是**每頁複製貼上**，改一處時請檢查其他頁面是否也要改。
- 本機預覽：在專案根目錄跑 `python3 -m http.server` 後開 `http://localhost:8000`（要用伺服器開，`assets/` 才載得到）。
- 後台登入是前端寫死帳密 + `localStorage.isAdmin`，僅做樣子用。
- 動態內容（留言、後台列表）以 template string 塞入 `innerHTML`。
- `.DS_Store` 未列入 `.gitignore`，不要提交它。
- commit message 目前多為簡短英文（如 `update admin page`、`add 404 page`）。
