// 丼步喱・絆 LINE bot（獨立的 Apps Script 專案，不是網站後端那個）
// 這份是備份與版本紀錄：貼到 bot 專案的編輯器，再「部署 → 管理部署作業 → 編輯 → 新版本」才會生效。
//
// 兩條規則讓它不用擔心資安（Apps Script 讀不到 X-Line-Signature，沒辦法驗證請求真的來自 LINE）：
// 1. 只讀：只看訂房 Sheet 的日期和狀態三欄，程式裡沒有任何寫入的呼叫（setValue、appendRow 之類）。
//    之後加功能也要守住：要寫入的事（訂房、改狀態）一律回網站連結，不在 bot 裡做。
// 2. 只回覆：只用 Reply API 回應別人傳來的訊息，不主動推播。偽造的請求拿不到 LINE 發的回覆權杖，回不了任何人；
//    Reply 也不算進免費方案每月 200 則的推播額度。
// 不回任何個資：名字、電話、Email 都不碰。
//
// 指令碼屬性（專案設定 → 指令碼屬性）：
//   LINE_CHANNEL_ACCESS_TOKEN  LINE Developers 的 Channel access token（long-lived）
//   SHEET_ID                   訂房 Google Sheet 網址 /d/ 和 /edit 中間那串
//   WEBHOOK_KEY                自己取的一串暗號，webhook 網址後面加 ?key=暗號，對不上的請求直接丟掉

var SITE_URL = 'https://tingyu333.github.io/dongbuli4fun/';
var SPLIT_URL = 'https://liff.line.me/2012419790-HYQOWzgM'; // 老闆做的分帳 LIFF
var DAYS_AHEAD = 30;

// 關鍵字：只認訊息開頭。群組裡被 @ 時，會先把 @bot 那段拿掉再判斷（「@丼步喱 空房」也算）
var COMMANDS = [
  { words: ['空房', '房況'], run: replyAvailability },
  { words: ['擲杯', '擲筊', '跋杯'], run: replyJiaobei },
  { words: ['抽籤', '御神籤'], run: replyOmikuji },
  { words: ['天氣', '氣象'], run: replyWeather },
  { words: ['訂房'], run: replyBooking },
  { words: ['說明', '指令'], run: replyHelp },
  { words: ['分帳', '拆帳', '算帳', '記帳', '誰欠誰', 'AA'], run: replySplit },
  { words: ['空氣', '紫外線', 'UV', 'uv'], run: replyAir },
  { words: ['月亮', '月相', '農曆'], run: replyMoon },
  { words: ['節氣'], run: replySolarTerm },
  { words: ['日出', '日落', '夕陽'], run: replySun },
  { words: ['放假', '連假', '假日'], run: replyHoliday },
  { words: ['油價', '汽油', '柴油'], run: replyOil },
  { words: ['股價', '股票', '股'], run: replyStock }, // 長的放前面，「股票 2330」才不會被切成「票 2330」
  // 狗、貓只認整句（「狗屎運」「貓咪好可愛」不會在群組裡突然冒出一張圖）
  { words: ['狗', '汪', '狗狗', '汪汪'], exact: true, run: replyDog },
  { words: ['貓', '喵', '貓貓', '貓咪', '喵喵'], exact: true, run: replyCat },
  { words: ['隱藏指令', '彩蛋'], run: replySecrets }
];

// --- 收訊息 ---

function doPost(e) {
  var key = prop('WEBHOOK_KEY');
  if (!key || (e.parameter || {}).key !== key) return ok(); // 暗號不對，當作沒收到

  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return ok();
  }

  (body.events || []).forEach(function (ev) {
    if (!ev.replyToken) return;
    try {
      var text = null;
      if (ev.type === 'follow' || ev.type === 'join') text = welcomeText(ev.type);
      if (ev.type === 'message' && ev.message) text = handleMessage(ev.message, ev.source || {});
      if (text) reply(ev.replyToken, text);
    } catch (err) {
      console.error('處理訊息失敗', err);
    }
  });
  return ok();
}

// 用 GET 打開 webhook 網址時給個回應，確認部署成功
function doGet() {
  return ContentService.createTextOutput('丼步喱・絆 LINE bot 醒著。');
}

// 一對一：不是指令就回一句廢話。群組：只有被 @ 才回廢話，平常聊天不插話
function handleMessage(message, source) {
  var oneOnOne = source.type === 'user';
  if (message.type === 'sticker') return oneOnOne ? nonsense(source, STICKER_LINES) : null;
  if (message.type !== 'text') return null;

  var mentioned = false;
  var text = String(message.text || '');
  var mentionees = (message.mention && message.mention.mentionees) || [];
  // 從後面往前切，前面的位置才不會跑掉
  mentionees.slice().sort(function (a, b) { return b.index - a.index; }).forEach(function (m) {
    if (!m.isSelf) return;
    mentioned = true;
    text = text.slice(0, m.index) + text.slice(m.index + m.length);
  });
  text = text.trim();

  for (var i = 0; i < COMMANDS.length; i++) {
    for (var j = 0; j < COMMANDS[i].words.length; j++) {
      var word = COMMANDS[i].words[j];
      var hit = COMMANDS[i].exact ? text.replace(/[!！~～。.?？]+$/, '') === word : text.indexOf(word) === 0;
      if (hit) return COMMANDS[i].run(text.slice(word.length).trim(), source);
    }
  }
  return oneOnOne || mentioned ? nonsense(source, NONSENSE_LINES) : null;
}

// --- 廢話（聽君一席話，如聽一席話） ---

var NONSENSE_LINES = [
  '聽君一席話，如聽一席話。',
  '你說的很有道理，因為你說了。',
  '這件事，你不說我也不知道。',
  '如果你不知道，那你就是不知道。',
  '二十七樓的風景很好，因為它在二十七樓。',
  '二十七樓比二十六樓高一樓。',
  '電梯往上的時候，就是在上樓。',
  '吃丼飯的時候，就是在吃丼飯。',
  '人生就像一碗丼飯，吃完就沒了。',
  '一個人住叫獨居，兩個人住叫兩個人住。',
  '明天的事明天再說，因為今天還是今天。',
  '退房的那一天，就是退房日。',
  '每一個晚上，都是晚上。',
  '十二點一過，就是半夜了。',
  '一天有二十四小時，晚上也算在裡面。',
  '想睡就去睡，睡著了就睡著了。',
  '早起的人，起得比較早。',
  '喝醉的人，通常都喝了酒。',
  '只要不下雨，就不會下雨。',
  '你的問題很好，好在它是一個問題。',
  '這個問題問得好，問完了。',
  '我聽懂了，你在說話。',
  '你傳的這句話我收到了，它是一句話。',
  '我想了很久，終於想完了。',
  '等一下，就是等一下。',
  '有空的時候，就是有空。',
  '時間會證明一切，因為時間一直在過。',
  '房間很安靜，因為沒有聲音。',
  '門關著的時候，是關著的。',
  '冰箱是空的，因為裡面沒有東西。',
  '錢包裡的錢，花掉就沒有了。',
  '老闆說房價八千八，因為它是八千八。',
  '老闆今天不在，因為他不在這裡。',
  '前夫的指紋，只有前夫有。',
  '羈絆之所以是羈絆，是因為它是羈絆。',
  '認真的人，都很認真。',
  '你說的我都同意，除了我不同意的那些。',
  '每次我閉上眼睛，就什麼都看不到了。',
  '走著走著，就走了。',
  '沒有人住的房間，就是空房。',
  '神明說，你可以擲個杯，因為你可以擲個杯。',
  '這句話很重要，所以我說了一次。',
  '凡事都有第一次，第二次是在第一次之後。',
  '你現在在看這句話，因為你在看這句話。'
];

var STICKER_LINES = [
  '這張貼圖，我看到了，它是一張貼圖。',
  '你傳了一張貼圖，所以我收到了一張貼圖。',
  '貼圖很可愛，因為它長得很可愛。',
  '收到。這是一張你傳來的貼圖。'
];

// 同一個聊天室不連續回同一句
function nonsense(source, lines) {
  var cache = CacheService.getScriptCache();
  var key = 'last:' + (source.groupId || source.roomId || source.userId || 'anon');
  var last = Number(cache.get(key));
  var i;
  do { i = Math.floor(Math.random() * lines.length); } while (lines.length > 1 && i === last);
  cache.put(key, String(i), 6 * 60 * 60);
  return lines[i];
}

// --- 空房 ---

// 空房回一張月曆卡片（Flex Message）；通知和聊天列表顯示的預覽文字是文字版房況
function replyAvailability() {
  var today = todayStr();
  var weekday = new Date(today + 'T00:00:00Z').getUTCDay();
  var gridStart = addDays(today, -weekday);                      // 這週日
  var weeks = Math.ceil((weekday + DAYS_AHEAD) / 7);             // 5～6 週，蓋得到接下來 30 天
  var gridEnd = addDays(gridStart, weeks * 7);
  var booked = bookedNights(today, gridEnd);
  return {
    type: 'flex',
    altText: availabilityText(today, booked).slice(0, 400),
    contents: calendarBubble(today, gridStart, weeks, booked)
  };
}

