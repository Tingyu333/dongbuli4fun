// 丼步喱・絆 後端（Google Apps Script，綁在訂房的 Google Sheet 上）
// 這份是備份與版本紀錄：改完貼到 Apps Script 編輯器，再「部署 → 管理部署作業 → 編輯 → 新版本」才會生效。
//
// Bookings 欄位: A=timestamp, B=room_name, C=guest_name, D=phone, E=check_in, F=check_out, G=status, H=id, I=guests,
//               J=email（選填）, K=confirm_mailed（確認信寄出的時間，寄過就不再寄）
// Tickets  欄位: A=timestamp, B=booking_id, C=seat, D=name, E=email（選填）（入住券：誰領了第幾張，第 1 張是訂房的人）
// Reviews  欄位: A=timestamp, B=name, C=rating, D=message
// Bonuses  欄位: A=timestamp, B=code, C=amount, D=note, E=max, F=status（主人從後台發的紅包：小遊戲的錢，不是真的錢）
// BonusClaims 欄位: A=timestamp, B=code, C=device（哪支手機領了哪一包；device 是手機自己產生的亂數，不是個資）
// Players  欄位: A=created, B=line_id, C=name, D=picture, E=money, F=spent, G=earned（JSON）, H=updated
//               （用 LINE 登入的玩家和小遊戲錢包。line_id 是 LINE 給的使用者代號，只存在這裡、不回給任何人）
//
// status: pending（待確認）/ confirmed（已確認）/ cancelled（已取消）。舊資料沒填的當作 confirmed。
//
// 資安（會寄信給別人，所以這裡不能從簡）：
// - 後台密碼放在「專案設定 → 指令碼屬性」的 ADMIN_PASSWORD，不寫在程式碼裡（這份檔案在公開的 GitHub 上）。
//   通知信寄給自己的信箱也放在指令碼屬性 OWNER_EMAIL。
// - 後台登入換一張 6 小時的通行證，改狀態、讀完整名單（含電話、Email）都要帶通行證。
// - 公開的 API 不回電話和 Email；公開的動作（訂房、領票、取消）不寄信給別人，
//   寄給旅人的信只有「老闆在後台按確認」這一種，陌生人沒辦法拿這裡當寄垃圾信的跳板。
// - 寄信、訂房、登入失敗都有上限。
// - LINE 登入：網頁送來的 ID token 一定要拿去問 LINE（verifyLineToken），不能相信網頁自己說的使用者代號。
//   第一次加上這段要在編輯器執行 authorizeLine() 授權「連到外部服務」。

var SITE_URL = 'https://tingyu333.github.io/dongbuli4fun/';
var ADMIN_URL = SITE_URL + 'admin_dashboard.html';
var STATUSES = ['pending', 'confirmed', 'cancelled'];
var COL_STATUS = 7; // G
var COL_ID = 8;     // H
var COL_GUESTS = 9; // I
var COL_EMAIL = 10; // J
var COL_CONFIRM_MAILED = 11; // K
var MAX_GUESTS = 8; // 27 樓的地板只有這麼大
var MAIL_LIMITS = { owner: 50, guest: 40 }; // 每天最多寄幾封（Gmail 個人帳號一天只能寄給 100 人）
var BOOKINGS_PER_HOUR = 20;  // 全站每小時最多幾筆新訂房，擋洗版
var REVIEWS_PER_HOUR = 30;   // 全站每小時最多幾則新留言
var REVIEW_MAX_LENGTH = 300; // 一則留言最多幾個字
var LOGIN_FAILS_LIMIT = 10;  // 十分鐘內登入失敗幾次就先鎖起來
var ADMIN_TOKEN_SECONDS = 6 * 60 * 60;
var BONUS_MAX_AMOUNT = 20000000; // 一包紅包每人最多發多少（小遊戲的錢，不是真的錢）
var BONUS_MAX_CLAIMS = 100;      // 一包最多幾個人領
var BONUS_TRIES_PER_HOUR = 120;  // 全站每小時最多試幾次紅包碼，擋亂猜
var LINE_LOGIN_CHANNEL_ID = '2012419790'; // LINE Login channel ID（公開的，不是密碼；channel secret 用不到，不要放進來）
var LINE_LOGINS_PER_HOUR = 300;  // 全站每小時最多驗證幾次 LINE 登入（每次都要打 LINE 的 API）
var WALLET_SYNCS_PER_HOUR = 1200; // 一個玩家每小時最多同步幾次錢包
var WALLET_MAX = 1000000000000;  // 錢包上限一兆（小遊戲的錢，不是真的錢）
var WALLET_START = 1000;         // 第一次來的錢
var GONGDE_LOGS_PER_HOUR = 60;   // 一支手機每小時最多送幾次功德紀錄
var GONGDE_ROWS_PER_HOUR = 1000; // 全站每小時最多記幾筆功德
var WASH_LOGS_PER_HOUR = 60;     // 一支手機每小時最多送幾次洗頭紀錄（一次最多 20 顆）
var WASH_ROWS_PER_HOUR = 2000;   // 全站每小時最多存幾顆頭
var CLEAN_LOGS_PER_HOUR = 60;    // 一支手機每小時最多送幾次打掃紀錄（一次最多 20 間）
var CLEAN_ROWS_PER_HOUR = 2000;  // 全站每小時最多存幾間

// doPost 用於接收資料：訂房、留言、後台改狀態
// 要排隊的動作：會「先讀再寫、讀到的決定寫什麼」的（撞期、領第幾張票、紅包還剩幾份、改狀態）。
// 以前每個 POST 都排同一個隊，所有人一個一個來，洗頭、刮刮樂的人一多後台就擠不進來。
// 現在只有這些整個排隊；錢包同步、LINE 登入只在寫 Players 那一下排隊（withLock）；
// 洗頭紀錄、留言用 appendRow（Google 自己保證不會蓋到別人那列），讀資料的完全不排隊。
var LOCKED_TYPES = { booking: 1, cancel: 1, claim: 1, unclaim: 1, bonusClaim: 1, updateStatus: 1, bonusCreate: 1, bonusClose: 1 };

function withLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { result: 'error', error: '後端在忙，等幾秒再試一次' };
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  try {
    var input = JSON.parse(e.postData.contents);
    var type = input.type || 'booking'; // 預設為 booking (相容舊版)
    if (LOCKED_TYPES[type]) return json(withLock(function () { return route(type, input); }));
    return json(route(type, input));
  } catch (err) {
    return json({ result: 'error', error: err.toString() });
  }
}

function route(type, input) {
    if (type === 'booking') return addBooking(input);
    if (type === 'review') return addReview(input);
    if (type === 'lookup') return lookupBookings(input);
    if (type === 'cancel') return cancelBooking(input);
    if (type === 'claim') return claimTicket(input);
    if (type === 'unclaim') return unclaimTicket(input);
    if (type === 'adminLogin') return adminLogin(input);
    if (type === 'bonusClaim') return bonusClaim(input);
    if (type === 'lineLogin') return lineLogin(input);
    if (type === 'lineLogout') return lineLogout(input);
    if (type === 'walletSync') return walletSync(input);
    if (type === 'washLog') return washLog(input);
    if (type === 'cleanLog') return cleanLog(input);
    if (type === 'gongdeLog') return gongdeLog(input);
    if (type === 'leaderboard') return leaderboard(input);

    // 以下只有後台能用，要帶登入拿到的通行證
    if (type === 'updateStatus' || type === 'adminList' || type === 'bonusCreate' || type === 'bonusList' || type === 'bonusClose') {
      if (!isAdmin(input.token)) return { result: 'unauthorized' };
      if (type === 'updateStatus') return updateStatus(input);
      if (type === 'bonusCreate') return bonusCreate(input);
      if (type === 'bonusList') return bonusList();
      if (type === 'bonusClose') return bonusClose(input);
      return adminList();
    }
    return { result: 'error', error: '不認得的請求' };
}

