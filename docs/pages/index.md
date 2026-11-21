<!-- 從 CLAUDE.md 拆出來的（2026-11-17）。改了這部分的功能，記得一起改這份。 -->

# index.html

首頁 + 訂房 Modal（含 1～8 人的人數選擇、選填 Email）+ 房況月曆 + 「我的預約」查詢取消（多人訂房顯示已領幾張、連到票夾）。訂好後除了入住通知書圖片，多人時還有「發票給同學」：分享 `ticket.html?id=訂房 id` 的連結。日期以「晚」為單位：入住日到退房前一天算有人住，退房那天可以讓下一組入住（flatpickr 入住選單擋有人住的晚上，退房選單用 maxDate 限制到下一個有人住的晚上）。


**載入（2026-11-18）**：flatpickr 改用 `assets/vendor/flatpickr/`（4.6.13，`defer`，語系 `zh-tw.js` 也在裡面；以前從 jsdelivr／npmcdn 抓、沒鎖版本、擋畫面）；`toKey()` 自己組 `yyyy-mm-dd`，不靠 flatpickr。房況改成 `DOMContentLoaded` 就開始抓（`startHome()`；以前等 `load`，要等大圖、字型都下載完）。**從 LINE 的連結要去別頁**（網址有 `liff.state` 而且不是首頁本身，`LIFF_HOP`）：不播電梯開場、等 `Line.ready` 後再 1.5 秒還在首頁才抓房況（通常已經被 LIFF 轉走了，省一次後端）。測試 `/home/claude/tw/home_slim.js`。


**我的預約的次數上限（2026-11-18）**：用電話查預約、取消有每小時上限（同一支電話查 10 次、取消 5 次；同一筆電話打錯 5 次），超過後端回錯誤訊息，頁面照樣用紙條顯示。

**公告跑馬燈**（2026-11-21，使用者要的「公告機制，在 admin 後台設定，放在首頁當跑馬燈，只能放一條」）：大圖（`<header>`）裡、導覽列下面一條 `#ann`（手機 `top: 4.6rem`、左右各 1rem；桌機置中最寬 640px），紙色半透明＋模糊底、左邊朱框「告」章、字從右往左跑（`.ann-text` `padding-left: 100%` 再 `translateX(-100%)`，速度一秒約 42px，最少 8 秒一圈）。按一下停住、再按繼續（`.is-paused`）；系統設定「減少動態」就不跑，整句換行顯示。`startHome()` 一開始叫 `startAnnounce()`：先用 `localStorage` `dongbuli-announce` 上次存的馬上顯示，再 `POST { type: 'announce' }` 拿新的（沒有公告、後端舊版、連不到就藏起來／維持原樣）；字一律 `textContent`。設定在 admin 後台「公告」分頁（見 `docs/pages/admin.md`）。

