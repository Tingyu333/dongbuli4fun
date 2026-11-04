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
var DAYS_AHEAD = 30;

// 關鍵字：只認訊息開頭。群組裡被 @ 時，會先把 @bot 那段拿掉再判斷（「@丼步喱 空房」也算）
var COMMANDS = [
  { words: ['空房', '房況'], run: replyAvailability },
  { words: ['擲杯', '擲筊', '跋杯'], run: replyJiaobei },
  { words: ['抽籤', '御神籤'], run: replyOmikuji },
  { words: ['訂房'], run: replyBooking },
  { words: ['說明', '指令'], run: replyHelp }
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
      if (text.indexOf(word) === 0) return COMMANDS[i].run(text.slice(word.length).trim(), source);
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

// 接下來 30 天哪幾晚有人（入住日到退房前一晚算有人，跟網站一樣）
function replyAvailability() {
  var today = todayStr();
  var end = addDays(today, DAYS_AHEAD);
  var booked = {};
  readBookedRanges().forEach(function (r) {
    for (var night = r.check_in; night < r.check_out; night = addDays(night, 1)) {
      if (night >= today && night < end) booked[night] = true;
    }
  });

  var stretches = [];
  for (var d = today; d < end; d = addDays(d, 1)) {
    if (!booked[d]) continue;
    var last = stretches[stretches.length - 1];
    if (last && addDays(last.to, 1) === d) last.to = d;
    else stretches.push({ from: d, to: d });
  }

  var lines = ['二十七樓・房況', shortDay(today) + ' 起 ' + DAYS_AHEAD + ' 天', ''];
  lines.push('今晚：' + (booked[today] ? '有人了' : '空著'));
  if (!stretches.length) {
    lines.push('', '接下來每一晚都空著，揪團吧。');
  } else {
    lines.push('', '有人的晚上：');
    stretches.forEach(function (s) {
      var n = nightsBetween(s.from, s.to) + 1;
      lines.push('・' + shortDay(s.from) + (n > 1 ? '～' + shortDay(s.to) + '（' + n + ' 晚）' : ''));
    });
    lines.push('', '其他晚上都空著。');
  }
  lines.push('', '訂房：' + SITE_URL);
  return lines.join('\n');
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

function replyOmikuji() {
  var f = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
  return '今晚的籤\n\n【' + f.rank + '】\n' + f.lines[0] + '\n' + f.lines[1];
}

// --- 其他 ---

function replyBooking() {
  return '訂房在網站上：\n' + SITE_URL + '\n\n多人訂房可以「發票給同學」，大家各領一張入住券。';
}

function replyHelp() {
  return '丼步喱・絆 聽得懂這些：\n\n' +
    '空房　接下來 30 天哪幾晚有人\n' +
    '擲杯　後面可以接問題，例如「擲杯 今晚續攤嗎」\n' +
    '抽籤　抽一支今晚的運勢\n' +
    '訂房　網站連結\n\n' +
    '其他的話，我也會回，只是回得沒什麼用。群組裡要 @我 才回。';
}

function welcomeText(type) {
  return (type === 'join' ? '二十七樓的神明來群組了。' : '歡迎來到丼步喱・絆。') + '\n\n' + replyHelp();
}

// --- LINE ---

function reply(replyToken, text) {
  var token = prop('LINE_CHANNEL_ACCESS_TOKEN');
  if (!token) return console.error('沒設定 LINE_CHANNEL_ACCESS_TOKEN');
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text.slice(0, 5000) }] }),
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