// doGet 用於獲取資料 (訂房狀況 + 留言列表)
function doGet(e) {
  if (e.parameter.action === 'getReviews') return json(readReviews());
  if (e.parameter.action === 'getTicket') return json(getTicket(e.parameter.id));

  // 公開的訂房列表只給日期和狀態（首頁月曆用），電話、Email 要從後台拿
  return json(readBookings(bookingsSheet()).map(function (b) {
    return { check_in: b.check_in, check_out: b.check_out, status: b.status };
  }));
}

// --- 後台 ---

// 密碼對了發一張通行證（存在 CacheService，6 小時後失效）
function adminLogin(input) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('loginFails') || 0);
  if (fails >= LOGIN_FAILS_LIMIT) return { result: 'error', error: '試太多次了，十分鐘後再來' };

  var password = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!password) return { result: 'error', error: '後台密碼還沒設定（指令碼屬性 ADMIN_PASSWORD）' };
  if (String(input.password || '') !== password) {
    cache.put('loginFails', String(fails + 1), 600);
    return { result: 'error', error: '密碼不對' };
  }

  var token = Utilities.getUuid();
  cache.put('admin:' + token, '1', ADMIN_TOKEN_SECONDS);
  return { result: 'success', token: token };
}

function isAdmin(token) {
  return !!token && CacheService.getScriptCache().get('admin:' + token) === '1';
}

// 後台的完整名單：含電話、Email、已經領票的人
function adminList() {
  var tickets = readTickets();
  var bookings = readBookings(bookingsSheet()).map(function (b) {
    return {
      id: b.id, guest_name: b.guest_name, phone: b.phone, email: b.email,
      check_in: b.check_in, check_out: b.check_out, status: b.status, guests: b.guests,
      confirm_mailed: !!b.confirm_mailed,
      next: nextStatuses(b),
      travelers: seatsOf(b, tickets).map(function (s) { return s.name; }).filter(String)
    };
  });
  return { result: 'success', bookings: bookings };
}

// --- 訂房 ---

function addBooking(input) {
  var checkIn = input.check_in;
  var checkOut = input.check_out;
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return { result: 'error', error: '日期不正確' };
  }
  var email = cleanEmail(input.email);
  if (input.email && !email) return { result: 'error', error: 'Email 格式不太對' };
  if (overHourlyBookings()) return { result: 'error', error: '今天太熱門了，晚點再來' };

  var sheet = bookingsSheet();
  if (hasConflict(readBookings(sheet), checkIn, checkOut, null)) {
    return { result: 'conflict' };
  }

  var id = Utilities.getUuid();
  var guests = clampGuests(input.guests);
  // 舊表沒有這幾欄的標題就補上
  [[COL_GUESTS, 'guests'], [COL_EMAIL, 'email'], [COL_CONFIRM_MAILED, 'confirm_mailed']].forEach(function (c) {
    if (!sheet.getRange(1, c[0]).getValue()) sheet.getRange(1, c[0]).setValue(c[1]);
  });
  sheet.appendRow([
    new Date(),
    input.room_name,
    input.guest_name,
    "'" + input.phone, // 前面加 ' 讓 Sheet 當文字存，09 開頭的 0 才不會不見
    checkIn,
    checkOut,
    'pending',
    id,
    guests,
    email,
    ''
  ]);
  // 人數那格強制用數字格式：欄位被設成日期時，4 會變成 1900/1/3
  sheet.getRange(sheet.getLastRow(), COL_GUESTS).setNumberFormat('0');
  countHourlyBooking();
  // 第 1 張票是訂房的人自己的
  ticketsSheet().appendRow([new Date(), id, 1, cleanName(input.guest_name) || '訂房人', email]);

  input.guests = guests;
  input.email = email;
  notifyOwner(input);
  return { result: 'success', id: id, guests: guests };
}

// 後台改狀態，只能往前走、不能回頭：
//   待確認 → 已確認（寄確認信）／已取消（婉拒，不寄信：陌生人亂填的信箱也會被婉拒，寄了就變成垃圾信）
//   已確認 → 已取消（寄取消通知：確認過的訂房，信箱才算可信）
//   已取消是終點；入住日當天起整筆鎖住。真的按錯，老闆直接改 Sheet 的 G 欄。
function updateStatus(input) {
  if (STATUSES.indexOf(input.status) === -1) {
    return { result: 'error', error: '狀態不正確' };
  }

  var sheet = bookingsSheet();
  var b = readBookings(sheet).filter(function (x) { return x.id === input.id; })[0];
  if (!b) return { result: 'error', error: '找不到這筆預約' };
  if (input.status === b.status) return { result: 'success', mailed: 0, next: nextStatuses(b) };
  if (nextStatuses(b).indexOf(input.status) === -1) {
    return { result: 'error', error: b.check_in <= todayStr() ? '已經入住或住過的預約不能改' : '這個狀態不能改回去' };
  }

  var from = b.status;
  sheet.getRange(b.row, COL_STATUS).setValue(input.status);
  b.status = input.status;

  var view = { result: 'success', mailed: 0, next: nextStatuses(b) };
  var mail = null;
  if (input.status === 'confirmed' && !b.confirm_mailed) {
    mail = sendGuestMail(b, '【丼步喱・絆】老闆准了：' + formatDay(b.check_in) + ' 入住', function (name) {
      return mailName(name) + ' 你好：\n\n' +
        '你在丼步喱・絆的預約，老闆蓋章了。\n\n' +
        '入住：' + formatDay(b.check_in) + '\n' +
        '退房：' + formatDay(b.check_out) + '\n' +
        '人數：' + b.guests + ' 人\n\n' +
        '票夾（誰領了票、你的入住券）：\n' + ticketLink(b) + '\n\n' +
        '二十七樓見。' + MAIL_FOOTER;
    });
    if (mail.sent) sheet.getRange(b.row, COL_CONFIRM_MAILED).setValue(new Date());
  }
  if (input.status === 'cancelled' && from === 'confirmed') {
    mail = sendGuestMail(b, '【丼步喱・絆】這趟取消了：' + formatDay(b.check_in) + ' 入住', function (name) {
      return mailName(name) + ' 你好：\n\n' +
        '很可惜，丼步喱・絆 ' + formatDay(b.check_in) + '～' + formatDay(b.check_out) + ' 這趟取消了。\n\n' +
        '票夾已經蓋上「作廢」：\n' + ticketLink(b) + '\n\n' +
        '下次再約。' + MAIL_FOOTER;
    });
  }
  if (mail) {
    view.mailed = mail.sent;
    view.mailKind = input.status;
    if (mail.sent < mail.total) view.mailError = lastMailError || '有信沒寄出去'; // 後台跳出來給老闆看
  }
  return view;
}

// 這筆預約還能改成哪些狀態（後台的下拉選單也照這個列）
function nextStatuses(b) {
  if (b.check_in <= todayStr()) return [];
  if (b.status === 'pending') return ['confirmed', 'cancelled'];
  if (b.status === 'confirmed') return ['cancelled'];
  return [];
}

// 朋友用訂房時留的電話查自己的預約（只回日期和狀態，不含別人的資料）
function lookupBookings(input) {
  var phone = normalizePhone(input.phone);
  if (phone.length < 8) return { result: 'error', error: '電話號碼不完整' };
  var tickets = readTickets();

  var mine = readBookings(bookingsSheet())
    .filter(function (b) { return normalizePhone(b.phone) === phone; })
    .map(function (b) {
      var claimed = seatsOf(b, tickets).filter(function (s) { return s.name; }).length;
      return { id: b.id, check_in: b.check_in, check_out: b.check_out, status: b.status, guests: b.guests, claimed: claimed };
    });
  return { result: 'success', bookings: mine };
}

