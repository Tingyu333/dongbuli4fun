// 丼步喱・絆 後端（Google Apps Script，綁在訂房的 Google Sheet 上）
// 這份是備份與版本紀錄：改完貼到 Apps Script 編輯器，再「部署 → 管理部署作業 → 編輯 → 新版本」才會生效。
//
// Bookings 欄位: A=timestamp, B=room_name, C=guest_name, D=phone, E=check_in, F=check_out, G=status, H=id
// Reviews  欄位: A=timestamp, B=name, C=rating, D=message
//
// status: pending（待確認）/ confirmed（已確認）/ cancelled（已取消）。舊資料沒填的當作 confirmed。

var ADMIN_URL = 'https://tingyu333.github.io/dongbuli4fun/admin_dashboard.html';
var STATUSES = ['pending', 'confirmed', 'cancelled'];
var COL_STATUS = 7; // G
var COL_ID = 8;     // H

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
  return json(readBookings(bookingsSheet()));
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
  sheet.appendRow([
    new Date(),
    input.room_name,
    input.guest_name,
    "'" + input.phone, // 前面加 ' 讓 Sheet 當文字存，09 開頭的 0 才不會不見
    checkIn,
    checkOut,
    'pending',
    id
  ]);

  notifyOwner(input);
  return { result: 'success', id: id };
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

  var mine = readBookings(bookingsSheet())
    .filter(function (b) { return normalizePhone(b.phone) === phone; })
    .map(function (b) {
      return { id: b.id, check_in: b.check_in, check_out: b.check_out, status: b.status };
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
      status: row[6] || 'confirmed'
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
  notifyOwner({ guest_name: '測試旅人', phone: '0900000000', check_in: '2026-01-01', check_out: '2026-01-02' });
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
