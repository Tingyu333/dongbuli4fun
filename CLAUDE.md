# CLAUDE.md

這份檔案提供 Claude Code 在此專案中工作時的指引。

## 專案概述

「丼步喱・絆」(DongBuLi) 是一個好友間玩笑性質的單房民宿網站（27 樓的「絆」房間），包含訂房、留言板與簡易後台。介面文字皆為繁體中文（`lang="zh-TW"`），文案語氣是帶點自嘲的日系侘寂風格。

**專案定位：純粹做好玩，不是真的要對外營運。優先順序是「有趣」＞ 功能 ＞ 資安。** 不需要主動提出資安強化（`innerHTML` 等都是刻意從簡），除非使用者問起。新功能與文案歡迎玩梗、維持幽默感。

**例外：會「對外發訊息」或碰到個資的部分不能從簡。** 網站會用部署者的 Gmail 寄信給別人，被濫用的後果在站外（帳號被當垃圾信來源、配額被燒光、朋友收到釣魚信）。規則：
- 金鑰、密碼放 Apps Script 的指令碼屬性（`PropertiesService`），不寫進程式碼或 HTML（repo 是公開的）。目前有 `ADMIN_PASSWORD`（後台密碼）和 `OWNER_EMAIL`（通知信寄給誰；沒設定會試著用 `Session.getEffectiveUser()`，但部署常常沒有 `userinfo.email` 權限而拿不到，所以一定要設）。
- 公開的動作（訂房、領票、取消、留言）**不寄信給別人**，只能寄給部署者自己。寄給旅人的信只能由後台（帶通行證）或之後的排程觸發。
- 公開 API 不回電話、Email；要完整資料走後台的 `adminList`。
- 寄信一律走 `sendMail()`（有每日上限）；信件內容用固定模板，使用者填的名字經過 `mailName()`（像網址的就換成「旅人」），不放使用者給的連結。
- LINE bot（`line-bot/`）是**另一個** Apps Script 專案，只讀、只回覆（見下面「LINE bot」）。不要把 LINE webhook 接到網站後端，也不要讓 bot 寫入或推播：Apps Script 的 `doPost` 讀不到 HTTP 標頭，沒辦法驗 `X-Line-Signature`。

**大多數使用者用手機瀏覽。** 新功能以手機（約 375px 寬、觸控操作）為主設計與測試：hover 才會觸發的互動要有觸控替代方案（例如逃跑按鈕在手機上改成抖動拒絕），長按要擋掉系統選單與文字選取，不能出現水平捲動。

## 技術架構

- **純靜態 HTML**：沒有建置工具、套件管理或測試框架。每個頁面是獨立的 `.html`，頁面專屬的 CSS 與 JS 寫在檔案內。
- **共用主題 `assets/`**：前台頁面（`index`、`reviews`、`jiaobei`、`about`、`ticket`）在 `<head>` 載入 `assets/theme.css` 與 `assets/theme.js`（要放在 Tailwind CDN 之後、同步載入）：
  - `theme.css`：色彩 CSS 變數、夜間模式覆寫、`body` 紙張背景、`nav` 獨立圖層（`translateZ(0)`）、`.toast`、`.nav-solid`、晝夜切換鈕。
  - **導覽列不要加 `mix-blend-mode`**：iPhone（尤其 LINE 內建瀏覽器）捲動時固定導覽列會卡在畫面中間（about 頁跟首頁都踩過）。
  - `theme.js`：`tailwind.config`、夜間模式切換、`showToast()`、`themeColor()`（給 canvas 讀 CSS 變數）。
  - `404.html` 與後台兩頁沒有接主題，仍在頁內各自宣告 `tailwind.config`（404 在 GitHub Pages 的子路徑下相對路徑會失效）。