// 朋友自己取消：電話要對得上，已經入住或住過的不能取消
function cancelBooking(input) {
  var sheet = bookingsSheet();
  var b = readBookings(sheet).filter(function (x) { return x.id === input.id; })[0];
  if (!b || normalizePhone(b.phone) !== normalizePhone(input.phone)) {
    return { result: 'error', error: '找不到這筆預約' };
  }
  if (b.status === 'cancelled') return { result: 'success' };
  if (b.check_in <= todayStr()) return { result: 'error', error: '已經入住或住過的預約不能取消' };

  sheet.getRange(b.row, COL_STATUS).setValue('cancelled');
  sendOwnerMail(
    '【丼步喱】取消訂房：' + b.guest_name + '　' + b.check_in + '～' + b.check_out,
    b.guest_name + ' 自己取消了預約。\n\n' +
    '入住：' + b.check_in + '\n' +
    '退房：' + b.check_out + '\n\n' +
    '後台：' + ADMIN_URL
  );
  return { result: 'success' };
}

// 只比對數字的後 9 碼：舊資料的電話被 Sheet 吃掉開頭的 0，也能對上
function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-9);
}

function todayStr() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
}

// 退房當天可以讓下一組入住，所以用 < 和 > 判斷重疊（yyyy-MM-dd 字串可以直接比大小）
function hasConflict(bookings, checkIn, checkOut, ignoreId) {
  return bookings.some(function (b) {
    return b.id !== ignoreId && b.status !== 'cancelled' && checkIn < b.check_out && checkOut > b.check_in;
  });
}

function readBookings(sheet) {
  var rows = sheet.getDataRange().getValues();
  var data = [];

  // 從第 2 行開始讀 (跳過標題)
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (!row[4] || !row[5]) continue; // 沒有日期的空白列

    var id = row[7];
    if (!id) { // 舊資料沒有 id，補一個寫回去，後台才能改它的狀態
      id = Utilities.getUuid();
      sheet.getRange(i + 1, COL_ID).setValue(id);
    }

    data.push({
      id: id,
      row: i + 1,
      guest_name: row[2],
      phone: String(row[3]),
      check_in: toDateStr(row[4]),
      check_out: toDateStr(row[5]),
      status: row[6] || 'confirmed',
      guests: clampGuests(row[8]), // 舊資料沒填人數的當作 1 人
      email: String(row[9] || ''),
      confirm_mailed: row[10] || ''
    });
  }
  return data;
}

function bookingsSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Bookings');
}

// 新訂房寄信給自己（部署的 Google 帳號）
function notifyOwner(b) {
  sendOwnerMail(
    '【丼步喱】新訂房：' + b.guest_name + '　' + b.check_in + '～' + b.check_out,
    '有人訂房了！\n\n' +
    '姓名：' + b.guest_name + '\n' +
    '電話：' + b.phone + '\n' +
    'Email：' + (b.email || '沒留') + '\n' +
    '人數：' + b.guests + ' 人\n' +
    '入住：' + b.check_in + '\n' +
    '退房：' + b.check_out + '\n\n' +
    '到後台確認：' + ADMIN_URL
  );
}

// 寄給自己：收件信箱放在指令碼屬性 OWNER_EMAIL。
// 沒設定就試著讀部署帳號的信箱（需要 userinfo.email 權限，沒有就跳過）。寄信出問題不影響訂房或取消。
function sendOwnerMail(subject, body) {
  var to = ownerEmail();
  if (to) sendMail('owner', to, subject, body);
}

function ownerEmail() {
  var email = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL');
  if (email) return email;
  try {
    return Session.getEffectiveUser().getEmail();
  } catch (err) {
    console.error('拿不到部署帳號的信箱，請在指令碼屬性加上 OWNER_EMAIL', err);
    return '';
  }
}

var MAIL_FOOTER = '\n\n——\n丼步喱・絆\n不想再收到這種信，跟老闆說一聲就好。';

function ticketLink(b) {
  return SITE_URL + 'ticket.html?id=' + encodeURIComponent(b.id);
}

// 寄給訂房人和領票時有留 Email 的人（同一個信箱只寄一次）。只能由後台的動作呼叫
function sendGuestMail(b, subject, bodyFor) {
  var seen = {};
  var recipients = [];
  var add = function (email, name) {
    var key = String(email || '').toLowerCase();
    if (!key || seen[key]) return;
    seen[key] = true;
    recipients.push({ email: email, name: name });
  };
  add(b.email, b.guest_name);
  readTickets().forEach(function (t) {
    if (t.booking_id === b.id && t.seat <= b.guests) add(t.email, t.name);
  });

  var sent = 0;
  lastMailError = '';
  recipients.forEach(function (r) {
    if (sendMail('guest', r.email, subject, bodyFor(r.name))) sent++;
  });
  return { sent: sent, total: recipients.length };
}

var lastMailError = ''; // 這次請求裡最後一次寄信失敗的原因

// 編輯器上方選這個函式按「執行」：檢查寄信設定、寄一封測試信給自己。
// 這裡故意不接住錯誤，有問題會直接顯示在下方「執行記錄」；第一次執行也會跳出授權視窗。
function debugMail() {
  var props = PropertiesService.getScriptProperties();
  var to = props.getProperty('OWNER_EMAIL');
  console.log('OWNER_EMAIL：' + (to || '（沒設定）'));
  console.log('Gmail 今天還能寄給幾人：' + MailApp.getRemainingDailyQuota());
  console.log('今天網站寄了幾封：寄給自己 ' + (props.getProperty('mailCount-owner') || '0') +
    '、寄給旅人 ' + (props.getProperty('mailCount-guest') || '0') + '（格式：日期|封數）');
  if (!to) throw new Error('請先到「專案設定 → 指令碼屬性」加上 OWNER_EMAIL');
  MailApp.sendEmail({ to: to, subject: '【丼步喱】寄信測試', body: '收到這封信，代表網站寄信沒問題。', name: '丼步喱・絆' });
  console.log('測試信已寄到 ' + to + '，沒看到記得找一下垃圾信匣');
}

// 所有寄信都走這裡：超過每日上限就不寄；寄信失敗不影響訂房或改狀態
function sendMail(kind, to, subject, body) {
  var props = PropertiesService.getScriptProperties();
  var key = 'mailCount-' + kind;
  var today = todayStr();
  var record = String(props.getProperty(key) || '').split('|');
  var count = record[0] === today ? Number(record[1]) || 0 : 0;
  if (count >= MAIL_LIMITS[kind]) {
    lastMailError = '今天的寄信上限到了';
    console.warn('今天的' + kind + '信件已達上限，不寄：' + subject);
    return false;
  }
  try {
    MailApp.sendEmail({ to: to, subject: subject, body: body, name: '丼步喱・絆' });
    props.setProperty(key, today + '|' + (count + 1));
    return true;
  } catch (err) {
    lastMailError = String(err.message || err);
    console.error('寄信失敗', err);
    return false;
  }
}

// 名字是使用者填的：像網址或信箱的就不放進信裡，免得變成釣魚連結
function mailName(name) {
  var n = cleanName(name);
  return !n || /[.\/@:]/.test(n) ? '旅人' : n;
}

function formatDay(str) {
  var d = new Date(str + 'T00:00:00+08:00');
  if (isNaN(d.getTime())) return str;
  var weekday = '日一二三四五六'.charAt(Number(Utilities.formatDate(d, 'Asia/Taipei', 'u')) % 7);
  return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd') + '（' + weekday + '）';
}

// 全站每小時的新訂房數，存在 CacheService
function hourKey() {
  return 'bookings:' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
}

function overHourlyBookings() {
  return Number(CacheService.getScriptCache().get(hourKey()) || 0) >= BOOKINGS_PER_HOUR;
}

function countHourlyBooking() {
  var cache = CacheService.getScriptCache();
  cache.put(hourKey(), String(Number(cache.get(hourKey()) || 0) + 1), 3600);
}

// 第一次貼上後，在編輯器上方選這個函式按「執行」：授權寄信權限，並收到一封測試信
function testNotify() {
  notifyOwner({ guest_name: '測試旅人', phone: '0900000000', email: '', guests: 2, check_in: '2026-01-01', check_out: '2026-01-02' });
}

// --- 入住券 ---
// 訂房的人把票夾連結（ticket.html?id=訂房 id）丟到群組，朋友輸入名字領下一張空票。
// 沒有帳號：同一個名字再領一次，就當作是同一個人換了手機，把原本那張還給他。

