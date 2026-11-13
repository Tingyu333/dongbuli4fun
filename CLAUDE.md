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
- **共用主題 `assets/`**：前台頁面（`index`、`reviews`、`jiaobei`、`about`、`ticket`）和後台兩頁（`admin_login`、`admin_dashboard`）在 `<head>` 載入 `assets/theme.css` 與 `assets/theme.js`（要放在 Tailwind CDN 之後、同步載入）：
  - `theme.css`：色彩 CSS 變數、夜間模式覆寫、`body` 紙張背景、`nav` 獨立圖層（`translateZ(0)`）、`.toast`、`.nav-solid`、晝夜切換鈕。
  - **導覽列不要加 `mix-blend-mode`**：iPhone（尤其 LINE 內建瀏覽器）捲動時固定導覽列會卡在畫面中間（about 頁跟首頁都踩過）。
  - `theme.js`：`tailwind.config`、夜間模式切換、`showToast()`、`themeColor()`（給 canvas 讀 CSS 變數）。
  - `404.html` 沒有接主題，仍在頁內自己宣告 `tailwind.config`（404 在 GitHub Pages 的子路徑下相對路徑會失效）。後台也有晝夜切換鈕，跟前台共用同一個 sessionStorage 設定。
- **Tailwind CSS（Play CDN）**：透過 `https://cdn.tailwindcss.com` 載入。
- **後端**：Google Apps Script Web App（`API_URL`，在 `index.html`、`reviews.html`、`ticket.html`、`scratch.html`、`admin_login.html`、`admin_dashboard.html` 中各自寫死同一個網址）。資料存在對應的 Google Sheet。後端程式碼備份在 `apps-script/Code.gs`，改完要由使用者貼到 Apps Script 編輯器並「部署 → 管理部署作業 → 編輯 → 新版本」才會生效（Claude 無法代為部署）。
- **部署**：GitHub repo `Tingyu333/dongbuli4fun`，有 `404.html`，推測透過 GitHub Pages 發布。
- **分享預覽**：前台五頁的 `<head>` 都有 `description` 和 Open Graph（`og:title`、`og:description`、`og:image`）。圖是 `assets/og.png`（1200×1200 正方形，使用者指定），`og:image`／`og:url` 要寫完整網址 `https://tingyu333.github.io/dongbuli4fun/…`。沒寫的話 LINE 會抓網頁開頭的文字當介紹（電梯開場的「▲ 1F 點擊略過」）。新增前台頁面記得一起加。LINE 會快取預覽一段時間，改了不會馬上變；**圖片是用圖片網址另外快取的**，換圖時要把 `og:image` 後面的 `?v=` 數字加一（五頁一起改），不然只有文字會更新。
- **LINE bot**：`line-bot/Code.gs`，獨立的 Apps Script 專案（設定步驟在 `line-bot/README.md`），用 `SpreadsheetApp.openById(SHEET_ID)` 讀同一份 Sheet 的 Bookings E～G 欄。