// 從 from 到 to（不含）哪幾晚有人：入住日到退房前一晚算有人，跟網站一樣
function bookedNights(from, to) {
  var booked = {};
  readBookedRanges().forEach(function (r) {
    for (var night = r.check_in; night < r.check_out; night = addDays(night, 1)) {
      if (night >= from && night < to) booked[night] = true;
    }
  });
  return booked;
}

// 文字版（卡片的預覽文字，也是看不到卡片的舊版 LINE 會顯示的內容）
function availabilityText(today, booked) {
  var end = addDays(today, DAYS_AHEAD);
  var stretches = [];
  for (var d = today; d < end; d = addDays(d, 1)) {
    if (!booked[d]) continue;
    var last = stretches[stretches.length - 1];
    if (last && addDays(last.to, 1) === d) last.to = d;
    else stretches.push({ from: d, to: d });
  }

  var lines = ['二十七樓・房況', '今晚：' + (booked[today] ? '有人了' : '空著')];
  if (!stretches.length) {
    lines.push('接下來 ' + DAYS_AHEAD + ' 天每一晚都空著，揪團吧。');
  } else {
    lines.push('有人的晚上：');
    stretches.forEach(function (s) {
      var n = nightsBetween(s.from, s.to) + 1;
      lines.push('・' + shortDay(s.from) + (n > 1 ? '～' + shortDay(s.to) + '（' + n + ' 晚）' : ''));
    });
  }
  return lines.join('\n');
}

// --- 月曆卡片（顏色跟網站白天一樣：米白紙、枯茶、墨色。Flex 不會跟著晝夜切換） ---

var COLOR = { bg: '#fcfaf8', ink: '#2c2c2c', text: '#4a4a4a', accent: '#8e8070', sub: '#dcdcdc', faded: '#c9c3ba', white: '#ffffff', shu: '#b33a2f' };

function calendarBubble(today, gridStart, weeks, booked) {
  var tonight = booked[today];
  var rows = [];
  for (var w = 0; w < weeks; w++) {
    var cells = [];
    for (var i = 0; i < 7; i++) cells.push(dayCell(addDays(gridStart, w * 7 + i), today, booked));
    rows.push({ type: 'box', layout: 'horizontal', spacing: 'xs', contents: cells });
  }

  var headerCells = '日一二三四五六'.split('').map(function (c) {
    return { type: 'text', text: c, size: 'xxs', color: COLOR.accent, align: 'center', flex: 1 };
  });

  return {
    type: 'bubble',
    styles: { body: { backgroundColor: COLOR.bg }, footer: { backgroundColor: COLOR.bg } },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: 'ROOM STATUS', size: 'xxs', color: COLOR.accent },
        { type: 'text', text: '二十七樓・房況', size: 'lg', color: COLOR.ink, margin: 'sm' },
        {
          type: 'box', layout: 'horizontal', margin: 'md', contents: [
            { type: 'text', text: '今晚', size: 'sm', color: COLOR.accent, flex: 0 },
            { type: 'text', text: tonight ? '有人了' : '空著，來吧', size: 'sm', color: COLOR.ink, margin: 'md' }
          ]
        },
        { type: 'separator', margin: 'lg', color: COLOR.sub },
        { type: 'box', layout: 'horizontal', margin: 'lg', contents: headerCells },
        { type: 'box', layout: 'vertical', margin: 'sm', spacing: 'xs', contents: rows },
        {
          // 圖例：整列垂直置中（不要用 offsetTop 推圓點，會超出邊界被 LINE 裁掉）
          type: 'box', layout: 'horizontal', margin: 'lg', spacing: 'sm', alignItems: 'center', contents: [
            { type: 'box', layout: 'vertical', width: '12px', height: '12px', cornerRadius: '6px', backgroundColor: COLOR.accent, contents: [] },
            { type: 'text', text: '有人住', size: 'xxs', color: COLOR.text, flex: 0 },
            { type: 'box', layout: 'vertical', width: '12px', height: '12px', cornerRadius: '6px', borderWidth: '1px', borderColor: COLOR.ink, contents: [], margin: 'md' },
            { type: 'text', text: '今天', size: 'xxs', color: COLOR.text, flex: 0 }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingTop: '0px',
      contents: [{
        type: 'button',
        style: 'primary',
        color: COLOR.ink,
        height: 'sm',
        action: { type: 'uri', label: '去訂房', uri: SITE_URL }
      }]
    }
  };
}

// 一格：有人住填枯茶色、今天加圈、過去的日子變淡；每個月 1 號（和第一格）標月份
function dayCell(day, today, booked) {
  var d = new Date(day + 'T00:00:00Z');
  var label = d.getUTCDate() === 1 || day === addDays(today, -new Date(today + 'T00:00:00Z').getUTCDay())
    ? (d.getUTCMonth() + 1) + '/' + d.getUTCDate()
    : String(d.getUTCDate());
  var past = day < today;
  var isBooked = !past && booked[day];
  // 外層撐滿一格、裡面放固定 30×30 的正圓：格子變寬時圈才不會被拉成橢圓
  var dot = {
    type: 'box',
    layout: 'vertical',
    width: '30px',
    height: '30px',
    justifyContent: 'center',
    alignItems: 'center',
    cornerRadius: '15px',
    contents: [{
      type: 'text',
      text: label,
      size: label.length > 2 ? 'xxs' : 'xs',
      align: 'center',
      color: past ? COLOR.faded : isBooked ? COLOR.white : COLOR.ink
    }]
  };
  if (isBooked) dot.backgroundColor = COLOR.accent;
  if (day === today) {
    dot.borderWidth = '2px';
    dot.borderColor = COLOR.ink;
  }
  return { type: 'box', layout: 'vertical', flex: 1, alignItems: 'center', contents: [dot] };
}

// 編輯器上方選這個函式按「執行」：用真的訂房資料印出卡片 JSON，
// 貼到 LINE 的 Flex Message Simulator（https://developers.line.biz/flex-simulator/）就能預覽
function printAvailabilityFlex() {
  console.log(JSON.stringify(replyAvailability().contents, null, 2));
}

// 只讀日期和狀態兩欄以外什麼都不碰：E=check_in, F=check_out, G=status
function readBookedRanges() {
  var sheet = SpreadsheetApp.openById(prop('SHEET_ID')).getSheetByName('Bookings');
  var rows = sheet.getDataRange().getValues();
  var ranges = [];
  for (var i = 1; i < rows.length; i++) {
    var checkIn = toDateStr(rows[i][4]);
    var checkOut = toDateStr(rows[i][5]);
    var status = rows[i][6] || 'confirmed';
    if (!checkIn || !checkOut || status === 'cancelled') continue;
    ranges.push({ check_in: checkIn, check_out: checkOut });
  }
  return ranges;
}

// --- 擲杯（台詞跟網站 jiaobei.html 一樣） ---

var JIAOBEI_LINES = {
  聖杯: ['神明點頭了。', '准。這個不錯。', '老闆說的不算，神明說的算。', '准了，神明覺得ｏｋ。'],
  笑杯: ['神明笑而不語。', '問題太好笑，神明笑到沒辦法回答。', '神明在笑你，換個問法吧。', '你心裡早就有答案了吧。'],
  陰杯: ['神明說：不要。', '這題神明不想回答。', '再問下去，神明要收香油錢了。', '神明搖頭，老闆也搖頭。']
};

// 「擲杯 今晚要續攤嗎」：同一個聊天室問同一個問題，連續三個聖杯才算數（記 6 小時）
function replyJiaobei(question, source) {
  var cache = CacheService.getScriptCache();
  var key = 'streak:' + (source.groupId || source.roomId || source.userId || 'anon');
  var saved = {};
  try { saved = JSON.parse(cache.get(key) || '{}'); } catch (err) { }
  var streak = saved.q === question && saved.n < 3 ? saved.n : 0; // 換了問題、或上一輪已經定案，就重新算

  // 每支筊杯平面朝上的機率一半：聖杯 1/2、笑杯 1/4、陰杯 1/4；另外 1/88 會立起來
  var name, line;
  if (Math.random() < 1 / 88) {
    name = '立杯';
    line = '神明有話要當面說，請親自上二十七樓。';
    streak = 0;
  } else {
    var a = Math.random() < 0.5, b = Math.random() < 0.5;
    name = a !== b ? '聖杯' : a ? '笑杯' : '陰杯';
    streak = name === '聖杯' ? streak + 1 : 0;
    line = streak === 3 ? '三聖杯。就這麼定了，不能反悔。' : pick(JIAOBEI_LINES[name]);
  }
  cache.put(key, JSON.stringify({ q: question, n: streak }), 6 * 60 * 60);

  var marks = '聖'.repeat(streak) + '・'.repeat(3 - streak);
  var head = question ? '問：' + question.slice(0, 30) + '\n\n' : '';
  return head + '【' + name + '】\n' + line + '\n\n三聖杯：' + marks +
    (streak === 3 ? '\n——定——' : streak ? '\n再擲一次，同一個問題。' : '');
}

// --- 抽籤（跟網站首頁的御神籤一樣） ---