// 票夾：訂房資訊（不含電話）＋每張票誰領了
function getTicket(id) {
  var b = findBooking(id);
  if (!b) return { result: 'error', error: '找不到這張票' };
  return ticketView(b, readTickets());
}

function claimTicket(input) {
  var b = findBooking(input.id);
  if (!b) return { result: 'error', error: '找不到這張票' };
  if (b.status === 'cancelled') return { result: 'error', error: '這趟已經取消了' };
  if (b.check_out < todayStr()) return { result: 'error', error: '這趟已經結束了' };
  var name = cleanName(input.name);
  if (!name) return { result: 'error', error: '請寫上名字' };
  var email = cleanEmail(input.email);
  if (input.email && !email) return { result: 'error', error: 'Email 格式不太對' };

  var tickets = readTickets();
  var seats = seatsOf(b, tickets);
  var mine = seats.filter(function (s) { return s.name === name; })[0];
  if (mine) { // 已經領過，同一張還給他；這次有留 Email 就補上
    var t = tickets.filter(function (x) { return x.booking_id === b.id && x.seat === mine.seat && x.name === name; })[0];
    if (email && t) ticketsSheet().getRange(t.row, 5).setValue(email);
    return ticketView(b, tickets, mine.seat);
  }

  var free = seats.filter(function (s) { return !s.name; })[0];
  if (!free) return { result: 'full' };

  ticketsSheet().appendRow([new Date(), b.id, free.seat, name, email]);
  return ticketView(b, readTickets(), free.seat);
}

// 退票：名字要對得上；第 1 張是訂房的人，不能退（要退就整筆取消）
function unclaimTicket(input) {
  var seat = Number(input.seat);
  if (seat === 1) return { result: 'error', error: '訂房的人不能退票' };
  var name = cleanName(input.name);
  var tickets = readTickets();
  var t = tickets.filter(function (x) { return x.booking_id === input.id && x.seat === seat && x.name === name; })[0];
  if (!t) return { result: 'error', error: '找不到這張票' };

  ticketsSheet().deleteRow(t.row);
  var b = findBooking(input.id);
  return b ? ticketView(b, readTickets()) : { result: 'success' };
}

function ticketView(b, tickets, seat) {
  var view = {
    result: 'success',
    booking: { id: b.id, host: b.guest_name, check_in: b.check_in, check_out: b.check_out, status: b.status, guests: b.guests },
    seats: seatsOf(b, tickets)
  };
  if (seat) view.seat = seat;
  return view;
}

// 這筆訂房的每一張票（1～guests），沒人領的 name 是空字串；人數改少時多出來的票不算
function seatsOf(b, tickets) {
  var seats = [];
  for (var n = 1; n <= b.guests; n++) seats.push({ seat: n, name: '' });
  tickets.forEach(function (t) {
    if (t.booking_id === b.id && t.seat >= 1 && t.seat <= b.guests && !seats[t.seat - 1].name) {
      seats[t.seat - 1].name = t.name;
    }
  });
  return seats;
}

function readTickets() {
  var rows = ticketsSheet().getDataRange().getValues();
  var data = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][1]) continue;
    data.push({ row: i + 1, booking_id: String(rows[i][1]), seat: Number(rows[i][2]), name: String(rows[i][3]), email: String(rows[i][4] || '') });
  }
  return data;
}

// 沒有 Tickets 分頁就自動建一個
function ticketsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Tickets');
  if (!sheet) {
    sheet = ss.insertSheet('Tickets');
    sheet.appendRow(['timestamp', 'booking_id', 'seat', 'name', 'email']);
  }
  return sheet;
}

function findBooking(id) {
  if (!id) return null;
  return readBookings(bookingsSheet()).filter(function (b) { return b.id === id; })[0] || null;
}

function clampGuests(value) {
  // 欄位被設成日期格式時讀出來是 Date（4 會變成 1900/1/3），換算回試算表的日期序號
  if (Object.prototype.toString.call(value) === '[object Date]') value = Math.round((value.getTime() - new Date(1899, 11, 30).getTime()) / 86400000);
  var n = parseInt(value, 10);
  if (!(n >= 1)) return 1;
  return Math.min(n, MAX_GUESTS);
}

// 選填的 Email：格式不對回空字串
function cleanEmail(value) {
  var s = String(value || '').trim();
  return s.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
}

function cleanName(name) {
  return String(name || '').trim().slice(0, 12);
}

// --- 留言 ---

function addReview(input) {
  var name = cleanName(input.name);
  var message = String(input.message || '').trim();
  var rating = Math.round(Number(input.rating));
  if (!name) return { result: 'error', error: '要寫名字' };
  if (!message) return { result: 'error', error: '留言是空的' };
  if (message.length > REVIEW_MAX_LENGTH) return { result: 'error', error: '留言最多 ' + REVIEW_MAX_LENGTH + ' 字' };
  if (!(rating >= 1 && rating <= 5)) return { result: 'error', error: '評分要 1～5 顆星' };

  var cache = CacheService.getScriptCache();
  var hourKey = 'reviews:' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var count = Number(cache.get(hourKey) || 0);
  if (count >= REVIEWS_PER_HOUR) return { result: 'error', error: '這小時留言太多了，晚點再來' };
  // 同一句話剛剛才留過（手滑按兩次、網路慢重送）就不再寫一次
  var sameKey = 'review-last:' + name + ':' + message;
  if (cache.get(sameKey)) return { result: 'error', error: '這句剛剛留過了' };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Reviews');
  if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Reviews');
  var now = new Date();
  // 開頭是 = + - @ 的話 Sheet 會當成公式，前面加 ' 當純文字存
  sheet.appendRow([now, asText(name), rating, asText(message)]);
  cache.put(hourKey, String(count + 1), 3600);
  cache.put(sameKey, '1', 10 * 60);
  return { result: 'success', type: 'review', review: { name: name, rating: rating, message: message, timestamp: now.toISOString() } };
}

function asText(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

// 新的在前面；空白列跳過；Sheet 裡被加了 ' 的不會讀到 '（Sheet 自己吃掉）
function readReviews() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Reviews');
  if (!sheet) return [];

  var rows = sheet.getDataRange().getValues();
  var data = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    if (!row[1] && !row[3]) continue;
    var time = row[0];
    data.push({
      timestamp: Object.prototype.toString.call(time) === '[object Date]' ? time.toISOString() : time,
      name: String(row[1] || ''),
      rating: Number(row[2]) || 5,
      message: String(row[3] || '')
    });
  }
  return data.reverse();
}

// --- 紅包：主人從後台發小遊戲的錢，旅人用紅包碼領進自己手機的錢包 ---
// Bonuses：A timestamp、B code、C amount（每人）、D note、E max（幾份）、F status（open／closed）
// BonusClaims：A timestamp、B code、C device（手機自己產生的亂數代號，不是個資）

function bonusSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Bonuses');
  if (!sheet) {
    sheet = ss.insertSheet('Bonuses');
    sheet.appendRow(['timestamp', 'code', 'amount', 'note', 'max', 'status']);
  }
  return sheet;
}

function bonusClaimsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('BonusClaims');
  if (!sheet) {
    sheet = ss.insertSheet('BonusClaims');
    sheet.appendRow(['timestamp', 'code', 'device']);
  }
  return sheet;
}

function readBonuses() {
  var rows = bonusSheet().getDataRange().getValues();
  var data = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][1]) continue;
    var time = rows[i][0];
    data.push({
      row: i + 1,
      timestamp: Object.prototype.toString.call(time) === '[object Date]' ? time.toISOString() : time,
      code: String(rows[i][1]), amount: Number(rows[i][2]) || 0, note: String(rows[i][3] || ''),
      max: Number(rows[i][4]) || 1, status: rows[i][5] === 'closed' ? 'closed' : 'open'
    });
  }
  return data;
}

function readBonusClaims() {
  var rows = bonusClaimsSheet().getDataRange().getValues();
  var data = [];
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][1]) data.push({ code: String(rows[i][1]), device: String(rows[i][2]) });
  }
  return data;
}

// 紅包碼只留大寫英數（旅人可能手打，小寫、空白都幫忙整理）
function cleanBonusCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