- **Tailwind CSS（Play CDN）**：透過 `https://cdn.tailwindcss.com` 載入。
- **後端**：Google Apps Script Web App（`API_URL`，在 `index.html`、`reviews.html`、`ticket.html`、`admin_login.html`、`admin_dashboard.html` 中各自寫死同一個網址）。資料存在對應的 Google Sheet。後端程式碼備份在 `apps-script/Code.gs`，改完要由使用者貼到 Apps Script 編輯器並「部署 → 管理部署作業 → 編輯 → 新版本」才會生效（Claude 無法代為部署）。
- **部署**：GitHub repo `Tingyu333/dongbuli4fun`，有 `404.html`，推測透過 GitHub Pages 發布。
- **分享預覽**：前台五頁的 `<head>` 都有 `description` 和 Open Graph（`og:title`、`og:description`、`og:image`）。圖是 `assets/og.png`（1200×1200 正方形，使用者指定），`og:image`／`og:url` 要寫完整網址 `https://tingyu333.github.io/dongbuli4fun/…`。沒寫的話 LINE 會抓網頁開頭的文字當介紹（電梯開場的「▲ 1F 點擊略過」）。新增前台頁面記得一起加。LINE 會快取預覽一段時間，改了不會馬上變；**圖片是用圖片網址另外快取的**，換圖時要把 `og:image` 後面的 `?v=` 數字加一（五頁一起改），不然只有文字會更新。
- **LINE bot**：`line-bot/Code.gs`，獨立的 Apps Script 專案（設定步驟在 `line-bot/README.md`），用 `SpreadsheetApp.openById(SHEET_ID)` 讀同一份 Sheet 的 Bookings E～G 欄。

## 頁面

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 首頁 + 訂房 Modal（含 1～8 人的人數選擇、選填 Email）+ 房況月曆 + 「我的預約」查詢取消（多人訂房顯示已領幾張、連到票夾）。訂好後除了入住通知書圖片，多人時還有「發票給同學」：分享 `ticket.html?id=訂房 id` 的連結。日期以「晚」為單位：入住日到退房前一天算有人住，退房那天可以讓下一組入住（flatpickr 入住選單擋有人住的晚上，退房選單用 maxDate 限制到下一個有人住的晚上）。 |
| `reviews.html` | 留言板。`GET ?action=getReviews` 讀取、POST `type: 'review'` 新增。 |
| `jiaobei.html` | 擲杯（擲筊）。純前端、不接後端：輸入或點選問題 → 點「擲」或搖手機（iPhone 要先授權）→ 兩支筊杯拋起翻面落地。聖杯 1/2、笑杯 1/4、陰杯 1/4，另有 1/88 的「立杯」彩蛋；同一個問題連續三個聖杯蓋「定」，換問題就重算。動畫只動 transform／opacity（Web Animations API）。 |
| `ticket.html` | 入住券票夾（不在導覽列，從分享連結進來）。朋友輸入名字（和選填的 Email）領下一張空票；同一個名字再領一次就拿回原本那張（當作換手機，沒有帳號）。這台手機領的票存在 `localStorage`（`dongbuli-ticket-<id>`）。可以退票（第 1 張是訂房人，不能退）；入住期間可以「剪票」（只記在本機）；取消的訂房蓋「作廢」。 |
| `about.html` | 關於頁。 |
| `404.html` | 找不到頁面。 |
| `admin_login.html` | 後台登入：只有密碼，送到後端 `adminLogin` 比對，拿到 6 小時的通行證存在 `localStorage.adminToken`。 |
| `admin_dashboard.html` | 後台預約列表（`adminList`，含電話、Email、人數、已領票的人），分「即將入住」與「歷史紀錄」，各自前端分頁（每頁 10 筆）。讀取中、讀取失敗（可重試）都有畫面。狀態下拉選單只列出還能改成的狀態，改之前先跳確認（改了不能回頭）；改完跳出寄了幾封確認信或取消通知。通行證失效（`unauthorized`）就回登入頁。 |

## API 約定（Google Apps Script）