var FORTUNES = [
  { rank: '大吉', lines: ['今晚前夫不在', '宜直衝二十七樓'] },
  { rank: '中吉', lines: ['友情小船平穩航行', '忌提起當年那件事'] },
  { rank: '小吉', lines: ['明早有手工早餐', '前提是你自己做'] },
  { rank: '吉', lines: ['網路可能會斷', '但羈絆不會'] },
  { rank: '吉', lines: ['客房服務已就位', '服務人員是你'] },
  { rank: '末吉', lines: ['房價毫無折扣', '宜先存八千八'] },
  { rank: '凶', lines: ['宜叫外送', '忌自己下廚'] },
  { rank: '大凶', lines: ['指紋比對失敗', '請找前夫開門'] }
];

// 回一張籤紙卡片：吉用朱色大字（被神明蓋章的東西才用朱色），凶用墨色。同一個聊天室不連續抽到同一支
function replyOmikuji(args, source) {
  var cache = CacheService.getScriptCache();
  var key = 'omikuji:' + (source.groupId || source.roomId || source.userId || 'anon');
  var last = Number(cache.get(key));
  var i;
  do { i = Math.floor(Math.random() * FORTUNES.length); } while (i === last);
  cache.put(key, String(i), 6 * 60 * 60);
  var f = FORTUNES[i];
  var unlucky = f.rank.indexOf('凶') !== -1;

  return {
    type: 'flex',
    altText: '今晚的籤：' + f.rank + '｜' + f.lines[0] + '，' + f.lines[1],
    contents: {
      type: 'bubble',
      size: 'kilo',
      styles: { body: { backgroundColor: COLOR.bg }, footer: { backgroundColor: COLOR.bg } },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '24px',
        contents: [
          { type: 'text', text: 'OMIKUJI', size: 'xxs', color: COLOR.accent, align: 'center' },
          { type: 'text', text: '今晚的籤', size: 'sm', color: COLOR.text, align: 'center', margin: 'sm' },
          { type: 'text', text: f.rank, size: '5xl', weight: 'bold', align: 'center', margin: 'xl', color: unlucky ? COLOR.ink : COLOR.shu },
          { type: 'separator', margin: 'xl', color: COLOR.sub },
          { type: 'text', text: f.lines[0], size: 'md', color: COLOR.ink, align: 'center', margin: 'xl', wrap: true },
          { type: 'text', text: f.lines[1], size: 'md', color: COLOR.ink, align: 'center', margin: 'sm', wrap: true },
          { type: 'text', text: '二十七樓・御神籤', size: 'xxs', color: COLOR.faded, align: 'center', margin: 'xxl' }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingTop: '0px',
        contents: [{ type: 'button', style: 'link', color: COLOR.accent, height: 'sm', action: { type: 'message', label: '再抽一支', text: '抽籤' } }]
      }
    }
  };
}

// --- 天氣（Open-Meteo：免費、不用申請金鑰，非商業用途一天約一萬次） ---
// 地點放指令碼屬性 WEATHER_PLACE、WEATHER_LAT、WEATHER_LON，沒設定就用台北

var WEATHER_CODES = [
  [0, '晴'], [1, '大致晴朗'], [2, '晴時多雲'], [3, '陰'], [45, '有霧'], [48, '有霧'],
  [51, '毛毛雨'], [53, '毛毛雨'], [55, '毛毛雨'], [56, '凍雨'], [57, '凍雨'],
  [61, '小雨'], [63, '下雨'], [65, '大雨'], [66, '凍雨'], [67, '凍雨'],
  [71, '小雪'], [73, '下雪'], [75, '大雪'], [77, '飄雪'],
  [80, '陣雨'], [81, '陣雨'], [82, '大陣雨'], [85, '陣雪'], [86, '陣雪'],
  [95, '雷雨'], [96, '雷雨'], [99, '雷雨']
];

function weatherName(code) {
  for (var i = 0; i < WEATHER_CODES.length; i++) if (WEATHER_CODES[i][0] === code) return WEATHER_CODES[i][1];
  return '天氣很難說';
}

function replyWeather() {
  var w = fetchWeather();
  if (!w) return '天氣讀不到，看一下窗外比較快。';
  var place = prop('WEATHER_PLACE') || '台北';
  var now = Math.round(w.current.temperature_2m);
  var feels = Math.round(w.current.apparent_temperature);
  var sky = weatherName(w.current.weather_code);
  var day = function (i) {
    return {
      hi: Math.round(w.daily.temperature_2m_max[i]),
      lo: Math.round(w.daily.temperature_2m_min[i]),
      rain: w.daily.precipitation_probability_max[i] || 0,
      sky: weatherName(w.daily.weather_code[i])
    };
  };
  var today = day(0), tomorrow = day(1);
  var tip = weatherTip(today, w.current.weather_code);
  var air = fetchAir(); // 讀不到就不放這行

  var dayRow = function (label, d) {
    return {
      type: 'box', layout: 'horizontal', margin: 'md', contents: [
        { type: 'text', text: label, size: 'sm', color: COLOR.accent, flex: 2 },
        { type: 'text', text: d.sky, size: 'sm', color: COLOR.ink, flex: 3 },
        { type: 'text', text: d.lo + '～' + d.hi + '°', size: 'sm', color: COLOR.ink, flex: 3, align: 'end' },
        { type: 'text', text: '雨 ' + d.rain + '%', size: 'sm', color: COLOR.text, flex: 3, align: 'end' }
      ]
    };
  };

  return {
    type: 'flex',
    altText: place + ' ' + now + '°，' + sky + '。今天 ' + today.lo + '～' + today.hi + '°，降雨 ' + today.rain + '%',
    contents: {
      type: 'bubble',
      styles: { body: { backgroundColor: COLOR.bg } },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        contents: [
          { type: 'text', text: 'WEATHER', size: 'xxs', color: COLOR.accent },
          { type: 'text', text: '二十七樓・天氣', size: 'lg', color: COLOR.ink, margin: 'sm' },
          { type: 'text', text: place, size: 'xs', color: COLOR.text, margin: 'xs' },
          {
            type: 'box', layout: 'horizontal', margin: 'lg', alignItems: 'flex-end', contents: [
              { type: 'text', text: now + '°', size: '4xl', color: COLOR.ink, flex: 0 },
              {
                type: 'box', layout: 'vertical', margin: 'lg', paddingBottom: '6px', contents: [
                  { type: 'text', text: sky, size: 'md', color: COLOR.ink },
                  { type: 'text', text: '體感 ' + feels + '°', size: 'xs', color: COLOR.text }
                ]
              }
            ]
          },
          { type: 'separator', margin: 'lg', color: COLOR.sub },
          dayRow('今天', today),
          dayRow('明天', tomorrow)
        ].concat(air ? [{
          type: 'box', layout: 'horizontal', margin: 'md', contents: [
            { type: 'text', text: '空氣', size: 'sm', color: COLOR.accent, flex: 2 },
            { type: 'text', text: aqiLevel(air.aqi) + '・紫外線最高 ' + air.uvMax + '（' + uvLevel(air.uvMax) + '）', size: 'sm', color: COLOR.ink, flex: 9, wrap: true }
          ]
        }] : []).concat([
          { type: 'text', text: tip, size: 'sm', color: COLOR.accent, margin: 'xl', wrap: true }
        ])
      }
    }
  };
}

// 一句廢話式的建議
function weatherTip(today, code) {
  if (code >= 95) return '會打雷。打雷的時候，會有雷聲。';
  if (today.rain >= 60) return '帶傘。下雨的時候，地會濕。';
  if (today.rain >= 30) return '可能會下雨，也可能不會。';
  if (today.hi >= 32) return '很熱，因為溫度很高。宜待在二十七樓吹冷氣。';
  if (today.lo <= 15) return '有點冷，冷的時候要穿外套。';
  return '天氣很好，好在它是天氣。';
}

// 拿 Open-Meteo 的天氣，存 30 分鐘；失敗回 null
function fetchWeather() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('weather');
  if (cached) return JSON.parse(cached);
  var lat = prop('WEATHER_LAT') || '25.0330';
  var lon = prop('WEATHER_LON') || '121.5654';
  var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) + '&longitude=' + encodeURIComponent(lon) +
    '&current=temperature_2m,apparent_temperature,weather_code' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&timezone=Asia%2FTaipei&forecast_days=2';
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      console.error('天氣讀取失敗', res.getResponseCode(), res.getContentText());
      return null;
    }
    var data = JSON.parse(res.getContentText());
    if (!data.current || !data.daily) return null;
    cache.put('weather', JSON.stringify({ current: data.current, daily: data.daily }), 30 * 60);
    return data;
  } catch (err) {
    console.error('天氣讀取失敗', err);
    return null;
  }
}

// =====================================================================
// --- 隱藏指令 ---
// 空氣、月相、節氣、日出日落、放假。只有空氣和放假要上網抓，其他都是自己算的（不用網路、不會壞）
// =====================================================================

// 卡片的共用外框：英文小標、「二十七樓・XX」、內容
function hiddenCard(altText, label, title, contents) {
  return {
    type: 'flex',
    altText: altText.slice(0, 400),
    contents: {
      type: 'bubble',
      size: 'kilo',
      styles: { body: { backgroundColor: COLOR.bg } },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        contents: [
          { type: 'text', text: label, size: 'xxs', color: COLOR.accent },
          { type: 'text', text: '二十七樓・' + title, size: 'md', color: COLOR.ink, margin: 'sm' }
        ].concat(contents)
      }
    }
  };
}

