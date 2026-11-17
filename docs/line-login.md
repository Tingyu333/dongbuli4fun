<!-- 從 CLAUDE.md 拆出來的（2026-11-17）。改了這部分的功能，記得一起改這份。 -->

# LINE 登入（`assets/line.js`）

- LIFF ID `2012419790-otENqBBj`，LINE Login channel ID `2012419790`（分帳 LIFF 同一個 channel；兩個都是公開的，channel secret 用不到，不要放進程式碼）。LIFF 的 Endpoint URL 是網站根目錄 `https://tingyu333.github.io/dongbuli4fun/`，scope 只有 `openid`、`profile`（不拿 Email）。
- 流程：網頁 `liff.init()` → 拿 `liff.getIDToken()` → 送 `lineLogin` → **後端拿去 `https://api.line.me/oauth2/v2.1/verify` 問 LINE**（`verifyLineToken()`，檢查 `aud` 是我們的 channel）→ 發網站自己的通行證（`session`，不會過期，登出才刪）。通行證存在 Sheet `Sessions`（A `created`、B `session`、C `line_id`、D `last_used`，`newSession()`／`sessionUser()`／`dropSession()`；查的時候先看 CacheService 六小時，沒有才翻分頁，翻到就記一次 `last_used`）。**以前存在指令碼屬性 `sess:<uuid>`**，可是指令碼屬性總共只能放 500 KB（約 6,700 張），滿了所有人都登入不了，2026-11-16 改掉；舊的 `sess:` 照樣認得，編輯器執行 `migrateSessions()` 一次搬完、刪掉（可以重複執行）。**不能讓網頁直接送 LINE 的使用者代號給後端**（誰都能冒充）。網頁從頭到尾不知道使用者代號，後端也不回。
- 等後端驗證時 `line.js` 自己蓋一層「驗證中」（`#line-busy`：朱色「絆」印一直蓋、虛線圈在轉，字照秒數換：跟 LINE 確認你是你 → LINE 說是本人沒錯 → 幫你把錢包搬上去 → 後端剛睡醒…），成功停在「歡迎，名字」一秒再收；失敗直接收掉、用 toast 說原因；最多 25 秒一定收。按登入要跳去 LINE 時顯示「前往 LINE」；網址帶 `code`＋`state`、`liffClientId` 或 `liff.state`（剛從 LINE 回來）時，SDK 還沒載完就先蓋上。頁面不用自己做。
- 網頁存 `dongbuli-session`（通行證）、`dongbuli-profile`（名字、大頭貼網址）。在 LINE 裡打開（`liff.isLoggedIn()`）會自動登入；按過登出的記 `dongbuli-line-off`，不再自動登入（LINE 裡沒辦法真的登出 LIFF）。
- 用法：`Line.loggedIn`、`Line.profile`、`Line.login()`（不在 LINE 裡會跳去 LINE 登入頁再回來）、`Line.logout()`、`Line.on(fn)`、`Line.call(body)`（自動帶通行證，回 `unauthorized` 就當作登出）、`Line.liffUrl('scratch.html')`。LIFF 載不起來（本機、被擋）時 `Line.available` 是 false，頁面照常當訪客用。
- **從 LIFF 連結（`https://liff.line.me/<LIFF ID>/某頁?…`）進來，LINE 會先開 Endpoint（首頁）再由 `liff.init()` 轉到那一頁**，所以 `index.html` 也要載 `line.js`。主人發的紅包連結就是走 LIFF 網址，在 LINE 裡點開會自動登入、紅包直接進帳號。
- 目前載入 `line.js` 的頁：`index`（轉頁用）、`member`、`scratch`、`xitou`、`fangwu`、`gongde`、`rank`、`baoxian`、`caiyuan`、`cengwang`、`zaocan`、`huoyun`、`tiandian`、`gushi`、`yuncai`（要放在 `wallet.js` 前面）。之後訂房要用 LINE 登入（自動帶名字、我的預約不用打電話、入住券用 LINE 身分領）也是接這支。
- 後端第一次用 `UrlFetchApp` 要授權「連到外部服務」：在 Apps Script 編輯器執行一次 `authorizeLine()`。