- Sheet `Bookings` 欄位：A `timestamp`、B `room_name`、C `guest_name`、D `phone`、E `check_in`、F `check_out`、G `status`、H `id`、I `guests`（1～8，舊資料空白當 1 人）、J `email`（選填）、K `confirm_mailed`（確認信寄出的時間，有值就不再寄）。`Tickets`（入住券，沒有這個分頁後端會自動建）：A `timestamp`、B `booking_id`、C `seat`（第幾張，1 是訂房人，訂房時自動寫入）、D `name`、E `email`（選填）。`Reviews`：A `timestamp`、B `name`、C `rating`、D `message`。
- `status`：`pending`（待確認，新訂房預設）/ `confirmed`（已確認，舊資料沒填也當作這個）/ `cancelled`（已取消，不佔日期）。
- `GET API_URL` → 公開的訂房陣列，只有 `{ check_in, check_out, status }`（首頁月曆用），日期是台灣時間 `yyyy-MM-dd`。
- `GET API_URL?action=getReviews` → 回傳留言陣列，欄位 `name`、`rating`、`message`、`timestamp`。
- `GET API_URL?action=getTicket&id=` → `{ result: 'success', booking: { id, host, check_in, check_out, status, guests }, seats: [{ seat, name }] }`（不含電話；沒人領的 `name` 是空字串）。
- `POST API_URL`，body 為 JSON 字串：
  - 訂房：`{ room_name, guest_name, phone, check_in, check_out, guests, email }` → `{ result: 'success', id, guests }`、`{ result: 'conflict' }`（撞期）或 `{ result: 'error', error }`（日期、Email 格式不對、全站每小時超過 20 筆）。後端會檢查撞期（退房日可接下一組入住）並寄通知信給部署帳號。`type` 不認得會回 `error`，不會被當成訂房。
  - 後台登入：`{ type: 'adminLogin', password }` → `{ result: 'success', token }`（6 小時）或 `error`（密碼不對、十分鐘內失敗 10 次先鎖、還沒設定 `ADMIN_PASSWORD`）。
  - 以下要帶 `token`，沒帶或過期回 `{ result: 'unauthorized' }`：
    - 後台名單：`{ type: 'adminList', token }` → `{ result: 'success', bookings: [{ id, guest_name, phone, email, check_in, check_out, status, guests, confirm_mailed, next, travelers }] }`（`travelers` 是已領票的名字；`next` 是還能改成的狀態，後台下拉選單照這個列）。
    - 改狀態：`{ type: 'updateStatus', id, status, token }` → `{ result: 'success', mailed, mailKind, mailError?, next }` 或 `error`（不允許的改法）。**狀態只能往前走**（`nextStatuses()`）：`pending` → `confirmed`／`cancelled`；`confirmed` → `cancelled`；`cancelled` 是終點；入住日當天起整筆鎖住。按錯只能由老闆直接改 Sheet 的 G 欄。寄信：第一次改成 `confirmed` 寄確認信；`confirmed` → `cancelled` 寄取消通知；`pending` → `cancelled`（婉拒）**不寄**（沒確認過的信箱可能是陌生人亂填的）。收件人是訂房人和領票時留 Email 的人（同信箱寄一次），`mailed` 是寄出幾封。
  - 查自己的預約（首頁「我的預約」）：`{ type: 'lookup', phone }` → `{ result: 'success', bookings: [{ id, check_in, check_out, status, guests, claimed }] }`。電話只比對數字後 9 碼（舊資料開頭的 0 被 Sheet 吃掉也對得上）。
  - 自己取消：`{ type: 'cancel', id, phone }` → `success` / `error`。電話要對得上，入住日當天或之後不能取消；取消會寄信通知部署帳號。
  - 領票：`{ type: 'claim', id, name, email }` → 跟 getTicket 一樣的內容再加 `seat`（領到第幾張）、`{ result: 'full' }`（發完了）或 `error`（已取消、已結束、沒寫名字）。名字去頭尾空白、最多 12 字。同名拿回原本那張時，有帶 Email 就補上。
  - 退票：`{ type: 'unclaim', id, seat, name }` → 跟 getTicket 一樣的內容，或 `error`（名字對不上、第 1 張）。
  - 留言：`{ type: 'review', name, rating, message }`
- 首頁與後台的 POST **不用 `no-cors`**，直接 `fetch(API_URL, { method: 'POST', body: JSON.stringify(...) })`：字串 body 是 `text/plain`，不會觸發 CORS 預檢，GAS 轉址後的回應讀得到。留言頁仍是舊的 `no-cors` 寫法。
- 寄信上限（每天，存在指令碼屬性 `mailCount-*`）：寄給部署者 50 封、寄給旅人 40 封（Gmail 個人帳號一天只能寄給 100 人）。超過就不寄、不影響訂房或改狀態。
- 若要改 API 欄位，記得 `apps-script/Code.gs` 也要同步修改並請使用者重新部署，且五個頁面（`index`、`reviews`、`ticket`、`admin_login`、`admin_dashboard`）的 `API_URL` 要一起更新。

