# CLAUDE.md

這份檔案提供 Claude Code 在此專案中工作時的指引。

## 專案概述

「丼步喱・絆」(DongBuLi) 是一個好友間玩笑性質的單房民宿網站（27 樓的「絆」房間），包含訂房、留言板與簡易後台。介面文字皆為繁體中文（`lang="zh-TW"`），文案語氣是帶點自嘲的日系侘寂風格。

**專案定位：純粹做好玩，不是真的要對外營運。優先順序是「有趣」＞ 功能 ＞ 資安。** 不需要主動提出資安強化（`innerHTML` 等都是刻意從簡），除非使用者問起。新功能與文案歡迎玩梗、維持幽默感。

**例外：會「對外發訊息」或碰到個資的部分不能從簡。** 網站會用部署者的 Gmail 寄信給別人，被濫用的後果在站外（帳號被當垃圾信來源、配額被燒光、朋友收到釣魚信）。規則：
- 金鑰、密碼放 Apps Script 的指令碼屬性（`PropertiesService`），不寫進程式碼或 HTML（repo 是公開的）。目前有 `ADMIN_PASSWORD`（預約後台密碼）、`GAME_ADMIN_PASSWORD`（admin 後台密碼，2026-11-20）和 `OWNER_EMAIL`（通知信寄給誰；沒設定會試著用 `Session.getEffectiveUser()`，但部署常常沒有 `userinfo.email` 權限而拿不到，所以一定要設）。
- 公開的動作（訂房、領票、取消、留言）**不寄信給別人**，只能寄給部署者自己。寄給旅人的信只能由後台（帶通行證）或之後的排程觸發。
- 公開 API 不回電話、Email；要完整資料走後台的 `adminList`。
- 寄信一律走 `sendMail()`（有每日上限）；信件內容用固定模板，使用者填的名字經過 `mailName()`（像網址的就換成「旅人」），不放使用者給的連結。
- **遊戲幣永遠不碰真錢**（使用者 2026-11-18 定的預防）：不能用真錢買遊戲幣、遊戲幣不能換現金、禮券或實體獎品，排行榜也不送真的東西。有刮刮樂、運動押注，跨過這條線就可能變成賭博。`about`、`scratch`、`yuncai` 頁尾有一句聲明（遊戲幣、不能儲值或換現金獎品、跟台灣彩券／運動彩券／TPVL 沒關係），新增類似玩法的頁面也加。分享預覽（`og:description`）不寫「TPVL」「運彩」，規則裡才寫。
- **「重生異世界人生」的企劃、文本、工具放在私人 repo `Tingyu333/reborn-otherworld-life`（本機 `~/reborn-otherworld-life`），不能放進公開的 `dongbuli4fun`**（使用者 2026-11-19 定的；這個 repo 是公開的，稿子放進來事件、結局、機率會被看光）。這個 repo 的 `reborn-otherworld-life/` 資料夾只放遊戲本身（網頁和資料檔），**資料檔要壓縮加編碼**（打開看不懂、搜尋不到文字），不能直接放原始的 JSON 或稿子。動這款遊戲前先讀私人 repo 的 `HANDOFF.md`。
- LINE bot（`line-bot/`）是**另一個** Apps Script 專案，只讀、只回覆（見 `docs/line-bot.md`）。不要把 LINE webhook 接到網站後端，也不要讓 bot 寫入或推播：Apps Script 的 `doPost` 讀不到 HTTP 標頭，沒辦法驗 `X-Line-Signature`。

**大多數使用者用手機瀏覽。** 新功能以手機（約 375px 寬、觸控操作）為主設計與測試：hover 才會觸發的互動要有觸控替代方案（例如逃跑按鈕在手機上改成抖動拒絕），長按要擋掉系統選單與文字選取，不能出現水平捲動。

## 技術架構

