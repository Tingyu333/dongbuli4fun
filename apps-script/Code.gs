// 丼步喱・絆 後端（Google Apps Script，綁在訂房的 Google Sheet 上）
// 這份是備份與版本紀錄：改完貼到 Apps Script 編輯器，再「部署 → 管理部署作業 → 編輯 → 新版本」才會生效。
//
// Bookings 欄位: A=timestamp, B=room_name, C=guest_name, D=phone, E=check_in, F=check_out, G=status, H=id, I=guests
// Tickets  欄位: A=timestamp, B=booking_id, C=seat, D=name（入住券：誰領了第幾張，第 1 張是訂房的人）
// Reviews  欄位: A=timestamp, B=name, C=rating, D=message
//
// status: pending（待確認）/ confirmed（已確認）/ cancelled（已取消）。舊資料沒填的當作 confirmed。

var ADMIN_URL = 'https://tingyu333.github.io/dongbuli4fun/admin_dashboard.html';
var STATUSES = ['pending', 'confirmed', 'cancelled'];
var COL_STATUS = 7; // G
var COL_ID = 8;     // H
var COL_GUESTS = 9; // I
var MAX_GUESTS = 8; // 27 樓的地板只有這麼大

// doPost 用於接收資料：訂房、留言、後台改狀態
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 兩個人同時訂房時排隊，避免一起寫進去撞期

    var input = JSON.parse(e.postData.contents);
    var type = input.type || 'booking'; // 預設為 booking (相容舊版)

    if (type === 'review') return json(addReview(input));
    if (type === 'updateStatus') return json(updateStatus(input));
    if (type === 'lookup') return json(lookupBookings(input));
    if (type === 'cancel') return json(cancelBooking(input));
    if (type === 'claim') return json(claimTicket(input));
    if (type === 'unclaim') return json(unclaimTicket(input));
    return json(addBooking(input));

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

  // 訂房列表：順便附上每筆已經領票的人（後台顯示用）
  var tickets = readTickets();
  return json(readBookings(bookingsSheet()).map(function (b) {
    b.travelers = seatsOf(b, tickets).map(function (s) { return s.name; }).filter(String);
    return b;
  }));
}

// --- 訂房 ---

function addBooking(input) {
  var checkIn = input.check_in;
  var checkOut = input.check_out;
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return { result: 'error', error: '日期不正確' };
  }

  var sheet = bookingsSheet();
  if (hasConflict(readBookings(sheet), checkIn, checkOut, null)) {
    return { result: 'conflict' };
  }

  var id = Utilities.getUuid();
  var guests = clampGuests(input.guests);
  if (!sheet.getRange(1, COL_GUESTS).getValue()) sheet.getRange(1, COL_GUESTS).setValue('guests'); // 舊表沒有這欄的標題就補上
  sheet.appendRow([
    new Date(),
    input.room_name,
    input.guest_name,
    "'" + input.phone, // 前面加 ' 讓 Sheet 當文字存，09 開頭的 0 才不會不見
    checkIn,
    checkOut,
    'pending',
    id,
    guests
  ]);
  // 第 1 張票是訂房的人自己的
  ticketsSheet().appendRow([new Date(), id, 1, cleanName(input.guest_name) || '訂房人']);

  input.guests = guests;
  notifyOwner(input);
  return { result: 'success', id: id, guests: guests };
}

// 後台改狀態；從「已取消」改回來時要再檢查一次有沒有撞期
function updateStatus(input) {
  if (STATUSES.indexOf(input.status) === -1) {
    return { result: 'error', error: '狀態不正確' };
  }

  var sheet = bookingsSheet();
  var bookings = readBookings(sheet);
  for (var i = 0; i < bookings.length; i++) {
    var b = bookings[i];
    if (b.id !== input.id) continue;

    if (input.status !== 'cancelled' && hasConflict(bookings, b.check_in, b.check_out, b.id)) {
      return { result: 'conflict' };
    }
    sheet.getRange(b.row, COL_STATUS).setValue(input.status);
    return { result: 'success' };
  }
  return { result: 'error', error: '找不到這筆預約' };
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
      guests: clampGuests(row[8]) // 舊資料沒填人數的當作 1 人
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
    '人數：' + b.guests + ' 人\n' +
    '入住：' + b.check_in + '\n' +
    '退房：' + b.check_out + '\n\n' +
    '到後台確認：' + ADMIN_URL
  );
}

// 寄信失敗不影響訂房或取消
function sendOwnerMail(subject, body) {
  try {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), subject, body);
  } catch (err) {
    console.error('通知信寄送失敗', err);
  }
}

// 第一次貼上後，在編輯器上方選這個函式按「執行」：授權寄信權限，並收到一封測試信
function testNotify() {
  notifyOwner({ guest_name: '測試旅人', phone: '0900000000', guests: 2, check_in: '2026-01-01', check_out: '2026-01-02' });
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

  var tickets = readTickets();
  var seats = seatsOf(b, tickets);
  var mine = seats.filter(function (s) { return s.name === name; })[0];
  if (mine) return ticketView(b, tickets, mine.seat); // 已經領過，同一張還給他

  var free = seats.filter(function (s) { return !s.name; })[0];
  if (!free) return { result: 'full' };

  ticketsSheet().appendRow([new Date(), b.id, free.seat, name]);
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
    data.push({ row: i + 1, booking_id: String(rows[i][1]), seat: Number(rows[i][2]), name: String(rows[i][3]) });
  }
  return data;
}

// 沒有 Tickets 分頁就自動建一個
function ticketsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Tickets');
  if (!sheet) {
    sheet = ss.insertSheet('Tickets');
    sheet.appendRow(['timestamp', 'booking_id', 'seat', 'name']);
  }
  return sheet;
}

function findBooking(id) {
  if (!id) return null;
  return readBookings(bookingsSheet()).filter(function (b) { return b.id === id; })[0] || null;
}

function clampGuests(value) {
  var n = parseInt(value, 10);
  if (!(n >= 1)) return 1;
  return Math.min(n, MAX_GUESTS);
}

function cleanName(name) {
  return String(name || '').trim().slice(0, 12);
}

// --- 留言 ---

function addReview(input) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Reviews');
  sheet.appendRow([
    new Date(),
    input.name,
    input.rating,
    input.message
  ]);
  return { result: 'success', type: 'review' };
}

function readReviews() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Reviews');
  if (!sheet) return [];

  var rows = sheet.getDataRange().getValues();
  var data = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    data.push({
      timestamp: row[0],
      name: row[1],
      rating: row[2],
      message: row[3]
    });
  }
  return data;
}

// --- 工具 ---

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// Sheet 會把日期字串轉成 Date，這裡轉回台灣時間的 yyyy-MM-dd，避免時區差一天
function toDateStr(value) {
  return value instanceof Date ? Utilities.formatDate(value, 'Asia/Taipei', 'yyyy-MM-dd') : value;
}