// LINE 不接受空字串的文字（整則回覆會被退回，bot 就像沒反應），沒有標籤的那行只放右邊的值
function cardRow(label, value) {
  if (!label) return { type: 'text', text: value, size: 'sm', color: COLOR.ink, margin: 'sm', align: 'end', wrap: true };
  return {
    type: 'box', layout: 'horizontal', margin: 'md', contents: [
      { type: 'text', text: label, size: 'sm', color: COLOR.accent, flex: 4 },
      { type: 'text', text: value, size: 'sm', color: COLOR.ink, flex: 6, align: 'end', wrap: true }
    ]
  };
}

function cardBig(text, color) {
  return { type: 'text', text: text, size: '3xl', color: color || COLOR.ink, margin: 'xl', align: 'center', wrap: true };
}

function cardSub(text) {
  return { type: 'text', text: text, size: 'xs', color: COLOR.text, margin: 'sm', align: 'center', wrap: true };
}

function cardTip(text) {
  return { type: 'text', text: text, size: 'sm', color: COLOR.accent, margin: 'xl', wrap: true };
}

function cardLine() {
  return { type: 'separator', margin: 'xl', color: COLOR.sub };
}

// --- 空氣和紫外線（Open-Meteo 的空氣品質 API，跟天氣同一家，也不用金鑰） ---

var AQI_LEVELS = [[50, '良好'], [100, '普通'], [150, '對敏感族群不健康'], [200, '對所有族群不健康'], [300, '非常不健康'], [Infinity, '危害']];
var UV_LEVELS = [[2, '低量'], [5, '中量'], [7, '高量'], [10, '過量'], [Infinity, '危險']];

function levelOf(levels, value) {
  for (var i = 0; i < levels.length; i++) if (value <= levels[i][0]) return levels[i][1];
}
function aqiLevel(aqi) { return levelOf(AQI_LEVELS, aqi); }
function uvLevel(uv) { return levelOf(UV_LEVELS, uv); }

function replyAir() {
  var air = fetchAir();
  if (!air) return '空氣讀不到。深呼吸一次，你就知道了。';
  var place = prop('WEATHER_PLACE') || '台北';
  var tip = air.aqi > 100 ? '空氣不太好，宜關窗，待在二十七樓。'
    : air.uvMax >= 8 ? '太陽很大，因為它是太陽。出門記得防曬。'
      : air.uvMax >= 6 ? '紫外線偏高，撐傘不只是為了下雨。'
        : '空氣還可以，可以放心呼吸，一次一口就好。';
  return hiddenCard(
    place + ' 空氣' + aqiLevel(air.aqi) + '（AQI ' + air.aqi + '），紫外線最高 ' + air.uvMax + '（' + uvLevel(air.uvMax) + '）',
    'AIR', '空氣', [
      { type: 'text', text: place, size: 'xs', color: COLOR.text, margin: 'xs' },
      cardBig(aqiLevel(air.aqi), air.aqi > 100 ? COLOR.shu : COLOR.ink),
      cardSub('空氣品質指標 AQI ' + air.aqi),
      cardLine(),
      cardRow('PM2.5', air.pm25 + ' μg/m³'),
      cardRow('紫外線', '現在 ' + air.uvNow + '（' + uvLevel(air.uvNow) + '）'),
      cardRow('', '今天最高 ' + air.uvMax + '（' + uvLevel(air.uvMax) + '）'),
      cardTip(tip)
    ]);
}

// 存 30 分鐘；失敗回 null。回傳整理過的 { aqi, pm25, uvNow, uvMax }
function fetchAir() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('air');
  if (cached) return JSON.parse(cached);
  var lat = prop('WEATHER_LAT') || '25.0330';
  var lon = prop('WEATHER_LON') || '121.5654';
  var url = 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + encodeURIComponent(lat) + '&longitude=' + encodeURIComponent(lon) +
    '&current=us_aqi,pm2_5,uv_index&hourly=uv_index&timezone=Asia%2FTaipei&forecast_days=1';
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      console.error('空氣讀取失敗', res.getResponseCode(), res.getContentText());
      return null;
    }
    var data = JSON.parse(res.getContentText());
    var c = data.current || {};
    if (c.us_aqi == null) return null;
    var uvs = ((data.hourly || {}).uv_index || []).filter(function (v) { return v != null; });
    var air = {
      aqi: Math.round(c.us_aqi),
      pm25: Math.round(c.pm2_5 || 0),
      uvNow: Math.round(c.uv_index || 0),
      uvMax: Math.round(Math.max.apply(null, uvs.concat([c.uv_index || 0])))
    };
    cache.put('air', JSON.stringify(air), 30 * 60);
    return air;
  } catch (err) {
    console.error('空氣讀取失敗', err);
    return null;
  }
}

// --- 天文：太陽、月亮的位置（Meeus《Astronomical Algorithms》的簡化公式） ---
// 太陽黃經誤差約 0.01 度（節氣時間差十幾分鐘）、月亮約 0.05 度，判斷「哪一天」夠用了。
// 台灣沒有日光節約，台灣時間一律用 UTC+8 算。

var RAD = Math.PI / 180;
var TAIPEI = 8 * 3600000;

function norm360(x) {
  x %= 360;
  return x < 0 ? x + 360 : x;
}

function sinD(x) { return Math.sin(x * RAD); }
function cosD(x) { return Math.cos(x * RAD); }

// 從 J2000 起算的儒略世紀（加 69 秒把世界時換成力學時）
function centuries(ms) {
  return (ms / 86400000 + 2440587.5 - 2451545 + 69 / 86400) / 36525;
}

function sunLongitude(ms) {
  var T = centuries(ms);
  var L0 = 280.46646 + 36000.76983 * T;
  var M = 357.52911 + 35999.05029 * T;
  var C = (1.914602 - 0.004817 * T) * sinD(M) + (0.019993 - 0.000101 * T) * sinD(2 * M) + 0.000289 * sinD(3 * M);
  return norm360(L0 + C - 0.00569 - 0.00478 * sinD(125.04 - 1934.136 * T));
}