- **純靜態 HTML**：沒有建置工具、套件管理或測試框架。每個頁面是獨立的 `.html`，頁面專屬的 CSS 與 JS 寫在檔案內。
- **共用主題 `assets/`**：前台頁面（`index`、`reviews`、`jiaobei`、`about`、`ticket`）和後台兩頁（`admin_login`、`admin_dashboard`）在 `<head>` 載入 `assets/theme.css` 與 `assets/theme.js`（同步載入，夜間模式才不會先閃一下白天）：
  - `theme.css`：色彩 CSS 變數、夜間模式覆寫、`body` 紙張背景、`nav` 獨立圖層（`translateZ(0)`）、`.toast`、`.nav-solid`、晝夜切換鈕。
  - 載入時網址後面帶 `?v=日期`（例如 `assets/line.js?v=20261113`）：LINE 內建瀏覽器和 GitHub Pages 都會快取舊的 js／css，**改了 `assets/` 裡的檔案，要把所有頁面的 `?v=` 一起換新**（`sed` 全部取代即可）。
  - **導覽列不要加 `mix-blend-mode`**：iPhone（尤其 LINE 內建瀏覽器）捲動時固定導覽列會卡在畫面中間（about 頁跟首頁都踩過）。
  - `theme.js`：夜間模式切換、`showToast()`、`themeColor()`（給 canvas 讀 CSS 變數）。
  - `saveimg.js`（`index`、`xitou`、`fangwu`、`caiyuan`、`cengwang`、`zaocan`、`huoyun`、`tiandian`、`diechao`、`scratch`、`yuncai`、`kuangkeng` 載）：`SaveImg.save(file, { title, text })` 存結果圖片（入住通知書、洗頭證明、房務檢查表、收成單、蹭網日報、早餐店日報、貨運提單、刮刮樂兌獎單、疊巢履歷、礦坑日報、礦坑結業證書）。能分享檔案就叫分享選單；**在 LINE／IG／FB 的 App 內瀏覽器（UA 有 `Line/`、`FBAN`、`Instagram`、`; wv)`），下載連結按了沒反應**（安卓使用者回報過），改成全螢幕放大圖片（data URL、`-webkit-touch-callout: default`）請他長按存、或截圖；分享失敗（不是自己取消）也走放大；其他直接下載。按鈕字：能分享寫「分享…」、App 內寫「存…圖片」、其他寫「下載…」（`SaveImg.inApp`）。新的結果圖片也用這支，不要自己寫 `a.download`。
  - `avatar.js`（`member`、`rank`、`tiandian`、`diechao`、`xuyuan`、`admin` 載）：**指定頭像**，只能從網站的角色挑（`Avatar.LIST`：茱莉鴨、蘋果鴨、浣熊大王、青江菜船長、店貓、坐洗部的狗、鼴鼠、雞塊、小吳鴨；後端 `AVATAR_KEYS` 要一樣），canvas 畫；蘋果鴨（`Avatar.appleDuck`）和小吳鴨（`Avatar.crow`，疊・巢的主角）的全身畫法也在這裡、`Avatar.url(key)` 給圖片網址（快取），角色是實物、顏色固定。不收上傳的照片（使用者選的做法 A）。2026-11-20 使用者要其他頭像「對標」小吳鴨、茱莉鴨的精緻度：浣熊大王（皇冠三顆寶石、紅披風白毛領）、青江菜船長（跟貨運・航的船長同一套畫法：白頂黑簷船長帽）、店貓（虎斑 M 字紋、睫毛）、坐洗部的狗（頭上頂洗頭泡泡）、鼴鼠（戴礦坑的工地帽）、雞塊（麵衣顆粒，24 顆、避開臉；第一版 70 顆使用者說太多）都重畫成漸層＋亮點的畫法（`rad()` 放射漸層，光從左上來）。
  - `vendor/flatpickr/`：首頁的日曆元件 flatpickr **4.6.13**（MIT，附 LICENSE；2026-11-18 從外面的 CDN 搬進來、鎖版本、`defer` 載入，不擋畫面）。
  - `404.html` 沒有接主題，仍在頁內自己宣告 `tailwind.config`（404 在 GitHub Pages 的子路徑下相對路徑會失效）。後台也有晝夜切換鈕，跟前台共用同一個 sessionStorage 設定。
