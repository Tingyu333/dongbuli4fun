# 丼步喱・絆 LINE bot

在 LINE 裡問「空房」「擲杯」「抽籤」「訂房」，bot 回覆。可以加好友一對一聊，也可以拉進朋友的群組。

- **獨立的 Apps Script 專案**：不是網站後端那個，壞了也碰不到訂房和寄信。
- **只讀訂房 Sheet 的日期和狀態**：不寫任何東西，也不回任何名字、電話、Email。
- **只回覆、不主動推播**：Reply 不算進 LINE 免費方案每月 200 則的額度。

| 檔案 | 用途 |
| --- | --- |
| `Code.gs` | bot 程式，貼到新的 Apps Script 專案 |
| `richmenu.png` | 圖文選單的圖（2500×1686，大型 2×2 四格） |

## 設定步驟

### 1. 開 LINE 官方帳號，啟用 Messaging API

1. 到 [LINE Official Account Manager](https://manager.line.biz/) 建立官方帳號（免費方案就夠）。
2. 帳號的「設定 → Messaging API」→ 啟用 Messaging API，選一個 provider（選了不能改）。
3. 到 [LINE Developers Console](https://developers.line.biz/console/)，點進剛剛那個 channel 的「Messaging API」分頁，在最下面的 **Channel access token (long-lived)** 按 Issue，複製起來。

> 2024 年 9 月起不能直接在 Developers Console 建 Messaging API channel，一定要從官方帳號那邊啟用。

### 2. 建 bot 的 Apps Script 專案

1. 到 [script.google.com](https://script.google.com/) →「新專案」，取名「丼步喱 LINE bot」。
2. 把 `Code.gs` 整份貼進去，儲存。
3. 左側「專案設定」（齒輪）→ 最下方「指令碼屬性」，新增三個：
   - `LINE_CHANNEL_ACCESS_TOKEN`：步驟 1 複製的 token
   - `SHEET_ID`：訂房 Google Sheet 網址裡 `/d/` 和 `/edit` 中間那一長串
   - `WEBHOOK_KEY`：自己亂打一串英數字當暗號，例如 `27f-kizuna-8888`
4. 右上「部署 → 新增部署作業」→ 類型選「網頁應用程式」：
   - 執行身分：**我**
   - 誰可以存取：**所有人**
5. 按部署，第一次會跳出授權視窗：允許讀取試算表、連線到外部服務。複製「網頁應用程式網址」（結尾是 `/exec`）。
6. 用瀏覽器打開那個網址，看到「丼步喱・絆 LINE bot 醒著。」就是部署成功。

### 3. 把 webhook 接上

1. 回 Developers Console 的「Messaging API」分頁 → Webhook settings：
   - **Webhook URL**：部署網址加上 `?key=你的暗號`，例如 `https://script.google.com/macros/s/xxxx/exec?key=27f-kizuna-8888`
   - 打開 **Use webhook**
2. 回 Official Account Manager 的「設定 → 回應設定」：
   - 關掉「自動回應訊息」，不然官方帳號的罐頭訊息會跟 bot 一起回
   - 打開「Webhook」
3. 「設定 → 帳號設定」：允許「加入群組或多人聊天室」，才能拉進朋友的群組。

> Webhook settings 裡的「Verify」按鈕有時會因為 Apps Script 回應前會先轉址而顯示失敗，但實際傳訊息通常照樣會動。以「加好友傳一句『空房』有沒有回」為準。

### 4. 測試

用手機加官方帳號好友（Developers Console 的「Messaging API」分頁有 QR code），依序傳：

- `說明`：應該列出四個指令
- `空房`：接下來 30 天的房況
- `擲杯 今晚續攤嗎`：連擲三次，看三聖杯會不會蓋「定」
- `抽籤`

沒反應的話，到 bot 專案左側「執行作業」看紀錄。

### 5. 圖文選單（選用，不用寫程式）

Official Account Manager →「主頁 → 圖文選單 → 建立」：

1. 版型選「大型」的 **2×2 四格**，圖片上傳 `richmenu.png`
2. 四格的動作（左上、右上、左下、右下）：
   - 左上：類型「文字」，內容 `空房`
   - 右上：類型「文字」，內容 `擲杯`
   - 左下：類型「文字」，內容 `抽籤`
   - 右下：類型「連結」，網址 `https://tingyu333.github.io/dongbuli4fun/`
3. 選單列顯示文字可以填「二十七樓」，設定成預設顯示，儲存。

## 指令

| 指令 | 回覆 |
| --- | --- |
| `空房`、`房況` | 今晚有沒有人、接下來 30 天哪幾晚有人（入住日到退房前一晚算有人，已取消不算），附訂房連結 |
| `擲杯`、`擲筊`、`跋杯`（後面可以接問題） | 聖杯 1/2、笑杯 1/4、陰杯 1/4、1/88 立杯。同一個聊天室問同一個問題，連續三個聖杯蓋「定」；換問題或 6 小時沒擲就重算 |
| `抽籤`、`御神籤` | 跟網站首頁一樣的御神籤 |
| `訂房` | 網站連結 |
| `說明`、`指令` | 指令列表 |
| 其他任何話、貼圖 | 一句廢話文學（「聽君一席話，如聽一席話」那種），同一個聊天室不會連續回同一句 |

- 只認訊息**開頭**的關鍵字。
- **一對一**：不是指令也會回廢話，傳貼圖也回。
- **群組**：只有 **@bot** 才回廢話，平常聊天不會被插話；「@bot 空房」也能當指令用。
- 加好友、被拉進群組時會打招呼。

## 改程式的規則

- **只讀**：要寫入的事（訂房、改狀態、取消）一律回網站連結，不在 bot 裡做。Apps Script 讀不到 `X-Line-Signature`，沒辦法確認請求真的來自 LINE，bot 能寫入的話，誰都能透過它寫入。
- **只回覆**：不用 Push API。要主動通知（例如新訂房）會用到每月 200 則的額度，而且訂房是公開動作，被洗版就會燒光；真的要做，先加每日上限。
- **不回個資**：名字、電話、Email 都不回。
- **廢話台詞**在 `Code.gs` 的 `NONSENSE_LINES`（文字）和 `STICKER_LINES`（貼圖），直接加句子就好，改完重新部署。
- **台詞跟網站同步**：擲杯台詞在 `jiaobei.html` 的 `RESULTS`，御神籤在 `index.html` 的 `FORTUNES`。改了網站的台詞，記得也改 `Code.gs`，再重新部署。