// 月亮黃經：主要的 24 項（單位百萬分之一度）。[D, M, M', F, 係數]
var MOON_TERMS = [
  [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618],
  [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332], [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066],
  [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
  [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980],
  [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034], [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888],
  [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036]
];

function moonLongitude(ms) {
  var T = centuries(ms);
  var L = 218.3164477 + 481267.88123421 * T;
  var D = 297.8501921 + 445267.1114034 * T;
  var M = 357.5291092 + 35999.0502909 * T;
  var Mp = 134.9633964 + 477198.8675055 * T;
  var F = 93.2720950 + 483202.0175233 * T;
  var sum = 0;
  for (var i = 0; i < MOON_TERMS.length; i++) {
    var t = MOON_TERMS[i];
    sum += t[4] * sinD(t[0] * D + t[1] * M + t[2] * Mp + t[3] * F);
  }
  return norm360(L + sum / 1e6 - 0.00478 * sinD(125.04 - 1934.136 * T));
}

// 月亮領先太陽幾度：0 新月、90 上弦、180 滿月、270 下弦
function moonElongation(ms) {
  return norm360(moonLongitude(ms) - sunLongitude(ms));
}

// 台灣時間 yyyy-MM-dd 那天的 00:00 是哪個時刻
function taipeiMidnight(str) {
  var p = str.split('-');
  return Date.UTC(+p[0], +p[1] - 1, +p[2]) - TAIPEI;
}

// 這一天（台灣時間）裡，角度 fn 有沒有走過 step 的整數倍；有的話回傳是第幾個（0 起算），沒有回 -1
function crossingOn(str, fn, step) {
  var start = taipeiMidnight(str);
  var a = fn(start), b = fn(start + 86400000);
  var target = norm360(Math.ceil(a / step - 1e-9) * step);
  return norm360(target - a) < norm360(b - a) ? Math.round(target / step) % Math.round(360 / step) : -1;
}

function formatTime(ms) {
  var d = new Date(ms + TAIPEI);
  return ('0' + d.getUTCHours()).slice(-2) + ':' + ('0' + d.getUTCMinutes()).slice(-2);
}

// --- 月相 ---

var PHASE_EVENTS = ['新月', '上弦月', '滿月', '下弦月'];
var LUNAR_DAYS = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

var MOON_TIPS = {
  '新月': '看不到月亮，但它一直都在。',
  '眉月': '月亮細細的，像沒睡飽的眼睛。',
  '上弦月': '月亮剩一半，另一半還在路上。',
  '盈凸月': '月亮快圓了，再等幾天。',
  '滿月': '月亮很圓，因為今天是滿月。宜上陽台。',
  '虧凸月': '月亮開始變瘦，比你先開始。',
  '下弦月': '月亮剩一半，另一半先回家了。',
  '殘月': '月亮快沒了，下個月還會再來。'
};

// 今天的月相：這天裡剛好經過新月、上弦、滿月、下弦，就叫那個名字；其他照角度分
function moonPhaseOn(str) {
  var event = crossingOn(str, moonElongation, 90);
  if (event !== -1) return PHASE_EVENTS[event];
  var e = moonElongation(taipeiMidnight(str) + 12 * 3600000);
  return e < 90 ? '眉月' : e < 180 ? '盈凸月' : e < 270 ? '虧凸月' : '殘月';
}

// 往前或往後找月相事件（0 新月、2 滿月），回傳 yyyy-MM-dd
function findMoonEvent(from, which, dir) {
  for (var i = 0; i <= 31; i++) {
    var day = addDays(from, i * dir);
    if (crossingOn(day, moonElongation, 90) === which) return day;
  }
  return null;
}

// 農曆初幾：新月那天是初一（農曆用的就是台灣時間）
function lunarDay(str) {
  var newMoon = findMoonEvent(str, 0, -1);
  return newMoon ? LUNAR_DAYS[nightsBetween(newMoon, str)] : null;
}

function replyMoon() {
  var today = todayStr();
  var phase = moonPhaseOn(today);
  var lit = Math.round((1 - cosD(moonElongation(Date.now()))) / 2 * 100);
  var lunar = lunarDay(today);
  var full = findMoonEvent(addDays(today, 1), 2, 1);
  var next = findMoonEvent(addDays(today, 1), 0, 1);
  return hiddenCard(
    '今晚' + phase + '，農曆' + lunar + '，亮了 ' + lit + '%。下次滿月 ' + shortDay(full) + '。',
    'MOON', '月相', [
      cardBig(phase),
      cardSub('農曆' + lunar + '・亮了 ' + lit + '%'),
      cardLine(),
      cardRow('下次滿月', shortDay(full) + '・' + nightsBetween(today, full) + ' 天'),
      cardRow('下次新月', shortDay(next) + '・' + nightsBetween(today, next) + ' 天'),
      cardTip(MOON_TIPS[phase])
    ]);
}

// --- 節氣（太陽黃經每 15 度一個，春分是 0 度） ---

var SOLAR_TERMS = ['春分', '清明', '穀雨', '立夏', '小滿', '芒種', '夏至', '小暑', '大暑', '立秋', '處暑', '白露',
  '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至', '小寒', '大寒', '立春', '雨水', '驚蟄'];

var SOLAR_TERM_LINES = {
  '立春': '春天開始了，冬天可能還不知道。',
  '雨水': '開始下雨了，雨是水做的。',
  '驚蟄': '蟲醒了，你也該醒了。',
  '春分': '白天和晚上一樣長，跟昨天差不多。',
  '清明': '天氣清明，心情盡量。',
  '穀雨': '雨是下給穀子的，你不用接。',
  '立夏': '夏天開始了，冷氣要開始努力了。',
  '小滿': '小小的滿足，也是滿足。',
  '芒種': '該播種了，至少播個訂房。',
  '夏至': '一年白天最長的一天，宜曬棉被，忌加班。',
  '小暑': '有點熱，大熱還在後面。',
  '大暑': '很熱，熱到熱本身都覺得熱。',
  '立秋': '秋天開始了，天氣還沒收到通知。',
  '處暑': '暑氣到這裡為止，理論上。',
  '白露': '早上有露水，露水很白。',
  '秋分': '晝夜又一樣長了，宜早點睡。',
  '寒露': '露水變冷了，你也多穿一件。',
  '霜降': '開始下霜了，台北通常沒有。',
  '立冬': '冬天開始了，宜吃補，忌減肥。',
  '小雪': '小雪。台灣不太會下。',
  '大雪': '大雪。台灣還是不太會下。',
  '冬至': '一年夜晚最長的一天，宜吃湯圓，宜留宿二十七樓。',
  '小寒': '冷，但還不是最冷。',
  '大寒': '最冷的時候。熬過去，就是春天。'
};

function solarTermOn(str) {
  var i = crossingOn(str, sunLongitude, 15);
  return i === -1 ? null : SOLAR_TERMS[i];
}

// 往前或往後找下一個節氣，回傳 { name, date }
function findSolarTerm(from, dir) {
  for (var i = 0; i <= 20; i++) {
    var day = addDays(from, i * dir);
    var name = solarTermOn(day);
    if (name) return { name: name, date: day };
  }
  return null;
}

function replySolarTerm() {
  var today = todayStr();
  var now = findSolarTerm(today, -1);
  var next = findSolarTerm(addDays(today, 1), 1);
  var nth = nightsBetween(now.date, today) + 1;
  return hiddenCard(
    '現在是' + now.name + '，' + shortDay(now.date) + '起。下一個是' + next.name + '，' + shortDay(next.date) + '。',
    'SOLAR TERM', '節氣', [
      cardBig(now.name),
      cardSub(nth === 1 ? '今天交節' : shortDay(now.date) + ' 起・第 ' + nth + ' 天'),
      cardTip(SOLAR_TERM_LINES[now.name]),
      cardLine(),
      cardRow('下一個', next.name + '・' + shortDay(next.date)),
      cardRow('', '還有 ' + nightsBetween(today, next.date) + ' 天')
    ]);
}

// --- 日出日落（太陽高度角公式，跟中央氣象署的時間差一兩分鐘） ---

// 某天太陽到某個天頂角的時刻（ms）：zenith 90.833 是日出日落，96 是民用曙暮光（天還亮著的最後一刻）
function sunEvent(str, zenith, rising) {
  var lat = Number(prop('WEATHER_LAT') || '25.0330');
  var lon = Number(prop('WEATHER_LON') || '121.5654');
  var p = str.split('-');
  var t = Date.UTC(+p[0], +p[1] - 1, +p[2], 12) - lon / 15 * 3600000; // 先猜當地正午
  for (var i = 0; i < 3; i++) { // 用猜的時刻算太陽位置，再修正兩次
    var T = centuries(t);
    var lambda = sunLongitude(t);
    var eps = 23.4393 - 0.013 * T;
    var dec = Math.asin(sinD(eps) * sinD(lambda)) / RAD;
    var ra = norm360(Math.atan2(cosD(eps) * sinD(lambda), cosD(lambda)) / RAD);
    var L0 = norm360(280.46646 + 36000.76983 * T);
    var eot = ((L0 - 0.0057183 - ra + 540) % 360) - 180; // 均時差（度）
    var noon = Date.UTC(+p[0], +p[1] - 1, +p[2]) + (720 - 4 * lon - 4 * eot) * 60000;
    var cosH = (cosD(zenith) - sinD(lat) * sinD(dec)) / (cosD(lat) * cosD(dec));
    if (cosH > 1 || cosH < -1) return null; // 極圈才會發生
    var H = Math.acos(cosH) / RAD;
    t = noon + (rising ? -1 : 1) * 4 * H * 60000;
  }
  return t;
}

function replySun() {
  var today = todayStr();
  var now = Date.now();
  var rise = sunEvent(today, 90.833, true);
  var set = sunEvent(today, 90.833, false);
  var dusk = sunEvent(today, 96, false);
  var tomorrowRise = sunEvent(addDays(today, 1), 90.833, true);
  var length = Math.round((set - rise) / 60000);

  var big, sub, tip;
  if (now < rise) {
    big = '日出 ' + formatTime(rise); sub = '還有 ' + Math.ceil((rise - now) / 60000) + ' 分鐘';
    tip = '太陽還在睡，你呢？';
  } else if (now < set) {
    var left = Math.ceil((set - now) / 60000);
    big = '日落 ' + formatTime(set); sub = left >= 60 ? '還有 ' + Math.floor(left / 60) + ' 小時 ' + left % 60 + ' 分' : '還有 ' + left + ' 分鐘';
    tip = left <= 90 ? '快日落了，二十七樓陽台幫你留了位置。' : '太陽還在上班，你也是。';
  } else {
    big = '明天日出 ' + formatTime(tomorrowRise); sub = '今天已經日落了';
    tip = '太陽下班了，明天 ' + formatTime(tomorrowRise) + ' 再上班。';
  }

  return hiddenCard(
    '今天日出 ' + formatTime(rise) + '、日落 ' + formatTime(set) + '，天黑前的魔幻時刻到 ' + formatTime(dusk) + '。',
    'SUN', '日出日落', [
      { type: 'text', text: prop('WEATHER_PLACE') || '台北', size: 'xs', color: COLOR.text, margin: 'xs' },
      cardBig(big),
      cardSub(sub),
      cardLine(),
      cardRow('日出', formatTime(rise)),
      cardRow('日落', formatTime(set)),
      cardRow('魔幻時刻', formatTime(set) + '～' + formatTime(dusk)),
      cardRow('白天', Math.floor(length / 60) + ' 小時 ' + length % 60 + ' 分'),
      cardTip(tip)
    ]);
}

// --- 放假和連假（行政院辦公日曆，ruyut/TaiwanCalendar 整理成 JSON，透過 jsDelivr 抓） ---

var HOLIDAY_URL = 'https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/';

// 抓今年和明年，整理成 { off: { yyyy-MM-dd: 名稱或 '' }, makeup: [補班的週末], last: 資料最後一天 }，存 6 小時
function fetchHolidays() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('holidays');
  if (cached) return JSON.parse(cached);
  var year = Number(todayStr().slice(0, 4));
  var cal = { off: {}, makeup: [], last: null };
  [year, year + 1].forEach(function (y) {
    try {
      var res = UrlFetchApp.fetch(HOLIDAY_URL + y + '.json', { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) return; // 明年的還沒公布
      JSON.parse(res.getContentText()).forEach(function (d) {
        var date = d.date.slice(0, 4) + '-' + d.date.slice(4, 6) + '-' + d.date.slice(6, 8);
        if (d.isHoliday) cal.off[date] = d.description || '';
        else if (d.week === '六' || d.week === '日') cal.makeup.push(date);
        if (!cal.last || date > cal.last) cal.last = date;
      });
    } catch (err) {
      console.error('行事曆讀取失敗', y, err);
    }
  });
  if (!cal.last) return null;
  cache.put('holidays', JSON.stringify(cal), 6 * 60 * 60);
  return cal;
}

// 一段連續放假的日子叫什麼：有春節就叫春節，不然用第一個有名字、不是補假的
function blockName(cal, from, to) {
  var names = [];
  for (var d = from; d <= to; d = addDays(d, 1)) {
    var n = cal.off[d];
    if (n && n !== '補假' && n !== '小年夜' && n !== '農曆除夕') names.push(n.split('/')[0]);
  }
  if (names.indexOf('春節') !== -1) return '春節';
  return names[0] || '連假';
}

// 從 from 開始往後找放假的區段，回傳 [{ from, to, days, name }]，最多 limit 段
function holidayBlocks(cal, from, minDays, limit) {
  var blocks = [];
  var d = from;
  while (d <= cal.last && blocks.length < limit) {
    if (cal.off[d] === undefined) { d = addDays(d, 1); continue; }
    var start = d;
    while (cal.off[addDays(d, 1)] !== undefined) d = addDays(d, 1);
    var days = nightsBetween(start, d) + 1;
    if (days >= minDays) blocks.push({ from: start, to: d, days: days, name: blockName(cal, start, d) });
    d = addDays(d, 1);
  }
  return blocks;
}

function replyHoliday() {
  var cal = fetchHolidays();
  if (!cal) return '行事曆讀不到。保險起見，今天先當作要上班。';
  var today = todayStr();

  // 今天
  var status;
  if (cal.off[today] !== undefined) status = '今天放假' + (cal.off[today] ? '（' + cal.off[today] + '）' : '') + '。';
  else if (cal.makeup.indexOf(today) !== -1) status = '今天補班。辛苦了。';
  else status = '今天要上班。';

  // 連假：如果今天就在連假裡，從這段的第一天算起
  var start = today;
  while (cal.off[addDays(start, -1)] !== undefined && cal.off[start] !== undefined) start = addDays(start, -1);
  var blocks = holidayBlocks(cal, start, 3, 3);
  var next = blocks[0];

  // 下一個有名字的假日（不管有沒有連假）
  var named = null;
  for (var d = addDays(today, 1); d <= cal.last; d = addDays(d, 1)) {
    var n = cal.off[d];
    if (n && n !== '補假' && n !== '小年夜') { named = { date: d, name: n.split('/')[0] }; break; }
  }

  var makeup = cal.makeup.filter(function (m) { return m > today && nightsBetween(today, m) <= 60; })[0];

  var contents = [{ type: 'text', text: status, size: 'xs', color: COLOR.text, margin: 'xs' }];
  var alt = status;
  if (next) {
    var inside = next.from <= today;
    contents.push(
      { type: 'text', text: '下一個連假', size: 'xs', color: COLOR.accent, margin: 'xl', align: 'center' },
      { type: 'text', text: next.name, size: next.name.length > 4 ? 'xxl' : '3xl', color: COLOR.ink, margin: 'sm', align: 'center', wrap: true },
      cardSub(shortDay(next.from) + '～' + shortDay(next.to) + '・放 ' + next.days + ' 天'),
      cardSub(inside ? '就是現在，還剩 ' + (nightsBetween(today, next.to) + 1) + ' 天' : '還有 ' + nightsBetween(today, next.from) + ' 天')
    );
    alt += '下一個連假：' + next.name + '，' + shortDay(next.from) + '～' + shortDay(next.to) + '，放 ' + next.days + ' 天。';
  } else {
    contents.push(cardBig('明年的行事曆還沒公布'));
  }
  contents.push(cardLine());
  if (named && (!next || named.date < next.from)) contents.push(cardRow('下一個假日', named.name + '・' + shortDay(named.date)));
  if (blocks.length > 1) contents.push({ type: 'text', text: '之後的連假', size: 'xs', color: COLOR.accent, margin: 'lg' });
  blocks.slice(1).forEach(function (b) {
    contents.push(cardRow(shortDay(b.from), b.name + '・' + b.days + ' 天'));
  });
  if (makeup) contents.push(cardRow('補班', shortDay(makeup) + '，記得設鬧鐘'));
  contents.push(cardTip(next && next.from > today
    ? '距離下一次光明正大不上班，還有 ' + nightsBetween(today, next.from) + ' 天。宜先訂房。'
    : '放假的時候，就是在放假。'));

  return hiddenCard(alt, 'HOLIDAY', '放假', contents);
}

// --- 狗、貓（免費的隨機圖片 API：bot 只回圖片網址，LINE 的伺服器自己去抓圖） ---
// LINE 圖片訊息的規定：HTTPS、JPEG 或 PNG、原圖 10MB 以內、縮圖 1MB 以內

var DOG_BREEDS = {
  shiba: '柴犬', husky: '哈士奇', corgi: '柯基', 'corgi-cardigan': '柯基', pembroke: '柯基', pug: '巴哥',
  'retriever-golden': '黃金獵犬', labrador: '拉不拉多', 'retriever-labrador': '拉不拉多',
  'poodle-toy': '貴賓', 'poodle-miniature': '貴賓', 'poodle-standard': '標準貴賓', poodle: '貴賓',
  chihuahua: '吉娃娃', beagle: '米格魯', 'bulldog-french': '法鬥', 'bulldog-english': '英國鬥牛犬', bulldog: '鬥牛犬',
  dachshund: '臘腸狗', samoyed: '薩摩耶', malamute: '阿拉斯加', germanshepherd: '德國牧羊犬',
  'collie-border': '邊境牧羊犬', collie: '牧羊犬', pomeranian: '博美', maltese: '瑪爾濟斯', shihtzu: '西施',
  akita: '秋田犬', 'schnauzer-miniature': '雪納瑞', schnauzer: '雪納瑞', dalmatian: '大麥町', doberman: '杜賓',
  rottweiler: '羅威納', chow: '鬆獅犬', 'terrier-yorkshire': '約克夏', 'frise-bichon': '比熊', papillon: '蝴蝶犬',
  greyhound: '靈緹', 'greyhound-italian': '義大利靈緹', mix: '米克斯', 'spaniel-cocker': '可卡',
  'sheepdog-shetland': '喜樂蒂', 'mountain-bernese': '伯恩山', stbernard: '聖伯納', newfoundland: '紐芬蘭',
  'terrier-jack-russell': '傑克羅素', 'terrier-westhighland': '西高地白㹴', 'terrier-boston': '波士頓㹴', boxer: '拳師犬'
};

var DOG_LINES = [
  '牠今天也沒有上班。',
  '比你還會撒嬌。',
  '看了三秒，心情好了一點點。',
  '牠不知道你在看牠，這樣比較好。',
  '汪。（翻譯：給我零食）',
  '二十七樓不能養狗，所以只能看圖。'
];

var CAT_LINES = [
  '牠不在乎你，這就是貓。',
  '喵。（翻譯：你可以走了）',
  '今天的貓已送達，請簽收。',
  '牠睡了十六個小時，比你努力。',
  '你看牠，牠不看你。',
  '二十七樓不能養貓，所以只能看圖。'
];

function imageMessage(url) {
  return { type: 'image', originalContentUrl: url, previewImageUrl: url };
}

function isLineImage(url) {
  return /^https:\/\/\S+\.(jpe?g|png)(\?\S*)?$/i.test(String(url || '')) && url.length <= 2000;
}

function fetchJson(url) {
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      console.error('讀取失敗', url, res.getResponseCode());
      return null;
    }
    return JSON.parse(res.getContentText());
  } catch (err) {
    console.error('讀取失敗', url, err);
    return null;
  }
}

