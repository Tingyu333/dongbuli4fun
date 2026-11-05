// 丼步喱・絆 後端（Google Apps Script，綁在訂房的 Google Sheet 上）
// 這份是備份與版本紀錄：改完貼到 Apps Script 編輯器，再「部署 → 管理部署作業 → 編輯 → 新版本」才會生效。
//
// Bookings 欄位: A=timestamp, B=room_name, C=guest_name, D=phone, E=check_in, F=check_out, G=status, H=id, I=guests,
//               J=email（選填）, K=confirm_mailed（確認信寄出的時間，寄過就不再寄）
// Tickets  欄位: A=timestamp, B=booking_id, C=seat, D=name, E=email（選填）（入住券：誰領了第幾張，第 1 張是訂房的人）
// Reviews  欄位: A=timestamp, B=name, C=rating, D=message
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

// doPost 用於接收資料：訂房、留言、後台改狀態
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 兩個人同時訂房時排隊，避免一起寫進去撞期

    var input = JSON.parse(e.postData.contents);
    var type = input.type || 'booking'; // 預設為 booking (相容舊版)

    if (type === 'booking') return json(addBooking(input));
    if (type === 'review') return json(addReview(input));
    if (type === 'lookup') return json(lookupBookings(input));
    if (type === 'cancel') return json(cancelBooking(input));
    if (type === 'claim') return json(claimTicket(input));
    if (type === 'unclaim') return json(unclaimTicket(input));
    if (type === 'adminLogin') return json(adminLogin(input));

    // 以下只有後台能用，要帶登入拿到的通行證
    if (type === 'updateStatus' || type === 'adminList') {
      if (!isAdmin(input.token)) return json({ result: 'unauthorized' });
      if (type === 'updateStatus') return json(updateStatus(input));
      return json(adminList());
    }
    return json({ result: 'error', error: '不認得的請求' });

  } catch (err) {
    return json({ result: 'error', error: err.toString() });

  } finally {
    lock.releaseLock();
  }
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

// --- 工具 ---

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// Sheet 會把日期字串轉成 Date，這裡轉回台灣時間的 yyyy-MM-dd，避免時區差一天
function toDateStr(value) {
  return value instanceof Date ? Utilities.formatDate(value, 'Asia/Taipei', 'yyyy-MM-dd') : value;
}
