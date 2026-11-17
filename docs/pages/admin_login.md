<!-- 從 CLAUDE.md 拆出來的（2026-11-17）。改了這部分的功能，記得一起改這份。 -->

# admin_login.html

後台登入：只有密碼，送到後端 `adminLogin` 比對，拿到 6 小時的通行證存在 `localStorage.adminToken`。後台兩頁打後端都走頁內的 `callApi()`：連不上、或 Apps Script 回了一頁 HTML 錯誤時，把原因翻成中文顯示出來（重新授權、同時太多人、今天用量到上限、Code.gs 沒貼完整…，後面附 Google 原本的錯誤字），不再只說「連不上後端」。