- **Tailwind CSS**：**只用先打包好的 `assets/tailwind.css`**，每頁 `</head>` 前面載入（2026-11-17 拿掉了 Play CDN `cdn.tailwindcss.com`：每頁都要在手機上現場編譯 CSS，很慢）。打包設定在 `tools/tailwind.config.js`。**新增或改了頁面裡的 Tailwind class 一定要重新產生**，不然那個 class 沒有樣式、排版會跑掉：`npx tailwindcss@3 -c tools/tailwind.config.js -i tools/tailwind.in.css -o assets/tailwind.css --minify`（在專案根目錄跑），再把所有頁面 `tailwind.css?v=` 換新。用字串拼出來的 class（例如 `'text-' + x`）打包抓不到，要寫完整的 class 名（寫在 JS 字串裡的完整 class 名抓得到）。`404.html` 用完整網址載入、自己在 `<style>` 補了 `--wabi-*` 變數。不能用 `@apply`、`<style type="text/tailwindcss">`（那是 CDN 才有的）。
- **後端**：Google Apps Script Web App（`API_URL`，在 `index.html`、`reviews.html`、`ticket.html`、`scratch.html`、`xitou.html`、`fangwu.html`、`caiyuan.html`、`cengwang.html`、`zaocan.html`、`huoyun.html`、`tiandian.html`、`diechao.html`、`kuangkeng.html`、`gushi.html`、`yuncai.html`、`admin_login.html`、`admin_dashboard.html`、`admin.html` 中各自寫死同一個網址；`xuyuan.html` 用 `Line.API_URL`）。資料存在對應的 Google Sheet。後端程式碼備份在 `apps-script/Code.gs`，改完要由使用者貼到 Apps Script 編輯器並「部署 → 管理部署作業 → 編輯 → 新版本」才會生效（Claude 無法代為部署）。**每次改 `Code.gs` 要把最上面的 `BACKEND_VERSION`（日期＋字母，例如 `2026-11-18a`）換新，`admin_dashboard.html` 的 `BACKEND_EXPECT` 一起換**：後台「後端・況」會比對，看得出部署的是不是新版。
- **部署**：GitHub repo `Tingyu333/dongbuli4fun`，有 `404.html`，推測透過 GitHub Pages 發布。
- **分享預覽**：前台五頁的 `<head>` 都有 `description` 和 Open Graph（`og:title`、`og:description`、`og:image`）。圖是 `assets/og.png`（1200×1200 正方形，使用者指定），`og:image`／`og:url` 要寫完整網址 `https://tingyu333.github.io/dongbuli4fun/…`。沒寫的話 LINE 會抓網頁開頭的文字當介紹（電梯開場的「▲ 1F 點擊略過」）。新增前台頁面、小遊戲頁面記得一起加（疊・巢、甜點・轉一開始漏了，LINE 預覽變成導覽列的字，2026-11-20 補上）。LINE 會快取預覽一段時間，改了不會馬上變；**圖片是用圖片網址另外快取的**，換圖時要把 `og:image` 後面的 `?v=` 數字加一（五頁一起改），不然只有文字會更新。
- **LINE bot**：`line-bot/Code.gs`，獨立的 Apps Script 專案（設定步驟在 `line-bot/README.md`），用 `SpreadsheetApp.openById(SHEET_ID)` 讀同一份 Sheet 的 Bookings E～G 欄。

## 頁面

**每一頁的細節（玩法、數字、存檔欄位、模擬結果、使用者定過的規則）都在 `docs/pages/<頁名>.md`。動到哪一頁之前先讀那一份，改完也要更新那一份。**