// dog.ceo：{ message: 'https://images.dog.ceo/breeds/shiba/xxx.jpg', status: 'success' }，網址裡有品種
function replyDog() {
  for (var i = 0; i < 2; i++) { // 偶爾抽到 LINE 不收的格式，再抽一次
    var data = fetchJson('https://dog.ceo/api/breeds/image/random');
    var url = data && data.status === 'success' ? data.message : null;
    if (!isLineImage(url)) continue;
    var m = url.match(/\/breeds\/([^/]+)\//);
    var breed = m ? (DOG_BREEDS[m[1]] || DOG_BREEDS[m[1].split('-')[0]] || '某種狗') : '某種狗';
    return [imageMessage(url), '今日之犬：' + breed + '。' + pick(DOG_LINES)];
  }
  return '狗跑掉了，等一下再叫一次。';
}

// The Cat API：[{ id, url, width, height }]；抓不到再換 cataas（先要編號，網址才會每次不一樣，LINE 才不會一直給同一隻）
function replyCat() {
  for (var i = 0; i < 2; i++) {
    var list = fetchJson('https://api.thecatapi.com/v1/images/search');
    var url = list && list[0] && list[0].url;
    if (isLineImage(url)) return [imageMessage(url), pick(CAT_LINES)];
  }
  var cat = fetchJson('https://cataas.com/cat?json=true');
  var id = cat && (cat.id || cat._id);
  if (id) return [imageMessage('https://cataas.com/cat/' + encodeURIComponent(id)), pick(CAT_LINES)];
  return '貓不想理你。（讀不到，等一下再叫一次）';
}

// --- 油價（中油官方的牌價服務，不用金鑰） ---
// 每個產品的歷史牌價（含已公告、還沒生效的下週價格），存 3 小時

var OIL_URL = 'https://vipmbr.cpc.com.tw/cpcstn/listpricewebservice.asmx/';
var OIL_PRODUCTS = [
  { id: 1, name: '92 無鉛' },
  { id: 2, name: '95 無鉛' },
  { id: 3, name: '98 無鉛' },
  { id: 4, name: '超級柴油' }
];

// 中油回的是 .NET DataSet 的 XML：裡面一筆一筆有「產品名」「參考牌價」「牌價生效時間」「計價單位」
// 欄位名稱各版本不太一樣，所以用「名字裡有什麼字」來認，不寫死
function oilRecords(text) {
  var root = XmlService.parse(text).getRootElement();
  // 用 GET 呼叫時，結果可能被包在 <string> 裡面當文字
  if (root.getChildren().length === 0 && /^\s*</.test(root.getText())) return oilRecords(root.getText());
  var out = [];
  (function walk(el) {
    var kids = el.getChildren();
    if (kids.length && kids.every(function (k) { return k.getChildren().length === 0; })) {
      var rec = {};
      kids.forEach(function (k) { rec[k.getName()] = k.getText(); });
      var keys = Object.keys(rec);
      var priceKey = keys.filter(function (k) { return k.indexOf('牌價') !== -1 && k.indexOf('時間') === -1; })[0];
      var timeKey = keys.filter(function (k) { return k.indexOf('生效') !== -1 || k.indexOf('時間') !== -1; })[0];
      if (priceKey) {
        out.push({
          name: rec[keys.filter(function (k) { return k.indexOf('產品') !== -1; })[0]] || '',
          price: Number(rec[priceKey]),
          time: timeKey ? new Date(rec[timeKey]).getTime() : NaN,
          unit: rec[keys.filter(function (k) { return k.indexOf('單位') !== -1; })[0]] || '元/公升'
        });
        return;
      }
    }
    kids.forEach(walk);
  })(root);
  return out.filter(function (r) { return !isNaN(r.price); });
}

// 回傳 [{ name, now, prev, next, since, nextAt }]：now 現在的價、prev 上一次、next 已公告還沒生效的
function fetchOil() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('oil');
  if (cached) return JSON.parse(cached);
  var now = Date.now();
  var result = [];
  OIL_PRODUCTS.forEach(function (p) {
    try {
      var res = UrlFetchApp.fetch(OIL_URL + 'getCPCMainProdListPrice_Historical?prodid=' + p.id, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) return console.error('油價讀取失敗', p.id, res.getResponseCode());
      var recs = oilRecords(res.getContentText())
        .filter(function (r) { return !isNaN(r.time); })
        .sort(function (a, b) { return a.time - b.time; });
      var past = recs.filter(function (r) { return r.time <= now; });
      var future = recs.filter(function (r) { return r.time > now; });
      if (!past.length) return;
      var cur = past[past.length - 1];
      var before = past.length > 1 ? past[past.length - 2] : null;
      result.push({
        name: p.name,
        now: cur.price,
        prev: before ? before.price : null,
        next: future.length ? future[0].price : null,
        since: cur.time,
        nextAt: future.length ? future[0].time : null
      });
    } catch (err) {
      console.error('油價讀取失敗', p.id, err);
    }
  });
  if (!result.length) return null;
  cache.put('oil', JSON.stringify(result), 3 * 60 * 60);
  return result;
}