// 六碼，不用 0 O 1 I 這些長得像的
function newBonusCode(taken) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    var code = '';
    for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    if (taken.indexOf(code) < 0) return code;
  }
}

// 後台：全部的紅包，新的在前面，含已經領了幾份
function bonusList() {
  var claims = readBonusClaims();
  var bonuses = readBonuses().map(function (b) {
    return {
      code: b.code, amount: b.amount, note: b.note, max: b.max, status: b.status, timestamp: b.timestamp,
      claimed: claims.filter(function (c) { return c.code === b.code; }).length
    };
  });
  return { result: 'success', bonuses: bonuses.reverse() };
}

// 後台：發一包。amount 是每個人領到的金額，max 是幾份
function bonusCreate(input) {
  var amount = Math.round(Number(input.amount));
  var max = Math.round(Number(input.max));
  var note = String(input.note || '').trim().slice(0, 30);
  if (!(amount >= 1 && amount <= BONUS_MAX_AMOUNT)) return { result: 'error', error: '金額要 1 到 ' + BONUS_MAX_AMOUNT };
  if (!(max >= 1 && max <= BONUS_MAX_CLAIMS)) return { result: 'error', error: '份數要 1 到 ' + BONUS_MAX_CLAIMS };

  var code = newBonusCode(readBonuses().map(function (b) { return b.code; }));
  bonusSheet().appendRow([new Date(), code, amount, asText(note), max, 'open']);
  var list = bonusList();
  list.code = code;
  return list;
}

// 後台：收回（還沒領的份就不能領了，已經領走的不會扣回來）
function bonusClose(input) {
  var code = cleanBonusCode(input.code);
  var b = readBonuses().filter(function (x) { return x.code === code; })[0];
  if (!b) return { result: 'error', error: '找不到這包紅包' };
  bonusSheet().getRange(b.row, 6).setValue('closed');
  return bonusList();
}

// 公開：用紅包碼領。一支手機（device）一包只能領一次，領完 max 份就沒了。不回任何個資、不寄信
function bonusClaim(input) {
  var cache = CacheService.getScriptCache();
  var triesKey = 'bonusTries:' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var tries = Number(cache.get(triesKey) || 0);
  if (tries >= BONUS_TRIES_PER_HOUR) return { result: 'error', error: '這小時太多人在領紅包了，晚點再來' };
  cache.put(triesKey, String(tries + 1), 3600);

  var code = cleanBonusCode(input.code);
  var device = String(input.device || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (!code) return { result: 'error', error: '要輸入紅包碼' };
  if (device.length < 8) return { result: 'error', error: '這支手機領不了（沒有裝置代號）' };

  var b = readBonuses().filter(function (x) { return x.code === code; })[0];
  if (!b) return { result: 'error', error: '沒有這個紅包碼' };
  if (b.status === 'closed') return { result: 'error', error: '這包紅包被主人收回去了' };

  var claims = readBonusClaims().filter(function (c) { return c.code === code; });
  if (claims.some(function (c) { return c.device === device; })) return { result: 'claimed' };
  if (claims.length >= b.max) return { result: 'empty' };

  bonusClaimsSheet().appendRow([new Date(), code, device]);
  return { result: 'success', amount: b.amount, note: b.note, left: b.max - claims.length - 1 };
}

// --- LINE 登入、小遊戲錢包 ---
// 網頁用 LIFF 拿到 LINE 的 ID token，送來這裡；這裡拿去問 LINE 是不是真的、是誰，
// 驗過了才發一張網站自己的通行證（session）。不能相信網頁自己說的使用者代號。

function playersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Players');
  if (!sheet) {
    sheet = ss.insertSheet('Players');
    sheet.appendRow(['created', 'line_id', 'name', 'picture', 'money', 'spent', 'earned', 'updated', 'gongde', 'shop']);
  }
  return sheet;
}

// 坐洗部店面升級：{ lv: { shampoo: 2, … }, spent }，存在 Players 的 J 欄（JSON）。等級只升不降，合併時每一項取高的
function cleanShop(s) {
  s = s && typeof s === 'object' ? s : {};
  var lv = {}, raw = s.lv && typeof s.lv === 'object' && !Array.isArray(s.lv) ? s.lv : {}, keys = Object.keys(raw);
  if (keys.length > 20) return null;
  for (var i = 0; i < keys.length; i++) {
    var n = cleanMoney(raw[keys[i]] || 0, 0, 10);
    if (!/^[a-z]{1,16}$/.test(keys[i]) || n === null) return null;
    if (n) lv[keys[i]] = n;
  }
  var spent = cleanMoney(s.spent || 0, 0, WALLET_MAX);
  if (spent === null) return null;
  return { lv: lv, spent: spent };
}

function mergeShop(a, b) {
  var out = { lv: {}, spent: Math.max(a.spent || 0, b.spent || 0) };
  [a.lv || {}, b.lv || {}].forEach(function (lv) {
    Object.keys(lv).forEach(function (k) { out.lv[k] = Math.max(out.lv[k] || 0, lv[k]); });
  });
  return out;
}

// 功德：{ donated 累積捐了多少, oil 光明燈剩多少燈油, oils 其他燈剩多少 { caishen, taisui, wenchang, yuelao }, lamps 點過幾盞, lit 點燈花了多少 }，存在 Players 的 I 欄（JSON）
function cleanGongde(g, allowNegative) {
  g = g && typeof g === 'object' ? g : {};
  var lo = allowNegative ? -WALLET_MAX : 0;
  var donated = cleanMoney(g.donated || 0, 0, WALLET_MAX);
  var oil = cleanMoney(g.oil || 0, lo, WALLET_MAX);
  var lamps = cleanMoney(g.lamps || 0, 0, 1000000);
  var lit = cleanMoney(g.lit || 0, 0, WALLET_MAX);
  if (donated === null || oil === null || lamps === null || lit === null) return null;
  // 其他種燈的燈油（財神、太歲、文昌、月老…）：小寫英文 key，最多 10 種
  var oils = {}, raw = g.oils && typeof g.oils === 'object' && !Array.isArray(g.oils) ? g.oils : {}, keys = Object.keys(raw);
  if (keys.length > 10) return null;
  for (var i = 0; i < keys.length; i++) {
    var v = cleanMoney(raw[keys[i]] || 0, lo, WALLET_MAX);
    if (!/^[a-z]{1,16}$/.test(keys[i]) || v === null) return null;
    if (v) oils[keys[i]] = v;
  }
  return { donated: donated, oil: oil, lamps: lamps, lit: lit, oils: oils };
}

function findPlayer(lineId) {
  var rows = playersSheet().getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][1]) !== lineId) continue;
    var earned = {}, gongde = {}, shop = {};
    try { earned = JSON.parse(rows[i][6] || '{}') || {}; } catch (e) { }
    try { gongde = JSON.parse(rows[i][8] || '{}') || {}; } catch (e) { }
    try { shop = JSON.parse(rows[i][9] || '{}') || {}; } catch (e) { }
    return {
      row: i + 1, lineId: lineId, name: String(rows[i][2] || ''), picture: String(rows[i][3] || ''),
      money: Number(rows[i][4]) || 0, spent: Number(rows[i][5]) || 0, earned: cleanEarned(earned) || {},
      gongde: cleanGongde(gongde) || { donated: 0, oil: 0, lamps: 0, lit: 0, oils: {} },
      shop: cleanShop(shop) || { lv: {}, spent: 0 }
    };
  }
  return null;
}

// 問 LINE 這張 ID token 是不是真的、是誰的。不是真的回 null
function verifyLineToken(idToken) {
  if (!idToken || idToken.length > 4000) return null;
  var res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'post',
    payload: { id_token: idToken, client_id: LINE_LOGIN_CHANNEL_ID },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return null;
  var p = JSON.parse(res.getContentText());
  if (String(p.aud) !== LINE_LOGIN_CHANNEL_ID || !p.sub) return null;
  return { sub: String(p.sub), name: String(p.name || '旅人').slice(0, 20), picture: /^https:\/\//.test(p.picture || '') ? String(p.picture) : '' };
}

// 第一次貼上後，在編輯器選這個函式按「執行」：授權「連到外部服務」（跟 LINE 驗證要用）
function authorizeLine() {
  var res = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'post', payload: { id_token: 'test', client_id: LINE_LOGIN_CHANNEL_ID }, muteHttpExceptions: true
  });
  Logger.log('連得到 LINE（這次用假的 token，回 400 是正常的）：' + res.getResponseCode());
}