## 頁面

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 首頁 + 訂房 Modal（含 1～8 人的人數選擇、選填 Email）+ 房況月曆 + 「我的預約」查詢取消（多人訂房顯示已領幾張、連到票夾）。訂好後除了入住通知書圖片，多人時還有「發票給同學」：分享 `ticket.html?id=訂房 id` 的連結。日期以「晚」為單位：入住日到退房前一天算有人住，退房那天可以讓下一組入住（flatpickr 入住選單擋有人住的晚上，退房選單用 maxDate 限制到下一個有人住的晚上）。 |
| `reviews.html` | 留言板。`GET ?action=getReviews` 讀取、POST `type: 'review'` 新增（等後端回覆，成功就把那則直接放到最上面、朱色標一下，失敗用 `showToast()` 說原因）。新的在前面（前端自己依時間排序）、一次 10 則「往前翻」、標題旁有「共 N 則・平均 X 顆星」、時間顯示「剛剛／3 小時前／昨天」。名字和留言用 `esc()` 跳脫、換行照原樣顯示；留言最多 300 字（有字數）；名字記在 `localStorage`（`dongbuli-review-name`）。手機上表單放在列表前面。 |
| `jiaobei.html` | 擲杯（擲筊）。純前端、不接後端：輸入或點選問題 → 點「擲」或搖手機（iPhone 要先授權）→ 兩支筊杯拋起翻面落地。聖杯 1/2、笑杯 1/4、陰杯 1/4，另有 1/88 的「立杯」彩蛋；同一個問題連續三個聖杯蓋「定」，換問題就重算。動畫只動 transform／opacity（Web Animations API）。 |
| `ticket.html` | 入住券票夾（不在導覽列，從分享連結進來）。朋友輸入名字（和選填的 Email）領下一張空票；同一個名字再領一次就拿回原本那張（當作換手機，沒有帳號）。這台手機領的票存在 `localStorage`（`dongbuli-ticket-<id>`）。可以退票（第 1 張是訂房人，不能退）；入住期間可以「剪票」（只記在本機）；取消的訂房蓋「作廢」。 |
| `about.html` | 關於頁。 |
| `quede.html` | 缺德榜（原本的功德榜改的；不在導覽列，目前也還沒有入口，直接開網址）。3 面大匾（`tier: 'big'`，重大刑案）＋ 10 塊罪牌（`small`）：黑漆、裂痕、鐵字，貼著「罪人・待審」封條。點了上「公堂」全螢幕開審：木魚三聲、（大匾）光明燈一盞一盞熄掉、雷劈下來封條炸開、名字一字一字烙上去（每個字自己一層 `.iron`，父層的 `background-clip:text` 遇到在動的子元素會消失）、下雨夾家具碎片和布丁蓋（canvas）、「缺德無量」朱印；大匾多了紅色 LED 跑馬燈「公告 某某 罪狀 缺德無量 請速賠償」。聲音都是 Web Audio 合成（木魚、打雷、咚）。開審後可以「擲杯求原諒」：聖杯 1/2 蓋「赦」、雨停；笑杯、陰杯可以再擲。看過的、赦過的存在 `localStorage`（`dongbuli-quede-seen`／`-pardon`），再點是快速版加「再審一次」；開審中點一下跳過；`prefers-reduced-motion` 直接顯示結果；「重新貼上封條」全部重來。沒名字的是「尚無前科」。漆、鐵、紙是實物，顏色固定用頁內的 `--qd-*`，不跟晝夜切換。**名單目前是頁內的假資料 `CASES`**（`item`、`name`、`crime` 罪狀、`verdict` 判詞），之後要改成後台編輯、從後端讀。 |
| `xitou.html` | 坐洗・泡：台式坐洗小遊戲（不在導覽列，目前沒有入口，直接開網址）。純前端、不接後端。客人隨機（`makeCustomer()`）：13 種個性台詞（`PERSONAS`）× 髮型（`STYLES`：短髮、長髮、包包頭、捲髮、平頭、地中海，各自有頭髮範圍 `inHair`、頭頂高度 `top`、剛好要擠幾下 `pumps`）× 膚色、髮色、眼鏡、鬍子、雀斑；稀有客人：每週都來的阿伯（地中海＋眼鏡）、戴墨鏡的神秘旅人、不知道怎麼進來的貓（台詞全部變成喵）。五道工序：**擠**（點瓶子，瓶子倒過來掉到客人頭上，點一下擠一坨下來，量尺框框是這種髮型剛好的下數，按「好了」結算；擠到 10 下會流到眼睛）→ **搓**（手指在頭上搓出泡泡，開始搓才計時 10 秒，這位客人的頭髮切成小格子 `G.cells` 算覆蓋率，泡泡中心要落在頭髮裡）→ **抓**（冒出朱色「癢」就點，14 個，第 7 個後問「這樣力道可以嗎？」，客人說要大力就變成每個點兩下）→ **捏**（泡泡量很多，想拉幾條都行；從泡泡上往外拉，`classify()` 看條數、方向、高度、有沒有轉圈，判定獨角獸、衝天炮、小惡魔、兔耳、霜淇淋、海膽、皇冠等）→ 沖水 → **拍**（指針走到紅線點「啪」，四拍）。爽度 = 擠 15＋搓 25＋抓 30＋造型 10＋拍 20，最後產生「洗頭證明」圖片（照鏡子那刻的截圖、各項結果、朱印 爽／讚／可／痛／訴），可以分享或下載。畫布用固定的 360×380 座標；客人（皮膚、頭髮、圍布）和證明是實物、顏色固定，鏡子跟晝夜走。最高爽度存在 `localStorage`（`dongbuli-xitou-best`）。聲音都是 Web Audio 合成。**洗完發工資**（`showResult()`）：工資 = 爽度 × 10（最少 $100），爽度 90 以上小費 $500、75 以上 $200，`Wallet.earn(工資＋小費, 'xitou')` 存進共用錢包，結果區和洗頭證明都會列出來，下面有「拿工資去彩券行」。結果區的 `#payAcct` 顯示錢存在哪（LINE 帳號，或「用 LINE 登入，換手機也在」）。 |
| `scratch.html` | 刮刮樂「27 樓彩券行」（不在導覽列，目前沒有入口，直接開網址）。**這頁刻意不走侘寂風**：仿台灣刮刮樂，鮮豔票面、新台幣、獎金下面印大寫金額（`capital()`）。刮刮樂本身純前端；領主人的紅包（`bonusClaim`）、LINE 登入後同步錢包（`walletSync`）會打後端。錢包上面一行是 LINE 登入狀態（`renderAcct()`：沒登入是「LINE 登入」綠色按鈕，登入後是大頭貼、名字、登出）。**錢在共用錢包**（`assets/wallet.js`，見下面「小遊戲的錢」）：買票 `Wallet.spend()`、兌獎 `Wallet.earn(金額, 'scratch')`，`S.money` 只是這頁顯示用的副本，`pageshow`／回到分頁時 `syncMoney()` 重新讀；沒有提款機了，不到 $50 會出現「去坐洗部打工」連到 `xitou.html`。十種（`GAMES`，每種有 `table` 機率表、`gen()` 開獎、`score()` 照規則從票面算獎金、`html()` 票面）：**好運連連** $100（中獎號碼 2 個對我的號碼 10 格，★ 直接得獎）、**三個一樣** $200（12 格三個相同金額）、**21 點** $300（比莊家大就中，21 點加倍）、**27 樓賓果** $500（刮 20 個號碼，賓果卡自動圈、連線亮，依連線數計獎）、**27 樓大紅包** $2000（中獎號碼 5 對我的號碼 20，★ 直接得、「全」20 組全中，頭獎 2000 萬）；後來再加五種：**井字樂** $50（九格 ○×，三個 ○ 連線得「獎金」區金額）、**骰子樂** $100（五局，你的骰子比莊家大就中）、**777 拉霸** $200（四列，同一列三個一樣）、**超級加倍** $1000（對號碼，總額再乘加倍區 ×1～×10）、**挖金礦** $300（`manual: true`，唯一不是事先決定的：16 格 4 顆炸彈，`data-tap` 點一下整格就開、不能刮一點偷看，挖到金額累計、可以隨時「收手兌獎」，挖到炸彈歸零；挖過的格子存在 `t.opened`，重新整理不能重來；挖 3 格收手期望值最高，約九成）。架上照票價排、兩欄。開獎在買的時候就決定：先抽總獎金 `T`，再把票面湊成剛好 `T`（`split()` 拆格、`decoy()` 沒中的格子也放獎金、賓果用重抽湊連線數），`score(t) === t.T` 要永遠成立（改機率表或票面規則後要重跑模擬驗算）。回收率大約六到九成、三成左右會中。可以一次買 5 張（`S.queue`），回架上會出現「繼續刮」。銀漆是蓋在 `[data-zone]` 上的 canvas（`makeFoil()`：`destination-out`，筆刷要設不透明色；每格 `[data-cell]` 刮掉 45% 就整格打開；`data-optional` 的「兌獎區 請勿刮開」不算在內）。全部刮開後中獎格（`[data-win]`）一格一格亮，按「兌獎」錢才進錢包，獎金是票價 10 倍以上跳全螢幕「恭喜中大獎」加彩帶。存在 `localStorage`（`dongbuli-scratch-tw`：刮幾張、花多少中多少、最大一筆、$2,000 以上的中獎紀錄、沒刮完的票，重新整理接著刮）。聲音是 Web Audio 合成。 |
| `404.html` | 找不到頁面。 |
| `admin_login.html` | 後台登入：只有密碼，送到後端 `adminLogin` 比對，拿到 6 小時的通行證存在 `localStorage.adminToken`。 |
| `admin_dashboard.html` | 後台預約列表（`adminList`，含電話、Email、人數、已領票的人）。最上面一行摘要（今晚誰在、待處理幾筆、三十天內入住幾筆），再分三區：「待處理」（待確認且還能改的，卡片＋「確認入住」「婉拒」大按鈕，空的時候叫你喝茶）、「即將入住」、「歷史紀錄」，後兩區各自前端分頁（每頁 10 筆，只有一頁就不顯示）。**手機（md 以下）用卡片**：電話 `tel:`、Email `mailto:` 點了就打／寄，按鈕至少 44px，歷史紀錄預設收起來點標題展開；**電腦版**即將入住、歷史仍是表格，狀態用下拉選單。只列出還能改成的狀態（`next`），改之前先跳確認（改了不能回頭）；改完跳出寄了幾封確認信或取消通知。讀取中、讀取失敗（可重試）都有畫面。通行證失效（`unauthorized`）就回登入頁。最下面另外有「發紅包」（`bonusList`／`bonusCreate`／`bonusClose`，見「小遊戲的錢」），自己讀自己的，後端還是舊版時只有這一區顯示「要重新部署」，預約名單照常。 |

