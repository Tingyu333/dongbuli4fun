<!-- 從 CLAUDE.md 拆出來的（2026-11-17）。改了這部分的功能，記得一起改這份。 -->

# 小遊戲的錢（`assets/wallet.js`）

小遊戲之間用同一個錢包串起來：**玩小遊戲賺錢 → 拿去 `scratch.html` 買刮刮樂**。之後新增的小遊戲也照這個接。

- 在 `<head>` 載入 `assets/wallet.js`（放在 `theme.js` 後面），會有全域的 `Wallet`：`Wallet.money`（現在有多少）、`Wallet.earn(金額, 來源)`、`Wallet.spend(金額)`（錢不夠回 `false`、不扣）、`Wallet.stats()`、`Wallet.fmt(n)`（`$1,430`）。
- 存在 `localStorage` 的 `dongbuli-wallet`：`{ money, spent, earned: { xitou: { times, total, best }, scratch: {…} }, pending }`。`earned` 照來源（哪個遊戲）分開記次數、總額、最大一筆，是留給之後排行榜、功德榜用的。
- 第一次來是 $1,000。舊版刮刮樂存在 `dongbuli-scratch-tw` 的錢會自動搬過來。
- **沒登入**：只存在那支手機。**用 LINE 登入**（見 `docs/line-login.md`）：錢存在後端的 `Players`，跟著 LINE 帳號走。登入時手機照常馬上加減，同時把「變了多少」記在 `pending`，1.5 秒後（或離開頁面時）送 `walletSync`，後端加進帳號、回傳最新的錢包（`adopt()` = 後端的 + 還沒送的）。送變化量不送總額，兩支手機同時玩不會互相蓋掉。打開頁面時會先同步一次，拿別支手機玩過的結果。**每一包變化有編號（`sid`）**：送出去時從 `pending` 搬到 `outbox`，沒收到回覆就用同一個編號再送（每 5 秒），後端在 `Players` 的 K 欄記最近 40 個編號，看過的不再加（回 `dup: true`）；新的變化照樣記在 `pending`，等 `outbox` 送完才送下一包；`adopt()` = 後端的 + `outbox` + `pending`。以前沒收到回覆會把那包放回 `pending` 重送，可是後端其實已經加過了，iPhone 上一筆 $20,000 被扣了三次、錢包扣到 0（2026-11-15）。離開頁面時的同步**不用 `keepalive`**（Apps Script 會轉址，iPhone 一定失敗）。後端回「錢包的數字不對」就丟掉那包（再送也一樣）。
- 第一次用 LINE 登入：用這支手機現在的錢開帳號（`Line.beforeLogin` 帶 `wallet`）。之後在別支手機登入：用帳號的錢，那支手機原本的訪客錢包收進 `dongbuli-wallet-guest`，登出時拿回來。
- 後端直接改帳號的動作（目前只有保險）：先 `await Wallet.settle()`（等正在送的送完、再把 `pending` 送掉），後端回來的錢包用 `Wallet.adopt(wallet)` 接（= 後端的 + 還沒送的）。
- `Wallet.on(fn)`：`'server'`（後端回來的錢跟手機上的不一樣，例如別支手機賺了）、`'login'`、`'logout'`。頁面自己加減錢不會觸發。
- 錢是手機算好送上去的，改得動（朋友間玩，不防）；後端只擋不合理的數字（不是整數、負的花費、超過一兆）和每小時同步次數。
- 目前賺錢的遊戲：坐洗部（`xitou`）、房務部（`clean`）、菜園部（`farm`）、蹭網部（`wifi`）、早餐店（`zaocan`）、貨運（`ship`）、甜點店（`dessert`）、礦坑（`mine`，2026-11-20 上線但監修中：監修中試玩不發工資；後端排行榜認得了，礦坑部）；保險滿期的利息記在 `insure`。新遊戲的工資抓「玩一次一分鐘左右、賺 $500～$1,500」，跟洗頭差不多，刮刮樂的票價（$50～$2,000）才有意義。
- **功德**（`assets/gongde.js` 的規則，錢包裡的 `gongde: { donated, oil, oils, lamps, lit }`）：`Wallet.donate(金額)`（從錢包扣、算在 `spent`、`donated` 加上去）、`Wallet.lightLamp(價錢, 燈油, 哪種燈)`（光明燈加在 `oil`，其他燈加在 `oils[key]`；`lamps`+1、`lit` 加價錢）、`Wallet.useOil(多少, 哪種燈)`、`Wallet.oilOf(哪種燈)`、`Wallet.gongde`。**五種燈**（`Gongde.LAMPS`，每種各自的燈油；價錢都抓「點 $1 大約換回 $0.6～0.7」）：光明燈 `guangming`（$1,000 照 $1,500 的刮刮樂，沒中的票一半機會重抽；**燈油只有第一次抽到沒中的票才扣**（照票價，`BLESS.lost`），中獎率高的票（超級加倍七成會中）才不會白燒燈油，點 $1 換回約 0.75 × 回收率）、財神燈 `caishen`（$1,000 照 $3,000，中獎多兩成，兌獎時用 `setMoney(…, 'caishen')` 另外給「財神加碼」，張張有獎也算，燈油不夠一張就照比例 `t.cai`）、太歲燈 `taisui`（$600 一次，挖金礦一張用一次：第一顆炸彈變啞彈 `t.dud`，格子蓋「擋」、可以繼續挖；有擋的話最佳挖法期望值會多 $400 左右，所以一次 $600）、文昌燈 `wenchang`（$300 一顆頭，坐洗部工資多兩成）、月老燈 `yuelao`（$200 一顆頭，`makeCustomer()` 稀有客人機率兩倍、跟招牌合起來最多 2.5 倍（約 20% → 40%，招牌三級時 50%），稀有客人來了多給 $200「月老牽線」）。文昌、月老在 `showResult()` 洗完才用掉，加成跟店面升級寫在同一行「加成」（`shopParts.wenchang`／`yuelao`）；坐洗部標題下 `#lampNote` 寫哪幾盞亮著。登入時跟錢一樣送變化量（`pending.gongde`，燈油可以是負的），後端存在 `Players` 的 I 欄；後端還是舊版（回來的錢包沒有 `gongde`）就先用手機上的。**加持**（`Gongde.blessing(odds, 票價)`）：買票那一刻，這張第一次抽到沒中（張張有獎的是最小獎）時，有 q 的機會再抽一次（`scratch.html` 的 `rollT()` 看 `BLESS`，只重抽一次，重抽變好就記 `t.blessed`，中獎時結果上加「神明加持」）。q = 位階永久加持（每種刮刮樂各自有上限：加持後回收率最多 98%，`CAP`）＋光明燈 50%×（燈油/票價，最多 1），總共最多 90%；燈油照票價扣，只給一般刮刮樂用，張張有獎和挖金礦不扣。挖金礦完全沒有加持。捐 $1 大約換回 $0.6～0.7 期望值（點燈也是），故意讓捐錢有點虧，不會越捐越賺；改了 `TIERS`／`LAMPS`／機率表要重跑模擬（`blessOf()` 的預測中獎率要對得上）。每筆捐獻、點燈用 `Gongde.log()` 記在 `localStorage` 的 `dongbuli-gongde-log`（`queue` 還沒送的、`recent` 最近 30 筆），送 `gongdeLog` 存在 Sheet `Gongde`（之後功德榜用，目前不公開）。
- **坐洗部店面升級、菜園農具**都在錢包（`shop: { lv, spent }`，兩家店 key 不重複、`spent` 合計）：等級只升不降，所以同步不是送變化量，而是有改過（`pending.shop`）就送整份，後端每一項取比較高的、`spent` 取大的（`mergeShop()`）；回來的比手機上的高就發 `'shop'` 事件。登入時手機上買過的也會併進帳號（第一次登入開帳號用；別支手機登入也會併，不會把帳號的蓋掉）；登出拿回訪客那份。
- **主人發紅包**（後台 → 手機錢包，要走後端）：後台 `admin_dashboard.html` 最下面的「發紅包」填每人金額、幾份、一句話，後端產生六碼紅包碼，卡片上有「分享／複製連結」（走 LIFF：`https://liff.line.me/2012419790-otENqBBj/scratch.html?hb=紅包碼`，在 LINE 裡點開會自動登入）和「收回」。旅人點連結，或在彩券行按「有紅包碼？」自己打，`claimHongbao()` 送 `bonusClaim`，成功就 `Wallet.earn(金額, 'bonus')`、跳「主人發紅包」全螢幕。一支手機一包只能領一次：手機自己產生亂數代號存在 `localStorage`（`dongbuli-device`，不是個資），後端照代號擋；領過的紅包碼另外記在 `dongbuli-hongbao`，省得再問後端。清掉 localStorage 可以重領，但一包最多就是 `max` 份。