## LINE bot

- 指令（訊息開頭符合才算）：`空房`／`房況`、`擲杯`／`擲筊`／`跋杯`（可接問題）、`抽籤`／`御神籤`、`天氣`／`氣象`、`訂房`、`說明`／`指令`。加好友（`follow`）、被拉進群組（`join`）會打招呼。
- 不是指令：一對一回一句廢話文學（`NONSENSE_LINES`，貼圖回 `STICKER_LINES`）；群組裡**只有被 @（`mention.mentionees[].isSelf`）才回**，平常聊天不插話。被 @ 時先把 @bot 那段字拿掉再判斷指令。同一個聊天室不連續回同一句（`CacheService` 的 `last:` key）。
- `空房` 回 Flex Message 月曆卡片（`calendarBubble()`，從這週日起 5～6 週、有人住填枯茶色、今天加圈），`altText` 是文字版房況（最多 400 字）。卡片顏色寫死白天那套，Flex 不跟晝夜切換。`printAvailabilityFlex()` 可以印出 JSON 貼到 Flex Message Simulator 預覽。`reply()` 收文字或組好的訊息物件。
- `抽籤` 回籤紙卡片（吉朱色、凶墨色，「再抽一支」是 message action，會再送一次「抽籤」）。`天氣` 回天氣卡片，資料來自 Open-Meteo（不用金鑰、非商業免費），`CacheService` 存 30 分鐘，讀不到就回一句文字；地點用指令碼屬性 `WEATHER_PLACE`／`WEATHER_LAT`／`WEATHER_LON`，預設台北。
- 規則：只讀（程式裡不能有寫入 Sheet 的呼叫，要寫入的事回網站連結）、只用 Reply API（不推播）、不回名字電話 Email。
- 指令碼屬性：`LINE_CHANNEL_ACCESS_TOKEN`、`SHEET_ID`、`WEBHOOK_KEY`（webhook 網址要帶 `?key=`，對不上或沒設定就不處理）。
- 擲杯的三聖杯存在 `CacheService`，key 是 `streak:` + groupId／roomId／userId，6 小時。
- **台詞跟網站同步**：擲杯台詞（`jiaobei.html` 的 `RESULTS`）、御神籤（`index.html` 的 `FORTUNES`）改了，`line-bot/Code.gs` 的 `JIAOBEI_LINES`、`FORTUNES` 也要改，並請使用者重新部署 bot 專案。
- 圖文選單的圖是 `line-bot/richmenu.png`（2500×1686，大型 2×2：空房・查、擲杯・問、抽籤・運、訂房・歸）。

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
- 導覽列在 `index.html`、`reviews.html`、`jiaobei.html`、`about.html`、`ticket.html` 五頁各自重複（`ticket.html` 不是導覽列裡的一項，四個都用 `<a>`），新增前台頁面時需同步更新每一頁的 nav，目前頁面用 `<span>` 加底線標示、其他用 `<a>`。四個連結在 375px 寬已經很擠（手機上 `px-4`、`gap-3`、連結 `tracking-normal`、Logo `tracking-[0.1em]`），要再加第五項得改版面（例如收進選單）。

## 開發注意事項

- 主題相關的共用設定放 `assets/`；nav、`API_URL`、`.vertical-rl` 等仍是**每頁複製貼上**，改一處時請檢查其他頁面是否也要改。
- 本機預覽：在專案根目錄跑 `python3 -m http.server` 後開 `http://localhost:8000`（要用伺服器開，`assets/` 才載得到）。
- 後台登入走後端通行證（見上面的 API），密碼在指令碼屬性 `ADMIN_PASSWORD`，不要寫回前端。
- 動態內容（留言、後台列表）以 template string 塞入 `innerHTML`。
- `.DS_Store` 未列入 `.gitignore`，不要提交它。
- commit message 目前多為簡短英文（如 `update admin page`、`add 404 page`）。