## 小遊戲的錢（`assets/wallet.js`）

小遊戲之間用同一個錢包串起來：**玩小遊戲賺錢 → 拿去 `scratch.html` 買刮刮樂**。之後新增的小遊戲也照這個接。

- 在 `<head>` 載入 `assets/wallet.js`（放在 `theme.js` 後面），會有全域的 `Wallet`：`Wallet.money`（現在有多少）、`Wallet.earn(金額, 來源)`、`Wallet.spend(金額)`（錢不夠回 `false`、不扣）、`Wallet.stats()`、`Wallet.fmt(n)`（`$1,430`）。
- 存在 `localStorage` 的 `dongbuli-wallet`：`{ money, spent, earned: { xitou: { times, total, best }, scratch: {…} }, pending }`。`earned` 照來源（哪個遊戲）分開記次數、總額、最大一筆，是留給之後排行榜、功德榜用的。
- 第一次來是 $1,000。舊版刮刮樂存在 `dongbuli-scratch-tw` 的錢會自動搬過來。
- **沒登入**：只存在那支手機。**用 LINE 登入**（見下面「LINE 登入」）：錢存在後端的 `Players`，跟著 LINE 帳號走。登入時手機照常馬上加減，同時把「變了多少」記在 `pending`，1.5 秒後（或離開頁面時）送 `walletSync`，後端加進帳號、回傳最新的錢包（`adopt()` = 後端的 + 還沒送的）。送變化量不送總額，兩支手機同時玩不會互相蓋掉。打開頁面時會先同步一次，拿別支手機玩過的結果。
- 第一次用 LINE 登入：用這支手機現在的錢開帳號（`Line.beforeLogin` 帶 `wallet`）。之後在別支手機登入：用帳號的錢，那支手機原本的訪客錢包收進 `dongbuli-wallet-guest`，登出時拿回來。
- `Wallet.on(fn)`：`'server'`（後端回來的錢跟手機上的不一樣，例如別支手機賺了）、`'login'`、`'logout'`。頁面自己加減錢不會觸發。
- 錢是手機算好送上去的，改得動（朋友間玩，不防）；後端只擋不合理的數字（不是整數、負的花費、超過一兆）和每小時同步次數。
- 新遊戲的工資抓「玩一次一分鐘左右、賺 $500～$1,500」，跟洗頭差不多，刮刮樂的票價（$50～$2,000）才有意義。
- **主人發紅包**（後台 → 手機錢包，要走後端）：後台 `admin_dashboard.html` 最下面的「發紅包」填每人金額、幾份、一句話，後端產生六碼紅包碼，卡片上有「分享／複製連結」（走 LIFF：`https://liff.line.me/2012419790-otENqBBj/scratch.html?hb=紅包碼`，在 LINE 裡點開會自動登入）和「收回」。旅人點連結，或在彩券行按「有紅包碼？」自己打，`claimHongbao()` 送 `bonusClaim`，成功就 `Wallet.earn(金額, 'bonus')`、跳「主人發紅包」全螢幕。一支手機一包只能領一次：手機自己產生亂數代號存在 `localStorage`（`dongbuli-device`，不是個資），後端照代號擋；領過的紅包碼另外記在 `dongbuli-hongbao`，省得再問後端。清掉 localStorage 可以重領，但一包最多就是 `max` 份。