function sessionUser(session) {
  session = String(session || '');
  if (!/^[0-9a-f-]{20,60}$/i.test(session)) return null;
  return PropertiesService.getScriptProperties().getProperty('sess:' + session);
}

// 網頁送來的錢包數字：都要是合理範圍的整數，不對就整包不收
function cleanMoney(v, min, max) {
  var n = Number(v);
  if (!isFinite(n) || Math.round(n) !== n || n < min || n > max) return null;
  return n;
}

function cleanEarned(earned) {
  if (!earned || typeof earned !== 'object' || Array.isArray(earned)) return null;
  var out = {}, keys = Object.keys(earned);
  if (keys.length > 20) return null;
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], e = earned[k];
    if (!/^[a-z]{1,16}$/.test(k) || !e || typeof e !== 'object') return null;
    var times = cleanMoney(e.times, 0, 1000000), total = cleanMoney(e.total, 0, WALLET_MAX), best = cleanMoney(e.best, 0, WALLET_MAX);
    if (times === null || total === null || best === null) return null;
    out[k] = { times: times, total: total, best: best };
  }
  return out;
}

function addEarned(base, more) {
  Object.keys(more).forEach(function (k) {
    var b = base[k] || (base[k] = { times: 0, total: 0, best: 0 });
    b.times += more[k].times;
    b.total = Math.min(WALLET_MAX, b.total + more[k].total);
    b.best = Math.max(b.best, more[k].best);
  });
  return base;
}

function walletView(p) {
  return { money: p.money, spent: p.spent, earned: p.earned, gongde: p.gongde, shop: p.shop };
}

function writeWallet(p) {
  playersSheet().getRange(p.row, 5, 1, 6).setValues([[p.money, p.spent, JSON.stringify(p.earned), new Date(), JSON.stringify(p.gongde), JSON.stringify(p.shop)]]);
}

// 公開：LINE 登入。第一次登入的人，用這支手機原本的錢包開帳號
function lineLogin(input) {
  var cache = CacheService.getScriptCache();
  var hourKey = 'lineLogins:' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var count = Number(cache.get(hourKey) || 0);
  if (count >= LINE_LOGINS_PER_HOUR) return { result: 'error', error: '這小時登入的人太多了，晚點再來' };
  cache.put(hourKey, String(count + 1), 3600);

  var who = verifyLineToken(String(input.idToken || ''));
  if (!who) return { result: 'error', error: 'LINE 登入驗證不過，再試一次' };

  // 問 LINE 那段比較慢，不排隊；只有查帳號、開帳號這一下排隊（同一個人兩支手機同時登入才不會開出兩個帳號）
  var isNew = false;
  var p = withLock(function () {
    var sheet = playersSheet();
    if (!sheet.getRange(1, 9).getValue()) sheet.getRange(1, 9).setValue('gongde'); // 舊表補上功德、店面那兩欄的標題
    if (!sheet.getRange(1, 10).getValue()) sheet.getRange(1, 10).setValue('shop');
    var localShop = cleanShop((input.wallet || {}).shop);
    var found = findPlayer(who.sub);
    if (found) {
      playersSheet().getRange(found.row, 3, 1, 2).setValues([[asText(who.name), who.picture]]);
      // 這支手機登入前買過的店面升級，併進帳號
      if (localShop && Object.keys(localShop.lv).length) {
        found.shop = mergeShop(found.shop, localShop);
        playersSheet().getRange(found.row, 10).setValue(JSON.stringify(found.shop));
      }
      return found;
    }
    isNew = true;
    var w = input.wallet || {};
    var money = cleanMoney(w.money, 0, WALLET_MAX), spent = cleanMoney(w.spent, 0, WALLET_MAX), earned = cleanEarned(w.earned);
    var gongde = cleanGongde(w.gongde) || { donated: 0, oil: 0, lamps: 0, lit: 0, oils: {} };
    playersSheet().appendRow([new Date(), who.sub, asText(who.name), who.picture,
      money === null ? WALLET_START : money, spent === null ? 0 : spent, JSON.stringify(earned || {}), new Date(), JSON.stringify(gongde),
      JSON.stringify(localShop || { lv: {}, spent: 0 })]);
    return findPlayer(who.sub);
  });
  if (!p) return { result: 'error', error: '帳號開不起來，再試一次' };
  if (p.result) return p;  // 排不到隊

  var session = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('sess:' + session, who.sub);
  var player = walletView(p);
  player.name = who.name;
  player.picture = who.picture;
  player.isNew = isNew;
  return { result: 'success', session: session, player: player };
}

function lineLogout(input) {
  if (sessionUser(input.session)) PropertiesService.getScriptProperties().deleteProperty('sess:' + input.session);
  return { result: 'success' };
}

// 要登入：把這支手機剛剛賺的、花的（delta）加進帳號，回傳帳號現在的錢包。delta 全是 0 就是單純讀一次
// 送的是「變了多少」不是「現在多少」，兩支手機同時玩才不會互相蓋掉
function walletSync(input) {
  var lineId = sessionUser(input.session);
  if (!lineId) return { result: 'unauthorized' };

  var cache = CacheService.getScriptCache();
  var hourKey = 'walletSync:' + lineId + ':' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var count = Number(cache.get(hourKey) || 0);
  if (count >= WALLET_SYNCS_PER_HOUR) return { result: 'error', error: '同步太多次了，晚點再來' };
  cache.put(hourKey, String(count + 1), 3600);

  var d = input.delta || {};
  var money = cleanMoney(d.money || 0, -WALLET_MAX, WALLET_MAX), spent = cleanMoney(d.spent || 0, 0, WALLET_MAX), earned = cleanEarned(d.earned || {});
  var gd = cleanGongde(d.gongde, true);  // 燈油可以是負的（刮刮樂用掉的）
  var shop = d.shop ? cleanShop(d.shop) : null;  // 店面送的是整份，不是變化量
  if (money === null || spent === null || earned === null || gd === null || (d.shop && !shop)) return { result: 'error', error: '錢包的數字不對' };

  var changed = money || spent || Object.keys(earned).length || gd.donated || gd.oil || gd.lamps || gd.lit || Object.keys(gd.oils).length || !!shop;
  // 單純讀不用排隊；有加減錢才排隊（讀出來、加上去、寫回去要一口氣做完，兩支手機同時送才不會少算）
  var read = function () {
    var p = findPlayer(lineId);
    if (!p) return { result: 'unauthorized' };
    if (changed) {
      p.money = Math.max(0, Math.min(WALLET_MAX, p.money + money));
      p.spent = Math.min(WALLET_MAX, p.spent + spent);
      p.earned = addEarned(p.earned, earned);
      p.gongde = {
        donated: Math.min(WALLET_MAX, p.gongde.donated + gd.donated),
        oil: Math.max(0, Math.min(WALLET_MAX, p.gongde.oil + gd.oil)),
        lamps: p.gongde.lamps + gd.lamps,
        lit: Math.min(WALLET_MAX, p.gongde.lit + gd.lit),
        oils: p.gongde.oils
      };
      Object.keys(gd.oils).forEach(function (k) {
        var v = Math.max(0, Math.min(WALLET_MAX, (p.gongde.oils[k] || 0) + gd.oils[k]));
        if (v) p.gongde.oils[k] = v; else delete p.gongde.oils[k];
      });
      if (Object.keys(p.gongde.oils).length > 10) return { result: 'error', error: '燈太多種了' };
      if (shop) p.shop = mergeShop(p.shop, shop);
      writeWallet(p);
    }
    return { result: 'success', wallet: walletView(p) };
  };
  return changed ? withLock(read) : read();
}