**紅包登入了只排一次隊（2026-11-18）**：彩券行領紅包時帶通行證，後端同一次就把錢加進帳號（`earned.bonus`），網頁拿回來的錢包直接 `Wallet.adopt()`，不用再送一次錢包同步；沒登入的照舊手機自己加。

**許願池（2026-11-19）**：`xuyuan.html` 每天第一個願望，後端直接把隨機 $3,000～6,666 加進帳號（`earned.wish`），跟紅包、保險一樣不走手機加；沒登入不能許。會員中心錢包的帳寫「許願池：許了 N 天的願」。`earned` 的來源後端最多收 20 種（`cleanEarned()`），現在約 14 種，新增來源要注意。

**專屬道具（2026-11-20）**：主人在 admin 後台（`admin.html`）發給某個人的道具，後端錢包回傳只給本人（`perks: [{ perk, expires }]`），`Wallet.adopt()`、登入時存進錢包的 `perks`，變了就 `emit('perks')`；登出、訪客是空的（訪客永遠原價）。
- `Wallet.perk('shop60')`：有沒有（要登入、沒過期）；`Wallet.perks('shop60')`：是哪幾個（`{ perk, name, line, expires }`，名字和那句話是主人在 admin 後台「道具庫」取的；朱印那條會寫名字，有那句話就多一行）。
- 「全店六折」只給**打工店的店面升級**（坐洗、菜園、蹭網、早餐、貨運、甜點、疊巢，2026-11-20 起加礦坑；朱印那條改寫「打工店的店面升級都打六折」，不寫家數）：價錢一律過 `Wallet.shopPrice(原價)`（顯示、能不能買、扣錢、記 `shop.spent` 都用它；甜點店鎖住的料盒標價也是）；按鈕用 `Wallet.priceTag(原價)`（原價劃掉、下一行六折價）；清單最上面 `Wallet.saleBanner()`（朱印「專屬・六折」，沒道具是空字串）。新的打工店做升級也照這樣接。刮刮樂、功德、股市、保險不接。
- 不公開：沒有任何別人看得到的標記；花錢照實際付的記。細節和使用者定的規則在 `docs/pages/admin.md`。