| 檔案 | 是什麼 | 詳細 |
| --- | --- | --- |
| `index.html` | 首頁、訂房、房況月曆、我的預約 | `docs/pages/index.md` |
| `reviews.html` | 留言板 | `docs/pages/reviews.md` |
| `jiaobei.html` | 擲杯（純前端） | `docs/pages/jiaobei.md` |
| `ticket.html` | 入住券票夾（分享連結進來） | `docs/pages/ticket.md` |
| `about.html` | 關於頁 | `docs/pages/about.md` |
| `quede.html` | 缺德榜（假資料，還沒入口） | `docs/pages/quede.md` |
| `xitou.html` | 打工：坐洗・泡（洗頭），店面升級 | `docs/pages/xitou.md` |
| `scratch.html` | 刮刮樂「27 樓彩券行」，十種票、加持、分享兌獎單 | `docs/pages/scratch.md` |
| `member.html` | 會員中心，小遊戲入口都在這；最上面有公告跑馬燈（admin 後台設定） | `docs/pages/member.md` |
| `gongde.html` | 功德・添：捐香油錢、點燈 | `docs/pages/gongde.md` |
| `fangwu.html` | 打工：房務・淨（打掃） | `docs/pages/fangwu.md` |
| `caiyuan.html` | 打工：菜園・拔（拔蘿蔔），農具升級 | `docs/pages/caiyuan.md` |
| `cengwang.html` | 打工：蹭・網（茱莉鴨轉頭前放開），無盡模式、道具 | `docs/pages/cengwang.md` |
| `zaocan.html` | 打工：早餐・煎，店面升級 | `docs/pages/zaocan.md` |
| `huoyun.html` | 打工：貨運・航（開船撈蘿蔔），無盡模式、船廠 | `docs/pages/huoyun.md` |
| `tiandian.html` | 打工：甜點・轉（蘋果鴨甜點店，轉盤），店面升級 | `docs/pages/tiandian.md` |
| `diechao.html` | 打工：疊・巢（小吳鴨疊精裝書，60 秒、無盡模式），店面 | `docs/pages/diechao.md` |
| `kuangkeng.html` | 打工：礦坑・挖（黃金礦工的丼步喱版，浣熊大王當礦工）。2026-11-20 晚上開工（頁內 `MAINTENANCE` 開關，改 `true` 會蓋「監修中」、`?preview` 試玩不發工資不記錄）；十關、礦坑商店、工資進錢包、店面、結局、日報和結業證書、排行榜礦坑部（挖最深） | `docs/pages/kuangkeng.md` |
| `xuyuan.html` | 許願・池：搜集提案，每天第一個願隨機 $3,000～6,666（網頁不寫金額），願望牆、主人回覆 | `docs/pages/xuyuan.md` |
| `rank.html` | 排行・榜：打工・榜、花錢・榜、無盡・榜 | `docs/pages/rank.md` |
| `baoxian.html` | 保險・存：儲蓄險（後端算） | `docs/pages/baoxian.md` |
| `gushi.html` | 股市・炒：十檔（含三檔妖股）、晚報、掛單 | `docs/pages/gushi.md` |
| `yuncai.html` | 運動・押：押 TPVL 排球，彩池分錢 | `docs/pages/yuncai.md` |
| `404.html` | 找不到頁面 | `docs/pages/404.md` |
| `admin_login.html` | 後台登入 | `docs/pages/admin_login.md` |
| `admin_dashboard.html` | 後台預約列表、發紅包（admin 後台也能發）、後端狀況 | `docs/pages/admin_dashboard.md` |
| `admin.html` | admin 後台（另一組密碼 `GAME_ADMIN_PASSWORD`）：玩家列表、專屬道具、道具庫（主人取名字）、經濟體檢、許願池（2026-11-21 從預約後台搬來）、會員中心的公告、發紅包（2026-11-21，跟預約後台同一份） | `docs/pages/admin.md` |

## 其他說明（也在 docs/）

- `docs/wallet.md`：小遊戲共用錢包（`assets/wallet.js`）、功德和燈、店面升級怎麼同步、主人發紅包。**新遊戲要賺錢、要做升級先讀這份。**
- `docs/line-login.md`：LINE 登入（`assets/line.js`）、通行證、LIFF。
- `docs/api.md`：後端 API 和每一張 Sheet 的欄位、排隊（`LOCKED_TYPES`）、額度、排行榜怎麼算、股市和運動怎麼算、**排程**（排行榜每 5 分鐘、20:58 晚報、00:00 派彩、03:00 備份，`setupTriggers()`）。**改 `apps-script/Code.gs` 前先讀這份。**
- `docs/line-bot.md`：LINE bot 的指令、資料來源、圖文選單。
- `docs/plans/`：還在企劃、還沒做的東西。`docs/plans/jiayuan/`：家園・築（精緻像素風的家園，使用者定的畫風規矩和樣張都在裡面）。

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
- 導覽列四項：首頁・歸、留言・絆、關於・絆、會員・我（擲杯拿掉了，從會員中心進）。在 `index.html`、`reviews.html`、`jiaobei.html`、`about.html`、`ticket.html`、`member.html`、`quede.html`、`xitou.html`、`scratch.html`、`gongde.html`、`fangwu.html`、`rank.html`、`baoxian.html`、`caiyuan.html`、`cengwang.html`、`zaocan.html`、`huoyun.html`、`tiandian.html`、`diechao.html`、`gushi.html`、`yuncai.html`、`xuyuan.html`、`kuangkeng.html` 各自重複，改了要每頁一起改；目前頁面用 `<span>` 加底線標示、其他用 `<a>`（不在導覽列的頁，四個都用 `<a>`）。四個連結在 375px 寬已經很擠（手機上 `px-4`、`gap-3`、連結 `tracking-normal`、Logo `tracking-[0.1em]`，只剩約 12px；320px 寬最右邊那項會被切掉一點），要再加第五項得改版面（例如收進選單）。以前右下角的會員圓鈕（`.member-fab`）已經拿掉。