// --- 工具 ---

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// Sheet 會把日期字串轉成 Date，這裡轉回台灣時間的 yyyy-MM-dd，避免時區差一天
function toDateStr(value) {
  return value instanceof Date ? Utilities.formatDate(value, 'Asia/Taipei', 'yyyy-MM-dd') : value;
}

// --- 坐洗・泡：每一顆頭的紀錄 ---
// 洗完網頁送上來，一列一顆頭，存在 Washes 分頁（之後排行榜、圖鑑用）。
// 有登入 LINE 的記 line_id（不回給任何人）；沒登入的只有手機代號（亂數，不是個資）。
// 不寄信、不回任何資料，只回存了幾顆。網頁送的數字改得動（朋友間玩，不防），這裡只擋格式和數量。

var WASH_HEADERS = ['timestamp', 'at', 'line_id', 'device', 'who', 'style', 'total', 'grade',
  'squeeze', 'rub', 'scratch', 'style_score', 'pat', 'pumps', 'want', 'drip', 'coverage', 'rub_ms',
  'hits', 'force', 'shape', 'strokes', 'pat_marks', 'face_pokes', 'ear_pokes', 'order', 'order_done',
  'wage', 'tip', 'order_tip', 'ms', 'login', 'extra'];

function washesSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Washes');
  if (!sheet) {
    sheet = ss.insertSheet('Washes');
    sheet.appendRow(WASH_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function washNum(v, min, max) {
  var n = Number(v);
  if (!isFinite(n)) return '';
  return Math.max(min, Math.min(max, Math.round(n * 100) / 100));
}

function washText(v, max) {
  return asText(String(v == null ? '' : v).replace(/[\r\n\t]/g, ' ').slice(0, max));
}

function washKey(v) {
  v = String(v || '');
  return /^[a-z]{1,12}$/.test(v) ? v : '';
}

// 一顆頭變成一列；格式不對回 null（整顆不收）
function washRow(r, now, lineId, device) {
  if (!r || typeof r !== 'object') return null;
  var at = new Date(r.at);
  if (isNaN(at.getTime()) || at.getTime() > now.getTime() + 86400000 || at.getTime() < now.getTime() - 90 * 86400000) return null;
  var parts = r.parts || {}, pay = r.pay || {}, pokes = r.pokes || {}, order = r.order || null;
  var want = Array.isArray(r.want) ? r.want.slice(0, 2).map(function (x) { return washNum(x, 0, 20); }).join('-') : '';
  var extra = { cat: !!r.cat, dog: !!r.dog, glasses: washKey(r.glasses), mustache: !!r.mustache, freckles: !!r.freckles };
  return [
    now, at, lineId || '', device,
    washText(r.who, 30), washKey(r.style), washNum(r.total, 0, 100), washText(r.grade, 2),
    washNum(parts.squeeze, 0, 15), washNum(parts.rub, 0, 25), washNum(parts.scratch, 0, 30), washNum(parts.style, 0, 10), washNum(parts.pat, 0, 20),
    washNum(r.pumps, 0, 20), want, !!r.drip, washNum(r.coverage, 0, 1), r.rubMs == null ? '' : washNum(r.rubMs, 0, 60000),
    washNum(r.hits, 0, 14), washText(r.force, 20), washKey(r.shape), washNum(r.strokes, 0, 200), washText(r.patMarks, 8),
    washNum(pokes.face, 0, 999), washNum(pokes.ear, 0, 999),
    order ? washKey(order.id) : '', order ? !!order.done : '',
    washNum(pay.wage, 0, 100000), washNum(pay.tip, 0, 100000), washNum(pay.order, 0, 100000),
    washNum(r.ms, 0, 3600000), !!r.login, JSON.stringify(extra)
  ];
}

// 在編輯器選這個按「執行」：先把 Washes 分頁建出來，順便確認編輯器裡是新的程式
function setupWashes() {
  var sheet = washesSheet();
  Logger.log('Washes 分頁好了，目前有 ' + (sheet.getLastRow() - 1) + ' 顆頭。網頁要能存，還要「部署 → 管理部署作業 → 編輯 → 版本選新版本 → 部署」。');
}

function washLog(input) {
  var device = String(input.device || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (device.length < 8) return { result: 'error', error: '沒有裝置代號' };
  var recs = Array.isArray(input.recs) ? input.recs.slice(0, 20) : [];
  if (!recs.length) return { result: 'success', saved: 0 };

  var cache = CacheService.getScriptCache();
  var hour = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var devKey = 'washLog:' + device + ':' + hour, allKey = 'washRows:' + hour;
  var devCount = Number(cache.get(devKey) || 0), allCount = Number(cache.get(allKey) || 0);
  if (devCount >= WASH_LOGS_PER_HOUR) return { result: 'error', error: '這小時送太多次了' };
  if (allCount + recs.length > WASH_ROWS_PER_HOUR) return { result: 'error', error: '這小時全站洗太多頭了' };
  cache.put(devKey, String(devCount + 1), 3600);

  var lineId = input.session ? sessionUser(input.session) : null;  // 通行證不對就當沒登入，照樣存
  var now = new Date(), rows = [], skipped = 0;
  recs.forEach(function (r) {
    var row = washRow(r, now, lineId, device);
    if (!row) { skipped++; return; }
    // 同一支手機同一個時間的同一顆頭，重送不要存兩次
    var dupKey = 'wash:' + device + ':' + row[1].getTime();
    if (cache.get(dupKey)) { skipped++; return; }
    cache.put(dupKey, '1', 6 * 3600);
    rows.push(row);
  });
  if (rows.length) {
    // appendRow 不排隊也不會兩個人寫到同一列（一次通常只有一顆）
    var sheet = washesSheet();
    rows.forEach(function (row) { sheet.appendRow(row); });
    cache.put(allKey, String(allCount + rows.length), 3600);
  }
  return { result: 'success', saved: rows.length, skipped: skipped };
}


// --- 打工排行榜（rank.html）---
// 只有用 LINE 登入過的玩家：賺多少、做幾次從 Players 的 earned 讀，單場最高分從 Washes／Cleans 讀（同分比快）。
// 公開：回 LINE 名字和大頭貼，不回 line_id；有帶 session 的話把自己那列標 me。算好的榜存 CacheService 5 分鐘。

var BOARD_CACHE_KEY = 'board:v1', BOARD_CACHE_SEC = 300;

function boardBest(sheetName, totalCol, msCol) {
  var best = {}, sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return best;
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, msCol + 1).getValues();
  rows.forEach(function (r) {
    var id = String(r[2] || ''), total = Number(r[totalCol]), ms = Number(r[msCol]) || 0;
    if (!id || r[totalCol] === '' || !isFinite(total)) return;
    var b = best[id];
    if (!b || total > b.score || (total === b.score && ms && (!b.ms || ms < b.ms))) best[id] = { score: total, ms: ms };
  });
  return best;
}

function buildBoard() {
  var washBest = boardBest('Washes', 6, 30), cleanBest = boardBest('Cleans', 5, 26);
  var rows = playersSheet().getDataRange().getValues(), out = [];
  for (var i = 1; i < rows.length; i++) {
    var id = String(rows[i][1] || '');
    if (!id) continue;
    var earned = {};
    try { earned = JSON.parse(rows[i][6] || '{}') || {}; } catch (e) { }
    var part = function (src, best) {
      var e = earned[src] || {}, b = best[id] || {};
      return { n: Number(e.times) || 0, money: Number(e.total) || 0, best: b.score == null ? null : b.score, ms: b.ms || 0 };
    };
    var x = part('xitou', washBest), c = part('clean', cleanBest);
    if (!x.n && !c.n && x.best == null && c.best == null) continue;
    out.push({ id: id, name: String(rows[i][2] || '旅人').slice(0, 20), picture: /^https:\/\//.test(rows[i][3] || '') ? String(rows[i][3]) : '', xitou: x, clean: c });
  }
  return { at: new Date().toISOString(), players: out };
}

function leaderboard(input) {
  var cache = CacheService.getScriptCache(), board = null, hit = cache.get(BOARD_CACHE_KEY);
  if (hit) { try { board = JSON.parse(hit); } catch (e) { } }
  if (!board) {
    board = buildBoard();
    try { cache.put(BOARD_CACHE_KEY, JSON.stringify(board), BOARD_CACHE_SEC); } catch (e) { }  // 太大存不進去就每次重算
  }
  var me = input && input.session ? sessionUser(input.session) : null;
  return {
    result: 'success', at: board.at,
    players: board.players.map(function (p) {
      return { name: p.name, picture: p.picture, xitou: p.xitou, clean: p.clean, me: !!me && p.id === me };
    })
  };
}


// --- 房務・淨：每一間房的打掃紀錄 ---
// 跟洗頭紀錄一樣：打掃完網頁送上來，一列一間，存在 Cleans 分頁。不寄信、不回資料，只擋格式和數量。

var CLEAN_HEADERS = ['timestamp', 'at', 'line_id', 'device', 'guest', 'total', 'grade',
  'sort', 'wipe', 'bed', 'find', 'run', 'sort_right', 'wrong', 'cleaned', 'wipe_ms',
  'corners', 'pillows', 'peeks', 'hidden', 'found', 'made', 'floor',
  'fee', 'lost_bonus', 'star', 'ms', 'login'];

function cleansSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Cleans');
  if (!sheet) {
    sheet = ss.insertSheet('Cleans');
    sheet.appendRow(CLEAN_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// 一間房變成一列；格式不對回 null（整間不收）
function cleanRow(r, now, lineId, device) {
  if (!r || typeof r !== 'object') return null;
  var at = new Date(r.at);
  if (isNaN(at.getTime()) || at.getTime() > now.getTime() + 86400000 || at.getTime() < now.getTime() - 90 * 86400000) return null;
  var parts = r.parts || {}, pay = r.pay || {};
  // 分錯的：「名字:丟哪>要丟哪」，最多 12 件
  var wrong = Array.isArray(r.wrong) ? r.wrong.slice(0, 12).map(function (w) { return String(w).replace(/[\r\n\t,]/g, ' ').slice(0, 24); }).join(', ') : '';
  var found = Array.isArray(r.found) ? r.found.slice(0, 6).map(washKey).filter(String).join(', ') : '';
  return [
    now, at, lineId || '', device,
    washKey(r.guest), washNum(r.total, 0, 100), washText(r.grade, 2),
    washNum(parts.sort, 0, 25), washNum(parts.wipe, 0, 20), washNum(parts.bed, 0, 15), washNum(parts.find, 0, 15), washNum(parts.run, 0, 25),
    washNum(r.sort_right, 0, 12), washText(wrong, 300), washNum(r.cleaned, 0, 100), r.wipe_ms == null ? '' : washNum(r.wipe_ms, 0, 60000),
    washNum(r.corners, 0, 4), washNum(r.pillows, 0, 2), washNum(r.peeks, 0, 6), washNum(r.hidden, 0, 6), found, !!r.made, washNum(r.floor, 1, 27),
    washNum(pay.base, 0, 100000), washNum(pay.lost, 0, 100000), washNum(pay.star, 0, 100000),
    washNum(r.ms, 0, 3600000), !!r.login
  ];
}

// 在編輯器選這個按「執行」：先把 Cleans 分頁建出來
function setupCleans() {
  var sheet = cleansSheet();
  Logger.log('Cleans 分頁好了，目前有 ' + (sheet.getLastRow() - 1) + ' 間房。網頁要能存，還要「部署 → 管理部署作業 → 編輯 → 版本選新版本 → 部署」。');
}

function cleanLog(input) {
  var device = String(input.device || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (device.length < 8) return { result: 'error', error: '沒有裝置代號' };
  var recs = Array.isArray(input.recs) ? input.recs.slice(0, 20) : [];
  if (!recs.length) return { result: 'success', saved: 0 };

  var cache = CacheService.getScriptCache();
  var hour = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var devKey = 'cleanLog:' + device + ':' + hour, allKey = 'cleanRows:' + hour;
  var devCount = Number(cache.get(devKey) || 0), allCount = Number(cache.get(allKey) || 0);
  if (devCount >= CLEAN_LOGS_PER_HOUR) return { result: 'error', error: '這小時送太多次了' };
  if (allCount + recs.length > CLEAN_ROWS_PER_HOUR) return { result: 'error', error: '這小時全站打掃太多間了' };
  cache.put(devKey, String(devCount + 1), 3600);

  var lineId = input.session ? sessionUser(input.session) : null;
  var now = new Date(), rows = [], skipped = 0;
  recs.forEach(function (r) {
    var row = cleanRow(r, now, lineId, device);
    if (!row) { skipped++; return; }
    var dupKey = 'clean:' + device + ':' + row[1].getTime();
    if (cache.get(dupKey)) { skipped++; return; }
    cache.put(dupKey, '1', 6 * 3600);
    rows.push(row);
  });
  if (rows.length) {
    var sheet = cleansSheet();
    rows.forEach(function (row) { sheet.appendRow(row); });
    cache.put(allKey, String(allCount + rows.length), 3600);
  }
  return { result: 'success', saved: rows.length, skipped: skipped };
}


// --- 功德・添：每一筆捐獻、點燈的紀錄 ---
// 網頁捐了就送上來，一列一筆，存在 Gongde 分頁（之後功德榜用）。有登入 LINE 的記 line_id（不回給任何人）。
// 跟洗頭紀錄一樣：不寄信、不回資料，只擋格式和數量；錢是手機算的（朋友間玩，不防）。

var GONGDE_HEADERS = ['timestamp', 'at', 'line_id', 'device', 'kind', 'amount', 'oil', 'total', 'tier', 'wish', 'lamp'];

function gongdeSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Gongde');
  if (!sheet) {
    sheet = ss.insertSheet('Gongde');
    sheet.appendRow(GONGDE_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function gongdeLog(input) {
  var device = String(input.device || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (device.length < 8) return { result: 'error', error: '沒有裝置代號' };
  var recs = Array.isArray(input.recs) ? input.recs.slice(0, 20) : [];
  if (!recs.length) return { result: 'success', saved: 0 };

  var cache = CacheService.getScriptCache();
  var hour = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var devKey = 'gongdeLog:' + device + ':' + hour, allKey = 'gongdeRows:' + hour;
  var devCount = Number(cache.get(devKey) || 0), allCount = Number(cache.get(allKey) || 0);
  if (devCount >= GONGDE_LOGS_PER_HOUR) return { result: 'error', error: '這小時送太多次了' };
  if (allCount + recs.length > GONGDE_ROWS_PER_HOUR) return { result: 'error', error: '這小時全站捐太多了' };
  cache.put(devKey, String(devCount + 1), 3600);

  var lineId = input.session ? sessionUser(input.session) : null;
  var now = new Date(), saved = 0, skipped = 0, sheet = null;
  recs.forEach(function (r) {
    var at = new Date(r && r.at);
    var kind = r && (r.kind === 'donate' || r.kind === 'lamp') ? r.kind : null;
    var amount = cleanMoney(r && r.amount, 1, WALLET_MAX);
    if (!kind || amount === null || isNaN(at.getTime()) || at.getTime() > now.getTime() + 86400000 || at.getTime() < now.getTime() - 90 * 86400000) { skipped++; return; }
    var dupKey = 'gongde:' + device + ':' + at.getTime();
    if (cache.get(dupKey)) { skipped++; return; }
    cache.put(dupKey, '1', 6 * 3600);
    sheet = sheet || gongdeSheet();
    sheet.appendRow([now, at, lineId || '', device, kind, amount, washNum(r.oil, 0, WALLET_MAX), washNum(r.total, 0, WALLET_MAX),
      washText(r.tier, 6), washText(r.wish, 30), kind === 'lamp' ? washKey(r.lamp || 'guangming') : '']);
    saved++;
  });
  if (saved) cache.put(allKey, String(allCount + saved), 3600);
  return { result: 'success', saved: saved, skipped: skipped };
}