## LINE 登入（`assets/line.js`）

- LIFF ID `2012419790-otENqBBj`，LINE Login channel ID `2012419790`（分帳 LIFF 同一個 channel；兩個都是公開的，channel secret 用不到，不要放進程式碼）。LIFF 的 Endpoint URL 是網站根目錄 `https://tingyu333.github.io/dongbuli4fun/`，scope 只有 `openid`、`profile`（不拿 Email）。
- 流程：網頁 `liff.init()` → 拿 `liff.getIDToken()` → 送 `lineLogin` → **後端拿去 `https://api.line.me/oauth2/v2.1/verify` 問 LINE**（`verifyLineToken()`，檢查 `aud` 是我們的 channel）→ 發網站自己的通行證（`session`，存在指令碼屬性 `sess:<uuid>`，不會過期，登出才刪）。**不能讓網頁直接送 LINE 的使用者代號給後端**（誰都能冒充）。網頁從頭到尾不知道使用者代號，後端也不回。
- 網頁存 `dongbuli-session`（通行證）、`dongbuli-profile`（名字、大頭貼網址）。在 LINE 裡打開（`liff.isLoggedIn()`）會自動登入；按過登出的記 `dongbuli-line-off`，不再自動登入（LINE 裡沒辦法真的登出 LIFF）。
- 用法：`Line.loggedIn`、`Line.profile`、`Line.login()`（不在 LINE 裡會跳去 LINE 登入頁再回來）、`Line.logout()`、`Line.on(fn)`、`Line.call(body)`（自動帶通行證，回 `unauthorized` 就當作登出）、`Line.liffUrl('scratch.html')`。LIFF 載不起來（本機、被擋）時 `Line.available` 是 false，頁面照常當訪客用。
- **從 LIFF 連結（`https://liff.line.me/<LIFF ID>/某頁?…`）進來，LINE 會先開 Endpoint（首頁）再由 `liff.init()` 轉到那一頁**，所以 `index.html` 也要載 `line.js`。主人發的紅包連結就是走 LIFF 網址，在 LINE 裡點開會自動登入、紅包直接進帳號。
- 目前載入 `line.js` 的頁：`index`（轉頁用）、`scratch`、`xitou`（要放在 `wallet.js` 前面）。之後訂房要用 LINE 登入（自動帶名字、我的預約不用打電話、入住券用 LINE 身分領）也是接這支。
- 後端第一次用 `UrlFetchApp` 要授權「連到外部服務」：在 Apps Script 編輯器執行一次 `authorizeLine()`。

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
  - 留言：`{ type: 'review', name, rating, message }` → `{ result: 'success', review: { name, rating, message, timestamp } }` 或 `error`（沒名字、沒內容、超過 300 字、評分不是 1～5、同一句十分鐘內重送、全站每小時超過 30 則）。名字照 `cleanName()`（12 字）；開頭是 `= + - @` 的存進 Sheet 前加 `'`，不會變成公式。不寄信。`getReviews` 回傳新的在前面、`timestamp` 是 ISO 字串、空白列跳過。
  - 領紅包（公開，`scratch.html`）：`{ type: 'bonusClaim', code, device }` → `{ result: 'success', amount, note, left }`、`{ result: 'claimed' }`（這支手機領過）、`{ result: 'empty' }`（領完了）或 `error`（沒有這個碼、被收回、沒帶裝置代號、全站每小時試超過 120 次）。紅包碼不分大小寫、會去掉空白。不回個資、不寄信。
  - LINE 登入（公開）：`{ type: 'lineLogin', idToken, wallet? }` → `{ result: 'success', session, player: { name, picture, money, spent, earned, isNew } }` 或 `error`（驗證不過、全站每小時超過 300 次）。新玩家用 `wallet`（這支手機的錢包，數字不合理就用 $1,000）開帳號，舊玩家不看 `wallet`、更新名字和大頭貼。`{ type: 'lineLogout', session }` → 刪掉這張通行證。
  - 錢包同步（要帶 `session`，沒帶或失效回 `unauthorized`）：`{ type: 'walletSync', session, delta: { money, spent, earned } }` → `{ result: 'success', wallet: { money, spent, earned } }`。`delta` 是這支手機上次同步後變了多少（`money` 可以是負的），全是 0 就是單純讀；數字不是整數、超過範圍、`earned` 的 key 不是小寫英文就整包不收（`error`）。錢最少 0、最多一兆。每個玩家每小時最多 1200 次。Sheet `Players`：A `created`、B `line_id`、C `name`、D `picture`、E `money`、F `spent`、G `earned`（JSON）、H `updated`。
  - 發紅包（要帶 `token`）：`{ type: 'bonusCreate', amount, max, note, token }`（`amount` 每人 1～2000 萬、`max` 1～100 份、`note` 最多 30 字）→ `{ result: 'success', code, bonuses }`；`{ type: 'bonusList', token }` → `{ result: 'success', bonuses: [{ code, amount, note, max, claimed, status, timestamp }] }`（新的在前面）；`{ type: 'bonusClose', code, token }` → 收回（`status` 變 `closed`，已經領走的不扣回），回新的 `bonuses`。Sheet `Bonuses`：A `timestamp`、B `code`、C `amount`、D `note`、E `max`、F `status`；`BonusClaims`：A `timestamp`、B `code`、C `device`（沒有分頁會自動建）。