function oilDiff(d) {
  if (d === null || d === undefined || isNaN(d)) return '';
  d = Math.round(d * 10) / 10;
  return d > 0 ? '漲 ' + d.toFixed(1) : d < 0 ? '降 ' + (-d).toFixed(1) : '不變';
}

function shortDayMs(ms) {
  return shortDay(Utilities.formatDate(new Date(ms), 'Asia/Taipei', 'yyyy-MM-dd'));
}

function replyOil() {
  var oil = fetchOil();
  if (!oil) return '油價讀不到。保險起見，先騎腳踏車。';
  var gas = oil.filter(function (o) { return o.name.indexOf('無鉛') !== -1; })[0] || oil[0];
  var diesel = oil.filter(function (o) { return o.name.indexOf('柴油') !== -1; })[0];
  var upcoming = oil.some(function (o) { return o.next !== null; });

  // 頭條：有公告下週價格就講下週，沒有就講這週比上週
  function change(o) { return o ? (upcoming ? (o.next === null ? 0 : o.next - o.now) : (o.prev === null ? null : o.now - o.prev)) : null; }
  var g = change(gas), dz = change(diesel);
  var when = upcoming ? shortDayMs(gas.nextAt || diesel.nextAt) + '起' : '這週';
  var gasLine = '汽油' + (oilDiff(g) || '—');
  var dieselLine = diesel ? '柴油' + (oilDiff(dz) || '—') : '';
  var headline = when + gasLine + (dieselLine ? '、' + dieselLine : '');
  var tip = g > 0 ? '漲了。宜騎腳踏車，宜在二十七樓待著不出門。'
    : g < 0 ? '降了。宜加滿，宜出去兜風再回二十七樓。'
      : '油價沒什麼變，跟你一樣。';

  var rows = oil.map(function (o) {
    var d = upcoming ? (o.next === null ? null : o.next - o.now) : (o.prev === null ? null : o.now - o.prev);
    var label = upcoming && o.next !== null ? o.now.toFixed(1) + ' → ' + o.next.toFixed(1) : o.now.toFixed(1);
    return {
      type: 'box', layout: 'horizontal', margin: 'md', contents: [
        { type: 'text', text: o.name, size: 'sm', color: COLOR.accent, flex: 4 },
        { type: 'text', text: label, size: 'sm', color: COLOR.ink, flex: 5, align: 'end' },
        { type: 'text', text: oilDiff(d) || '—', size: 'xs', color: d > 0 ? COLOR.shu : COLOR.text, flex: 3, align: 'end', gravity: 'center' }
      ]
    };
  });

  return hiddenCard(
    headline + '。' + oil.map(function (o) { return o.name + ' ' + o.now.toFixed(1); }).join('、') + '（元/公升）',
    'OIL', '油價', [
      { type: 'text', text: when, size: 'xs', color: COLOR.accent, margin: 'xl', align: 'center' },
      { type: 'text', text: gasLine, size: 'xxl', color: g > 0 ? COLOR.shu : COLOR.ink, margin: 'sm', align: 'center' },
      cardSub(dieselLine || '中油的汽油價'),
      cardLine(),
      { type: 'text', text: '中油牌價・元/公升・現價 ' + shortDayMs(gas.since) + '生效', size: 'xxs', color: COLOR.text, margin: 'md', wrap: true }
    ].concat(rows).concat([cardTip(tip)]));
}

// --- 股價（證交所、櫃買中心的 OpenAPI，不用金鑰；都是最近一個交易日的收盤資料，不是即時） ---
// 證交所 STOCK_DAY_ALL 約 1,400 檔；櫃買中心的表很大（含權證、債券，上萬筆），所以先查上市，找不到才查上櫃
// 查到的那一檔存 20 分鐘

var TWSE_URL = 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL';
var TPEX_URL = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes';
var STOCK_DOWN = '#4f7a5c'; // 台股跌是綠色（漲是朱色）

function stockNum(v) {
  var n = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[,\s+]/g, ''));
  return isNaN(n) ? null : n;
}

// 民國日期 1151111 → 2026-11-11
function rocDate(v) {
  var m = String(v || '').trim().match(/^(\d{2,3})(\d{2})(\d{2})$/);
  return m ? (Number(m[1]) + 1911) + '-' + m[2] + '-' + m[3] : null;
}

// 兩邊的欄位名稱不一樣，整理成同一種
function normalizeStock(row, market) {
  var code = String(row.Code || row.SecuritiesCompanyCode || '').trim();
  var name = String(row.Name || row.CompanyName || row.CompanyAbbreviation || '').trim();
  return {
    market: market,
    code: code,
    name: name,
    date: rocDate(row.Date),
    close: stockNum(row.ClosingPrice !== undefined ? row.ClosingPrice : row.Close),
    change: stockNum(row.Change),
    open: stockNum(row.OpeningPrice !== undefined ? row.OpeningPrice : row.Open),
    high: stockNum(row.HighestPrice !== undefined ? row.HighestPrice : row.High),
    low: stockNum(row.LowestPrice !== undefined ? row.LowestPrice : row.Low),
    volume: stockNum(row.TradeVolume !== undefined ? row.TradeVolume : row.TradingShares) // 股
  };
}

// 代號完全一樣 > 名稱完全一樣 > 名稱包含（取最短的，「台積」→ 台積電）
function findStock(rows, market, query) {
  var list = rows.map(function (r) { return normalizeStock(r, market); }).filter(function (r) { return r.code; });
  var q = query.toUpperCase();
  var hit = list.filter(function (r) { return r.code.toUpperCase() === q; })[0] ||
    list.filter(function (r) { return r.name === query; })[0];
  if (hit) return hit;
  if (/^\d+[A-Z]?$/.test(q)) return null; // 打代號就只認代號
  return list.filter(function (r) { return r.name.indexOf(query) !== -1; })
    .sort(function (a, b) { return a.name.length - b.name.length; })[0] || null;
}