## 開發注意事項

- 主題相關的共用設定放 `assets/`；nav、`API_URL`、`.vertical-rl` 等仍是**每頁複製貼上**，改一處時請檢查其他頁面是否也要改。
- 本機預覽：在專案根目錄跑 `python3 -m http.server` 後開 `http://localhost:8000`（要用伺服器開，`assets/` 才載得到）。
- 後台登入走後端通行證（見上面的 API），密碼在指令碼屬性 `ADMIN_PASSWORD`，不要寫回前端。
- 動態內容（留言、後台列表）以 template string 塞入 `innerHTML`；別人輸入的字（名字、留言、Email）先過頁內的 `esc()`。
- `.DS_Store` 未列入 `.gitignore`，不要提交它。
- **字型**：Google Fonts 的 Noto Serif TC、Noto Sans TC，每頁連結前面有兩行 `preconnect`（`fonts.googleapis.com`、`fonts.gstatic.com crossorigin`），新頁面照抄。粗細查過（2026-11-17）：畫面和 canvas 幾乎每一種都有用到，瀏覽器只下載真的用到的粗細，所以連結裡多列的粗細不太花流量，不用再砍。
- **遊戲畫布的動畫迴圈**（坐洗、房務、菜園、蹭網、早餐、貨運、甜點、礦坑）：`frame()` 最後叫 `nextFrame()`、一開始叫 `startLoop()`；`IntersectionObserver` 看畫布 `#cv`，**整個捲出畫面就停**（收工看結果時不用一直畫，手機才不會燙），捲回來再接著畫、`lastNow` 重設。**沒在玩的時候（標題、結果畫面）每秒只畫約 20 張**（2026-11-18：`nextFrame()` 裡 `setTimeout(…, 34)` 再 `requestAnimationFrame`；剛收工的 2.5 秒照常 60 張，給結算動畫；坐洗、房務看 `stage` 0～4，其他看 `G.started && !G.ended`），量過標題畫面主執行緒忙碌從 8～18% 降到 3～8%；dt 上限 50ms，所以動畫速度不變。新遊戲照這個寫，不要在 `frame()` 裡直接 `requestAnimationFrame(frame)`。**畫布跟著 `resize` 調大小的話，大小沒變就不要重設 `cv.width`／`cv.height`**（重設會清空畫布；手機捲動時網址列伸縮會一直觸發 `resize`，疊・巢、甜點店都因為這樣捲動時狂閃，2026-11-19 修好），變了就馬上重畫一張。
- **說明書分成很多份**：這份只留規則和索引，每一頁的細節在 `docs/pages/`、錢包、登入、API、LINE bot 在 `docs/`。改了功能就改對應的那一份；新增頁面就新增一份 `docs/pages/<頁名>.md`，並在上面的表加一列。
- **版本紀錄 `changelog/年-月.md`**（例如 `changelog/2026-11.md`，**每個月一個檔案**）：給使用者看的流水帳，**一定要用繁體中文寫**（使用者看不懂英文；程式裡的名字可以照原樣放在 `` ` `` 裡）。每次改完（commit 前）在**這個月的檔案最後面加一段**，用 `cat >> changelog/2026-11.md <<'EOF'` 直接附加，**不用先讀、也不改以前寫的**。這個月的檔案還沒有就新開一個，第一行寫 `# 版本紀錄・2026 年 12 月`、空一行、`給自己看的流水帳。新的寫在最下面，只加不改。`（月份看台灣時間）。每一筆的格式：`## 日期 時間（台灣）　一句標題`，下面幾條白話的 `-`（改了什麼、玩家感覺得到什麼、要不要重新部署後端或 LINE bot）。
- commit message 目前多為簡短英文（如 `update admin page`、`add 404 page`）。