- 所有頁面的 POST **都不用 `no-cors`**，直接 `fetch(API_URL, { method: 'POST', body: JSON.stringify(...) })`：字串 body 是 `text/plain`，不會觸發 CORS 預檢，GAS 轉址後的回應讀得到。不要加 `Content-Type: application/json`（會觸發預檢而失敗）。
- 寄信上限（每天，存在指令碼屬性 `mailCount-*`）：寄給部署者 50 封、寄給旅人 40 封（Gmail 個人帳號一天只能寄給 100 人）。超過就不寄、不影響訂房或改狀態。
- 若要改 API 欄位，記得 `apps-script/Code.gs` 也要同步修改並請使用者重新部署，且六個頁面（`index`、`reviews`、`ticket`、`scratch`、`admin_login`、`admin_dashboard`）的 `API_URL` 要一起更新。

## LINE bot

- 指令（訊息開頭符合才算）：`空房`／`房況`、`擲杯`／`擲筊`／`跋杯`（可接問題）、`抽籤`／`御神籤`、`天氣`／`氣象`、`訂房`、`分帳`／`拆帳`／`算帳`／`記帳`／`誰欠誰`／`AA`（回卡片＋按鈕打開使用者自己做的分帳 LIFF，網址是 `SPLIT_URL`）、`說明`／`指令`，加上下面那組看天、過日子的指令。**`說明`要列出全部指令**（`replyHelp()` 分六組：二十七樓、問神明、看天、過日子、看排球、沒有用），新增指令記得一起加。加好友（`follow`）、被拉進群組（`join`）會打招呼。
- 不是指令：一對一回一句廢話文學（`NONSENSE_LINES`，貼圖回 `STICKER_LINES`）；群組裡**只有被 @（`mention.mentionees[].isSelf`）才回**，平常聊天不插話。被 @ 時先把 @bot 那段字拿掉再判斷指令。同一個聊天室不連續回同一句（`CacheService` 的 `last:` key）。
- `空房` 回 Flex Message 月曆卡片（`calendarBubble()`，從這週日起 5～6 週、有人住填枯茶色、今天加圈），`altText` 是文字版房況（最多 400 字）。卡片顏色寫死白天那套，Flex 不跟晝夜切換。`printAvailabilityFlex()` 可以印出 JSON 貼到 Flex Message Simulator 預覽。`reply()` 收文字或組好的訊息物件。
- `抽籤` 回籤紙卡片（吉朱色、凶墨色，「再抽一支」是 message action，會再送一次「抽籤」）。`天氣` 回天氣卡片，資料來自 Open-Meteo（不用金鑰、非商業免費），`CacheService` 存 30 分鐘，讀不到就回一句文字；地點用指令碼屬性 `WEATHER_PLACE`／`WEATHER_LAT`／`WEATHER_LON`，預設台北。
- **看天、過日子**（以前是隱藏指令，現在都在 `說明` 裡；`隱藏指令`／`彩蛋` 回「已經沒有藏了」加說明）：`空氣`／`紫外線`／`UV`（Open-Meteo 空氣品質 API，存 30 分鐘；天氣卡片也多一行空氣，抓不到就不放）、`月亮`／`月相`／`農曆`、`節氣`、`夕陽`／`日出`／`日落`（這三個是程式自己算的天文公式，不用網路）、`放假`／`連假`／`假日`（`ruyut/TaiwanCalendar` 的 JSON 走 jsDelivr，抓今年和明年，存 6 小時）。卡片共用 `hiddenCard()`。`testHiddenSources()` 給使用者在編輯器裡確認來源抓得到。
- `油價`／`汽油`／`柴油`：中油官方牌價服務 `listpricewebservice.asmx/getCPCMainProdListPrice_Historical?prodid=1～4`（92、95、98、超級柴油，不用金鑰），回的是 .NET DataSet XML，`oilRecords()` 用 `XmlService` 解析、欄位用「名字裡有牌價／生效／產品」來認；最新一筆生效時間在未來的就是已公告的下週價格。存 3 小時（`oil`）。
- `股`／`股價`／`股票`（後面接代號或名稱）：證交所 `openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL`，找不到再查櫃買中心 `tpex_mainboard_daily_close_quotes`（很大，所以放後面），都不用金鑰、都是最近一個交易日收盤。欄位名稱兩邊不同，`normalizeStock()` 統一；日期是民國 `1151111`（`rocDate()`）；數字是字串，可能有逗號。漲朱色、跌綠色（`STOCK_DOWN`，台股習慣）。查到的那檔存 20 分鐘（`stock:` + 查詢字）。**群組裡查不到就不回**（`replyStock` 收到 `source`，非一對一回 `null`），避免「股市今天…」被當指令。
- `排球`／`TPVL`（後面可接隊名或 `戰績`）：TPVL **沒有公開 API**，從 `tpvl.tw/matches`、`/standings` 的 HTML 抓 Next.js RSC flight payload（`self.__next_f.push([1,"..."])` 串起來），展開 `"$L<id>"` lazy 參照（`tpvlDefs`／`tpvlResolve`），每列用 `className":"tp-mrow"`／`tp-sx-row` 切段，欄位是 `"data-field":"x","data-value":"y"`（`tpvlFields`，取第一次出現的）。參考 `ichendong/tpvl-skill`（MIT）。未完賽的列清掉比分（會撿到別場的）、同 `match_no`＋日期去重。隊名 slug 對照在 `TPVL_TEAMS`、簡稱在 `TPVL_ALIASES`（2026-27 五隊）。存 30 分鐘（`tpvl:matches`／`tpvl:standings`）。**官網改版就會壞**，壞了回「讀不到」。群組裡認不得的隊名不回。Claude 的環境連不到 tpvl.tw，測試用模擬的 payload。
- 排球球員（`排球 得分王`／`攔網`／`發球`／`攻擊`／`接發`／`防守`／`舉球`、`排球 球員 名字`、`排球 <隊> 球員`）：網址（`VOLLEY_CATEGORIES.path` + `query`）：得分是 `/stats/players?m=points&sort=points&order=desc`，其他是技能頁 `/stats/players/skills?m=block_points&skill=block&ssort=success&sorder=desc`、`m=reception_success&skill=reception…`、`m=dig_success&skill=dig…`、`m=setting_success&skill=setting…`（開源專案寫的 `sort=block_points` 是舊格式，官網會忽略）。得分頁的欄位是 `points`、`points_per_set`、`high_points`；技能頁的數字在 `success`（次數）、`success_rate`（可能是 0.48 或 48.5，`rateFmt()` 都處理）、`per_set`。`leaderField()` 取這頁第一個真的有值的欄位。**技能排行的路徑是 `/stats/players/skills?…`**（使用者在瀏覽器確認的；頁面裡的連結寫成 `/stats/players?…skill=…`，抓那個只會拿到得分頁）。路徑在 `VOLLEY_CATEGORIES.path`。讀不到數字欄位時回「讀不到數字，可能改版了」加官網連結。位置是 `"data-taxonomy":"position","data-term":"middle","children":"快攻手"`。每種一頁、存 1 小時（`tpvl:players:<key>`），一頁約 690KB。球員卡和單隊球員都用得分那頁。`debugTpvlPlayers()`／`debugTpvlLinks()` 會印出頁面實際的欄位和連結，官網改版時先跑這兩個。
- `狗`／`汪`／`狗狗`、`貓`／`喵`／`貓咪`（`exact: true`：整句只有這個字才算，群組聊天不會亂跳圖）：dog.ceo、The Cat API（備援 cataas），回圖片訊息加一句廢話。圖片訊息只回網址，LINE 自己去抓；要 HTTPS、JPEG／PNG（`isLineImage()`），gif 會重抽。`reply()` 可以一次回多則（陣列，最多 5 則）。
- 規則：只讀（程式裡不能有寫入 Sheet 的呼叫，要寫入的事回網站連結）、只用 Reply API（不推播）、不回名字電話 Email。
- 指令碼屬性：`LINE_CHANNEL_ACCESS_TOKEN`、`SHEET_ID`、`WEBHOOK_KEY`（webhook 網址要帶 `?key=`，對不上或沒設定就不處理）。
- 擲杯的三聖杯存在 `CacheService`，key 是 `streak:` + groupId／roomId／userId，6 小時。
- **台詞跟網站同步**：擲杯台詞（`jiaobei.html` 的 `RESULTS`）、御神籤（`index.html` 的 `FORTUNES`）改了，`line-bot/Code.gs` 的 `JIAOBEI_LINES`、`FORTUNES` 也要改，並請使用者重新部署 bot 專案。
- 圖文選單的圖是 `line-bot/richmenu.png`（2500×1686，大型 3×2 六格：上排空房・查、訂房・歸、天氣・觀，下排擲杯・問、抽籤・運、說明・閱）。版型和每格動作在 `line-bot/README.md`，改圖的格子順序時要一起改。

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
- 動態內容（留言、後台列表）以 template string 塞入 `innerHTML`；別人輸入的字（名字、留言、Email）先過頁內的 `esc()`。
- `.DS_Store` 未列入 `.gitignore`，不要提交它。
- commit message 目前多為簡短英文（如 `update admin page`、`add 404 page`）。