function lookupStock(query) {
  var cache = CacheService.getScriptCache();
  var key = 'stock:' + query;
  var cached = cache.get(key);
  if (cached) return JSON.parse(cached);
  var sources = [[TWSE_URL, '上市'], [TPEX_URL, '上櫃']];
  var anyLoaded = false;
  for (var i = 0; i < sources.length; i++) {
    var rows = fetchJson(sources[i][0]);
    if (!Array.isArray(rows)) continue;
    anyLoaded = true;
    var hit = findStock(rows, sources[i][1], query);
    if (hit && hit.close !== null) {
      cache.put(key, JSON.stringify(hit), 20 * 60);
      return hit;
    }
  }
  return anyLoaded ? { notFound: true } : null;
}

function stockFmt(n, digits) {
  if (n === null || n === undefined) return '—';
  var d = digits === undefined ? 2 : digits; // ETF 一檔 0.05，所以都留兩位，再把多的 0 拿掉
  var parts = n.toFixed(d).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.').replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function replyStock(arg, source) {
  var query = String(arg || '').replace(/^[:：\s]+/, '').trim();
  var quiet = source && source.type !== 'user'; // 群組裡「股市今天好慘」這種不是在查股價，查不到就安靜
  if (!query) return quiet ? null : '要查哪一支？例如「股 2330」或「股 台積電」。';
  if (query.length > 12) return quiet ? null : '名字太長了，打代號比較快，例如「股 2330」。';
  var s = lookupStock(query);
  if (!s) return quiet ? null : '證交所讀不到。股市不會因為你沒看就不動，但我也沒辦法。';
  if (s.notFound) return quiet ? null : '找不到「' + query + '」。打代號最準，例如「股 2330」。';

  var prevClose = s.change !== null ? s.close - s.change : null;
  var pct = prevClose ? s.change / prevClose * 100 : null;
  var up = s.change > 0, down = s.change < 0;
  var color = up ? COLOR.shu : down ? STOCK_DOWN : COLOR.ink;
  var changeText = s.change === null ? '—' : s.change === 0 ? '平盤'
    : (up ? '▲ ' : down ? '▼ ' : '') + stockFmt(Math.abs(s.change)) + (pct === null ? '' : '（' + (up ? '+' : down ? '−' : '') + Math.abs(pct).toFixed(2) + '%）');
  var tip = pct === null ? '股價是收盤價，不是神明的旨意。'
    : pct >= 3 ? '漲很多。今晚二十七樓你請。'
      : pct > 0 ? '小漲。可以多加一顆滷蛋。'
        : pct === 0 ? '不動如山。跟你的存款一樣。'
          : pct > -3 ? '小跌。沒關係，二十七樓的房價不會跌（因為不賣）。'
            : '跌很多。宜擲杯問神明要不要攤平。';
  var day = s.date ? shortDay(s.date) + '收盤' : '最近一個交易日收盤';

  return hiddenCard(
    s.name + '（' + s.code + '）' + day + ' ' + stockFmt(s.close) + '，' + changeText,
    'STOCK', '股價', [
      { type: 'text', text: s.name + '　' + s.code + '・' + s.market, size: 'sm', color: COLOR.text, margin: 'lg', align: 'center' },
      { type: 'text', text: stockFmt(s.close), size: '3xl', color: color, margin: 'sm', align: 'center' },
      { type: 'text', text: changeText, size: 'sm', color: color, margin: 'xs', align: 'center' },
      cardLine(),
      cardRow('開盤', stockFmt(s.open)),
      cardRow('最高', stockFmt(s.high)),
      cardRow('最低', stockFmt(s.low)),
      cardRow('成交量', s.volume === null ? '—' : stockFmt(Math.round(s.volume / 1000), 0) + ' 張'),
      { type: 'text', text: day + '・非即時，非投資建議', size: 'xxs', color: COLOR.text, margin: 'lg', wrap: true },
      cardTip(tip)
    ]);
}

// 在編輯器選這個函式按「執行」，確認外面的來源都抓得到（看「執行記錄」）
function testHiddenSources() {
  CacheService.getScriptCache().removeAll(['air', 'holidays', 'oil', 'stock:2330', 'stock:6488']);
  console.log('股價（上市）', JSON.stringify(lookupStock('2330')));
  console.log('股價（上櫃）', JSON.stringify(lookupStock('6488')));
  console.log('狗', JSON.stringify(replyDog()));
  console.log('貓', JSON.stringify(replyCat()));
  console.log('油價', JSON.stringify(fetchOil()));
  console.log('空氣', JSON.stringify(fetchAir()));
  var cal = fetchHolidays();
  console.log('行事曆', cal ? '抓到了，資料到 ' + cal.last + '，放假 ' + Object.keys(cal.off).length + ' 天' : '抓不到');
  console.log('月相', moonPhaseOn(todayStr()), '農曆' + lunarDay(todayStr()), '節氣', JSON.stringify(findSolarTerm(todayStr(), -1)));
  console.log('日出日落', formatTime(sunEvent(todayStr(), 90.833, true)), formatTime(sunEvent(todayStr(), 90.833, false)));
}

// 以前藏起來的指令現在都寫進「說明」了，有人來找彩蛋就給他說明
function replySecrets() {
  return '已經沒有藏了，全部都在這裡。\n\n' + replyHelp();
}

// --- 分帳（老闆自己做的 LIFF，bot 只給連結） ---

function replySplit() {
  var card = hiddenCard('分帳在這裡：' + SPLIT_URL, 'SPLIT', '分帳', [
    cardBig('分帳・算'),
    cardSub('一起出去玩，錢的事交給它'),
    cardTip('朋友之間不談錢。要談的話，用這個談。')
  ]);
  card.contents.styles.footer = { backgroundColor: COLOR.bg };
  card.contents.footer = {
    type: 'box',
    layout: 'vertical',
    paddingTop: '0px',
    contents: [{
      type: 'button',
      style: 'primary',
      color: COLOR.ink,
      height: 'sm',
      action: { type: 'uri', label: '打開分帳', uri: SPLIT_URL }
    }]
  };
  return card;
}

// --- 其他 ---

function replyBooking() {
  return '訂房在網站上：\n' + SITE_URL + '\n\n多人訂房可以「發票給同學」，大家各領一張入住券。';
}

function replyHelp() {
  return '丼步喱・絆 聽得懂這些：\n\n' +
    '【二十七樓】\n' +
    '空房　接下來 30 天哪幾晚有人\n' +
    '訂房　網站連結\n\n' +
    '【問神明】\n' +
    '擲杯　後面可以接問題，例如「擲杯 今晚續攤嗎」\n' +
    '抽籤　抽一支今晚的運勢\n\n' +
    '【看天】\n' +
    '天氣　今天、明天的天氣\n' +
    '空氣　空氣品質和紫外線\n' +
    '夕陽　日出、日落、魔幻時刻\n' +
    '月亮　今晚的月相、農曆初幾\n' +
    '節氣　現在是什麼節氣\n\n' +
    '【過日子】\n' +
    '放假　下一個連假還有幾天\n' +
    '分帳　出去玩誰欠誰，打開就算（打記帳、拆帳、AA 也可以）\n' +
    '油價　這週的油價，下週漲還是跌\n' +
    '股　　收盤價，例如「股 2330」「股 台積電」\n\n' +
    '【沒有用】\n' +
    '狗、貓　隨機一張，只打一個字才會出現\n\n' +
    '其他的話，我也會回，只是回得沒什麼用。群組裡要 @我 才回。';
}

function welcomeText(type) {
  return (type === 'join' ? '二十七樓的神明來群組了。' : '歡迎來到丼步喱・絆。') + '\n\n' + replyHelp();
}

// --- LINE ---

// message 可以是文字，或是組好的訊息物件（例如空房的月曆卡片）
// message 可以是文字、一則訊息物件，或一次好幾則（陣列，最多 5 則）
function reply(replyToken, message) {
  var messages = (Array.isArray(message) ? message : [message]).slice(0, 5).map(function (m) {
    return typeof m === 'string' ? { type: 'text', text: m.slice(0, 5000) } : m;
  });
  var token = prop('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token) return console.error('沒設定 LINE_CHANNEL_ACCESS_TOKEN');
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: messages }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) console.error('LINE 回覆失敗', res.getResponseCode(), res.getContentText());
}

function ok() {
  return ContentService.createTextOutput('OK');
}

// --- 工具 ---

function prop(name) {
  return PropertiesService.getScriptProperties().getProperty(name);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function todayStr() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
}

// Sheet 會把日期字串轉成 Date，這裡轉回台灣時間的 yyyy-MM-dd
function toDateStr(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') return Utilities.formatDate(value, 'Asia/Taipei', 'yyyy-MM-dd');
  return String(value || '').slice(0, 10);
}

// yyyy-MM-dd 的加減一律用 UTC 算，不會被時區或日光節約搞亂
function addDays(str, n) {
  var d = new Date(str + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function nightsBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}

function shortDay(str) {
  var d = new Date(str + 'T00:00:00Z');
  return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + '（' + '日一二三四五六'.charAt(d.getUTCDay()) + '）';
}
