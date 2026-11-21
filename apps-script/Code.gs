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
var FARM_LOGS_PER_HOUR = 60;     // 一支手機每小時最多送幾次菜園紀錄
var FARM_ROWS_PER_HOUR = 2000;   // 全站每小時最多存幾輪
var WIFI_LOGS_PER_HOUR = 60;     // 一支手機每小時最多送幾次蹭網紀錄
var WIFI_ROWS_PER_HOUR = 2000;   // 全站每小時最多存幾輪
var ZAOCAN_LOGS_PER_HOUR = 60;   // 一支手機每小時最多送幾次早餐店紀錄
var ZAOCAN_ROWS_PER_HOUR = 2000; // 全站每小時最多存幾天（一輪 75 秒算一天）
var DESSERT_LOGS_PER_HOUR = 60;  // 一支手機每小時最多送幾次甜點店紀錄
var DESSERT_ROWS_PER_HOUR = 2000;
var STACK_LOGS_PER_HOUR = 60;    // 一支手機每小時最多送幾次疊巢紀錄
var STACK_ROWS_PER_HOUR = 2000;
var MINE_LOGS_PER_HOUR = 60;     // 一支手機每小時最多送幾次礦坑紀錄（一關一筆，一次最多 20 關）
var MINE_ROWS_PER_HOUR = 3000;
var SHIP_LOGS_PER_HOUR = 60;     // 一支手機每小時最多送幾次貨運紀錄
var SHIP_ROWS_PER_HOUR = 2000;   // 全站每小時最多存幾趟

// doPost 用於接收資料：訂房、留言、後台改狀態
// 要排隊的動作：會「先讀再寫、讀到的決定寫什麼」的（撞期、領第幾張票、紅包還剩幾份、改狀態）。
// 以前每個 POST 都排同一個隊，所有人一個一個來，洗頭、刮刮樂的人一多後台就擠不進來。
// 現在只有這些整個排隊；錢包同步、LINE 登入只在寫 Players 那一下排隊（withLock）；
// 洗頭紀錄、留言用 appendRow（Google 自己保證不會蓋到別人那列），讀資料的完全不排隊。
// 後端版本：每次改 Code.gs 要部署的時候換新（日期＋字母），admin_dashboard.html 的 BACKEND_EXPECT 一起換。
// 後台會比對，看得出部署的是不是新版（2026-11-18 加的）
var BACKEND_VERSION = '2026-11-21d';

var LOCKED_TYPES = { booking: 1, cancel: 1, claim: 1, unclaim: 1, bonusClaim: 1, updateStatus: 1, bonusCreate: 1, bonusClose: 1, policyBuy: 1, policyClaim: 1, policyCancel: 1, stockTrade: 1, stockCancel: 1, sportBet: 1, wishAdd: 1, wishVote: 1, adminWishSet: 1, gaPerkGrant: 1, gaPerkRevoke: 1, gaLibSave: 1, gaLibRetire: 1, gaBonusCreate: 1, gaBonusClose: 1 };

function withLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { result: 'error', error: '後端在忙，等幾秒再試一次' };
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// 打工、功德紀錄的限流和擋重送：每支手機每種紀錄只佔一筆快取（這小時送了幾次＋最近送過的 80 輪時間）。
// 以前一輪一筆、一小時一筆，人一多會把快取（總共最多 1,000 筆）塞滿，把通行證、排行榜的快取擠掉（2026-11-18 改）
function logGate(kind, device, hour) {
  var cache = CacheService.getScriptCache(), key = 'gate:' + kind + ':' + device, d = null;
  try { d = JSON.parse(cache.get(key) || 'null'); } catch (e) { }
  if (!d || !Array.isArray(d.t)) d = { h: hour, n: 0, t: [] };
  if (d.h !== hour) { d.h = hour; d.n = 0; }
  var seen = {};
  d.t.forEach(function (x) { seen[x] = 1; });
  return {
    n: d.n,
    count: function () { d.n++; this.save(); },
    seen: function (t) { if (seen[t]) return true; seen[t] = 1; d.t.push(t); return false; },
    save: function () { d.t = d.t.slice(-80); try { cache.put(key, JSON.stringify(d), 6 * 3600); } catch (e) { } }
  };
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
    if (type === 'profile') return profileSet(input);
    if (type === 'walletSync') return walletSync(input);
    if (type === 'washLog') return washLog(input);
    if (type === 'cleanLog') return cleanLog(input);
    if (type === 'farmLog') return farmLog(input);
    if (type === 'wifiLog') return wifiLog(input);
    if (type === 'zaocanLog') return zaocanLog(input);
    if (type === 'dessertLog') return dessertLog(input);
    if (type === 'stackLog') return stackLog(input);
    if (type === 'mineLog') return mineLog(input);
    if (type === 'shipLog') return shipLog(input);
    if (type === 'gongdeLog') return gongdeLog(input);
    if (type === 'leaderboard') return leaderboard(input);
    if (type === 'policyList') return policyList(input);
    if (type === 'policyBuy') return policyBuy(input);
    if (type === 'policyClaim') return policyClaim(input);
    if (type === 'policyCancel') return policyCancel(input);
    if (type === 'stockQuote') return stockQuote(input);
    if (type === 'stockMine') return stockMine(input);
    if (type === 'stockTrade') return stockTrade(input);
    if (type === 'stockCancel') return stockCancel(input);
    if (type === 'sportQuote') return sportQuote(input);
    if (type === 'sportMine') return sportMine(input);
    if (type === 'sportBet') return sportBet(input);
    if (type === 'wishList') return wishList(input);
    if (type === 'wishAdd') return wishAdd(input);
    if (type === 'wishVote') return wishVote(input);
    if (type === 'announce') return announceGet();

    if (type === 'ping') return { result: 'success', version: BACKEND_VERSION };   // 公開：只回版本

    // admin 後台（admin.html，2026-11-20）：另一組密碼 GAME_ADMIN_PASSWORD、另一種通行證，跟預約後台互不通用
    if (type === 'gameAdminLogin') return gameAdminLogin(input);
    if (/^ga[A-Z]/.test(type)) {
      if (!isGameAdmin(input.token)) return { result: 'unauthorized' };
      if (type === 'gaPlayers') return gaPlayers();
      if (type === 'gaPerkGrant') return gaPerkGrant(input);
      if (type === 'gaPerkRevoke') return gaPerkRevoke(input);
      if (type === 'gaLibSave') return gaLibSave(input);
      if (type === 'gaLibRetire') return gaLibRetire(input);
      if (type === 'gaEcon') return gaEcon();
      if (type === 'gaWage') return gaWage(input);
      if (type === 'gaWishes') return adminWishes();        // 許願池 2026-11-21 從預約後台搬過來
      if (type === 'gaWishSet') return adminWishSet(input);
      if (type === 'gaAnnounce') return gaAnnounce();
      if (type === 'gaAnnounceSet') return gaAnnounceSet(input);
      if (type === 'gaBonusList') return bonusList();           // 發紅包 2026-11-21：admin 後台也能發（跟預約後台同一份 Bonuses，兩邊都看得到）
      if (type === 'gaBonusCreate') return bonusCreate(input);
      if (type === 'gaBonusClose') return bonusClose(input);
      return { result: 'error', error: '不認得的請求' };
    }

    // 以下只有後台能用，要帶登入拿到的通行證
    if (type === 'updateStatus' || type === 'adminList' || type === 'bonusCreate' || type === 'bonusList' || type === 'bonusClose' || type === 'adminHealth') {
      if (!isAdmin(input.token)) return { result: 'unauthorized' };
      if (type === 'adminHealth') return adminHealth();
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
// 後台「後端・況」：版本、排程上次／下次、每張分頁幾列、試算表用了幾 %、今天寄了幾封信
function adminHealth() {
  var props = PropertiesService.getScriptProperties(), ss = SpreadsheetApp.getActiveSpreadsheet(), total = 0, sheets = [];
  ss.getSheets().forEach(function (sh) { total += sh.getMaxRows() * sh.getMaxColumns(); sheets.push({ name: sh.getName(), rows: Math.max(0, sh.getLastRow() - 1) }); });
  var crons = Object.keys(CRON_DAILY).map(function (fn) {
    var next = Number(props.getProperty('cron:' + fn) || 0);
    return { fn: fn, next: next ? new Date(next).toISOString() : '', last: props.getProperty('cronLast:' + fn) || '' };
  });
  var triggers = [];
  try { triggers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }); } catch (e) { }
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var mails = ['owner', 'guest'].map(function (k) { var v = String(props.getProperty('mailCount-' + k) || '').split('|'); return v[0] === today ? Number(v[1]) || 0 : 0; });
  return { result: 'success', version: BACKEND_VERSION, crons: crons, triggers: triggers, sheets: sheets, cells: total, cellLimit: CELL_LIMIT,
    mails: { owner: mails[0], guest: mails[1], ownerMax: MAIL_LIMITS.owner, guestMax: MAIL_LIMITS.guest } };
}

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

// 用電話查預約、取消的次數上限（2026-11-18：以前沒有限制，知道別人電話就能一直查、一直試）
// 同一支電話每小時查 10 次、取消 5 次；同一筆預約電話打錯每小時 5 次；全站每小時查 300 次
var LOOKUP_PER_PHONE = 10, LOOKUP_ALL = 300, CANCEL_PER_PHONE = 5, CANCEL_FAILS_PER_BOOKING = 5;
function overHourLimit(key, max) {
  var cache = CacheService.getScriptCache(), k = 'lim:' + key + ':' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var n = Number(cache.get(k) || 0);
  if (n >= max) return true;
  cache.put(k, String(n + 1), 3600);
  return false;
}

// 朋友用訂房時留的電話查自己的預約（只回日期和狀態，不含別人的資料）
function lookupBookings(input) {
  var phone = normalizePhone(input.phone);
  if (phone.length < 8) return { result: 'error', error: '電話號碼不完整' };
  if (overHourLimit('lookupAll', LOOKUP_ALL)) return { result: 'error', error: '這小時查的人太多了，晚點再來' };
  if (overHourLimit('lookup:' + phone, LOOKUP_PER_PHONE)) return { result: 'error', error: '這支電話這小時查太多次了，晚點再查' };
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
  var phone = normalizePhone(input.phone), id = String(input.id || '').slice(0, 40);
  if (overHourLimit('cancel:' + phone, CANCEL_PER_PHONE)) return { result: 'error', error: '這支電話這小時取消太多次了，晚點再試' };
  var cache = CacheService.getScriptCache(), failKey = 'lim:cancelFail:' + id + ':' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var fails = Number(cache.get(failKey) || 0);
  if (fails >= CANCEL_FAILS_PER_BOOKING) return { result: 'error', error: '試太多次了，晚點再來' };
  var sheet = bookingsSheet();
  var b = readBookings(sheet).filter(function (x) { return x.id === id; })[0];
  if (!b || normalizePhone(b.phone) !== phone) {
    cache.put(failKey, String(fails + 1), 3600);
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
  if (mine) { // 已經領過，同一張還給他；之前沒留 Email、這次有留才補上。已經有的不蓋掉（2026-11-18：以前用同一個名字再領一次就能把別人的 Email 換掉）
    var t = tickets.filter(function (x) { return x.booking_id === b.id && x.seat === mine.seat && x.name === name; })[0];
    var view = ticketView(b, tickets, mine.seat);
    if (email && t && !t.email) ticketsSheet().getRange(t.row, 5).setValue(email);
    else if (email && t && t.email && t.email !== email) view.emailKept = true;
    return view;
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
  var out = { result: 'success', amount: b.amount, note: b.note, left: b.max - claims.length - 1 };
  // 登入了：同一次排隊直接把錢加進帳號（2026-11-18；以前手機領到再送一次錢包同步，大家同時領會排兩次隊、後面的人「後端在忙」）
  var lineId = input.session ? sessionUser(input.session) : null, p = lineId ? findPlayer(lineId) : null;
  if (p) {
    p.money = Math.min(WALLET_MAX, p.money + b.amount);
    p.earned = addEarned(p.earned, { bonus: { times: 1, total: b.amount, best: b.amount } });
    writeWallet(p);
    out.credited = true; out.wallet = walletView(p);
  }
  return out;
}

// --- LINE 登入、小遊戲錢包 ---
// 網頁用 LIFF 拿到 LINE 的 ID token，送來這裡；這裡拿去問 LINE 是不是真的、是誰，
// 驗過了才發一張網站自己的通行證（session）。不能相信網頁自己說的使用者代號。

function playersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Players');
  if (!sheet) {
    sheet = ss.insertSheet('Players');
    sheet.appendRow(['created', 'line_id', 'name', 'picture', 'money', 'spent', 'earned', 'updated', 'gongde', 'shop', 'syncs']);
  }
  return sheet;
}

// 坐洗部店面升級：{ lv: { shampoo: 2, … }, spent }，存在 Players 的 J 欄（JSON）。等級只升不降，合併時每一項取高的
function cleanShop(s) {
  s = s && typeof s === 'object' ? s : {};
  var lv = {}, raw = s.lv && typeof s.lv === 'object' && !Array.isArray(s.lv) ? s.lv : {}, keys = Object.keys(raw);
  if (keys.length > 80) return null;  // 六家店合起來 40 項（2026-11-17 從 40 調到 80），留空間給之後的店
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
    var syncs = [];
    try { syncs = JSON.parse(rows[i][10] || '[]') || []; } catch (e) { }
    return {
      row: i + 1, lineId: lineId, name: String(rows[i][2] || ''), picture: String(rows[i][3] || ''),
      money: Number(rows[i][4]) || 0, spent: Number(rows[i][5]) || 0, earned: cleanEarned(earned) || {},
      gongde: cleanGongde(gongde) || { donated: 0, oil: 0, lamps: 0, lit: 0, oils: {} },
      shop: cleanShop(shop) || { lv: {}, spent: 0 },
      syncs: Array.isArray(syncs) ? syncs.slice(-SYNC_IDS_KEPT) : []
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

// --- 登入通行證：存在 Sessions 分頁 ---
// 以前存在指令碼屬性 sess:<uuid>，可是指令碼屬性總共只能放 500 KB（大約 6,700 張），只有登出才會刪，滿了所有人都登入不了。
// Sessions：A created、B session、C line_id、D last_used（最多六小時記一次）。查的時候先看 CacheService（六小時），沒有才翻分頁。
// 舊的 sess: 屬性照樣認得（還沒搬的人不會被登出）；在編輯器執行 migrateSessions() 一次搬完，搬完指令碼屬性就空出來了。
var SESSION_CACHE_SEC = 21600;
function sessionsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Sessions');
  if (!sheet) {
    sheet = ss.insertSheet('Sessions');
    sheet.appendRow(['created', 'session', 'line_id', 'last_used']);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 2, 1000, 2).setNumberFormat('@');  // 通行證、LINE 代號當文字存，不要被 Sheet 猜成數字或日期
  }
  return sheet;
}
function findSessionRow(sheet, session) {
  var n = sheet.getLastRow() - 1;
  if (n < 1) return 0;
  var ids = sheet.getRange(2, 2, n, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === session) return i + 2;  // 新的在下面，從下面找
  return 0;
}
function sessionUser(session) {
  session = String(session || '');
  if (!/^[0-9a-f-]{20,60}$/i.test(session)) return null;
  var cache = CacheService.getScriptCache(), key = 'sess:' + session, hit = cache.get(key);
  if (hit) return hit === '-' ? null : hit;
  var sheet = sessionsSheet(), row = findSessionRow(sheet, session), id = null;
  if (row) {
    id = String(sheet.getRange(row, 3).getValue() || '') || null;
    if (id) sheet.getRange(row, 4).setValue(new Date());
  } else {
    id = PropertiesService.getScriptProperties().getProperty(key);  // 還沒搬的舊通行證
  }
  cache.put(key, id || '-', id ? SESSION_CACHE_SEC : 300);
  return id;
}
function newSession(lineId) {
  var session = Utilities.getUuid(), now = new Date();
  sessionsSheet().appendRow([now, session, lineId, now]);
  CacheService.getScriptCache().put('sess:' + session, lineId, SESSION_CACHE_SEC);
  return session;
}
function dropSession(session) {
  session = String(session || '');
  if (!/^[0-9a-f-]{20,60}$/i.test(session)) return;
  var sheet = sessionsSheet(), row = findSessionRow(sheet, session);
  if (row) sheet.deleteRow(row);
  PropertiesService.getScriptProperties().deleteProperty('sess:' + session);
  CacheService.getScriptCache().put('sess:' + session, '-', 300);
}

// 在編輯器選這個按「執行」：把指令碼屬性裡的舊通行證（sess:…）全部搬到 Sessions 分頁，搬完刪掉。可以重複執行。
function migrateSessions() {
  var props = PropertiesService.getScriptProperties(), all = props.getProperties(), sheet = sessionsSheet();
  var have = {}, n = sheet.getLastRow() - 1;
  if (n > 0) sheet.getRange(2, 2, n, 1).getValues().forEach(function (r) { have[String(r[0])] = true; });
  var rows = [], keys = Object.keys(all).filter(function (k) { return k.indexOf('sess:') === 0; }), bytes = 0;
  Object.keys(all).forEach(function (k) { bytes += k.length + String(all[k]).length; });
  keys.forEach(function (k) {
    var session = k.slice(5);
    if (!have[session] && all[k]) rows.push([new Date(), session, all[k], '']);
  });
  if (rows.length) {
    var start = sheet.getLastRow() + 1;
    sheet.getRange(start, 2, rows.length, 2).setNumberFormat('@');
    sheet.getRange(start, 1, rows.length, 4).setValues(rows);
  }
  keys.forEach(function (k) { props.deleteProperty(k); });
  Logger.log('指令碼屬性原本用了大約 ' + Math.round(bytes / 1024) + ' KB（上限 500 KB），裡面有 ' + keys.length + ' 張舊通行證。' +
    '搬了 ' + rows.length + ' 張到 Sessions 分頁，指令碼屬性裡的都刪掉了。Sessions 分頁現在有 ' + (sheet.getLastRow() - 1) + ' 張。');
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
  return { money: p.money, spent: p.spent, earned: p.earned, gongde: p.gongde, shop: p.shop, perks: perksFor(p.lineId) };
}

function writeWallet(p) {
  playersSheet().getRange(p.row, 5, 1, 7).setValues([[p.money, p.spent, JSON.stringify(p.earned), new Date(), JSON.stringify(p.gongde), JSON.stringify(p.shop), JSON.stringify(p.syncs || [])]]);
}

// 錢包同步的「這包變化」編號：手機沒收到回覆會用同一個編號再送，後端看過就不再加一次
// （iPhone 上回覆常常收不到，以前同一包會被加兩三次，錢被扣到 0）。存在 Players 的 K 欄，留最近 SYNC_IDS_KEPT 個
var SYNC_IDS_KEPT = 40;
function cleanSyncId(v) {
  v = String(v || '');
  return /^[A-Za-z0-9-]{8,40}$/.test(v) ? v : '';
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
    if (!sheet.getRange(1, 11).getValue()) sheet.getRange(1, 11).setValue('syncs');
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

  var session = newSession(who.sub);
  var player = walletView(p);
  player.name = who.name;
  player.picture = who.picture;
  var pf = playerProfile(p.row);
  player.nick = pf.nick; player.avatar = pf.avatar;
  player.isNew = isNew;
  return { result: 'success', session: session, player: player };
}

// --- 暱稱、指定頭像（Players 的 M nick、N avatar）---
// LINE 的名字、大頭貼（C、D）不動，登入時照樣更新；有暱稱或指定頭像就優先顯示它（排行榜），沒有才用 LINE 的。
// 頭像只能從網站的角色挑（AVATAR_KEYS，網頁 assets/avatar.js 畫），不收上傳的圖。
var AVATAR_KEYS = ['julie', 'appleduck', 'raccoon', 'captain', 'cat', 'dog', 'mole', 'nugget', 'xiaowu'];
var PROFILE_OPS_PER_HOUR = 60;
function playerProfile(row) {
  var v = playersSheet().getRange(row, 13, 1, 2).getValues()[0];
  var nick = String(v[0] || '').replace(/^'/, '').trim().slice(0, 12), avatar = String(v[1] || '');
  return { nick: nick, avatar: AVATAR_KEYS.indexOf(avatar) >= 0 ? avatar : '' };
}
// { type: 'profile', session, nick?, avatar? }：有帶的欄位才改（空字串＝清掉、改回用 LINE 的），沒帶就只是讀
function profileSet(input) {
  var lineId = sessionUser(input.session);
  if (!lineId) return { result: 'unauthorized' };
  var cache = CacheService.getScriptCache(), key = 'profile:' + lineId + ':' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var n = Number(cache.get(key) || 0);
  if (n >= PROFILE_OPS_PER_HOUR) return { result: 'error', error: '這小時改太多次了，晚點再來' };
  cache.put(key, String(n + 1), 3600);
  var p = findPlayer(lineId);
  if (!p) return { result: 'unauthorized' };
  var sheet = playersSheet();
  if (input.nick !== undefined || input.avatar !== undefined) {
    var head = sheet.getRange(1, 13, 1, 2).getValues()[0];
    if (!head[0] || !head[1]) sheet.getRange(1, 13, 1, 2).setValues([['nick', 'avatar']]);
  }
  if (input.nick !== undefined) {
    var nick = String(input.nick == null ? '' : input.nick).replace(/[\r\n\t]/g, ' ').trim().slice(0, 12);
    sheet.getRange(p.row, 13).setValue(nick ? asText(nick) : '');
  }
  if (input.avatar !== undefined) {
    var av = String(input.avatar || '');
    if (av && AVATAR_KEYS.indexOf(av) < 0) return { result: 'error', error: '沒有這個頭像' };
    sheet.getRange(p.row, 14).setValue(av);
  }
  var pf = playerProfile(p.row);
  return { result: 'success', profile: { name: p.name, picture: p.picture, nick: pf.nick, avatar: pf.avatar } };
}

function lineLogout(input) {
  if (sessionUser(input.session)) dropSession(input.session);
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
  var sid = cleanSyncId(input.sid);
  // 單純讀不用排隊；有加減錢才排隊（讀出來、加上去、寫回去要一口氣做完，兩支手機同時送才不會少算）
  var read = function () {
    var p = findPlayer(lineId);
    if (!p) return { result: 'unauthorized' };
    // 同一包已經加過了（上次的回覆手機沒收到）：不再加，直接回現在的錢包
    if (changed && sid && p.syncs.indexOf(sid) >= 0) return { result: 'success', wallet: walletView(p), dup: true };
    if (changed) {
      if (sid) { p.syncs.push(sid); p.syncs = p.syncs.slice(-SYNC_IDS_KEPT); }
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
  var allKey = 'washRows' + ':' + hour, gate = logGate('wash', device, hour);
  var devCount = gate.n, allCount = Number(cache.get(allKey) || 0);
  if (devCount >= WASH_LOGS_PER_HOUR) return { result: 'error', error: '這小時送太多次了' };
  if (allCount + recs.length > WASH_ROWS_PER_HOUR) return { result: 'error', error: '這小時全站洗太多頭了' };
  gate.count();

  var lineId = input.session ? sessionUser(input.session) : null;  // 通行證不對就當沒登入，照樣存
  var now = new Date(), rows = [], skipped = 0;
  recs.forEach(function (r) {
    var row = washRow(r, now, lineId, device);
    if (!row) { skipped++; return; }
    if (gate.seen(row[1].getTime())) { skipped++; return; }   // 同一支手機重送的同一輪，不要存兩次
    rows.push(row);
  });
  if (rows.length) {
    // appendRow 不排隊也不會兩個人寫到同一列（一次通常只有一顆）
    var sheet = washesSheet();
    rows.forEach(function (row) { sheet.appendRow(row); });
    cache.put(allKey, String(allCount + rows.length), 3600);
  }
  gate.save();
  return { result: 'success', saved: rows.length, skipped: skipped };
}


// --- 排行榜（rank.html：打工・榜、花錢・榜）---
// 只有用 LINE 登入過的玩家：賺多少、做幾次從 Players 的 earned 讀，單場最高分從 Washes／Cleans 讀（同分比快）。
// 花錢：Players 的 spent（全部花掉的）拆成店面升級（shop.spent，洗頭店＋菜園農具＋早餐店）、捐香油錢（gongde.donated）、點燈（gongde.lit），剩下的算刮刮樂。
// 公開：回 LINE 名字和大頭貼，不回 line_id；有帶 session 的話把自己那列標 me。算好的榜存 CacheService 5 分鐘。

// 排行榜：排程 cronBoard() 每 5 分鐘先算好存快取（2026-11-18，使用者定的），打開排行榜只讀現成的。
// 快取一筆最多 100KB，榜大了就切成好幾段存（BOARD_CHUNK 個字一段，中文一字最多 3 bytes 也放得下）。
// 存 10 分鐘：排程哪天停了，過期後有人打開就當場算（跟以前一樣），不會壞。
var BOARD_CACHE_KEY = 'board:v14', BOARD_CACHE_SEC = 600, BOARD_CHUNK = 30000;
function boardCachePut(board) {
  var s = JSON.stringify(board), n = Math.ceil(s.length / BOARD_CHUNK), m = {};
  for (var i = 0; i < n; i++) m[BOARD_CACHE_KEY + ':' + i] = s.slice(i * BOARD_CHUNK, (i + 1) * BOARD_CHUNK);
  m[BOARD_CACHE_KEY] = String(n);
  try { CacheService.getScriptCache().putAll(m, BOARD_CACHE_SEC); } catch (e) { console.warn('排行榜存不進快取：' + e); }
}
function boardCacheGet() {
  var cache = CacheService.getScriptCache(), n = Number(cache.get(BOARD_CACHE_KEY));
  if (!n) return null;
  var keys = [];
  for (var i = 0; i < n; i++) keys.push(BOARD_CACHE_KEY + ':' + i);
  var got = cache.getAll(keys), parts = [];
  for (var j = 0; j < n; j++) { if (got[keys[j]] == null) return null; parts.push(got[keys[j]]); }
  try { return JSON.parse(parts.join('')); } catch (e) { return null; }
}

// 每張紀錄表怎麼併成「每個人最好的一場」：cols 讀幾欄，merge(best, row) 把一列併進去（best 用 line_id 當 key）
// 單場最高分（Washes G total／AE ms、Cleans F total／AA ms）：分數高的贏，同分比快
function mergeTopScore(totalCol, msCol) {
  return function (best, r) {
    var id = String(r[2] || ''), total = Number(r[totalCol]), ms = Number(r[msCol]) || 0;
    if (!id || r[totalCol] === '' || !isFinite(total)) return;
    var b = best[id];
    if (!b || total > b.score || (total === b.score && ms && (!b.ms || ms < b.ms))) best[id] = { score: total, ms: ms };
  };
}
var BOARD_SOURCES = {
  // 貨運：一般模式最長的連撈（K max_combo，一樣長比運費多 E total）和一趟最多賺多少；
  // 無盡模式（AO mode = endless）航最遠（AQ dist，百分之一海里，同樣遠比運費）和一趟最多賺多少
  Ships: { cols: 43, merge: function (best, r) {
    var id = String(r[2] || '');
    if (!id) return;
    var total = Number(r[4]) || 0, n = Number(r[10]) || 0;
    var b = best[id] || (best[id] = { normal: null, combo: null, money: null, far: null });
    if (r[40] !== 'endless') {
      if (b.normal == null || total > b.normal) b.normal = total;
      if (n && (!b.combo || n > b.combo.n || (n === b.combo.n && total > b.combo.total))) b.combo = { n: n, total: total, picked: Number(r[9]) || 0 };
      return;
    }
    var dist = Number(r[42]) || 0, zone = Number(r[41]) || 1, ms = Number(r[37]) || 0;
    if (!b.far || dist > b.far.dist || (dist === b.far.dist && total > b.far.total)) b.far = { dist: dist, zone: zone, total: total, ms: ms };
    if (!b.money || total > b.money.total) b.money = { total: total, ms: ms, zone: zone, dist: dist };
  } },
  Washes: { cols: 31, merge: mergeTopScore(6, 30) },
  Cleans: { cols: 27, merge: mergeTopScore(5, 26) },
  // 蹭網：一般模式一輪最多省多少（E total）；無盡模式撐最久的一輪和一輪最多省多少（G wifi_ms、Q ms、U mode、V season）
  // 部署新版之前送上來的那幾輪沒有 U、V（舊版沒存），不過一般模式最多 60 秒，超過 61 秒的一定是無盡模式，季數用秒數算
  // 撐最久比的是真的連著 28 樓的時間（G wifi_ms），放著掛機的時間不算；all 是那輪總共撐多久
  Wifis: { cols: 22, merge: function (best, r) {
    var id = String(r[2] || ''), ms = Number(r[16]) || 0, mode = r[20] || '', total = Number(r[4]) || 0;
    if (!id) return;
    var b = best[id] || (best[id] = { normal: null, alive: null, money: null });
    if (mode !== 'endless' && !(mode === '' && ms > 61000)) {
      if (b.normal == null || total > b.normal) b.normal = total;
      return;
    }
    if (!ms) return;
    var season = Number(r[21]) || Math.floor(ms / 30000) + 1, wifi = Number(r[6]) || 0;
    if (!b.alive || wifi > b.alive.ms) b.alive = { ms: wifi, all: ms, season: season, total: total };
    if (!b.money || total > b.money.total) b.money = { total: total, ms: ms, season: season };
  } },
  // 早餐店：每個 line_id 出餐最多的一天（I served），同樣多比氣走少（J）、再比賺多（E）
  Zaocans: { cols: 11, merge: function (best, r) {
    var id = String(r[2] || ''), served = Number(r[8]) || 0, angry = Number(r[9]) || 0, total = Number(r[4]) || 0;
    if (!id || !served) return;
    var b = best[id];
    if (!b || served > b.n || (served === b.n && (angry < b.angry || (angry === b.angry && total > b.total)))) best[id] = { n: served, items: Number(r[10]) || 0, angry: angry, total: total };
  } },
  // 疊巢：一般模式疊最高的一場（F layers，一樣高比「正」多 G perfect、再比賺多 E total）和一場最多賺多少（best）；
  // 無盡模式（S mode = endless）另外記疊最高（far）和一場最多賺多少（money），上無盡・榜
  // 2026-11-18b 那版記的是 { n, perfect, total }（還沒有無盡模式），讀到就當一般模式
  Stacks: { cols: 19, merge: function (best, r) {
    var id = String(r[2] || ''), layers = Number(r[5]) || 0, perfect = Number(r[6]) || 0, total = Number(r[4]) || 0, ms = Number(r[15]) || 0;
    if (!id) return;
    var b = best[id];
    if (b && b.normal === undefined) b = { normal: b.n ? { n: b.n, perfect: b.perfect, total: b.total } : null, best: b.total || null, far: null, money: null };
    b = best[id] = b || { normal: null, best: null, far: null, money: null };
    var better = function (o) { return !o || layers > o.n || (layers === o.n && (perfect > o.perfect || (perfect === o.perfect && total > o.total))); };
    if (r[18] !== 'endless') {
      if (b.best == null || total > b.best) b.best = total;
      if (layers && better(b.normal)) b.normal = { n: layers, perfect: perfect, total: total };
      return;
    }
    if (layers && better(b.far)) b.far = { n: layers, perfect: perfect, total: total, ms: ms };
    if (!b.money || total > b.money.total) b.money = { total: total, n: layers, ms: ms };
  } },
  // 礦坑：每個 line_id 挖最深的一次（G win 的 F lv 最大，一樣深比 I liang 那時累積的兩多），破關幾次（T final）
  // 監修中試玩不送紀錄，所以這裡只會有正式開工後的
  Mines: { cols: 20, merge: function (best, r) {
    var id = String(r[2] || ''), lv = Number(r[5]) || 0, liang = Number(r[8]) || 0;
    if (!id || r[6] !== true) return;
    var b = best[id] = best[id] || { lv: 0, liang: 0, clears: 0 };
    if (lv > b.lv || (lv === b.lv && liang > b.liang)) { b.lv = lv; b.liang = liang; }
    if (r[19] === true) b.clears++;
  } },
  // 甜點店：每個 line_id 出餐最多的一輪（I served），同樣多比氣走少（J angry）、再比報廢少（K scrapped）、再比賺多（E total）
  Desserts: { cols: 11, merge: function (best, r) {
    var id = String(r[2] || ''), served = Number(r[8]) || 0, angry = Number(r[9]) || 0, scrapped = Number(r[10]) || 0, total = Number(r[4]) || 0;
    if (!id || !served) return;
    var b = best[id];
    if (!b || served > b.n || (served === b.n && (angry < b.angry || (angry === b.angry && (scrapped < b.scrapped || (scrapped === b.scrapped && total > b.total)))))) best[id] = { n: served, angry: angry, scrapped: scrapped, total: total };
  } },
};

// --- 排行榜只讀新的列 ---
// 以前每次算榜都把紀錄表從頭讀到尾，表越大越慢。現在每個人最好的成績記在 Board 分頁（每張表一格 JSON：{ row 讀到第幾列, best }），
// 下次只讀 row 後面新增的列、跟記下的比。紀錄被 archiveLogs() 搬走也沒關係：成績已經記在 Board，搬走幾列 row 就減幾。
// 改了 merge 的規則要重算：把 BOARD_STATE_VERSION 加一（會從頭讀一次；已經封存走的紀錄就不算了，要小心）。
var BOARD_STATE_VERSION = 3;  // 2：多了 Ships（欄位位置變了，從頭讀一次）；3：一般模式、無盡模式分開記（無盡・榜）
var BOARD_STATE_COLS = ['Washes', 'Cleans', 'Wifis', 'Zaocans', 'Ships', 'Desserts', 'Stacks', 'Mines'];
// Board 分頁照第一列的標題找欄（加新的表只多一欄，舊的照樣接著讀，不用從頭讀）
function boardStateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Board');
  if (!sheet) {
    sheet = ss.insertSheet('Board');
    sheet.appendRow(BOARD_STATE_COLS.concat(['version', 'epoch']));
  }
  return sheet;
}
// epoch：archiveLogs() 每搬一次加一。算榜算到一半剛好有人封存，存回去之前看 epoch 變了就不存（不然列數會對不上）
function boardStateRow() {
  var sheet = boardStateSheet(), w = Math.max(sheet.getLastColumn(), 1), rows = sheet.getRange(1, 1, 2, w).getValues(), m = {};
  rows[0].forEach(function (h, i) { if (h) m[String(h)] = rows[1][i]; });
  return m;
}
function loadBoardState() {
  var m = boardStateRow();
  var st = { epoch: Number(m.epoch) || 0 };
  if (Number(m.version) !== BOARD_STATE_VERSION) return st;  // 版本不對：從頭讀
  BOARD_STATE_COLS.forEach(function (name) {
    try { var v = JSON.parse(m[name] || 'null'); if (v && typeof v.row === 'number' && v.best) st[name] = v; } catch (e) { }
  });
  return st;
}
function writeBoardState(st) {
  var row = BOARD_STATE_COLS.map(function (name) { return JSON.stringify(st[name] || { row: 1, best: {} }); });
  if (row.some(function (v) { return v.length > 49000; })) return false;  // 一格最多五萬字，放不下就不存（下次照樣從頭讀，只是慢）
  var sheet = boardStateSheet();
  if (sheet.getLastColumn() > row.length + 2) sheet.getRange(1, row.length + 3, 2, sheet.getLastColumn() - row.length - 2).clearContent();
  sheet.getRange(1, 1, 1, row.length + 2).setValues([BOARD_STATE_COLS.concat(['version', 'epoch'])]);
  sheet.getRange(2, 1, 1, row.length + 2).setValues([row.concat([BOARD_STATE_VERSION, st.epoch || 0])]);
  return true;
}
// 算榜後存回去：排隊，存之前確認沒有人剛封存過
function saveBoardState(st) {
  return withLock(function () {
    var now = Number(boardStateRow().epoch) || 0;
    if (now !== (st.epoch || 0)) return false;
    return writeBoardState(st);
  });
}
// 把一張紀錄表新增的列併進 state[name]，回傳 best
function boardScan(st, name) {
  var src = BOARD_SOURCES[name], sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  var cur = st[name] || { row: 1, best: {} };
  if (!sheet) { st[name] = cur; return cur.best; }
  var last = sheet.getLastRow();
  if (last < cur.row) cur.row = last;  // 有人直接在 Sheet 刪了列：記下的成績留著，從現在最後一列接著讀
  if (last > cur.row) {
    sheet.getRange(cur.row + 1, 1, last - cur.row, src.cols).getValues().forEach(function (r) { src.merge(cur.best, r); });
    cur.row = last;
  }
  st[name] = cur;
  return cur.best;
}

// --- 紀錄表太大的時候 ---
// 一份試算表最多 1,000 萬格。在編輯器執行 logSize() 看現在用了多少；
// 執行 archiveLogs() 把 90 天以前的紀錄搬到新的一份試算表（檔名「丼步喱紀錄封存 日期」，在你的雲端硬碟），這份裡的刪掉。
// 排行榜的最好成績先記進 Board 再搬，所以搬走的那幾場還是算數。第一次執行會跳出授權（要能建新的試算表）。
var CELL_LIMIT = 10000000;
var ARCHIVE_SHEETS = ['Washes', 'Cleans', 'Farms', 'Wifis', 'Zaocans', 'Ships', 'Desserts', 'Stacks', 'Mines', 'Gongde'];
function logSize() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), total = 0, lines = [];
  ss.getSheets().forEach(function (sh) {
    var cells = sh.getMaxRows() * sh.getMaxColumns();
    total += cells;
    lines.push(sh.getName() + '：' + (sh.getLastRow() - 1) + ' 列（佔 ' + cells + ' 格）');
  });
  Logger.log(lines.join('\n') + '\n合計 ' + total + ' 格，上限 ' + CELL_LIMIT + ' 格，用了 ' + Math.round(total / CELL_LIMIT * 1000) / 10 + '%。');
  return total;
}
function archiveLogs(days) {
  days = typeof days === 'number' && days > 0 ? days : 90;
  var cutoff = Date.now() - days * 864e5, ss = SpreadsheetApp.getActiveSpreadsheet();
  var out = withLock(function () {
    var st = loadBoardState();
    BOARD_STATE_COLS.forEach(function (name) { boardScan(st, name); });  // 先把成績記進 Board（讀到現在最後一列）
    var archive = null, moved = [];
    ARCHIVE_SHEETS.forEach(function (name) {
      var sheet = ss.getSheetByName(name);
      if (!sheet || sheet.getLastRow() < 2) return;
      // 紀錄是照時間往下加的：從第 2 列往下數，數到第一列不夠舊的
      var times = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues(), k = 0;
      while (k < times.length && Object.prototype.toString.call(times[k][0]) === '[object Date]' && times[k][0].getTime() < cutoff) k++;
      if (!k) return;
      var cols = sheet.getLastColumn(), rows = sheet.getRange(2, 1, k, cols).getValues();
      if (!archive) archive = SpreadsheetApp.create('丼步喱紀錄封存 ' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'));
      var dest = archive.insertSheet(name);
      dest.getRange(1, 1, 1, cols).setValues(sheet.getRange(1, 1, 1, cols).getValues());
      dest.getRange(2, 1, k, cols).setValues(rows);
      sheet.deleteRows(2, k);
      if (st[name]) st[name].row = Math.max(1, st[name].row - k);
      moved.push(name + ' ' + k + ' 列');
    });
    st.epoch = (st.epoch || 0) + 1;
    writeBoardState(st);
    return { moved: moved, url: archive ? archive.getUrl() : '' };
  });
  if (out.result) { Logger.log(out.error); return; }
  Logger.log(out.moved.length ? '搬了：' + out.moved.join('、') + '。封存檔：' + out.url : days + ' 天以前的紀錄一列都沒有，不用搬。');
  logSize();
}

function buildBoard() {
  var st = loadBoardState();
  var washBest = boardScan(st, 'Washes'), cleanBest = boardScan(st, 'Cleans'), wifis = boardScan(st, 'Wifis'), served = boardScan(st, 'Zaocans'), ships = boardScan(st, 'Ships'), desserts = boardScan(st, 'Desserts'), stacks = boardScan(st, 'Stacks'), mines = boardScan(st, 'Mines');
  try { saveBoardState(st); } catch (e) { console.warn('Board 分頁存不進去：' + e); }
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
    var fe = earned.farm || {};  // 菜園：最高的一輪就是 earned 的 best（一輪賣多少錢）
    var fm = { n: Number(fe.times) || 0, money: Number(fe.total) || 0, best: fe.best ? Number(fe.best) : null, ms: 0 };
    var we = earned.wifi || {}, wb = wifis[id] || {};  // 蹭網：最高分只算一般模式（從 Wifis 算）；無盡模式另外放 endless（無盡・榜）
    var wf = { n: Number(we.times) || 0, money: Number(we.total) || 0, best: wb.normal || null, ms: 0, alive: wb.alive || null,
      endless: { money: wb.money || null, alive: wb.alive || null } };
    var ze = earned.zaocan || {};  // 早餐店：最高的一天是 earned 的 best；served 是出餐最多的一天
    var zc = { n: Number(ze.times) || 0, money: Number(ze.total) || 0, best: ze.best ? Number(ze.best) : null, ms: 0, served: served[id] || null };
    var de = earned.dessert || {};  // 甜點店：最高的一輪是 earned 的 best；served 是出餐最多的一輪
    var ds = { n: Number(de.times) || 0, money: Number(de.total) || 0, best: de.best ? Number(de.best) : null, ms: 0, served: desserts[id] || null };
    var ke = earned.stack || {}, kb = stacks[id] || {};  // 疊巢：最高分、疊最高只算一般模式（從 Stacks 算）；無盡模式疊最高、一場最多放 endless
    if (kb.normal === undefined && kb.n) kb = { normal: { n: kb.n, perfect: kb.perfect, total: kb.total }, best: kb.total };  // 2026-11-18b 的舊格式
    var sk = { n: Number(ke.times) || 0, money: Number(ke.total) || 0, best: kb.best || null, ms: 0, layers: kb.normal || null,
      endless: { far: kb.far || null, money: kb.money || null } };
    var me = earned.mine || {}, mb = mines[id] || {};  // 礦坑：挖最深（從 Mines 算），破關幾次
    var mn = { n: Number(me.times) || 0, money: Number(me.total) || 0, best: mb.lv || null, ms: 0, deep: mb.lv ? { lv: mb.lv, liang: mb.liang } : null, clears: mb.clears || 0 };
    var se = earned.ship || {}, sb = ships[id] || {};  // 貨運：最高分、最長連撈只算一般模式；無盡模式航最遠、一趟最多放 endless
    var sh = { n: Number(se.times) || 0, money: Number(se.total) || 0, best: sb.normal || null, ms: 0, combo: sb.combo || null,
      endless: { money: sb.money || null, far: sb.far || null } };
    var gd = {}, shop = {};
    try { gd = JSON.parse(rows[i][8] || '{}') || {}; } catch (e) { }
    try { shop = JSON.parse(rows[i][9] || '{}') || {}; } catch (e) { }
    var num = function (v) { v = Number(v); return isFinite(v) && v > 0 ? Math.round(v) : 0; };
    var sp = { total: num(rows[i][5]), shop: num(shop.spent), donate: num(gd.donated), lamp: num(gd.lit) };
    sp.scratch = Math.max(0, sp.total - sp.shop - sp.donate - sp.lamp);
    sp.won = num((earned.scratch || {}).total) + num((earned.caishen || {}).total);  // 刮中的（含財神加碼）
    if (!x.n && !c.n && !fm.n && !wf.n && !zc.n && !sh.n && !ds.n && !sk.n && !mn.n && x.best == null && c.best == null && !sp.total) continue;
    // 有暱稱、指定頭像就用它，沒有才用 LINE 的
    var nick = String(rows[i][12] || '').replace(/^'/, '').trim().slice(0, 12), avatar = String(rows[i][13] || '');
    if (AVATAR_KEYS.indexOf(avatar) < 0) avatar = '';
    out.push({ id: id, name: nick || String(rows[i][2] || '旅人').slice(0, 20), avatar: avatar,
      picture: !avatar && /^https:\/\//.test(rows[i][3] || '') ? String(rows[i][3]) : '', xitou: x, clean: c, farm: fm, wifi: wf, zaocan: zc, ship: sh, dessert: ds, stack: sk, mine: mn, spend: sp });
  }
  return { at: new Date().toISOString(), players: out };
}

function leaderboard(input) {
  // 排行榜頁按「刷新」（fresh）：當場重算存回快取。後端不擋次數（使用者 2026-11-18 定的：只擋同一支手機一分鐘一次，在網頁那邊擋）
  var board = null, refreshed = false;
  if (input && input.fresh) { board = buildBoard(); boardCachePut(board); refreshed = true; }
  if (!board) board = boardCacheGet();
  if (!board) { board = buildBoard(); boardCachePut(board); refreshed = true; }   // 排程沒算到（剛部署、排程停了）才當場算
  var me = input && input.session ? sessionUser(input.session) : null;
  return {
    result: 'success', at: board.at, refreshed: refreshed,
    players: board.players.map(function (p) {
      return { name: p.name, picture: p.picture, avatar: p.avatar || '', xitou: p.xitou, clean: p.clean, farm: p.farm, wifi: p.wifi, zaocan: p.zaocan, ship: p.ship, dessert: p.dessert, stack: p.stack, mine: p.mine, spend: p.spend, me: !!me && p.id === me };
    })
  };
}


// --- 保險・存（baoxian.html）：丼步喱人壽的儲蓄險 ---
// 要 LINE 登入。投保、領滿期金、解約都直接改 Players 的錢（排隊做），時間用後端的時鐘，手機調時間沒有用。
// 投保扣的錢不算 spent（錢只是鎖起來）；領滿期金時利息記在 earned.insure；解約少拿的部分不算 spent。

var POLICY_PLANS = {
  d3: { name: '三日・安', days: 3, rate: 0.10 },
  d5: { name: '五日・穩', days: 5, rate: 0.25 },
  d7: { name: '七日・久', days: 7, rate: 0.40 }
};
var POLICY_MIN = 10000, POLICY_MAX = 100000, POLICY_ACTIVE_MAX = 3, POLICY_SURRENDER_BASE = 0.7, POLICY_OPS_PER_HOUR = 120;
var POLICY_HEADERS = ['created', 'id', 'line_id', 'plan', 'amount', 'rate', 'start', 'end', 'status', 'closed', 'payout'];

function policiesSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Policies');
  if (!sheet) {
    sheet = ss.insertSheet('Policies');
    sheet.appendRow(POLICY_HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function policyRows(lineId) {
  var rows = policiesSheet().getDataRange().getValues(), out = [];
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][2]) !== lineId) continue;
    out.push({
      row: i + 1, id: String(rows[i][1]), plan: String(rows[i][3]), amount: Number(rows[i][4]) || 0, rate: Number(rows[i][5]) || 0,
      start: new Date(rows[i][6]), end: new Date(rows[i][7]), status: String(rows[i][8] || 'active'),
      closed: rows[i][9] ? new Date(rows[i][9]) : null, payout: Number(rows[i][10]) || 0
    });
  }
  return out;
}

function policyDue(p) { return p.amount + Math.round(p.amount * p.rate); }

// 現在解約拿回多少：剛投保 7 成，越接近滿期越多（沒有利息）
function policySurrender(p, now) {
  var span = p.end.getTime() - p.start.getTime();
  var prog = span > 0 ? Math.max(0, Math.min(1, (now.getTime() - p.start.getTime()) / span)) : 1;
  return Math.floor(p.amount * (POLICY_SURRENDER_BASE + (1 - POLICY_SURRENDER_BASE) * prog));
}

function policyView(p, now) {
  var plan = POLICY_PLANS[p.plan] || { name: p.plan, days: 0 };
  return {
    id: p.id, plan: p.plan, name: plan.name, days: plan.days, amount: p.amount, rate: p.rate,
    start: p.start.toISOString(), end: p.end.toISOString(), status: p.status,
    closed: p.closed ? p.closed.toISOString() : '', payout: p.payout, due: policyDue(p),
    surrender: p.status === 'active' && now < p.end ? policySurrender(p, now) : 0
  };
}

// 回給網頁的：還在保的全部 + 最近 10 張結束的，加上現在時間和規則
function policyBook(lineId, now) {
  var all = policyRows(lineId);
  var active = all.filter(function (p) { return p.status === 'active'; });
  var done = all.filter(function (p) { return p.status !== 'active'; }).sort(function (a, b) { return (b.closed || 0) - (a.closed || 0); }).slice(0, 10);
  var plans = Object.keys(POLICY_PLANS).map(function (k) { var x = POLICY_PLANS[k]; return { key: k, name: x.name, days: x.days, rate: x.rate }; });
  return {
    now: now.toISOString(), policies: active.concat(done).map(function (p) { return policyView(p, now); }),
    rules: { plans: plans, min: POLICY_MIN, max: POLICY_MAX, activeMax: POLICY_ACTIVE_MAX, surrenderBase: POLICY_SURRENDER_BASE }
  };
}

function policyGuard(input) {
  var lineId = sessionUser(input.session);
  if (!lineId) return { error: { result: 'unauthorized' } };
  var cache = CacheService.getScriptCache();
  var key = 'policy:' + lineId + ':' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var n = Number(cache.get(key) || 0);
  if (n >= POLICY_OPS_PER_HOUR) return { error: { result: 'error', error: '這小時跑保險公司太多次了，晚點再來' } };
  cache.put(key, String(n + 1), 3600);
  return { lineId: lineId };
}

function policyList(input) {
  var g = policyGuard(input);
  if (g.error) return g.error;
  var out = policyBook(g.lineId, new Date());
  out.result = 'success';
  return out;
}

function policyBuy(input) {
  var g = policyGuard(input);
  if (g.error) return g.error;
  var plan = POLICY_PLANS[String(input.plan || '')];
  var amount = cleanMoney(input.amount, POLICY_MIN, POLICY_MAX);
  if (!plan) return { result: 'error', error: '沒有這種保單' };
  if (amount === null) return { result: 'error', error: '保額要是 $' + POLICY_MIN + '～$' + POLICY_MAX + ' 的整數' };
  var p = findPlayer(g.lineId);
  if (!p) return { result: 'unauthorized' };
  var active = policyRows(g.lineId).filter(function (x) { return x.status === 'active'; });
  if (active.length >= POLICY_ACTIVE_MAX) return { result: 'error', error: '同時最多 ' + POLICY_ACTIVE_MAX + ' 張保單' };
  if (p.money < amount) return { result: 'error', error: '錢包不夠' };
  p.money -= amount;
  writeWallet(p);
  var now = new Date(), end = new Date(now.getTime() + plan.days * 86400000);
  var id = 'P' + Utilities.getUuid().replace(/-/g, '').slice(0, 7).toUpperCase();
  policiesSheet().appendRow([now, id, g.lineId, String(input.plan), amount, plan.rate, now, end, 'active', '', '']);
  var out = policyBook(g.lineId, now);
  out.result = 'success'; out.id = id; out.wallet = walletView(p);
  return out;
}

function policyFind(lineId, id) {
  var list = policyRows(lineId);
  for (var i = 0; i < list.length; i++) if (list[i].id === String(id || '')) return list[i];
  return null;
}

function policyClose(p, status, payout, now) {
  policiesSheet().getRange(p.row, 9, 1, 3).setValues([[status, now, payout]]);
}

function policyClaim(input) {
  var g = policyGuard(input);
  if (g.error) return g.error;
  var pol = policyFind(g.lineId, input.id), now = new Date();
  if (!pol) return { result: 'error', error: '找不到這張保單' };
  if (pol.status !== 'active') return { result: 'error', error: '這張保單已經結束了' };
  if (now < pol.end) return { result: 'error', error: '還沒滿期' };
  var p = findPlayer(g.lineId);
  if (!p) return { result: 'unauthorized' };
  var due = policyDue(pol), interest = due - pol.amount;
  p.money = Math.min(WALLET_MAX, p.money + due);
  p.earned = addEarned(p.earned, { insure: { times: 1, total: interest, best: interest } });
  writeWallet(p);
  policyClose(pol, 'matured', due, now);
  var out = policyBook(g.lineId, now);
  out.result = 'success'; out.payout = due; out.interest = interest; out.wallet = walletView(p);
  return out;
}

function policyCancel(input) {
  var g = policyGuard(input);
  if (g.error) return g.error;
  var pol = policyFind(g.lineId, input.id), now = new Date();
  if (!pol) return { result: 'error', error: '找不到這張保單' };
  if (pol.status !== 'active') return { result: 'error', error: '這張保單已經結束了' };
  if (now >= pol.end) return { result: 'error', error: '已經滿期了，直接領滿期金' };
  var p = findPlayer(g.lineId);
  if (!p) return { result: 'unauthorized' };
  var back = policySurrender(pol, now);
  p.money = Math.min(WALLET_MAX, p.money + back);
  writeWallet(p);
  policyClose(pol, 'surrendered', back, now);
  var out = policyBook(g.lineId, now);
  out.result = 'success'; out.payout = back; out.wallet = walletView(p);
  return out;
}

// 在編輯器選這個按「執行」：先把 Policies 分頁建出來
function setupPolicies() {
  var sheet = policiesSheet();
  Logger.log('Policies 分頁好了，目前有 ' + (sheet.getLastRow() - 1) + ' 張保單。網頁要能投保，還要「部署 → 管理部署作業 → 編輯 → 版本選新版本 → 部署」。');
}

// --- 股市・炒（gushi.html）：二十七樓證券交易所 ---
// 價格不用排程：每一格（每天 9:00～24:00 的整點）的漲跌用祕密鑰匙（指令碼屬性 STOCK_SEED，沒有就自己產生一把）
// 加上「股票代號、日期、幾點」算 HMAC，換成 0～1 的數字。同一把鑰匙、同一格，算出來永遠一樣；沒有鑰匙算不出明天。
// 算過的每一格存在 Prices 分頁（A 第幾格、B 時間、C～I 七檔的價格），下一格接著上一格算，改了規則也不會改到過去。
// 整點過後第一個來看行情的人（排隊）把新的格子補上，順便處理排隊的委託單（跌停掛賣、漲停掛買，打開才成交）。
// 晚報：每天 21:00 出明天的。明天哪一檔上新聞、真正往哪走、走多少、晚報說真話還是說反話，都用同一把鑰匙事先算好；
// 句子從 NewsLines 分頁抽（使用者自己匯入，A code、B name、C dir、D kind、E text、F on），抽好的存進 News，之後不再變。
// 持股、委託、損益存在 Players 的 L 欄（JSON）。手續費、損益都不算 spent、不算 earned（花錢榜、打工榜不受影響）。

var STOCKS = [
  { code: '2701', name: '長蘿貨運', base: 128 },
  { code: '2702', name: '麥克早餐', base: 64.5 },
  { code: '2703', name: '丼步喱人壽', base: 210 },
  { code: '2704', name: '伊藤彩券', base: 45.2 },
  { code: '2705', name: '茱莉鴨電信', base: 88 },
  { code: '2706', name: '雅雅沙龍', base: 156 },
  { code: '2707', name: 'San Farm', base: 37.4 },
  // 妖股（2026-11-17）：漲跌停 ±20%、每小時亂晃大好幾倍、會連續好幾天漲停再崩；不上晚報、也不會被挑去「突發」
  { code: '2708', name: '浣熊海盜控股', base: 18.5, yao: true },
  { code: '2709', name: '伊藤明牌投顧', base: 27.7, yao: true },
  { code: '2710', name: '鼴鼠區塊鏈', base: 8.8, yao: true }
];
var STOCK_NORMAL = STOCKS.filter(function (s) { return !s.yao; });   // 晚報、突發只從這七檔挑（加了妖股，原本七檔的走勢一點都不變）
var YAO_LIMIT = 0.20;                             // 妖股漲跌停
var YAO_NOISE = 0.04;                             // 妖股每小時亂晃 ±4%
var YAO_REVERT = 0.002;                           // 妖股往起始價拉回（照倍數的對數算：漲到兩倍，每小時拉回 0.14%；再大就變成「跌深了買」穩賺）
// 妖股每天在三種狀態之間換：平（亂晃）、炒（大漲，多半漲停）、殺（大跌，多半跌停）。
// 炒的隔天：再炒、被殺的機會一樣大（YAO_KEEP），所以漲停隔天追進去平均不賺不賠（還要付手續費），連續漲停是運氣
var YAO_START = 0.08;                             // 平的時候，隔天開始炒（或開始殺）的機率，各一份
var YAO_KEEP = 0.45, YAO_FLIP = 0.45;              // 炒／殺的隔天：繼續、反過來的機率（剩下回到平）
var YAO_SIZE = [0.18, 0.34];                      // 炒／殺那天整天推多少（超過 20% 就鎖漲停／跌停）
var YAO_BLOCK = 32;                               // 每 32 天從「平」重新算起（不用存狀態，哪一天叫都算得出一樣的）
var STOCK_OPEN = 9, STOCK_SLOTS = 16;            // 一天 16 格：9:00（＝昨收）、10:00～24:00 跳 15 次
var STOCK_NEWS_HOUR = 21;                         // 每晚幾點出明天的晚報
var STOCK_LIMIT = 0.10;                           // 漲跌停
var STOCK_NOISE = 0.012;                          // 每小時亂晃 ±1.2%
var STOCK_NEWS_SIZE = [0.03, 0.05];               // 上新聞那檔隔天整天往真正方向推多少
var STOCK_TRUTH = 0.73;                           // 晚報說真話的機率（加上亂晃蓋過推力，整體說中大約七成）
var STOCK_NEWS_COUNT = 2;                         // 一份晚報幾則（2026-11-17 從 1 則改 2 則；兩則各自七成說中，不會是同一檔）
var STOCK_DRIFT = 0.006;                          // 沒上新聞的每天也有一點點方向（±0.6%）
var STOCK_REVERT = 0.004;                         // 每小時往起始價拉回：偏離 50% 就拉 0.2%
var STOCK_SHOCK = 0.10, STOCK_SHOCK_SIZE = [0.09, 0.16];  // 沒有晚報預告的突發大漲大跌：每天 10% 機會挑一檔（不是上新聞那檔）
var STOCK_FEE = 0.01;                             // 買、賣各 1%（零頭進位）
var STOCK_CAP_ONE = 500000, STOCK_CAP_ALL = 2000000;  // 持股成本上限：一檔、全部（含掛單預留的錢）
var STOCK_HISTORY_DAYS = 30;                      // 第一次開市假裝上市幾天了
var STOCK_OPS_PER_HOUR = 300;
var STOCK_TRADE_HEADERS = ['timestamp', 'line_id', 'code', 'side', 'shares', 'price', 'amount', 'fee', 'pl', 'kind', 'money'];

// 晚報句子 NewsLines 是空的時候用（正式句子在使用者自己的 Sheet，不放公開的程式碼）
var STOCK_FALLBACK = {
  title: {
    '2701': ['長蘿號傳出加開夜航', '長蘿號又撞上浣熊的木盆'], '2702': ['大冰奶第二杯半價，隊伍排到大橋頭', '雞塊老闆被拍到在別家吃早餐'],
    '2703': ['法說會釋利多：宣告利率不降反升', '傳出現金增資計畫，股東皺眉'], '2704': ['伊藤宣布：「這週的明牌，我拿命押了。」', '伊藤承認明牌筆記是擲杯擲出來的'],
    '2705': ['28 樓路由器又重開，全棟改用茱莉鴨網路', '茱莉鴨顧湯太專心，被蹭了整整一季'], '2706': ['店貓登上雜誌封面，預約排到下個月', '客人投訴泡泡流到眼睛'],
    '2707': ['巨型蘿蔔出土，農會到場拍照', '鼴鼠在菜園開了分店']
  },
  source: ['鄰居阿伯在電梯裡說的'], reply: ['公司不願回應，只回了一張貼圖。'], foot: ['本報消息大約七成準確。投資一定有風險，看報紙更有。']
};

function stockNow() { return new Date(); }

// 台灣時間：第幾天（從 1970-01-01 算）、幾點
function stockClock(ms) {
  var t = ms + 8 * 3600000;
  return { day: Math.floor(t / 86400000), hour: Math.floor((t % 86400000) / 3600000) };
}
function stockDayStr(day) { return new Date(day * 86400000).toISOString().slice(0, 10); }
function stockDayMs(day, hour) { return day * 86400000 + (hour - 8) * 3600000; }  // 台灣 day 的 hour 點是 UTC 幾毫秒
// 現在是第幾格：0:00～9:00 還是昨天收盤那格（24 點）
function stockSlotAt(ms) {
  var c = stockClock(ms);
  return c.hour < STOCK_OPEN ? (c.day - 1) * STOCK_SLOTS + STOCK_SLOTS - 1 : c.day * STOCK_SLOTS + (c.hour - STOCK_OPEN);
}
function stockSlotDay(idx) { return Math.floor(idx / STOCK_SLOTS); }
function stockSlotHour(idx) { return idx % STOCK_SLOTS + STOCK_OPEN; }
function stockSlotLabel(idx) { var h = stockSlotHour(idx); return stockDayStr(stockSlotDay(idx)) + ' ' + (h < 10 ? '0' : '') + h + ':00'; }
// 下一次跳價：0:00～10:00 是 10:00，其他是下一個整點
function stockNextJump(ms) {
  var c = stockClock(ms);
  if (c.hour < STOCK_OPEN + 1) return stockDayMs(c.day, STOCK_OPEN + 1);
  return stockDayMs(c.day, c.hour + 1);
}
// 下一次 9:00 開盤（今天買的要等到這時候才能賣）
function stockNextOpen(ms) {
  var c = stockClock(ms);
  return stockDayMs(c.hour < STOCK_OPEN ? c.day : c.day + 1, STOCK_OPEN);
}

function stockSeed() {
  var props = PropertiesService.getScriptProperties(), s = props.getProperty('STOCK_SEED');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('STOCK_SEED', s); }
  return s;
}
// 果汁機：一樣的材料一定打出一樣的 0～1，沒有鑰匙猜不到
function stockRand(seed, text) {
  var b = Utilities.computeHmacSha256Signature(text, seed);
  return (((b[0] & 255) * 16777216) + ((b[1] & 255) << 16 >>> 0) + ((b[2] & 255) << 8) + (b[3] & 255)) / 4294967296;
}

// 台股的升降單位
function stockTick(p) { return p < 10 ? 0.01 : p < 50 ? 0.05 : p < 100 ? 0.1 : p < 500 ? 0.5 : p < 1000 ? 1 : 5; }
function stockFix(p) { return Math.round(p * 100) / 100; }
function stockRound(p) { var t = stockTick(p); return stockFix(Math.round(p / t) * t); }
function stockLimits(prev, s) {
  var L = s && s.yao ? YAO_LIMIT : STOCK_LIMIT;
  var up = prev * (1 + L), dn = prev * (1 - L);
  var tu = stockTick(up), td = stockTick(dn);
  return { up: stockFix(Math.floor(up / tu + 1e-9) * tu), down: stockFix(Math.ceil(dn / td - 1e-9) * td) };
}

// 第 day 天的新聞：哪一檔、真正往哪走、走多少、晚報說真話嗎（晚報說的方向 claim）
// 第一則用原本的鑰匙（以前的日子算出來一樣），第二則在剩下的六檔裡挑、用另一組鑰匙
function stockNewsPlans(seed, day) {
  var d = stockDayStr(day), out = [], n = stockNewsCount(day);
  for (var k = 0; k < n; k++) {
    var sfx = k ? String(k + 1) : '';
    var pool = STOCK_NORMAL.filter(function (s) { return !out.some(function (p) { return p.code === s.code; }); });
    var idx = Math.min(pool.length - 1, Math.floor(stockRand(seed, 'news' + sfx + '|' + d) * pool.length));
    var up = stockRand(seed, 'dir' + sfx + '|' + d) < 0.5;
    var size = STOCK_NEWS_SIZE[0] + stockRand(seed, 'size' + sfx + '|' + d) * (STOCK_NEWS_SIZE[1] - STOCK_NEWS_SIZE[0]);
    var truth = stockRand(seed, 'truth' + sfx + '|' + d) < STOCK_TRUTH;
    out.push({ day: day, n: k, code: pool[idx].code, up: up, size: size, truth: truth, claimUp: truth ? up : !up });
  }
  return out;
}
function stockNewsPlan(seed, day) { return stockNewsPlans(seed, day)[0]; }
// 從哪一天的晚報開始出兩則：新版第一次跑的時候記下「還沒出刊的下一份」，已經出了一則的那幾天照舊（價格才對得上晚報）
var stockNews2Cache = null;
function stockNews2Day() {
  if (stockNews2Cache !== null) return stockNews2Cache;
  var props = PropertiesService.getScriptProperties(), v = props.getProperty('STOCK_NEWS2_DAY');
  if (!v) { v = String(stockNewsDay(stockNow().getTime()) + 1); props.setProperty('STOCK_NEWS2_DAY', v); }
  stockNews2Cache = Number(v);
  return stockNews2Cache;
}
function stockNewsCount(day) { return day >= stockNews2Day() ? STOCK_NEWS_COUNT : 1; }

// 這一天每檔每小時的推力
function stockShock(seed, day, newsCodes) {
  var d = stockDayStr(day);
  if (stockRand(seed, 'shock|' + d) >= STOCK_SHOCK) return null;
  var others = STOCK_NORMAL.filter(function (s) { return newsCodes.indexOf(s.code) < 0; });
  var s = others[Math.min(others.length - 1, Math.floor(stockRand(seed, 'shockwho|' + d) * others.length))];
  var size = STOCK_SHOCK_SIZE[0] + stockRand(seed, 'shocksize|' + d) * (STOCK_SHOCK_SIZE[1] - STOCK_SHOCK_SIZE[0]);
  return { code: s.code, move: stockRand(seed, 'shockdir|' + d) < 0.5 ? size : -size };
}

function stockDrifts(seed, day) {
  var plans = stockNewsPlans(seed, day), codes = plans.map(function (p) { return p.code; });
  var shock = stockShock(seed, day, codes), d = stockDayStr(day), out = {};
  STOCKS.forEach(function (s) {
    if (s.yao) { out[s.code] = stockYaoDrift(seed, s, day) / (STOCK_SLOTS - 1); return; }
    var plan = plans[codes.indexOf(s.code)];
    var daily = plan ? (plan.up ? plan.size : -plan.size)
      : shock && shock.code === s.code ? shock.move
      : (stockRand(seed, 'drift|' + s.code + '|' + d) - 0.5) * 2 * STOCK_DRIFT;
    out[s.code] = daily / (STOCK_SLOTS - 1);
  });
  return out;
}

// 妖股這一天的狀態：0 平、1 炒、-1 殺。從這一段（YAO_BLOCK 天）的第一天「平」開始，一天一天照機率換過來
function stockYaoState(seed, s, day) {
  var st = 0;
  for (var d = Math.floor(day / YAO_BLOCK) * YAO_BLOCK + 1; d <= day; d++) {
    var r = stockRand(seed, 'yao|' + s.code + '|' + stockDayStr(d));
    if (st === 0) st = r < YAO_START ? 1 : r < 2 * YAO_START ? -1 : 0;
    else st = r < YAO_KEEP ? st : r < YAO_KEEP + YAO_FLIP ? -st : 0;
  }
  return st;
}
// 妖股這一天整天往哪推
function stockYaoDrift(seed, s, day) {
  var st = stockYaoState(seed, s, day), k = stockRand(seed, 'yaosize|' + s.code + '|' + stockDayStr(day));
  if (!st) return (k - 0.5) * 0.06;
  return st * (YAO_SIZE[0] + k * (YAO_SIZE[1] - YAO_SIZE[0]));
}

// 從 prev 那一格的價格算出 idx 這一格（idx 不是 9 點那格）
function stockStep(seed, s, idx, price, prevClose, drift) {
  var d = stockDayStr(stockSlotDay(idx)), h = stockSlotHour(idx);
  var noise = (stockRand(seed, s.code + '|' + d + '|' + h) - 0.5) * 2 * (s.yao ? YAO_NOISE : STOCK_NOISE);
  var revert = s.yao ? YAO_REVERT * Math.log(s.base / price) : STOCK_REVERT * (s.base - price) / s.base;
  var lim = stockLimits(prevClose, s);
  // 妖股用指數（對數空間對稱）：漲跌那麼大的時候，用 1+x 會一直往下滑（漲 20% 再跌 20% 剩 96%）
  var next = stockRound(s.yao ? price * Math.exp(drift + revert + noise) : price * (1 + drift + revert + noise));
  return Math.max(lim.down, Math.min(lim.up, next));
}

function stockSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
function pricesSheet() { return stockSheet('Prices', ['slot', 'time'].concat(STOCKS.map(function (s) { return s.code + ' ' + s.name; }))); }
function newsSheet() { return stockSheet('News', ['day', 'published', 'code', 'claim', 'real', 'size', 'truth', 'title', 'source', 'reply', 'foot']); }
function tradesSheet() { return stockSheet('Trades', STOCK_TRADE_HEADERS); }
function newsLinesSheet() { return stockSheet('NewsLines', ['code', 'name', 'dir', 'kind', 'text', 'on']); }

// Prices 最後 n 列：[{ idx, p: { code: price } }]
function stockRows(n) {
  var sheet = pricesSheet(), last = sheet.getLastRow();
  if (last < 2) return [];
  var from = Math.max(2, last - n + 1);
  return sheet.getRange(from, 1, last - from + 1, 2 + STOCKS.length).getValues().map(function (r) {
    var p = {};
    STOCKS.forEach(function (s, i) { p[s.code] = Number(r[2 + i]); });
    return { idx: Number(r[0]), p: p };
  }).filter(function (r) { return isFinite(r.idx) && r.idx > 0; });
}

// 新加的股票（妖股）：Prices 已經有的那幾百列，這幾檔的欄是空的。從第一列的起始價照規則一格一格補上（要在排隊裡叫）
function stockBackfill(seed, sheet) {
  var want = ['slot', 'time'].concat(STOCKS.map(function (s) { return s.code + ' ' + s.name; }));
  var head = sheet.getRange(1, 1, 1, want.length).getValues()[0];
  var missing = [];
  STOCKS.forEach(function (s, i) { if (String(head[2 + i] || '').indexOf(s.code) !== 0) missing.push(i); });
  if (!missing.length) return 0;
  sheet.getRange(1, 1, 1, want.length).setValues([want]);
  var last = sheet.getLastRow();
  if (last < 2) return missing.length;
  var idxs = sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return Number(r[0]); });
  missing.forEach(function (i) {
    var s = STOCKS[i], price = s.base, prev = s.base, dday = -1, drift = 0, out = [];
    idxs.forEach(function (idx, k) {
      if (k > 0) {
        if (idx % STOCK_SLOTS === 0) prev = price;   // 9:00 開盤＝昨收，不跳
        else {
          var day = stockSlotDay(idx);
          if (day !== dday) { drift = stockYaoDrift(seed, s, day) / (STOCK_SLOTS - 1); dday = day; }
          price = stockStep(seed, s, idx, price, prev, s.yao ? drift : 0);
        }
      }
      out.push([price]);
    });
    sheet.getRange(2, 3 + i, out.length, 1).setValues(out);
  });
  return missing.length;
}

// 把 Prices 補到現在這一格（要在排隊裡叫）。回傳新補的格子
function stockSync(nowMs) {
  var seed = stockSeed(), sheet = pricesSheet(), cur = stockSlotAt(nowMs);
  stockBackfill(seed, sheet);
  var tail = stockRows(STOCK_SLOTS + 1), last = tail[tail.length - 1];
  var rows = [], made = [];
  var price = {}, prevClose = {}, idx;
  if (!last) {
    // 第一次開市：假裝 30 天前上市，從起始價開始
    idx = (stockClock(nowMs).day - STOCK_HISTORY_DAYS) * STOCK_SLOTS;
    STOCKS.forEach(function (s) { price[s.code] = s.base; prevClose[s.code] = s.base; });
    rows.push([idx, stockSlotLabel(idx)].concat(STOCKS.map(function (s) { return s.base; })));
    made.push({ idx: idx, p: Object.assign({}, price) });
  } else {
    idx = last.idx;
    price = Object.assign({}, last.p);
    var open = tail.filter(function (r) { return r.idx === stockSlotDay(idx) * STOCK_SLOTS; })[0];
    STOCKS.forEach(function (s) { prevClose[s.code] = open ? open.p[s.code] : price[s.code]; });
  }
  if (idx > cur) return [];
  var drifts = null, driftDay = -1;
  for (var i = idx + 1; i <= cur; i++) {
    var day = stockSlotDay(i);
    if (i % STOCK_SLOTS === 0) {
      STOCKS.forEach(function (s) { prevClose[s.code] = price[s.code]; });  // 9:00 開盤＝昨收，不跳
    } else {
      if (driftDay !== day) { drifts = stockDrifts(seed, day); driftDay = day; }
      STOCKS.forEach(function (s) { price[s.code] = stockStep(seed, s, i, price[s.code], prevClose[s.code], drifts[s.code]); });
    }
    rows.push([i, stockSlotLabel(i)].concat(STOCKS.map(function (s) { return price[s.code]; })));
    made.push({ idx: i, p: Object.assign({}, price), prev: Object.assign({}, prevClose) });
  }
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  if (made.length) stockSettleOrders(made);
  return made;
}

// --- 晚報 ---
function stockNewsLines() {
  var sheet = newsLinesSheet(), last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, 6).getValues().map(function (r) {
    return { code: String(r[0]).trim(), dir: String(r[2]).trim(), kind: String(r[3]).trim(), text: String(r[4]).trim(), on: String(r[5]).trim() };
  }).filter(function (x) { return x.text && x.on !== '0'; });
}
function stockPick(seed, list, key) { return list.length ? list[Math.min(list.length - 1, Math.floor(stockRand(seed, key) * list.length))] : ''; }

// { day: [第一則, 第二則] }：同一天幾則就幾列，照列的順序
function stockReadNews() {
  var rows = newsSheet().getDataRange().getValues(), out = {};
  for (var i = 1; i < rows.length; i++) {
    var day = Number(rows[i][0]);
    if (!isFinite(day) || day <= 0) continue;
    (out[day] = out[day] || []).push({ day: day, published: rows[i][1] instanceof Date ? rows[i][1].toISOString() : String(rows[i][1]), code: String(rows[i][2]), claim: String(rows[i][3]),
      real: String(rows[i][4]), title: String(rows[i][7]), source: String(rows[i][8]), reply: String(rows[i][9]), foot: String(rows[i][10]) });
  }
  return out;
}

// 第 day 天的晚報（前一天 21:00 出），還沒有就抽句子存起來（要在排隊裡叫）
function stockMakeNews(day, have) {
  if (have[day]) return have[day];
  var seed = stockSeed(), lines = stockNewsLines(), d = stockDayStr(day);
  have[day] = stockNewsPlans(seed, day).map(function (plan) { return stockMakeOne(seed, lines, d, day, plan); });
  return have[day];
}
function stockMakeOne(seed, lines, d, day, plan) {
  var claim = plan.claimUp ? 'up' : 'down', k = plan.n ? String(plan.n + 1) : '';
  var titles = lines.filter(function (x) { return x.kind === 'title' && x.code === plan.code && x.dir === claim; }).map(function (x) { return x.text; });
  if (!titles.length) titles = [STOCK_FALLBACK.title[plan.code][plan.claimUp ? 0 : 1]];
  var pickKind = function (kind) {
    var list = lines.filter(function (x) { return x.kind === kind && (x.code === 'all' || x.code === plan.code); }).map(function (x) { return x.text; });
    return list.length ? list : STOCK_FALLBACK[kind];
  };
  var rec = {
    day: day, published: new Date(stockDayMs(day - 1, STOCK_NEWS_HOUR)).toISOString(), code: plan.code, claim: claim, real: plan.up ? 'up' : 'down',
    title: stockPick(seed, titles, 'nt' + k + '|' + d), source: stockPick(seed, pickKind('source'), 'ns' + k + '|' + d),
    reply: stockPick(seed, pickKind('reply'), 'nr' + k + '|' + d), foot: stockPick(seed, pickKind('foot'), 'nf|' + d)
  };
  newsSheet().appendRow([day, new Date(stockDayMs(day - 1, STOCK_NEWS_HOUR)), plan.code, claim, rec.real, Math.round(plan.size * 1000) / 10, plan.truth ? 'true' : 'false',
    asText(rec.title), asText(rec.source), asText(rec.reply), asText(rec.foot)]);
  return rec;
}

// 現在看得到的晚報：21:00 以後是明天的，之前是今天的（昨晚出的）
function stockNewsDay(ms) { var c = stockClock(ms); return c.hour >= STOCK_NEWS_HOUR ? c.day + 1 : c.day; }
function stockPublicList(list) { return (list || []).map(stockPublicNews); }
function stockPublicNews(rec) {
  return rec ? { day: stockDayStr(rec.day), published: rec.published, code: rec.code, claim: rec.claim, title: rec.title, source: rec.source, reply: rec.reply, foot: rec.foot } : null;
}

// 補價格、補晚報。需要寫才排隊
function stockEnsure(nowMs, locked) {
  var cur = stockSlotAt(nowMs), newsDay = stockNewsDay(nowMs);
  var cache = CacheService.getScriptCache(), key = 'stockok:v2:' + cur + ':' + newsDay;
  if (cache.get(key)) return;
  var work = function () {
    stockSync(nowMs);
    var have = stockReadNews();
    stockMakeNews(newsDay, have);
    stockMakeNews(stockSlotDay(cur), have);
    cache.put(key, '1', 3600);
  };
  if (locked) return work();
  var tail = stockRows(1), news = stockReadNews();
  var full = tail.length && STOCKS.every(function (s) { return tail[0].p[s.code] > 0; });   // 新加的股票還沒補歷史就要排隊補
  if (full && tail[0].idx >= cur && news[newsDay] && news[stockSlotDay(cur)]) { cache.put(key, '1', 3600); return; }
  var r = withLock(function () { work(); return null; });
  if (r && r.result === 'error') throw new Error(r.error);
}

// 公開的行情（不用登入）。存快取 3 分鐘
function stockQuoteData(nowMs) {
  var cur = stockSlotAt(nowMs), newsDay = stockNewsDay(nowMs), today = stockSlotDay(cur);
  var cache = CacheService.getScriptCache(), key = 'stockq:v3:' + cur + ':' + newsDay, hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var rows = stockRows(STOCK_SLOTS * (STOCK_HISTORY_DAYS + 1) + 1).filter(function (r) { return r.idx <= cur; });
  var dayRows = rows.filter(function (r) { return stockSlotDay(r.idx) === today; });
  var closes = rows.filter(function (r) { return r.idx % STOCK_SLOTS === STOCK_SLOTS - 1 && stockSlotDay(r.idx) < today; }).slice(-STOCK_HISTORY_DAYS);
  var news = stockReadNews();
  var stocks = STOCKS.map(function (s) {
    var prev = dayRows.length ? dayRows[0].p[s.code] : s.base, price = rows.length ? rows[rows.length - 1].p[s.code] : s.base, lim = stockLimits(prev, s);
    return {
      code: s.code, name: s.name, yao: !!s.yao, limit: s.yao ? YAO_LIMIT : STOCK_LIMIT, price: price, prev: prev, up: lim.up, down: lim.down,
      state: price >= lim.up ? 'up' : price <= lim.down ? 'down' : '',
      day: dayRows.map(function (r) { return r.p[s.code]; }),
      month: closes.map(function (r) { return r.p[s.code]; }).concat([price])
    };
  });
  var c = stockClock(nowMs);
  var out = {
    now: nowMs, slot: cur, label: stockSlotLabel(cur), day: stockDayStr(today), open: c.hour >= STOCK_OPEN, next: stockNextJump(nowMs),
    // news／newsNow 是第一則（舊頁面用），newsList／newsNowList 是整份（一則或兩則）
    stocks: stocks, news: stockPublicNews((news[newsDay] || [])[0]), newsNow: stockPublicNews((news[today] || [])[0]),
    newsList: stockPublicList(news[newsDay]), newsNowList: stockPublicList(news[today]),
    rules: { fee: STOCK_FEE, capOne: STOCK_CAP_ONE, capAll: STOCK_CAP_ALL, limit: STOCK_LIMIT, newsHour: STOCK_NEWS_HOUR }
  };
  cache.put(key, JSON.stringify(out), 180);
  return out;
}

function stockQuote(input) {
  var now = stockNow().getTime();
  stockEnsure(now, false);
  var out = stockQuoteData(now);
  out.result = 'success';
  return out;
}

// --- 持股（Players 的 L 欄）---
// { h: { code: { n 股數, cost 成本（含買進手續費）, lock 還不能賣的股數, until 幾點解鎖 } },
//   o: [{ id, code, side, n, price, day, at, reserve }] 排隊的委託, pl 已實現損益, fee 手續費合計, notes: 還沒看的成交／取消通知 }
function stockBlank() { return { h: {}, o: [], pl: 0, fee: 0, notes: [] }; }
function stockParse(raw) {
  var s = stockBlank();
  try { var x = JSON.parse(raw || '{}') || {}; Object.keys(s).forEach(function (k) { if (x[k] !== undefined) s[k] = x[k]; }); } catch (e) { }
  if (!s.h || typeof s.h !== 'object') s.h = {};
  if (!Array.isArray(s.o)) s.o = [];
  if (!Array.isArray(s.notes)) s.notes = [];
  return s;
}
function stockLoad(p) {
  var sheet = playersSheet();
  if (!sheet.getRange(1, 12).getValue()) sheet.getRange(1, 12).setValue('stock');
  p.stock = stockParse(sheet.getRange(p.row, 12).getValue());
  return p;
}
function stockSave(p) {
  writeWallet(p);
  playersSheet().getRange(p.row, 12).setValue(JSON.stringify(p.stock));
}
function stockNote(st, note) { st.notes.push(note); if (st.notes.length > 10) st.notes = st.notes.slice(-10); }
function stockLocked(h, nowMs) { return h && h.until && nowMs < h.until ? h.lock : 0; }
function stockQueued(st, code, side) { return st.o.filter(function (o) { return o.code === code && o.side === side; }).reduce(function (t, o) { return t + o.n; }, 0); }
function stockCostAll(st) {
  var t = 0;
  Object.keys(st.h).forEach(function (k) { t += st.h[k].cost; });
  st.o.forEach(function (o) { if (o.side === 'buy') t += o.reserve; });
  return t;
}
// 委託算哪一天：收盤後（0:00～9:00，現在是昨天 24:00 那格）掛的算下一個交易日
function stockOrderDay(slot) { return stockSlotDay(slot) + (slot % STOCK_SLOTS === STOCK_SLOTS - 1 ? 1 : 0); }
function stockAmount(price, n) { var a = Math.round(price * n); return { amount: a, fee: Math.ceil(a * STOCK_FEE) }; }

function stockLog(lineId, code, side, n, price, amt, pl, kind, money) {
  tradesSheet().appendRow([new Date(), lineId, code, side, n, price, amt.amount, amt.fee, pl, kind, money]);
}

// 買進成交：錢已經扣好（或預留好）了，這裡只加股數
function stockAddShares(st, code, n, cost, nowMs) {
  var h = st.h[code] || (st.h[code] = { n: 0, cost: 0, lock: 0, until: 0 });
  if (!h.until || nowMs >= h.until) h.lock = 0;
  h.n += n; h.cost += cost; h.lock += n; h.until = stockNextOpen(nowMs);
}
// 賣出成交：回傳這次的損益
function stockRemoveShares(st, code, n, proceeds) {
  var h = st.h[code], part = Math.round(h.cost * n / h.n), pl = proceeds - part;
  h.n -= n; h.cost -= part;
  if (h.lock > h.n) h.lock = h.n;
  if (h.n <= 0) delete st.h[code];
  st.pl += pl;
  return pl;
}

// 新補上的格子：跌停打開就成交排隊的賣單（用跌停價），漲停打開就成交買單（用漲停價）；過了那一天還沒成交就取消
function stockSettleOrders(made) {
  var sheet = playersSheet(), last = sheet.getLastRow();
  if (last < 2) return;
  var cells = sheet.getRange(2, 12, last - 1, 1).getValues(), ids = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < cells.length; i++) {
    if (!cells[i][0] || String(cells[i][0]).indexOf('"side"') < 0) continue;
    var st = stockParse(cells[i][0]);
    if (!st.o.length) continue;
    var p = findPlayer(String(ids[i][0]));
    if (!p) continue;
    p.stock = st;
    var changed = false;
    made.forEach(function (m) {
      var at = stockDayMs(stockSlotDay(m.idx), stockSlotHour(m.idx));
      st.o = st.o.filter(function (o) {
        if (stockSlotDay(m.idx) > o.day) {  // 那一天收盤了還沒成交：取消，買單把預留的錢還回去
          if (o.side === 'buy') p.money = Math.min(WALLET_MAX, p.money + o.reserve);
          stockNote(st, { at: at, kind: 'expire', code: o.code, side: o.side, n: o.n, price: o.price });
          changed = true;
          return false;
        }
        if (stockSlotDay(m.idx) !== o.day || m.idx % STOCK_SLOTS === 0) return true;
        var price = m.p[o.code];
        var opened = o.side === 'sell' ? price > o.price : price < o.price;
        if (!opened) return true;
        var amt = stockAmount(o.price, o.n);
        if (o.side === 'sell') {
          var back = amt.amount - amt.fee;
          p.money = Math.min(WALLET_MAX, p.money + back);
          var pl = stockRemoveShares(st, o.code, o.n, back);
          st.fee += amt.fee;
          stockNote(st, { at: at, kind: 'fill', code: o.code, side: 'sell', n: o.n, price: o.price, pl: pl });
          stockLog(p.lineId, o.code, 'sell', o.n, o.price, amt, pl, 'order', p.money);
        } else {
          p.money = Math.min(WALLET_MAX, p.money + o.reserve - amt.amount - amt.fee);
          stockAddShares(st, o.code, o.n, amt.amount + amt.fee, at);
          st.fee += amt.fee;
          stockNote(st, { at: at, kind: 'fill', code: o.code, side: 'buy', n: o.n, price: o.price });
          stockLog(p.lineId, o.code, 'buy', o.n, o.price, amt, 0, 'order', p.money);
        }
        changed = true;
        return false;
      });
    });
    if (changed) stockSave(p);
  }
}

function stockView(st, quote, nowMs) {
  var price = {};
  quote.stocks.forEach(function (s) { price[s.code] = s; });
  var hold = Object.keys(st.h).map(function (code) {
    var h = st.h[code], q = price[code] || { price: 0 }, locked = stockLocked(h, nowMs), queued = stockQueued(st, code, 'sell');
    return { code: code, n: h.n, cost: h.cost, avg: h.n ? Math.round(h.cost / h.n * 100) / 100 : 0, value: Math.round(q.price * h.n),
      locked: locked, until: locked ? h.until : 0, queued: queued, sellable: Math.max(0, h.n - locked - queued) };
  });
  return { hold: hold, orders: st.o.map(function (o) { return { id: o.id, code: o.code, side: o.side, n: o.n, price: o.price, at: o.at }; }),
    pl: st.pl, fee: st.fee, notes: st.notes, cost: stockCostAll(st) };
}

function stockGuard(input) {
  var lineId = sessionUser(input.session);
  if (!lineId) return { error: { result: 'unauthorized' } };
  var cache = CacheService.getScriptCache();
  var key = 'stockops:' + lineId + ':' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var n = Number(cache.get(key) || 0);
  if (n >= STOCK_OPS_PER_HOUR) return { error: { result: 'error', error: '這小時進出號子太多次了，晚點再來' } };
  cache.put(key, String(n + 1), 3600);
  var p = findPlayer(lineId);
  if (!p) return { error: { result: 'unauthorized' } };
  return { lineId: lineId, p: p };
}

function stockReply(p, nowMs, extra) {
  var quote = stockQuoteData(nowMs);
  var out = { result: 'success', quote: quote, mine: stockView(p.stock, quote, nowMs), wallet: walletView(p) };
  Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
  return out;
}

// 我的持股（要登入）。只是讀不排隊（2026-11-18：以前整個排隊，21:00 晚報一出大家同時開會塞住）；
// 要補價格、寫晚報 stockEnsure 自己排隊；有通知要清（看過就清掉）才排隊，排進去重讀一次再清
function stockMine(input) {
  var g = stockGuard(input);
  if (g.error) return g.error;
  var now = stockNow().getTime();
  stockEnsure(now, false);
  var p = findPlayer(g.lineId);
  if (!p) return { result: 'unauthorized' };
  p = stockLoad(p);
  var out = stockReply(p, now), seen = p.stock.notes.length;
  if (seen) withLock(function () {
    var q = stockLoad(findPlayer(g.lineId));
    q.stock.notes = q.stock.notes.slice(seen);   // 排隊時剛好有新的通知（成交、取消）留著，下次再給
    stockSave(q);
  });
  return out;
}

// 買賣：{ code, side: 'buy'|'sell', n, slot 網頁看到的是第幾格 }。漲停買、跌停賣變成排隊的委託
function stockTrade(input) {
  var g = stockGuard(input);
  if (g.error) return g.error;
  var now = stockNow().getTime();
  stockEnsure(now, true);
  var p = stockLoad(findPlayer(g.lineId)), st = p.stock;
  var code = String(input.code || ''), side = String(input.side || ''), n = cleanMoney(input.n, 1, 1000000);
  var s = STOCKS.filter(function (x) { return x.code === code; })[0];
  if (!s) return { result: 'error', error: '沒有這檔股票' };
  if (side !== 'buy' && side !== 'sell') return { result: 'error', error: '要買還是要賣？' };
  if (n === null) return { result: 'error', error: '股數要是 1 以上的整數' };
  var quote = stockQuoteData(now), q = quote.stocks.filter(function (x) { return x.code === code; })[0];
  if (Number(input.slot) !== quote.slot) return stockReply(p, now, { result: 'moved', error: '價格剛跳了，再看一次' });
  var amt = stockAmount(q.price, n);
  if (side === 'buy') {
    var held = st.h[code] ? st.h[code].cost : 0;
    var reservedOne = st.o.filter(function (o) { return o.code === code && o.side === 'buy'; }).reduce(function (t, o) { return t + o.reserve; }, 0);
    if (held + reservedOne + amt.amount + amt.fee > STOCK_CAP_ONE) return { result: 'error', error: '一檔最多買 $' + STOCK_CAP_ONE.toLocaleString() + '（照成本算）' };
    if (stockCostAll(st) + amt.amount + amt.fee > STOCK_CAP_ALL) return { result: 'error', error: '全部持股最多 $' + STOCK_CAP_ALL.toLocaleString() + '，先賣一些' };
    if (p.money < amt.amount + amt.fee) return { result: 'error', error: '錢包不夠' };
    p.money -= amt.amount + amt.fee;
    if (q.state === 'up') {
      var id = 'O' + Utilities.getUuid().replace(/-/g, '').slice(0, 7).toUpperCase();
      st.o.push({ id: id, code: code, side: 'buy', n: n, price: q.price, day: stockOrderDay(quote.slot), at: now, reserve: amt.amount + amt.fee });
      stockSave(p);
      return stockReply(p, now, { done: 'queued', side: 'buy', code: code, n: n, price: q.price });
    }
    stockAddShares(st, code, n, amt.amount + amt.fee, now);
    st.fee += amt.fee;
    stockSave(p);
    stockLog(g.lineId, code, 'buy', n, q.price, amt, 0, 'market', p.money);
    return stockReply(p, now, { done: 'filled', side: 'buy', code: code, n: n, price: q.price, amount: amt.amount, fee: amt.fee });
  }
  var h = st.h[code];
  var sellable = h ? h.n - stockLocked(h, now) - stockQueued(st, code, 'sell') : 0;
  if (!h || !h.n) return { result: 'error', error: '你沒有這一檔' };
  if (n > sellable) return { result: 'error', error: sellable > 0 ? '現在最多只能賣 ' + sellable + ' 股' : '今天買的要等明天 9:00 開盤後才能賣' };
  if (q.state === 'down') {
    var oid = 'O' + Utilities.getUuid().replace(/-/g, '').slice(0, 7).toUpperCase();
    st.o.push({ id: oid, code: code, side: 'sell', n: n, price: q.price, day: stockOrderDay(quote.slot), at: now, reserve: 0 });
    stockSave(p);
    return stockReply(p, now, { done: 'queued', side: 'sell', code: code, n: n, price: q.price });
  }
  var back = amt.amount - amt.fee;
  p.money = Math.min(WALLET_MAX, p.money + back);
  var pl = stockRemoveShares(st, code, n, back);
  st.fee += amt.fee;
  stockSave(p);
  stockLog(g.lineId, code, 'sell', n, q.price, amt, pl, 'market', p.money);
  return stockReply(p, now, { done: 'filled', side: 'sell', code: code, n: n, price: q.price, amount: amt.amount, fee: amt.fee, pl: pl });
}

// 取消委託：買單把預留的錢還回去
function stockCancel(input) {
  var g = stockGuard(input);
  if (g.error) return g.error;
  var now = stockNow().getTime();
  stockEnsure(now, true);
  var p = stockLoad(findPlayer(g.lineId)), st = p.stock, id = String(input.id || '');
  var o = st.o.filter(function (x) { return x.id === id; })[0];
  if (!o) return stockReply(p, now, { result: 'error', error: '這張委託已經成交或取消了' });
  st.o = st.o.filter(function (x) { return x.id !== id; });
  if (o.side === 'buy') p.money = Math.min(WALLET_MAX, p.money + o.reserve);
  stockSave(p);
  return stockReply(p, now, { done: 'cancelled', side: o.side, code: o.code, n: o.n });
}

// 在編輯器選這個按「執行」：建好 Prices（含 30 天的歷史）、News、NewsLines、Trades 分頁
function setupStocks() {
  stockSeed();
  newsLinesSheet(); tradesSheet();
  var now = stockNow().getTime();
  var made = withLock(function () { var m = stockSync(now); var have = stockReadNews(); stockMakeNews(stockNewsDay(now), have); stockMakeNews(stockSlotDay(stockSlotAt(now)), have); return m; });
  var n = newsLinesSheet().getLastRow() - 1;
  Logger.log('股市開張了：Prices 補了 ' + (made.length || 0) + ' 格。NewsLines 有 ' + Math.max(0, n) + ' 句' + (n > 0 ? '' : '（是空的，晚報先用程式裡的幾句備用，記得匯入句庫）') + '。');
}


// --- 運彩・押（yuncai.html）：TPVL 排球，彩池分錢 ---
// 只押誰贏（win：home／away）和局數比分（score：3:0、3:1、3:2、2:3、1:3、0:3），每一種各自一個彩池。
// 彩池：押中的人照押的比例分「整個彩池」；二十七樓運彩在每個選項先放 SPORT_SEED（保底，讓一個人玩也有得賺），
// 保底那份押中了就消失（運彩不抽成）。開賽就不能押。比完自動派彩，錢直接加進 Players 的錢包（不算 earned、押的不算 spent，跟股市一樣）。
// 賽程存在 SportMatches 分頁，不用每次都去爬官網：一天爬一次賽程；有比賽開打兩小時後還沒結果，才每 15 分鐘去看一次比分。
// 比賽都在週末，平常幾乎不會去爬。官網改版爬不到的時候，可以在編輯器用 sportSetResult()／sportVoid() 手動開獎、退錢。
var SPORT_SEED = 10000;
var SPORT_MIN = 100, SPORT_MAX = 50000, SPORT_MATCH_MAX = 200000;
var SPORT_OPS_PER_HOUR = 300;
var SPORT_PICKS = { win: ['home', 'away'], score: ['3:0', '3:1', '3:2', '2:3', '1:3', '0:3'] };
var SPORT_FULL_MS = 24 * 3600000;       // 賽程多久重爬一次
var SPORT_RESULT_MS = 15 * 60000;       // 等比分的時候多久去看一次
var SPORT_AFTER_MS = 2 * 3600000;       // 開賽多久以後開始等比分
var SPORT_VOID_MS = 3 * 24 * 3600000;   // 開賽三天還沒結果就退錢
var SPORT_SHOW_PAST_MS = 7 * 24 * 3600000, SPORT_SHOW_NEXT_MS = 21 * 24 * 3600000;
var SPORT_TPVL = 'https://tpvl.tw';
var SPORT_TEAMS = {
  'taichung-winstreak': '臺中連莊', 'tsg-skyhawks': '台鋼天鷹', 'taipei-east-power': '臺北伊斯特',
  'taoyuan-leopards': '桃園雲豹飛將', 'hsinchu-collie-engineers': '新竹可利工程師'
};
var SPORT_STATUS = { final: 'COMPLETED', completed: 'COMPLETED', scheduled: 'SCHEDULED', postponed: 'POSTPONED', live: 'LIVE', in_progress: 'LIVE', cancelled: 'CANCELLED', canceled: 'CANCELLED' };
var SPORT_MATCH_HEADERS = ['id', 'no', 'date', 'time', 'start', 'venue', 'home', 'away', 'status', 'home_sets', 'away_sets', 'updated', 'manual'];
var SPORT_BET_HEADERS = ['timestamp', 'id', 'line_id', 'match', 'kind', 'pick', 'amount', 'status', 'payout', 'settled', 'result'];

function sportNow() { return new Date(); }
// 一週是週一到週日（台灣時間），只能押這週的比賽；下週以後的只列賽程、不能押、不算倍數
function sportWeekEnd(now) {
  var d = new Date(now + 8 * 3600000), dow = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow + 7) - 8 * 3600000;
}
function sportOpen(m, now) { return m.status === 'SCHEDULED' && now < m.start && m.start < sportWeekEnd(now); }
function sportSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(name);
  if (!sheet) { sheet = ss.insertSheet(name); sheet.appendRow(headers); sheet.setFrozenRows(1); }
  return sheet;
}
function sportMatchesSheet() { return sportSheet('SportMatches', SPORT_MATCH_HEADERS); }
function sportBetsSheet() { return sportSheet('Bets', SPORT_BET_HEADERS); }

// 官網的資料藏在 self.__next_f.push([1,"..."])（Next.js 的 RSC payload），每場比賽標了 "data-field":"x","data-value":"y"
// （跟 LINE bot 的排球指令同一套解析，參考 github.com/ichendong/tpvl-skill，MIT）
function sportFetchTpvl() {
  var res = UrlFetchApp.fetch(SPORT_TPVL + '/matches', { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DongBuLi)', 'Accept-Language': 'zh-TW,zh;q=0.9' } });
  if (res.getResponseCode() !== 200) throw new Error('TPVL /matches ' + res.getResponseCode());
  var html = res.getContentText(), parts = [], re = /self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g, m;
  while ((m = re.exec(html))) { try { var arr = JSON.parse(m[1]); if (Array.isArray(arr) && typeof arr[1] === 'string') parts.push(arr[1]); } catch (e) { } }
  var payload = parts.join('');
  if (!payload) throw new Error('TPVL 沒有 flight payload（官網可能改版了）');
  // "$L<id>" 是延後載入的區塊，展開兩層
  var marks = [], dre = /(?:^|\n)([0-9a-f]+):/g, d;
  while ((d = dre.exec(payload))) marks.push([d.index, d[1]]);
  var defs = {};
  for (var i = 0; i < marks.length; i++) {
    var text = payload.slice(marks[i][0], i + 1 < marks.length ? marks[i + 1][0] : payload.length).replace(/^\n/, '');
    defs[marks[i][1]] = text.slice(text.indexOf(':') + 1);
  }
  var resolve = function (t) { for (var k = 0; k < 2; k++) { var n = t.replace(/"\$L([0-9a-f]+)"/g, function (all, id) { return defs[id] !== undefined ? defs[id] : all; }); if (n === t) break; t = n; } return t; };
  var marker = 'className":"tp-mrow"', idx = [], pos = payload.indexOf(marker);
  while (pos !== -1) { idx.push(pos); pos = payload.indexOf(marker, pos + marker.length); }
  var out = [], seen = {};
  idx.forEach(function (start, j) {
    var seg = resolve(payload.slice(start, Math.min(j + 1 < idx.length ? idx[j + 1] : payload.length, start + 8000)));
    var f = {}, fre = /"data-field":"([a-z_0-9]+)","data-value":"([^"]*)"/g, x;
    while ((x = fre.exec(seg))) if (!(x[1] in f)) f[x[1]] = x[2];
    var team = function (slug) {
      if (SPORT_TEAMS[slug]) return SPORT_TEAMS[slug];
      var t = seg.match(new RegExp('href":"/teams/' + String(slug).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '","children":"([^"]+)"'));
      return t ? t[1] : String(slug || '');
    };
    var when = sportWhen(f.start_time), status = SPORT_STATUS[f.status] || String(f.status || '').toUpperCase() || 'UNKNOWN';
    var done = status === 'COMPLETED', hs = parseInt(f.home_sets, 10), as = parseInt(f.away_sets, 10);
    var venue = (seg.match(/"data-field":"venue"[\s\S]*?"children":"([^"]+)"/) || [])[1] || f.venue || '';
    var id = String(f.league_match_id || '') || (f.match_no ? f.match_no + '-' + when.date : '');
    if (!id || !when.date || !f.home_team || seen[id]) return;
    seen[id] = true;
    out.push({ id: id.slice(0, 40), no: String(f.match_no || '').slice(0, 10), date: when.date, time: when.time, venue: String(venue).slice(0, 40),
      home: team(f.home_team).slice(0, 20), away: team(f.away_team).slice(0, 20), status: status,
      homeSets: done && !isNaN(hs) ? hs : null, awaySets: done && !isNaN(as) ? as : null });
  });
  if (!out.length) throw new Error('TPVL /matches 解析不到比賽（官網可能改版了）');
  return out;
}
// 有帶時區就換成台灣時間，沒帶當台灣時間
function sportWhen(start) {
  start = String(start || '');
  if (!start) return { date: '', time: '' };
  if (/(Z|[+-]\d\d:?\d\d)$/.test(start) && !/\+08:?00$/.test(start)) {
    var d = new Date(start);
    if (!isNaN(d)) { var tw = new Date(d.getTime() + 8 * 3600000).toISOString(); return { date: tw.slice(0, 10), time: tw.slice(11, 16) }; }
  }
  return { date: start.slice(0, 10), time: start.length > 11 ? start.slice(11, 16) : '' };
}
function sportStartMs(date, time) {
  var t = Date.parse(date + 'T' + (/^\d\d:\d\d$/.test(time || '') ? time : '00:00') + ':00+08:00');
  return isNaN(t) ? 0 : t;
}

// 讀分頁很慢（一次幾百毫秒），賽程和注都先放 CacheService：一個版本號 sportver，寫入 SportMatches／Bets 就換版本號（sportBump），舊的自然不用
// 會照 row 寫回分頁的地方（併賽程、派彩、手動開獎、清注）一律 fresh 讀分頁，不用快取
function sportVer() {
  var c = CacheService.getScriptCache(), v = c.get('sportver');
  if (!v) { v = String(Date.now()); c.put('sportver', v, 21600); }
  return v;
}
function sportBump() { CacheService.getScriptCache().put('sportver', Utilities.getUuid().slice(0, 8), 21600); }
function sportCached(name, fresh, read) {
  if (fresh) return read();
  var c = CacheService.getScriptCache(), key = 'sport' + name + ':' + sportVer(), hit = c.get(key);
  if (hit) { try { return JSON.parse(hit); } catch (e) { } }
  var v = read(), str = JSON.stringify(v);
  if (str.length < 95000) c.put(key, str, 21600);   // 一格最多 100KB，太大就每次讀分頁
  return v;
}
function sportReadMatches(fresh) { return sportCached('m', fresh, sportReadMatchesSheet); }
function sportReadBets(fresh) { return sportCached('b', fresh, sportReadBetsSheet); }
function sportReadMatchesSheet() {
  var rows = sportMatchesSheet().getDataRange().getValues(), out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    var dateStr = r[2] instanceof Date ? Utilities.formatDate(r[2], 'Asia/Taipei', 'yyyy-MM-dd') : String(r[2]).replace(/^'/, '');
    out.push({ row: i + 1, id: String(r[0]), no: String(r[1] || ''), date: dateStr, time: String(r[3] || '').replace(/^'/, ''), start: Number(r[4]) || 0,
      venue: String(r[5] || ''), home: String(r[6] || ''), away: String(r[7] || ''), status: String(r[8] || ''),
      homeSets: r[9] === '' || r[9] == null ? null : Number(r[9]), awaySets: r[10] === '' || r[10] == null ? null : Number(r[10]), manual: !!r[12] });
  }
  return out;
}
// 爬到的賽程併進 SportMatches：新的加一列，舊的更新（手動開獎過的不動）
function sportUpsert(list, now) {
  var sheet = sportMatchesSheet(), have = {};
  sportReadMatches(true).forEach(function (m) { have[m.id] = m; });
  list.forEach(function (m) {
    var start = sportStartMs(m.date, m.time);
    var row = [m.id, m.no, "'" + m.date, "'" + (m.time || ''), start, m.venue, m.home, m.away, m.status, m.homeSets == null ? '' : m.homeSets, m.awaySets == null ? '' : m.awaySets, new Date(now)];
    var old = have[m.id];
    if (!old) { sheet.appendRow(row.concat([''])); return; }
    if (old.manual) return;
    sheet.getRange(old.row, 1, 1, row.length).setValues([row]);
  });
  sportBump();
}
// 要不要去爬：一天一次賽程；有比賽開打兩小時以後還沒結果，每 15 分鐘看一次
function sportNeedFetch(matches, now) {
  var props = PropertiesService.getScriptProperties();
  var full = Number(props.getProperty('sportFullAt') || 0), tried = Number(props.getProperty('sportTriedAt') || 0);
  if (now - tried < SPORT_RESULT_MS) return false;
  if (now - full > SPORT_FULL_MS) return true;
  return matches.some(function (m) { return sportWaiting(m, now); });
}
function sportWaiting(m, now) {
  return !m.manual && (m.status === 'SCHEDULED' || m.status === 'LIVE' || m.status === 'UNKNOWN') && m.start && now > m.start + SPORT_AFTER_MS && now < m.start + SPORT_VOID_MS;
}
// 讀賽程（要爬就爬一次、有比完的就派彩）。force 是編輯器手動更新用的；locked 是已經在排隊裡（不要再排一次）
function sportSync(now, force, locked) {
  var matches = sportReadMatches();
  if (force || sportNeedFetch(matches, now)) {
    var work = function () {
      var props = PropertiesService.getScriptProperties();
      if (!force && !sportNeedFetch(sportReadMatches(true), now)) return;  // 排隊的時候別人剛爬過
      props.setProperty('sportTriedAt', String(now));
      try {
        sportUpsert(sportFetchTpvl(), now);
        props.setProperty('sportFullAt', String(now));
        props.deleteProperty('sportError');
      } catch (e) {
        props.setProperty('sportError', String(e && e.message || e).slice(0, 200));
        console.warn('運動・押爬賽程失敗：' + e);
      }
    };
    if (locked) work(); else withLock(work);
    matches = sportReadMatches();
  }
  if (sportSettle(matches, now, locked)) sportBump();
  return matches;
}

// 這場比完了嗎：{ win: 'home'|'away', score: '3:1' } 或 'void'（延賽、取消、三天沒結果）或 null（還沒）
function sportOutcome(m, now) {
  if (m.status === 'VOID' || m.status === 'POSTPONED' || m.status === 'CANCELLED') return 'void';
  var h = m.homeSets, a = m.awaySets;
  if (m.status === 'COMPLETED' && h != null && a != null && ((h === 3 && a >= 0 && a <= 2) || (a === 3 && h >= 0 && h <= 2))) {
    return { win: h > a ? 'home' : 'away', score: h + ':' + a };
  }
  if (m.start && now > m.start + SPORT_VOID_MS) return 'void';
  return null;
}
function sportReadBetsSheet() {
  var rows = sportBetsSheet().getDataRange().getValues(), out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1]) continue;
    out.push({ row: i + 1, at: r[0] instanceof Date ? r[0].getTime() : Number(new Date(r[0])) || 0, id: String(r[1]), lineId: String(r[2]), match: String(r[3]),
      kind: String(r[4]), pick: String(r[5]).replace(/^'/, ''), amount: Number(r[6]) || 0, status: String(r[7] || 'open'), payout: Number(r[8]) || 0,
      settled: r[9] instanceof Date ? r[9].getTime() : 0, result: String(r[10] || '').replace(/^'/, '') });
  }
  return out;
}
// 每一場、每一種的彩池：{ matchId: { win: { home: 押了多少, away: … }, score: {…} } }（不含保底）
function sportPools(bets) {
  var pools = {};
  bets.forEach(function (b) {
    if (b.status === 'refund' || !SPORT_PICKS[b.kind]) return;
    var p = pools[b.match] || (pools[b.match] = { win: {}, score: {} });
    p[b.kind][b.pick] = (p[b.kind][b.pick] || 0) + b.amount;
  });
  return pools;
}
// 派彩：比完的場次，還沒結算的注全部算掉；押中的照比例分整個彩池（含保底），零頭捨去
function sportSettle(matches, now, locked) {
  var byId = {}, ready = {};
  matches.forEach(function (m) { byId[m.id] = m; });
  var bets = sportReadBets(), open = bets.filter(function (b) { return b.status === 'open'; });
  open.forEach(function (b) { if (!(b.match in ready)) ready[b.match] = byId[b.match] ? sportOutcome(byId[b.match], now) : null; });
  if (!open.some(function (b) { return ready[b.match]; })) return 0;
  var work = function () {
    bets = sportReadBets(true);
    var pools = sportPools(bets), credit = {}, sheet = sportBetsSheet(), stamp = new Date(now), n = 0;
    bets.forEach(function (b) {
      var o = ready[b.match];
      if (b.status !== 'open' || !o) return;
      var status, payout = 0, result = '';
      if (o === 'void') { status = 'refund'; payout = b.amount; result = 'void'; }
      else {
        result = o.score;
        var want = b.kind === 'win' ? o.win : o.score, pool = pools[b.match][b.kind], opts = SPORT_PICKS[b.kind];
        var total = opts.reduce(function (t, k) { return t + (pool[k] || 0) + SPORT_SEED; }, 0), on = (pool[want] || 0) + SPORT_SEED;
        if (b.pick === want) { status = 'won'; payout = Math.floor(b.amount * total / on); } else status = 'lost';
      }
      sheet.getRange(b.row, 8, 1, 4).setValues([[status, payout, stamp, "'" + result]]);
      if (payout) credit[b.lineId] = (credit[b.lineId] || 0) + payout;
      n++;
    });
    Object.keys(credit).forEach(function (id) {
      var p = findPlayer(id);
      if (!p) return;
      p.money = Math.min(WALLET_MAX, p.money + credit[id]);
      playersSheet().getRange(p.row, 5).setValue(p.money);
    });
    if (n) sportBump();
    return n;
  };
  var r = locked ? work() : withLock(work);
  return typeof r === 'number' ? r : 0;
}

function sportOdds(pool, kind) {
  var opts = SPORT_PICKS[kind], total = opts.reduce(function (t, k) { return t + (pool[k] || 0) + SPORT_SEED; }, 0), out = {};
  opts.forEach(function (k) { out[k] = { pool: pool[k] || 0, odds: Math.floor(total / ((pool[k] || 0) + SPORT_SEED) * 100) / 100 }; });
  return { total: total - SPORT_SEED * opts.length, opts: out };
}
function sportQuoteData(matches, bets, now) {
  var pools = sportPools(bets), props = PropertiesService.getScriptProperties();
  var list = matches.filter(function (m) { return m.start && m.start > now - SPORT_SHOW_PAST_MS && m.start < now + SPORT_SHOW_NEXT_MS; })
    .sort(function (a, b) { return a.start - b.start; })
    .map(function (m) {
      var p = pools[m.id] || { win: {}, score: {} }, o = sportOutcome(m, now);
      return { id: m.id, no: m.no, date: m.date, time: m.time, start: m.start, venue: m.venue, home: m.home, away: m.away, status: m.status,
        homeSets: m.homeSets, awaySets: m.awaySets, open: sportOpen(m, now), later: m.start >= sportWeekEnd(now),
        result: o === 'void' ? 'void' : o ? o.score : null, win: sportOdds(p.win, 'win'), score: sportOdds(p.score, 'score') };
    });
  return { now: now, weekEnd: sportWeekEnd(now), matches: list, fetchedAt: Number(props.getProperty('sportFullAt') || 0), error: props.getProperty('sportError') || '',
    rules: { seed: SPORT_SEED, min: SPORT_MIN, max: SPORT_MAX, matchMax: SPORT_MATCH_MAX, picks: SPORT_PICKS } };
}
// 行情（公開）
function sportQuote() {
  var now = sportNow().getTime(), matches = sportSync(now, false);
  var out = sportQuoteData(matches, sportReadBets(), now);   // 沒有變動的話兩個都是快取
  out.result = 'success';
  return out;
}
function sportGuard(input) {
  var lineId = sessionUser(input.session);
  if (!lineId) return { error: { result: 'unauthorized' } };
  var cache = CacheService.getScriptCache(), key = 'sportops:' + lineId + ':' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var n = Number(cache.get(key) || 0);
  if (n >= SPORT_OPS_PER_HOUR) return { error: { result: 'error', error: '這小時看太多次了，晚點再來' } };
  cache.put(key, String(n + 1), 3600);
  return { lineId: lineId };
}
function sportReply(lineId, now, matches, extra) {
  var bets = sportReadBets(), p = findPlayer(lineId);
  if (!p) return { result: 'unauthorized' };
  var mine = bets.filter(function (b) { return b.lineId === lineId; });
  var out = { result: 'success', quote: sportQuoteData(matches, bets, now), wallet: walletView(p),
    mine: { bets: mine.slice(-60).reverse().map(function (b) { return { id: b.id, match: b.match, kind: b.kind, pick: b.pick, amount: b.amount, status: b.status, payout: b.payout, at: b.at, settled: b.settled, result: b.result }; }),
      staked: mine.reduce(function (t, b) { return t + (b.status === 'refund' ? 0 : b.amount); }, 0),
      paid: mine.reduce(function (t, b) { return t + (b.status === 'won' ? b.payout : 0); }, 0) } };
  Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
  return out;
}
// 我的彩票（要登入、排隊；順便派彩）
function sportMine(input) {
  var g = sportGuard(input);
  if (g.error) return g.error;
  var now = sportNow().getTime();
  return sportReply(g.lineId, now, sportSync(now, false, false));   // 只是讀：不排隊（要爬賽程、要派彩的時候 sportSync 自己排隊）
}
// 下注（要登入、排隊）：{ match, kind: 'win'|'score', pick, amount }
function sportBet(input) {
  var g = sportGuard(input);
  if (g.error) return g.error;
  var now = sportNow().getTime(), matches = sportSync(now, false, true);
  var m = matches.filter(function (x) { return x.id === String(input.match || ''); })[0];
  var kind = String(input.kind || ''), pick = String(input.pick || ''), amount = cleanMoney(input.amount, SPORT_MIN, SPORT_MAX);
  if (!m) return { result: 'error', error: '找不到這場比賽' };
  if (m.status === 'SCHEDULED' && now < m.start && m.start >= sportWeekEnd(now)) return { result: 'error', error: '這場是下週以後的，週一開放才能押' };
  if (!sportOpen(m, now)) return { result: 'error', error: '這場已經開打，不能押了' };
  if (!SPORT_PICKS[kind] || SPORT_PICKS[kind].indexOf(pick) < 0) return { result: 'error', error: '沒有這個選項' };
  if (amount === null) return { result: 'error', error: '一注要 $' + SPORT_MIN + '～$' + SPORT_MAX.toLocaleString() + ' 的整數' };
  var p = findPlayer(g.lineId);
  if (!p) return { result: 'unauthorized' };
  var already = sportReadBets(true).filter(function (b) { return b.lineId === g.lineId && b.match === m.id && b.status !== 'refund'; }).reduce(function (t, b) { return t + b.amount; }, 0);
  if (already + amount > SPORT_MATCH_MAX) return { result: 'error', error: '一場最多押 $' + SPORT_MATCH_MAX.toLocaleString() + '（這場已經押了 $' + already.toLocaleString() + '）' };
  if (p.money < amount) return { result: 'error', error: '錢包不夠' };
  p.money -= amount;
  playersSheet().getRange(p.row, 5).setValue(p.money);
  var id = 'B' + Utilities.getUuid().replace(/-/g, '').slice(0, 7).toUpperCase();
  sportBetsSheet().appendRow([new Date(now), id, g.lineId, m.id, kind, "'" + pick, amount, 'open', 0, '', '']);
  sportBump();
  return sportReply(g.lineId, now, matches, { done: id });
}

// 在編輯器選這個按「執行」：先把 SportMatches、Bets 分頁建好，爬一次賽程
function setupSport() {
  sportBetsSheet();
  var now = Date.now(), list = withLock(function () { return sportSync(now, true, true); });
  var err = PropertiesService.getScriptProperties().getProperty('sportError');
  Logger.log(err ? '爬賽程失敗：' + err : '運動・押開張：SportMatches 有 ' + (list.length || 0) + ' 場。網頁要能用，還要「部署 → 管理部署作業 → 編輯 → 新版本」。');
}
// 官網爬不到比分的時候手動開獎：sportSetResult('17013', 3, 1)（主隊 3、客隊 1），比賽 id 看 SportMatches 的 A 欄
function sportSetResult(id, homeSets, awaySets) {
  var m = sportReadMatches(true).filter(function (x) { return x.id === String(id); })[0];
  if (!m) { Logger.log('找不到 ' + id); return; }
  sportMatchesSheet().getRange(m.row, 9, 1, 5).setValues([['COMPLETED', homeSets, awaySets, new Date(), 'manual']]);
  sportBump();
  var n = sportSettle(sportReadMatches(true), Date.now());
  Logger.log(m.home + ' ' + homeSets + ':' + awaySets + ' ' + m.away + '，結算了 ' + n + ' 注。');
}
// 清掉測試的注：還沒開獎的把押的錢退回錢包，然後把 Bets 分頁除了標題全部刪掉（已經開獎派過的錢不收回）。
// 在編輯器選這個按「執行」就好，不用重新部署。正式開放以後不要再跑（會把大家的注一起清掉）。
function sportClearBets() {
  var out = withLock(function () {
    var bets = sportReadBets(true), refund = {}, n = 0;
    bets.forEach(function (b) { if (b.status === 'open') { refund[b.lineId] = (refund[b.lineId] || 0) + b.amount; n++; } });
    Object.keys(refund).forEach(function (id) {
      var p = findPlayer(id);
      if (!p) return;
      p.money = Math.min(WALLET_MAX, p.money + refund[id]);
      playersSheet().getRange(p.row, 5).setValue(p.money);
    });
    var sheet = sportBetsSheet(), last = sheet.getLastRow();
    if (last > 1) sheet.deleteRows(2, last - 1);
    sportBump();
    return { all: bets.length, open: n, money: Object.keys(refund).reduce(function (t, k) { return t + refund[k]; }, 0) };
  });
  if (out.result) { Logger.log(out.error); return; }
  Logger.log('清掉 ' + out.all + ' 注，其中 ' + out.open + ' 注還沒開獎，退回 $' + out.money.toLocaleString() + '。');
}

// 這場不算了，全部退錢：sportVoid('17013')
function sportVoid(id) {
  var m = sportReadMatches(true).filter(function (x) { return x.id === String(id); })[0];
  if (!m) { Logger.log('找不到 ' + id); return; }
  sportMatchesSheet().getRange(m.row, 9, 1, 5).setValues([['VOID', '', '', new Date(), 'manual']]);
  sportBump();
  var n = sportSettle(sportReadMatches(true), Date.now());
  Logger.log(m.home + ' vs ' + m.away + ' 不算了，退了 ' + n + ' 注。');
}


// --- 菜園・拔：每一輪的收成 ---
// 跟洗頭、打掃紀錄一樣：拔完網頁送上來，一列一輪，存在 Farms 分頁。不寄信、不回資料。

var FARM_HEADERS = ['timestamp', 'at', 'line_id', 'device', 'total', 'sales', 'bonus', 'grade',
  'small', 'mid', 'big', 'giant', 'heart', 'snapped', 'bent', 'sweet', 'ticket', 'mole', 'wiggles', 'helpers', 'ms', 'login', 'mole_free', 'len', 'shop', 'stall'];

function farmsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Farms');
  if (!sheet) {
    sheet = ss.insertSheet('Farms');
    sheet.appendRow(FARM_HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < FARM_HEADERS.length) {
    // 舊分頁後來加了欄位（W mole_free）：把標題補上
    sheet.getRange(1, 1, 1, FARM_HEADERS.length).setValues([FARM_HEADERS]);
  }
  return sheet;
}

function farmRow(r, now, lineId, device) {
  if (!r || typeof r !== 'object') return null;
  var at = new Date(r.at);
  if (isNaN(at.getTime()) || at.getTime() > now.getTime() + 86400000 || at.getTime() < now.getTime() - 90 * 86400000) return null;
  var n = function (v) { return washNum(v, 0, 999); };
  var shop = {};
  if (r.shop && typeof r.shop === 'object') Object.keys(r.shop).slice(0, 20).forEach(function (k) { if (/^[a-z]{1,16}$/.test(k)) shop[k] = washNum(r.shop[k], 0, 10); });
  return [
    now, at, lineId || '', device,
    washNum(r.total, 0, 100000), washNum(r.sales, -10000, 100000), washNum(r.bonus, 0, 10000), washText(r.grade, 2),
    n(r.small), n(r.mid), n(r.big), n(r.giant), n(r.heart), n(r.snapped), n(r.bent), n(r.sweet), n(r.ticket), n(r.mole),
    washNum(r.wiggles, 0, 100000), washNum(r.helpers, 0, 10), washNum(r.ms, 0, 3600000), !!r.login, n(r.mole_free),
    washNum(r.len, 0, 3600), JSON.stringify(shop), washNum(r.stall, 0, 100000)
  ];
}

// 在編輯器選這個按「執行」：先把 Farms 分頁建出來
function setupFarms() {
  var sheet = farmsSheet();
  Logger.log('Farms 分頁好了，目前有 ' + (sheet.getLastRow() - 1) + ' 輪。網頁要能存，還要「部署 → 管理部署作業 → 編輯 → 版本選新版本 → 部署」。');
}

function farmLog(input) {
  var device = String(input.device || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (device.length < 8) return { result: 'error', error: '沒有裝置代號' };
  var recs = Array.isArray(input.recs) ? input.recs.slice(0, 20) : [];
  if (!recs.length) return { result: 'success', saved: 0 };

  var cache = CacheService.getScriptCache();
  var hour = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var allKey = 'farmRows' + ':' + hour, gate = logGate('farm', device, hour);
  var devCount = gate.n, allCount = Number(cache.get(allKey) || 0);
  if (devCount >= FARM_LOGS_PER_HOUR) return { result: 'error', error: '這小時送太多次了' };
  if (allCount + recs.length > FARM_ROWS_PER_HOUR) return { result: 'error', error: '這小時全站拔太多輪了' };
  gate.count();

  var lineId = input.session ? sessionUser(input.session) : null;
  var now = new Date(), rows = [], skipped = 0;
  recs.forEach(function (r) {
    var row = farmRow(r, now, lineId, device);
    if (!row) { skipped++; return; }
    if (gate.seen(row[1].getTime())) { skipped++; return; }   // 同一支手機重送的同一輪，不要存兩次
    rows.push(row);
  });
  if (rows.length) {
    var sheet = farmsSheet();
    rows.forEach(function (row) { sheet.appendRow(row); });
    cache.put(allKey, String(allCount + rows.length), 3600);
  }
  gate.save();
  return { result: 'success', saved: rows.length, skipped: skipped };
}


// --- 蹭・網（cengwang.html）：每一輪的紀錄 ---
// 跟菜園紀錄一樣：公開、appendRow 不排隊、不寄信不回資料；session 對就記 line_id。
var WIFI_HEADERS = ['timestamp', 'at', 'line_id', 'device', 'total', 'sales', 'wifi_ms', 'episodes', 'drama', 'strikes',
  'looks', 'dodged', 'fakes', 'connects', 'perfect', 'grade', 'ms', 'login', 'boost_ms', 'max_mult', 'mode', 'season',
  'recovered', 'phones', 'glances', 'routers', 'idle_end', 'shop', 'breads', 'antenna', 'fine', 'rices'];

function wifisSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Wifis');
  if (!sheet) {
    sheet = ss.insertSheet('Wifis');
    sheet.appendRow(WIFI_HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < WIFI_HEADERS.length) {
    // 舊分頁後來加了欄位（U mode、V season，W～AE 無盡模式的細節和道具）：把標題補上
    sheet.getRange(1, 1, 1, WIFI_HEADERS.length).setValues([WIFI_HEADERS]);
  }
  return sheet;
}

function wifiRow(r, now, lineId, device) {
  if (!r || typeof r !== 'object') return null;
  var at = new Date(r.at);
  if (isNaN(at.getTime()) || at.getTime() > now.getTime() + 86400000 || at.getTime() < now.getTime() - 90 * 86400000) return null;
  var n = function (v) { return washNum(v, 0, 999); };
  var shop = {};
  if (r.shop && typeof r.shop === 'object') Object.keys(r.shop).slice(0, 20).forEach(function (k) { if (/^[a-z]{1,16}$/.test(k)) shop[k] = washNum(r.shop[k], 0, 10); });
  return [
    now, at, lineId || '', device,
    washNum(r.total, 0, 100000), washNum(r.sales, -10000, 100000), washNum(r.wifi_ms, 0, 3600000), n(r.episodes), washText(r.drama, 20),
    n(r.strikes), n(r.looks), n(r.dodged), n(r.fakes), n(r.connects), !!r.perfect, washText(r.grade, 2), washNum(r.ms, 0, 3600000), !!r.login,
    washNum(r.boost_ms, 0, 3600000), Math.round(washNum((r.max_mult || 1) * 10, 10, 50)) / 10,
    r.mode === 'endless' ? 'endless' : 'normal', n(r.season),
    n(r.recovered), n(r.phones), n(r.glances), n(r.routers), !!r.idle_end,
    JSON.stringify(shop), n(r.breads), washNum(r.antenna, 0, 100000), washNum(r.fine, -100000, 0), n(r.rices)
  ];
}

// 在編輯器選這個按「執行」：先把 Wifis 分頁建出來
function setupWifis() {
  var sheet = wifisSheet();
  Logger.log('Wifis 分頁好了，目前有 ' + (sheet.getLastRow() - 1) + ' 輪。網頁要能存，還要「部署 → 管理部署作業 → 編輯 → 版本選新版本 → 部署」。');
}

function wifiLog(input) {
  var device = String(input.device || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (device.length < 8) return { result: 'error', error: '沒有裝置代號' };
  var recs = Array.isArray(input.recs) ? input.recs.slice(0, 20) : [];
  if (!recs.length) return { result: 'success', saved: 0 };

  var cache = CacheService.getScriptCache();
  var hour = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var allKey = 'wifiRows' + ':' + hour, gate = logGate('wifi', device, hour);
  var devCount = gate.n, allCount = Number(cache.get(allKey) || 0);
  if (devCount >= WIFI_LOGS_PER_HOUR) return { result: 'error', error: '這小時送太多次了' };
  if (allCount + recs.length > WIFI_ROWS_PER_HOUR) return { result: 'error', error: '這小時全站蹭太多輪了' };
  gate.count();

  var lineId = input.session ? sessionUser(input.session) : null;
  var now = new Date(), rows = [], skipped = 0;
  recs.forEach(function (r) {
    var row = wifiRow(r, now, lineId, device);
    if (!row) { skipped++; return; }
    if (gate.seen(row[1].getTime())) { skipped++; return; }   // 同一支手機重送的同一輪，不要存兩次
    rows.push(row);
  });
  if (rows.length) {
    var sheet = wifisSheet();
    rows.forEach(function (row) { sheet.appendRow(row); });
    cache.put(allKey, String(allCount + rows.length), 3600);
  }
  gate.save();
  return { result: 'success', saved: rows.length, skipped: skipped };
}

// --- 早餐・煎（zaocan.html）：每一輪（開店一天）的紀錄 ---
// 跟蹭網紀錄一樣：公開、appendRow 不排隊、不寄信不回資料；session 對就記 line_id。
// 欄位收齊一點，之後排行榜（最多錢、出餐最多、最快出餐、零氣走…）都從這裡算。
var ZAOCAN_HEADERS = ['timestamp', 'at', 'line_id', 'device', 'total', 'sales', 'grade',
  'customers', 'served', 'angry', 'items', 'tips', 'ito', 'quality', 'burnt', 'spilled', 'wrong', 'trashed',
  'rolls_nice', 'rolls_messy', 'drinks_perfect', 'drinks_short', 'eggs_half', 'eggs_full', 'flips',
  'fastest_ms', 'avg_wait_ms', 'ex', 'ito_wins', 'specials', 'menu', 'shop', 'ms', 'len', 'login'];
var ZAOCAN_MENU = ['egg', 'bacon', 'cake', 'roll', 'noodle', 'milk', 'tea', 'soy'];
var ZAOCAN_SPECIALS = ['duck', 'ito', 'ex', 'dog'];

function zaocansSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Zaocans');
  if (!sheet) {
    sheet = ss.insertSheet('Zaocans');
    sheet.appendRow(ZAOCAN_HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < ZAOCAN_HEADERS.length) {
    sheet.getRange(1, 1, 1, ZAOCAN_HEADERS.length).setValues([ZAOCAN_HEADERS]);
  }
  return sheet;
}

// 只收認得的 key、數字限範圍，存成 JSON（menu：每種賣幾份；shop：之後的升級等級）
function zaocanCounts(obj, keys, max) {
  var out = {};
  if (!obj || typeof obj !== 'object') return '{}';
  keys.forEach(function (k) { var v = washNum(obj[k], 0, max); if (v) out[k] = v; });
  return JSON.stringify(out);
}

function zaocanRow(r, now, lineId, device) {
  if (!r || typeof r !== 'object') return null;
  var at = new Date(r.at);
  if (isNaN(at.getTime()) || at.getTime() > now.getTime() + 86400000 || at.getTime() < now.getTime() - 90 * 86400000) return null;
  var n = function (v) { return washNum(v, 0, 999); };
  var shop = {};
  if (r.shop && typeof r.shop === 'object') Object.keys(r.shop).slice(0, 20).forEach(function (k) { if (/^[a-z]{1,12}$/.test(k)) shop[k] = washNum(r.shop[k], 0, 10); });
  return [
    now, at, lineId || '', device,
    washNum(r.total, 0, 100000), washNum(r.sales, -10000, 100000), washText(r.grade, 2),
    n(r.customers), n(r.served), n(r.angry), n(r.items), washNum(r.tips, 0, 100000), washNum(r.ito, 0, 100000), washNum(r.quality, 0, 100000),
    n(r.burnt), n(r.spilled), n(r.wrong), n(r.trashed),
    n(r.rolls_nice), n(r.rolls_messy), n(r.drinks_perfect), n(r.drinks_short), n(r.eggs_half), n(r.eggs_full), n(r.flips),
    washNum(r.fastest_ms, 0, 600000), washNum(r.avg_wait_ms, 0, 600000), n(r.ex), n(r.ito_wins),
    zaocanCounts(r.specials, ZAOCAN_SPECIALS, 99), zaocanCounts(r.menu, ZAOCAN_MENU, 999), JSON.stringify(shop),
    washNum(r.ms, 0, 3600000), washNum(r.len, 0, 3600), !!r.login
  ];
}

// 在編輯器選這個按「執行」：先把 Zaocans 分頁建出來
function setupZaocans() {
  var sheet = zaocansSheet();
  Logger.log('Zaocans 分頁好了，目前有 ' + (sheet.getLastRow() - 1) + ' 天。網頁要能存，還要「部署 → 管理部署作業 → 編輯 → 版本選新版本 → 部署」。');
}

function zaocanLog(input) {
  var device = String(input.device || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (device.length < 8) return { result: 'error', error: '沒有裝置代號' };
  var recs = Array.isArray(input.recs) ? input.recs.slice(0, 20) : [];
  if (!recs.length) return { result: 'success', saved: 0 };

  var cache = CacheService.getScriptCache();
  var hour = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var allKey = 'zaocanRows' + ':' + hour, gate = logGate('zaocan', device, hour);
  var devCount = gate.n, allCount = Number(cache.get(allKey) || 0);
  if (devCount >= ZAOCAN_LOGS_PER_HOUR) return { result: 'error', error: '這小時送太多次了' };
  if (allCount + recs.length > ZAOCAN_ROWS_PER_HOUR) return { result: 'error', error: '這小時全站開太多次店了' };
  gate.count();

  var lineId = input.session ? sessionUser(input.session) : null;
  var now = new Date(), rows = [], skipped = 0;
  recs.forEach(function (r) {
    var row = zaocanRow(r, now, lineId, device);
    if (!row) { skipped++; return; }
    if (gate.seen(row[1].getTime())) { skipped++; return; }   // 同一支手機重送的同一輪，不要存兩次
    rows.push(row);
  });
  if (rows.length) {
    var sheet = zaocansSheet();
    rows.forEach(function (row) { sheet.appendRow(row); });
    cache.put(allKey, String(allCount + rows.length), 3600);
  }
  gate.save();
  return { result: 'success', saved: rows.length, skipped: skipped };
}

// --- 甜點・轉（tiandian.html）：蘋果鴨甜點店，每一輪的紀錄 ---
// 跟早餐店紀錄一樣：公開、appendRow 不排隊、不寄信不回資料；session 對就記 line_id。
var DESSERT_HEADERS = ['timestamp', 'at', 'line_id', 'device', 'total', 'sales', 'grade',
  'customers', 'served', 'angry', 'scrapped', 'wrong', 'missed', 'tips', 'ito', 'bubbles', 'pauses', 'rewinds', 'staff',
  'fastest_ms', 'avg_wait_ms', 'specials', 'menu', 'shop', 'ms', 'len', 'login', 'ito_wins', 'overlap'];
var DESSERT_MENU = ['cookie', 'cake', 'bread', 'choco', 'cream', 'pudding', 'fruit', 'sprinkle', 'whip', 'sauce', 'berry'];
var DESSERT_SPECIALS = ['duck', 'ito', 'dog'];

function dessertsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Desserts');
  if (!sheet) {
    sheet = ss.insertSheet('Desserts');
    sheet.appendRow(DESSERT_HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < DESSERT_HEADERS.length) {
    sheet.getRange(1, 1, 1, DESSERT_HEADERS.length).setValues([DESSERT_HEADERS]);
  }
  return sheet;
}

function dessertRow(r, now, lineId, device) {
  if (!r || typeof r !== 'object') return null;
  var at = new Date(r.at);
  if (isNaN(at.getTime()) || at.getTime() > now.getTime() + 86400000 || at.getTime() < now.getTime() - 90 * 86400000) return null;
  var n = function (v) { return washNum(v, 0, 999); };
  var shop = {};
  if (r.shop && typeof r.shop === 'object') Object.keys(r.shop).slice(0, 20).forEach(function (k) { if (/^[a-z]{1,16}$/.test(k)) shop[k] = washNum(r.shop[k], 0, 10); });
  return [
    now, at, lineId || '', device,
    washNum(r.total, 0, 100000), washNum(r.sales, -10000, 100000), washText(r.grade, 2),
    n(r.customers), n(r.served), n(r.angry), n(r.scrapped), n(r.wrong), n(r.missed),
    washNum(r.tips, 0, 100000), washNum(r.ito, 0, 100000), n(r.bubbles), n(r.pauses), n(r.rewinds), n(r.staff),
    washNum(r.fastest_ms, 0, 600000), washNum(r.avg_wait_ms, 0, 600000),
    zaocanCounts(r.specials, DESSERT_SPECIALS, 99), zaocanCounts(r.menu, DESSERT_MENU, 999), JSON.stringify(shop),
    washNum(r.ms, 0, 3600000), washNum(r.len, 0, 3600), !!r.login, n(r.ito_wins), n(r.overlap)
  ];
}

// 在編輯器選這個按「執行」：先把 Desserts 分頁建出來
function setupDesserts() {
  var sheet = dessertsSheet();
  Logger.log('Desserts 分頁好了，目前有 ' + (sheet.getLastRow() - 1) + ' 輪。網頁要能存，還要「部署 → 管理部署作業 → 編輯 → 版本選新版本 → 部署」。');
}

function dessertLog(input) {
  var device = String(input.device || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (device.length < 8) return { result: 'error', error: '沒有裝置代號' };
  var recs = Array.isArray(input.recs) ? input.recs.slice(0, 20) : [];
  if (!recs.length) return { result: 'success', saved: 0 };
  var cache = CacheService.getScriptCache();
  var hour = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var allKey = 'dessertRows' + ':' + hour, gate = logGate('dessert', device, hour);
  var devCount = gate.n, allCount = Number(cache.get(allKey) || 0);
  if (devCount >= DESSERT_LOGS_PER_HOUR) return { result: 'error', error: '這小時送太多次了' };
  if (allCount + recs.length > DESSERT_ROWS_PER_HOUR) return { result: 'error', error: '這小時全站開太多次店了' };
  gate.count();
  var lineId = input.session ? sessionUser(input.session) : null;
  var now = new Date(), rows = [], skipped = 0;
  recs.forEach(function (r) {
    var row = dessertRow(r, now, lineId, device);
    if (!row) { skipped++; return; }
    if (gate.seen(row[1].getTime())) { skipped++; return; }   // 同一支手機重送的同一輪，不要存兩次
    rows.push(row);
  });
  if (rows.length) {
    var sheet = dessertsSheet();
    rows.forEach(function (row) { sheet.appendRow(row); });
    cache.put(allKey, String(allCount + rows.length), 3600);
  }
  gate.save();
  return { result: 'success', saved: rows.length, skipped: skipped };
}

// --- 疊・巢（diechao.html）：小吳鴨疊書，每一場的紀錄 ---
// 跟甜點店紀錄一樣：公開、appendRow 不排隊、不寄信不回資料；session 對就記 line_id。
var STACK_HEADERS = ['timestamp', 'at', 'line_id', 'device', 'total', 'layers', 'perfect', 'miss', 'rollback', 'tutor',
  'max_streak', 'min_w', 'stage', 'last', 'stuck', 'ms', 'len', 'login', 'mode'];

function stacksSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Stacks');
  if (!sheet) {
    sheet = ss.insertSheet('Stacks');
    sheet.appendRow(STACK_HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < STACK_HEADERS.length) {
    sheet.getRange(1, 1, 1, STACK_HEADERS.length).setValues([STACK_HEADERS]);
  }
  return sheet;
}

function stackRow(r, now, lineId, device) {
  if (!r || typeof r !== 'object') return null;
  var at = new Date(r.at);
  if (isNaN(at.getTime()) || at.getTime() > now.getTime() + 86400000 || at.getTime() < now.getTime() - 90 * 86400000) return null;
  var n = function (v) { return washNum(v, 0, 999); };
  return [
    now, at, lineId || '', device,
    washNum(r.total, 0, 100000), n(r.layers), n(r.perfect), n(r.miss), n(r.rollback), n(r.tutor),
    n(r.max_streak), washNum(r.min_w, 0, 400), washText(r.stage, 6), washText(r.last, 24), washText(r.stuck, 24),
    washNum(r.ms, 0, 3600000), washNum(r.len, 0, 3600), !!r.login, r.mode === 'endless' ? 'endless' : 'normal'
  ];
}

// 在編輯器選這個按「執行」：先把 Stacks 分頁建出來
function setupStacks() {
  var sheet = stacksSheet();
  Logger.log('Stacks 分頁好了，目前有 ' + (sheet.getLastRow() - 1) + ' 場。網頁要能存，還要「部署 → 管理部署作業 → 編輯 → 版本選新版本 → 部署」。');
}

function stackLog(input) {
  var device = String(input.device || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (device.length < 8) return { result: 'error', error: '沒有裝置代號' };
  var recs = Array.isArray(input.recs) ? input.recs.slice(0, 20) : [];
  if (!recs.length) return { result: 'success', saved: 0 };
  var cache = CacheService.getScriptCache();
  var hour = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var allKey = 'stackRows' + ':' + hour, gate = logGate('stack', device, hour);
  var devCount = gate.n, allCount = Number(cache.get(allKey) || 0);
  if (devCount >= STACK_LOGS_PER_HOUR) return { result: 'error', error: '這小時送太多次了' };
  if (allCount + recs.length > STACK_ROWS_PER_HOUR) return { result: 'error', error: '這小時全站疊太多次了' };
  gate.count();
  var lineId = input.session ? sessionUser(input.session) : null;
  var now = new Date(), rows = [], skipped = 0;
  recs.forEach(function (r) {
    var row = stackRow(r, now, lineId, device);
    if (!row) { skipped++; return; }
    if (gate.seen(row[1].getTime())) { skipped++; return; }   // 同一支手機重送的同一場，不要存兩次
    rows.push(row);
  });
  if (rows.length) {
    var sheet = stacksSheet();
    rows.forEach(function (row) { sheet.appendRow(row); });
    cache.put(allKey, String(allCount + rows.length), 3600);
  }
  gate.save();
  return { result: 'success', saved: rows.length, skipped: skipped };
}

// --- 礦坑・挖（kuangkeng.html）：每一關的紀錄 ---
// 跟疊巢紀錄一樣：公開、appendRow 不排隊、不寄信不回資料；session 對就記 line_id。一關一筆（過關、沒挖夠都記）。
// total 是那關發的工資（真人工資表用），liang 是那關結束時累積的兩（排行榜挖最深用），final 是這關打完破了十關。
var MINE_HEADERS = ['timestamp', 'at', 'line_id', 'device', 'total', 'lv', 'win', 'gain', 'liang', 'target',
  'lost', 'dyn_used', 'dyn_left', 'items', 'buff', 'haul', 'shop', 'ms', 'len', 'final', 'login'];

function minesSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Mines');
  if (!sheet) {
    sheet = ss.insertSheet('Mines');
    sheet.appendRow(MINE_HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < MINE_HEADERS.length) {
    sheet.getRange(1, 1, 1, MINE_HEADERS.length).setValues([MINE_HEADERS]);
  }
  return sheet;
}

var MINE_HAUL = ['gold1', 'gold2', 'gold3', 'gold4', 'nugget', 'rock1', 'rock2', 'diamond', 'cat', 'bag', 'skull', 'bone', 'barrel'];
function mineRow(r, now, lineId, device) {
  if (!r || typeof r !== 'object') return null;
  var at = new Date(r.at);
  if (isNaN(at.getTime()) || at.getTime() > now.getTime() + 86400000 || at.getTime() < now.getTime() - 90 * 86400000) return null;
  var n = function (v) { return washNum(v, 0, 999); };
  var lv = washNum(r.lv, 1, 10), win = !!r.win;
  var shop = {}, haul = {};
  if (r.shop && typeof r.shop === 'object') Object.keys(r.shop).slice(0, 20).forEach(function (k) { if (/^[a-z]{1,16}$/.test(k)) shop[k] = washNum(r.shop[k], 0, 10); });
  if (r.haul && typeof r.haul === 'object') MINE_HAUL.forEach(function (k) { if (r.haul[k]) haul[k] = n(r.haul[k]); });
  return [
    now, at, lineId || '', device,
    washNum(r.total, 0, 10000), lv, win, washNum(r.gain, 0, 100000), washNum(r.liang, 0, 1000000), washNum(r.target, 0, 1000000),
    washNum(r.lost, 0, 10000), n(r.dyn_used), n(r.dyn_left), n(r.items), washText(r.buff, 24), JSON.stringify(haul), JSON.stringify(shop),
    washNum(r.ms, 0, 3600000), washNum(r.len, 0, 3600), win && lv === 10 && !!r.final, !!r.login
  ];
}

// 在編輯器選這個按「執行」：先把 Mines 分頁建出來
function setupMines() {
  var sheet = minesSheet();
  Logger.log('Mines 分頁好了，目前有 ' + (sheet.getLastRow() - 1) + ' 關。網頁要能存，還要「部署 → 管理部署作業 → 編輯 → 版本選新版本 → 部署」。');
}

function mineLog(input) {
  var device = String(input.device || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (device.length < 8) return { result: 'error', error: '沒有裝置代號' };
  var recs = Array.isArray(input.recs) ? input.recs.slice(0, 20) : [];
  if (!recs.length) return { result: 'success', saved: 0 };
  var cache = CacheService.getScriptCache();
  var hour = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var allKey = 'mineRows' + ':' + hour, gate = logGate('mine', device, hour);
  var devCount = gate.n, allCount = Number(cache.get(allKey) || 0);
  if (devCount >= MINE_LOGS_PER_HOUR) return { result: 'error', error: '這小時送太多次了' };
  if (allCount + recs.length > MINE_ROWS_PER_HOUR) return { result: 'error', error: '這小時全站挖太多次了' };
  gate.count();
  var lineId = input.session ? sessionUser(input.session) : null;
  var now = new Date(), rows = [], skipped = 0;
  recs.forEach(function (r) {
    var row = mineRow(r, now, lineId, device);
    if (!row) { skipped++; return; }
    if (gate.seen(row[1].getTime())) { skipped++; return; }   // 同一支手機重送的同一關，不要存兩次
    rows.push(row);
  });
  if (rows.length) {
    var sheet = minesSheet();
    rows.forEach(function (row) { sheet.appendRow(row); });
    cache.put(allKey, String(allCount + rows.length), 3600);
  }
  gate.save();
  return { result: 'success', saved: rows.length, skipped: skipped };
}

// --- 貨運・航（huoyun.html）：每一趟的紀錄 ---
// 跟早餐店紀錄一樣：公開、appendRow 不排隊、不寄信不回資料；session 對就記 line_id。欄位收齊，之後排行榜、升級都從這裡算。
var SHIP_HEADERS = ['timestamp', 'at', 'line_id', 'device', 'total', 'sales', 'grade', 'sank', 'hull',
  'picked', 'max_combo', 'combo_bonus', 'small', 'big', 'crate', 'gold', 'bottles', 'ito_wins', 'dogs', 'ducks', 'duck_hits',
  'trash', 'pet', 'bag', 'router', 'reefs', 'ships', 'gulls', 'gull_shoo', 'gull_steals',
  'raccoons', 'raccoon_shoo', 'raccoon_steals', 'stolen', 'lanes', 'events', 'shop', 'ms', 'len', 'login',
  'mode', 'zone', 'dist', 'whirls', 'gusts', 'whale_hits', 'buoys', 'rush'];

function shipsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Ships');
  if (!sheet) {
    sheet = ss.insertSheet('Ships');
    sheet.appendRow(SHIP_HEADERS);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastColumn() < SHIP_HEADERS.length) {
    sheet.getRange(1, 1, 1, SHIP_HEADERS.length).setValues([SHIP_HEADERS]);
  }
  return sheet;
}

function shipRow(r, now, lineId, device) {
  if (!r || typeof r !== 'object') return null;
  var at = new Date(r.at);
  if (isNaN(at.getTime()) || at.getTime() > now.getTime() + 86400000 || at.getTime() < now.getTime() - 90 * 86400000) return null;
  var n = function (v) { return washNum(v, 0, 999); };
  var shop = {};
  if (r.shop && typeof r.shop === 'object') Object.keys(r.shop).slice(0, 20).forEach(function (k) { if (/^[a-z]{1,12}$/.test(k)) shop[k] = washNum(r.shop[k], 0, 10); });
  var events = String(r.events || '').split(',').filter(function (e) { return /^[a-z]{1,8}$/.test(e); }).slice(0, 6).join(',');
  return [
    now, at, lineId || '', device,
    washNum(r.total, 0, 1000000), washNum(r.sales, -100000, 1000000), washText(r.grade, 2), !!r.sank, washNum(r.hull, 0, 9),
    n(r.picked), n(r.max_combo), washNum(r.combo_bonus, 0, 100000), n(r.small), n(r.big), n(r.crate), n(r.gold),
    n(r.bottles), n(r.ito_wins), n(r.dogs), n(r.ducks), n(r.duck_hits),
    n(r.trash), n(r.pet), n(r.bag), n(r.router), n(r.reefs), n(r.ships), n(r.gulls), n(r.gull_shoo), n(r.gull_steals),
    n(r.raccoons), n(r.raccoon_shoo), n(r.raccoon_steals), washNum(r.stolen, 0, 100000), n(r.lanes), events, JSON.stringify(shop),
    washNum(r.ms, 0, 7200000), washNum(r.len, 0, 7200), !!r.login,
    r.mode === 'endless' ? 'endless' : 'normal', washNum(r.zone, 0, 999), washNum(r.dist, 0, 10000000),
    n(r.whirls), n(r.gusts), n(r.whale_hits), n(r.buoys), Math.round(washNum((r.rush || 1) * 100, 100, 250)) / 100
  ];
}

// 在編輯器選這個按「執行」：先把 Ships 分頁建出來
function setupShips() {
  var sheet = shipsSheet();
  Logger.log('Ships 分頁好了，目前有 ' + (sheet.getLastRow() - 1) + ' 趟。網頁要能存，還要「部署 → 管理部署作業 → 編輯 → 版本選新版本 → 部署」。');
}

function shipLog(input) {
  var device = String(input.device || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (device.length < 8) return { result: 'error', error: '沒有裝置代號' };
  var recs = Array.isArray(input.recs) ? input.recs.slice(0, 20) : [];
  if (!recs.length) return { result: 'success', saved: 0 };

  var cache = CacheService.getScriptCache();
  var hour = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var allKey = 'shipRows' + ':' + hour, gate = logGate('ship', device, hour);
  var devCount = gate.n, allCount = Number(cache.get(allKey) || 0);
  if (devCount >= SHIP_LOGS_PER_HOUR) return { result: 'error', error: '這小時送太多次了' };
  if (allCount + recs.length > SHIP_ROWS_PER_HOUR) return { result: 'error', error: '這小時全站出航太多次了' };
  gate.count();

  var lineId = input.session ? sessionUser(input.session) : null;
  var now = new Date(), rows = [], skipped = 0;
  recs.forEach(function (r) {
    var row = shipRow(r, now, lineId, device);
    if (!row) { skipped++; return; }
    if (gate.seen(row[1].getTime())) { skipped++; return; }   // 同一支手機重送的同一輪，不要存兩次
    rows.push(row);
  });
  if (rows.length) {
    var sheet = shipsSheet();
    rows.forEach(function (row) { sheet.appendRow(row); });
    cache.put(allKey, String(allCount + rows.length), 3600);
  }
  gate.save();
  return { result: 'success', saved: rows.length, skipped: skipped };
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
  var allKey = 'cleanRows' + ':' + hour, gate = logGate('clean', device, hour);
  var devCount = gate.n, allCount = Number(cache.get(allKey) || 0);
  if (devCount >= CLEAN_LOGS_PER_HOUR) return { result: 'error', error: '這小時送太多次了' };
  if (allCount + recs.length > CLEAN_ROWS_PER_HOUR) return { result: 'error', error: '這小時全站打掃太多間了' };
  gate.count();

  var lineId = input.session ? sessionUser(input.session) : null;
  var now = new Date(), rows = [], skipped = 0;
  recs.forEach(function (r) {
    var row = cleanRow(r, now, lineId, device);
    if (!row) { skipped++; return; }
    if (gate.seen(row[1].getTime())) { skipped++; return; }   // 同一支手機重送的同一輪，不要存兩次
    rows.push(row);
  });
  if (rows.length) {
    var sheet = cleansSheet();
    rows.forEach(function (row) { sheet.appendRow(row); });
    cache.put(allKey, String(allCount + rows.length), 3600);
  }
  gate.save();
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
  var allKey = 'gongdeRows' + ':' + hour, gate = logGate('gongde', device, hour);
  var devCount = gate.n, allCount = Number(cache.get(allKey) || 0);
  if (devCount >= GONGDE_LOGS_PER_HOUR) return { result: 'error', error: '這小時送太多次了' };
  if (allCount + recs.length > GONGDE_ROWS_PER_HOUR) return { result: 'error', error: '這小時全站捐太多了' };
  gate.count();

  var lineId = input.session ? sessionUser(input.session) : null;
  var now = new Date(), saved = 0, skipped = 0, sheet = null;
  recs.forEach(function (r) {
    var at = new Date(r && r.at);
    var kind = r && (r.kind === 'donate' || r.kind === 'lamp') ? r.kind : null;
    var amount = cleanMoney(r && r.amount, 1, WALLET_MAX);
    if (!kind || amount === null || isNaN(at.getTime()) || at.getTime() > now.getTime() + 86400000 || at.getTime() < now.getTime() - 90 * 86400000) { skipped++; return; }
    if (gate.seen(at.getTime())) { skipped++; return; }   // 同一支手機重送的同一輪，不要存兩次
    sheet = sheet || gongdeSheet();
    sheet.appendRow([now, at, lineId || '', device, kind, amount, washNum(r.oil, 0, WALLET_MAX), washNum(r.total, 0, WALLET_MAX),
      washText(r.tier, 6), washText(r.wish, 30), kind === 'lamp' ? washKey(r.lamp || 'guangming') : '']);
    saved++;
  });
  if (saved) cache.put(allKey, String(allCount + saved), 3600);
  gate.save();
  return { result: 'success', saved: saved, skipped: skipped };
}


// ===== 排程（2026-11-18，使用者定的時間；都是台灣時間）=====
// 在 Apps Script 編輯器選 setupTriggers 按「執行」一次就設好（第一次會跳授權：要多「管理觸發器」和「存檔到雲端硬碟」）。
// 看下次什麼時候跑：執行 cronStatus()，結果在「執行紀錄」。
//   cronBoard   每 5 分鐘：先算好排行榜存快取；順便檢查下面三個每日排程還在不在（不在就補排）
//   cronNews    每天 20:58：先把 21:00 要出的晚報寫好（21:00 以前公開的 API 只給今天的，所以不會提早曝光）
//   cronSport   每天 00:00：去 TPVL 官網抓比分，比完的派彩（有人打開運動頁時也照樣會抓、會派）
//   cronBackup  每天 03:00：整份試算表匯出成 .xlsx 存到雲端硬碟「丼步喱備份」資料夾，只留最近 90 份（舊的丟垃圾桶，30 天內還救得回來）
// 每日排程用「指定時間跑一次」的觸發器，跑的時候先排好明天的（Google 每日觸發器只能準到前後 15 分鐘）。
// Google 不保證準到秒，通常晚幾十秒到幾分鐘。
var CRON_DAILY = { cronNews: [20, 58], cronSport: [0, 0], cronBackup: [3, 0], cronMonthly: [4, 0, 1] };   // [時, 分, 每月幾號（沒寫就是每天）]
var BACKUP_FOLDER = '丼步喱備份', BACKUP_PREFIX = '丼步喱備份-', BACKUP_KEEP = 90;

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'cronBoard' || CRON_DAILY[fn]) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('cronBoard').timeBased().everyMinutes(5).create();
  Object.keys(CRON_DAILY).forEach(function (fn) { cronSchedule(fn); });
  backupFolder();   // 先建好資料夾，順便讓授權一次問完
  cronStatus();
}
function cronStatus() {
  var props = PropertiesService.getScriptProperties(), lines = [];
  ScriptApp.getProjectTriggers().forEach(function (t) { lines.push('觸發器：' + t.getHandlerFunction()); });
  Object.keys(CRON_DAILY).forEach(function (fn) {
    var next = Number(props.getProperty('cron:' + fn) || 0), last = props.getProperty('cronLast:' + fn) || '還沒跑過';
    lines.push(fn + ' 下次 ' + (next ? Utilities.formatDate(new Date(next), 'Asia/Taipei', 'yyyy-MM-dd HH:mm') : '沒排') + '｜上次 ' + last);
  });
  Logger.log(lines.join('\n'));
}
// 下一個台灣時間 h:m（已經過了或一分鐘內就排明天）；有 dom 就是每月 dom 號
function cronNextAt(h, m, nowMs, dom) {
  var tpe = new Date(nowMs + 8 * 3600000);
  if (dom) {
    var y = tpe.getUTCFullYear(), mo = tpe.getUTCMonth(), t2 = Date.UTC(y, mo, dom, h, m) - 8 * 3600000;
    while (t2 <= nowMs + 60000) { mo++; t2 = Date.UTC(y, mo, dom, h, m) - 8 * 3600000; }
    return t2;
  }
  var t = Date.UTC(tpe.getUTCFullYear(), tpe.getUTCMonth(), tpe.getUTCDate(), h, m) - 8 * 3600000;
  while (t <= nowMs + 60000) t += 86400000;
  return t;
}
// 把 fn 的觸發器換成下一次的時間，記在指令碼屬性 cron:fn
function cronSchedule(fn) {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t); });
  var at = cronNextAt(CRON_DAILY[fn][0], CRON_DAILY[fn][1], Date.now(), CRON_DAILY[fn][2]);
  ScriptApp.newTrigger(fn).timeBased().at(new Date(at)).create();
  PropertiesService.getScriptProperties().setProperty('cron:' + fn, String(at));
}
// 每日排程跑的時候：先排明天（後面出錯也不會斷），跑完記一下
function cronRun(fn, work) {
  try { cronSchedule(fn); } catch (e) { console.warn(fn + ' 排明天失敗：' + e); }
  var msg = 'OK';
  try { var r = work(); if (r && r.result === 'error') msg = r.error; else if (r && r.msg) msg = r.msg; }
  catch (e) { msg = '失敗：' + (e && e.message || e); console.warn(fn + ' ' + msg); }
  PropertiesService.getScriptProperties().setProperty('cronLast:' + fn, Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm') + ' ' + String(msg).slice(0, 120));
}

function cronBoard() {
  var board = buildBoard();
  boardCachePut(board);
  // 看門狗：每日排程該跑卻超過 15 分鐘沒跑（觸發器不見了），補排
  var props = PropertiesService.getScriptProperties(), now = Date.now();
  Object.keys(CRON_DAILY).forEach(function (fn) {
    var next = Number(props.getProperty('cron:' + fn) || 0);
    if (next && now > next + 15 * 60000) { try { cronSchedule(fn); } catch (e) { console.warn('補排 ' + fn + ' 失敗：' + e); } }
  });
}
function cronNews() {
  cronRun('cronNews', function () {
    var now = stockNow().getTime(), day = stockNewsDay(now + 30 * 60000);   // 20:58 跑：算的是 21:00 以後那份（明天的）
    return withLock(function () { stockSync(now); var have = stockReadNews(); stockMakeNews(day, have); return { msg: '第 ' + stockDayStr(day) + ' 的晚報好了' }; });
  });
}
function cronSport() {
  cronRun('cronSport', function () { sportSync(Date.now(), true, false); return { msg: PropertiesService.getScriptProperties().getProperty('sportError') || 'OK' }; });
}
function cronBackup() { cronRun('cronBackup', backupSheet); }
// 每月 1 號 04:00：運動舊注單搬家、舊通行證清掉。打工紀錄不封存（使用者 2026-11-18：資料量還不大，要的話在編輯器手動跑 archiveLogs）
function cronMonthly() {
  cronRun('cronMonthly', function () { var a = archiveBets(), b = pruneSessions(); return { msg: '運動注單搬走 ' + a + ' 張、通行證清掉 ' + b + ' 張' }; });
}

// 開獎（或退錢）超過 BETS_KEEP_DAYS 天的注單，搬到「丼步喱注單封存」這份試算表（只有一份，id 記在指令碼屬性 BETS_ARCHIVE_ID，被刪了會重建）。
// 還沒開獎的一張都不動。運動頁只顯示最近 7 天開獎的，玩家看不出差別；Bets 不會一直變長，快取才放得下
var BETS_KEEP_DAYS = 60, SESSIONS_KEEP_DAYS = 90;
function isDate(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()); }
function betsArchiveSheet() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('BETS_ARCHIVE_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create('丼步喱注單封存'); props.setProperty('BETS_ARCHIVE_ID', ss.getId()); }
  var sheet = ss.getSheetByName('Bets') || ss.insertSheet('Bets');
  if (sheet.getLastRow() < 1) sheet.appendRow(SPORT_BET_HEADERS);
  return sheet;
}
// 把 rows 裡要刪的列（第幾列，從 1 算）一段一段從下往上刪：新加在最下面的列不會被刪到
function deleteRowList(sheet, list) {
  list = list.slice().sort(function (a, b) { return b - a; });
  for (var i = 0; i < list.length;) {
    var end = list[i], start = end;
    while (i + 1 < list.length && list[i + 1] === start - 1) { i++; start--; }
    sheet.deleteRows(start, end - start + 1);
    i++;
  }
}
function archiveBets(days) {
  days = typeof days === 'number' && days > 0 ? days : BETS_KEEP_DAYS;
  var cutoff = Date.now() - days * 864e5;
  var r = withLock(function () {
    var sheet = sportBetsSheet(), rows = sheet.getDataRange().getValues(), move = [], rowNos = [];
    for (var i = 1; i < rows.length; i++) {
      var st = String(rows[i][7] || 'open'), settled = isDate(rows[i][9]) ? rows[i][9].getTime() : 0;
      if (st !== 'open' && settled && settled < cutoff) { move.push(rows[i]); rowNos.push(i + 1); }
    }
    if (!move.length) return 0;
    var arc = betsArchiveSheet(), at = arc.getLastRow() + 1;
    arc.getRange(at, 1, move.length, SPORT_BET_HEADERS.length).setNumberFormat('@');   // 「3:1」不要被當成時間
    arc.getRange(at, 1, move.length, SPORT_BET_HEADERS.length).setValues(move.map(function (x) { return x.slice(0, SPORT_BET_HEADERS.length).map(function (v) { return isDate(v) ? Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss') : v; }); }));
    deleteRowList(sheet, rowNos);
    sportBump();
    return move.length;
  });
  if (r && r.result === 'error') throw new Error(r.error);
  return r;
}
// 超過 SESSIONS_KEEP_DAYS 天沒用的通行證刪掉（那支手機下次要重新登入；錢都在後端，不會不見）
function pruneSessions(days) {
  days = typeof days === 'number' && days > 0 ? days : SESSIONS_KEEP_DAYS;
  var cutoff = Date.now() - days * 864e5, sheet = sessionsSheet(), n = sheet.getLastRow() - 1;
  if (n < 1) return 0;
  var rows = sheet.getRange(2, 1, n, 4).getValues(), del = [];
  rows.forEach(function (r, i) {
    var used = isDate(r[3]) ? r[3].getTime() : isDate(r[0]) ? r[0].getTime() : 0;
    if (used && used < cutoff) del.push(i + 2);
  });
  if (del.length) deleteRowList(sheet, del);
  return del.length;
}

function backupFolder() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('BACKUP_FOLDER_ID');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { } }
  var it = DriveApp.getFoldersByName(BACKUP_FOLDER), folder = it.hasNext() ? it.next() : DriveApp.createFolder(BACKUP_FOLDER);
  props.setProperty('BACKUP_FOLDER_ID', folder.getId());
  return folder;
}
// 整份試算表匯出成 .xlsx（只有資料，不會連程式、指令碼屬性一起複製），存進備份資料夾；超過 BACKUP_KEEP 份的舊檔丟垃圾桶
// 備份裡有電話、Email、大家的錢：資料夾不要分享給別人
function backupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), folder = backupFolder();
  var res = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('匯出失敗 HTTP ' + res.getResponseCode());
  var name = BACKUP_PREFIX + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd-HHmm') + '.xlsx';
  folder.createFile(res.getBlob().setName(name));
  var files = [], it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (f.getName().indexOf(BACKUP_PREFIX) === 0) files.push(f); }
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(BACKUP_KEEP).forEach(function (f) { f.setTrashed(true); });
  return { msg: name + '（' + Math.round(res.getBlob().getBytes().length / 1024) + ' KB，資料夾裡 ' + Math.min(files.length, BACKUP_KEEP) + ' 份）' };
}


// ===== 真人工資對帳表（2026-11-18）=====
// 在編輯器選 econReport 按「執行」：讀七個打工的紀錄分頁，算真人「一分鐘賺多少」，寫進「對帳」分頁（每次整頁重寫）。
// 用中位數（不被一兩個特別快、特別慢的人拉偏）；一輪不到 10 秒的（沒玩完、亂按）不算。之後調工資照這張，不再只看機器人模擬。
// econReport(30) 只算最近 30 天。只讀紀錄，不改任何東西，不用部署。
var ECON_SOURCES = [
  { sheet: 'Washes', name: '坐洗・泡', dur: 'ms', fallback: 0 },
  { sheet: 'Cleans', name: '房務・淨', dur: 'ms', fallback: 0 },
  { sheet: 'Farms', name: '菜園・拔', dur: 'len', fallback: 60 },
  { sheet: 'Wifis', name: '蹭・網', dur: 'ms', fallback: 0, mode: true },
  { sheet: 'Zaocans', name: '早餐・煎', dur: 'len', fallback: 75 },
  { sheet: 'Ships', name: '貨運・航', dur: 'len', fallback: 60, mode: true },
  { sheet: 'Desserts', name: '甜點・轉', dur: 'len', fallback: 75 },
  { sheet: 'Stacks', name: '疊・巢', dur: 'len', fallback: 60 },
  { sheet: 'Mines', name: '礦坑・挖', dur: 'len', fallback: 60 }
];
function econMedian(a) { if (!a.length) return 0; a = a.slice().sort(function (x, y) { return x - y; }); var m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
function econPct(a, p) { if (!a.length) return 0; a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; }
function econReport(days) {
  var r = econCompute(days), ss = SpreadsheetApp.getActiveSpreadsheet(), out = r.out, since = r.since;
  var sheet = ss.getSheetByName('對帳') || ss.insertSheet('對帳');
  sheet.clearContents();
  var head = ECON_HEAD;
  sheet.getRange(1, 1, 1, head.length).setValues([head]);
  if (out.length) sheet.getRange(2, 1, out.length, head.length).setValues(out);
  sheet.getRange(out.length + 3, 1, 1, 1).setValue('算的時間：' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm') + (since ? '（最近 ' + days + ' 天）' : '（全部）') + '。輪數少於 20 的那列參考就好。');
  sheet.setFrozenRows(1);
  Logger.log(r.log.join('\n') || '沒有紀錄');
  return out;
}
var ECON_HEAD = ['打工', '模式', '升級程度', '輪數', '幾個人', '每分鐘（中位數）', '每輪（中位數）', '每輪（前 10% 的門檻）', '一輪幾秒（中位數）', '期間'];
// 只算、不寫（admin 後台的「真人工資」也用這個）
function econCompute(days) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), since = typeof days === 'number' && days > 0 ? Date.now() - days * 864e5 : 0, out = [], log = [];
  ECON_SOURCES.forEach(function (src) {
    var sheet = ss.getSheetByName(src.sheet);
    if (!sheet || sheet.getLastRow() < 2) return;
    var rows = sheet.getDataRange().getValues(), head = rows[0].map(String), col = function (n) { return head.indexOf(n); };
    var cTotal = col('total'), cDur = col(src.dur), cMs = col('ms'), cShop = col('shop'), cMode = col('mode'), cLine = col('line_id'), cDev = col('device'), cAt = col('at');
    var groups = {};
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i], total = Number(r[cTotal]);
      if (!isFinite(total)) continue;
      var at = r[cAt] instanceof Date ? r[cAt].getTime() : 0;
      if (since && at && at < since) continue;
      var sec = src.dur === 'len' ? Number(r[cDur]) || 0 : (Number(r[cDur]) || 0) / 1000;
      if (!sec && cMs >= 0 && src.dur === 'len') sec = (Number(r[cMs]) || 0) / 1000;
      if (!sec) sec = src.fallback;
      if (sec < 10) continue;
      var lv = 0;
      if (cShop >= 0) { try { var sh = JSON.parse(r[cShop] || '{}') || {}; Object.keys(sh).forEach(function (k) { lv += Number(sh[k]) || 0; }); } catch (e) { } }
      var mode = src.mode && cMode >= 0 && String(r[cMode]) === 'endless' ? '無盡' : '一般';
      var tier = cShop < 0 ? '（沒記）' : lv === 0 ? '沒升級' : lv <= 3 ? '升 1～3 級' : lv <= 7 ? '升 4～7 級' : '升 8 級以上';
      var key = mode + '|' + tier, g = groups[key] || (groups[key] = { mode: mode, tier: tier, lv: lv, perMin: [], perRound: [], secs: [], who: {}, first: at, last: at });
      g.perMin.push(total / sec * 60); g.perRound.push(total); g.secs.push(sec);
      g.who[String(cLine >= 0 && r[cLine] || (cDev >= 0 ? r[cDev] : '') || '?')] = 1;
      if (at) { g.first = g.first ? Math.min(g.first, at) : at; g.last = Math.max(g.last || 0, at); }
    }
    var order = ['沒升級', '升 1～3 級', '升 4～7 級', '升 8 級以上', '（沒記）'];
    Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) { return a.mode === b.mode ? order.indexOf(a.tier) - order.indexOf(b.tier) : a.mode === '一般' ? -1 : 1; })
      .forEach(function (g) {
        var day = function (t) { return t ? Utilities.formatDate(new Date(t), 'Asia/Taipei', 'yyyy-MM-dd') : ''; };
        out.push([src.name, src.mode ? g.mode : '', g.tier, g.perRound.length, Object.keys(g.who).length,
          Math.round(econMedian(g.perMin)), Math.round(econMedian(g.perRound)), Math.round(econPct(g.perRound, 0.9)), Math.round(econMedian(g.secs)), day(g.first) + '～' + day(g.last)]);
        log.push(src.name + (src.mode ? ' ' + g.mode : '') + ' ' + g.tier + '：' + g.perRound.length + ' 輪，每分鐘中位數 $' + Math.round(econMedian(g.perMin)));
      });
  });
  return { out: out, log: log, since: since };
}


// --- 許願池（2026-11-19）---
// 旅人用 LINE 登入許願（網站想多什麼、哪裡壞了），每天第一個願望 +$1,000 直接加進帳號（earned.wish）。
// 願望牆公開（暱稱、頭像、內容、主人的回覆、幾個人也想要），不回 line_id；主人在後台改狀態、回一句話、藏起來。
// 不寄信（公開的動作不寄信給別人，也不寄給主人：願望在後台看）。
// Wishes：A timestamp、B id、C line_id、D kind、E text、F status、G reply、H voters（JSON，line_id 陣列）、I hidden、J replied_at
var WISH_REWARD_MIN = 3000, WISH_REWARD_MAX = 6666;   // 每天第一個願望的獎金，隨機（遊戲幣；2026-11-19 使用者定的：$1,000 → $3,000 → 隨機 3,000～6,666，網頁上不寫金額）
var WISH_PER_DAY = 3;            // 一個人一天最多許幾個（只有第一個有獎金）
var WISH_MIN = 4, WISH_MAX = 200;
var WISH_PER_HOUR = 60;          // 全站每小時最多幾個願望
var WISH_VOTES_PER_HOUR = 60;    // 一個人每小時最多按幾次「我也想要」
var WISH_LIST_MAX = 80;          // 願望牆最多回幾個
var WISH_KINDS = ['game', 'idea', 'bug', 'other'];             // 新遊戲、點子、抓蟲、其他
var WISH_STATUS = ['new', 'seen', 'doing', 'done', 'no'];      // 剛投、收到了、在做了、實現了、不行
var WISH_HEADERS = ['timestamp', 'id', 'line_id', 'kind', 'text', 'status', 'reply', 'voters', 'hidden', 'replied_at'];

function wishesSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Wishes');
  if (!sheet) { sheet = ss.insertSheet('Wishes'); sheet.appendRow(WISH_HEADERS); }
  return sheet;
}

function readWishes() {
  var rows = wishesSheet().getDataRange().getValues(), out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1]) continue;
    var voters = [];
    try { voters = JSON.parse(r[7] || '[]') || []; } catch (e) { }
    var t = r[0], rt = r[9];
    out.push({
      row: i + 1, id: String(r[1]), lineId: String(r[2] || ''),
      kind: WISH_KINDS.indexOf(r[3]) >= 0 ? r[3] : 'other',
      text: String(r[4] || '').replace(/^'/, ''), status: WISH_STATUS.indexOf(r[5]) >= 0 ? r[5] : 'new',
      reply: String(r[6] || '').replace(/^'/, ''), voters: Array.isArray(voters) ? voters : [],
      hidden: r[8] === true || r[8] === 'TRUE' || r[8] === 'true',
      at: t instanceof Date ? t.toISOString() : String(t || ''),
      repliedAt: rt instanceof Date ? rt.toISOString() : String(rt || '')
    });
  }
  return out;
}

// line_id → 顯示的名字、頭像（暱稱、指定頭像優先，跟排行榜一樣）
function wishPeople() {
  var rows = playersSheet().getDataRange().getValues(), map = {};
  for (var i = 1; i < rows.length; i++) {
    var nick = String(rows[i][12] || '').replace(/^'/, '').trim().slice(0, 12), av = String(rows[i][13] || '');
    map[String(rows[i][1])] = { name: nick || String(rows[i][2] || '') || '旅人', picture: String(rows[i][3] || ''), avatar: AVATAR_KEYS.indexOf(av) >= 0 ? av : '' };
  }
  return map;
}

function wishDay(iso) { return Utilities.formatDate(iso ? new Date(iso) : new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }

function wishView(w, people, me) {
  var who = people[w.lineId] || { name: '旅人', picture: '', avatar: '' };
  return {
    id: w.id, at: w.at, kind: w.kind, text: w.text, status: w.status, reply: w.reply, repliedAt: w.repliedAt,
    votes: w.voters.length, name: who.name, picture: who.picture, avatar: who.avatar,
    mine: !!me && w.lineId === me, voted: !!me && w.voters.indexOf(me) >= 0
  };
}

// 我今天許了幾個、拿過獎金沒
function wishMe(all, me) {
  if (!me) return null;
  var today = wishDay(), n = all.filter(function (w) { return w.lineId === me && wishDay(w.at) === today; }).length;
  return { today: n, left: Math.max(0, WISH_PER_DAY - n), rewarded: n > 0, perDay: WISH_PER_DAY };
}

// 公開：願望牆。{ type: 'wishList', session? }
function wishList(input) {
  var me = input.session ? sessionUser(input.session) : null;
  var all = readWishes(), people = wishPeople();
  var shown = all.filter(function (w) { return !w.hidden; });
  var list = shown.slice(-WISH_LIST_MAX).reverse().map(function (w) { return wishView(w, people, me); });
  return {
    result: 'success', wishes: list, total: shown.length, done: shown.filter(function (w) { return w.status === 'done'; }).length,
    me: wishMe(all, me), rules: { perDay: WISH_PER_DAY, min: WISH_MIN, max: WISH_MAX, kinds: WISH_KINDS }
  };
}

function cleanWishText(v) {
  return String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

// 要登入（排隊）：{ type: 'wishAdd', session, kind, text }
function wishAdd(input) {
  var lineId = sessionUser(input.session);
  if (!lineId) return { result: 'unauthorized' };
  var p = findPlayer(lineId);
  if (!p) return { result: 'unauthorized' };
  var text = cleanWishText(input.text), kind = WISH_KINDS.indexOf(input.kind) >= 0 ? input.kind : 'other';
  if (text.length < WISH_MIN) return { result: 'error', error: '願望太短了，多說一點（至少 ' + WISH_MIN + ' 個字）' };
  if (text.length > WISH_MAX) return { result: 'error', error: '願望太長了，' + WISH_MAX + ' 個字以內' };
  var cache = CacheService.getScriptCache(), hourKey = 'wishes:' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var hour = Number(cache.get(hourKey) || 0);
  if (hour >= WISH_PER_HOUR) return { result: 'error', error: '池子這小時收太多願望了，晚點再來' };
  var all = readWishes(), today = wishDay();
  var mineToday = all.filter(function (w) { return w.lineId === lineId && wishDay(w.at) === today; });
  if (mineToday.length >= WISH_PER_DAY) return { result: 'error', error: '今天許了 ' + WISH_PER_DAY + ' 個了，神明也要休息，明天再來' };
  if (all.some(function (w) { return w.lineId === lineId && w.text === text; })) return { result: 'error', error: '這個願望你許過了，池子記得' };
  cache.put(hourKey, String(hour + 1), 3600);

  var id = 'w' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), now = new Date();
  wishesSheet().appendRow([now, id, lineId, kind, asText(text), 'new', '', '[]', false, '']);
  var reward = mineToday.length === 0 ? WISH_REWARD_MIN + Math.floor(Math.random() * (WISH_REWARD_MAX - WISH_REWARD_MIN + 1)) : 0, out = { result: 'success', id: id, reward: reward };
  if (reward) {
    p.money = Math.min(WALLET_MAX, p.money + reward);
    p.earned = addEarned(p.earned, { wish: { times: 1, total: reward, best: reward } });
    writeWallet(p);
  }
  out.wallet = walletView(p);
  out.me = { today: mineToday.length + 1, left: Math.max(0, WISH_PER_DAY - mineToday.length - 1), rewarded: true, perDay: WISH_PER_DAY };
  return out;
}

// 要登入（排隊）：{ type: 'wishVote', session, id }：「我也想要」，再按一次收回；自己的不能按
function wishVote(input) {
  var lineId = sessionUser(input.session);
  if (!lineId) return { result: 'unauthorized' };
  var cache = CacheService.getScriptCache(), key = 'wishVotes:' + lineId + ':' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHH');
  var n = Number(cache.get(key) || 0);
  if (n >= WISH_VOTES_PER_HOUR) return { result: 'error', error: '按太多次了，晚點再來' };
  var w = readWishes().filter(function (x) { return x.id === String(input.id || '') && !x.hidden; })[0];
  if (!w) return { result: 'error', error: '找不到這個願望' };
  if (w.lineId === lineId) return { result: 'error', error: '自己的願望不用自己附議' };
  cache.put(key, String(n + 1), 3600);
  var i = w.voters.indexOf(lineId);
  if (i >= 0) w.voters.splice(i, 1); else w.voters.push(lineId);
  wishesSheet().getRange(w.row, 8).setValue(JSON.stringify(w.voters.slice(-2000)));
  return { result: 'success', id: w.id, votes: w.voters.length, voted: i < 0 };
}

// 後台：全部的願望（含藏起來的），新的在前面
function adminWishes() {
  var people = wishPeople();
  return { result: 'success', wishes: readWishes().reverse().map(function (w) { var v = wishView(w, people, null); v.hidden = w.hidden; return v; }) };
}

// admin 後台：{ type: 'gaWishSet', token, id, status?, reply?, hidden? }（2026-11-21 以前是預約後台的 adminWishSet；通行證是 admin 後台的）
function adminWishSet(input) {
  var w = readWishes().filter(function (x) { return x.id === String(input.id || ''); })[0];
  if (!w) return { result: 'error', error: '找不到這個願望' };
  var sheet = wishesSheet();
  if (input.status !== undefined) {
    if (WISH_STATUS.indexOf(input.status) < 0) return { result: 'error', error: '狀態不對' };
    sheet.getRange(w.row, 6).setValue(input.status);
  }
  if (input.reply !== undefined) {
    var reply = cleanWishText(input.reply).slice(0, WISH_MAX);
    sheet.getRange(w.row, 7).setValue(reply ? asText(reply) : '');
    sheet.getRange(w.row, 10).setValue(reply ? new Date() : '');
  }
  if (input.hidden !== undefined) sheet.getRange(w.row, 9).setValue(!!input.hidden);
  return adminWishes();
}


// ===== 公告（2026-11-21）=====
// 會員中心（member.html）的跑馬燈，只有一條（一開始放首頁，使用者說只放會員・我）。admin 後台設定（gaAnnounceSet），存在指令碼屬性 ANNOUNCE（JSON：text、at、until）。
// 公開的 announce 只回字和時間；until 到了就當作沒有。字只給主人寫，但頁面一律用 textContent 放，不當 HTML。
var ANNOUNCE_MAX = 80;
function readAnnounce() {
  var raw = PropertiesService.getScriptProperties().getProperty('ANNOUNCE'), a = null;
  try { a = raw ? JSON.parse(raw) : null; } catch (e) { a = null; }
  return a && a.text ? a : null;
}
function announceLive(a) { return !!a && (!a.until || new Date(a.until).getTime() > Date.now()); }
function cleanAnnounce(v) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}
// 公開：{ type: 'announce' } → { text, at }（沒有就是空字串）
function announceGet() {
  var cache = CacheService.getScriptCache(), hit = cache.get('announce:v1');
  if (hit) { var c = JSON.parse(hit); if (!c.until || new Date(c.until).getTime() > Date.now()) return { result: 'success', text: c.text, at: c.at }; return { result: 'success', text: '', at: '' }; }
  var a = readAnnounce(), out = announceLive(a) ? { text: a.text, at: a.at, until: a.until || '' } : { text: '', at: '', until: '' };
  cache.put('announce:v1', JSON.stringify(out), 600);
  return { result: 'success', text: out.text, at: out.at };
}
// admin 後台：看現在掛的（含已經過期的）
function gaAnnounce() {
  var a = readAnnounce();
  return { result: 'success', announce: a ? { text: a.text, at: a.at, until: a.until || '', live: announceLive(a) } : null, max: ANNOUNCE_MAX };
}
// admin 後台：{ type: 'gaAnnounceSet', token, text, days }：text 空的就撤下；days 0 是不自動下架，1～30 天後自己下架。新的直接蓋掉舊的（只有一條）
function gaAnnounceSet(input) {
  var text = cleanAnnounce(input.text), props = PropertiesService.getScriptProperties();
  if (text.length > ANNOUNCE_MAX) return { result: 'error', error: '公告最多 ' + ANNOUNCE_MAX + ' 個字' };
  if (!text) props.deleteProperty('ANNOUNCE');
  else {
    var days = Math.max(0, Math.min(30, Math.floor(Number(input.days) || 0))), now = new Date();
    props.setProperty('ANNOUNCE', JSON.stringify({ text: text, at: now.toISOString(), until: days ? new Date(now.getTime() + days * 86400000).toISOString() : '' }));
  }
  CacheService.getScriptCache().remove('announce:v1');
  return gaAnnounce();
}

// ===== admin 後台（admin.html，2026-11-20）=====
// 使用者要的「另一個後台」：玩家列表、專屬道具（先做架子：發、收回、到期，還沒有效果）、經濟體檢。
// 密碼是另一組：指令碼屬性 GAME_ADMIN_PASSWORD（跟預約後台的 ADMIN_PASSWORD 分開），通行證也分開（cache 'gadmin:'）。
// 不回 line_id：玩家用 key（line_id 的雜湊，前 12 碼）認，發道具時後端再對回 line_id。
// Perks：A timestamp、B id、C line_id、D perk（道具庫的 id；舊的直接寫效果 key）、E note、F expires（空白＝永久）、G revoked_at、H key
// 道具庫（2026-11-20c）：主人自己取名字的道具，每一個掛一種「效果」（PERK_TYPES）。發道具是從道具庫挑。
// PerkLib：A created、B id、C name（12 字）、D effect、E line（給拿到的人看的一句話，30 字）、F retired_at（停用：不能再發，已經發的照樣有效）、G updated
// PERK_TYPES 是「效果」：寫在程式裡，有程式才有效果；名字是道具庫取的
var PERK_TYPES = {
  shop60: { name: '全店六折', desc: '八家打工店面升級打六折（刮刮樂、功德、股市、保險照原價）', live: true },   // 2026-11-20b 起生效；live: false 的只記錄、不送給玩家
  // 2026-11-21d：解鎖隱藏商品。平常店面看不到，有這個道具才出現（$1、不打折）；道具到期或收回就藏起來、效果也停
  minemag: { name: '磁力夾', desc: '礦坑・挖的店面出現「磁力夾」（$1）：金塊靠近鉤子就吸過來', live: true },
  shiplamp: { name: '探照燈', desc: '貨運・航的船廠出現「探照燈」（$1）：夜航船頭燈照得又遠又寬', live: true }
};
var PERK_HEADERS = ['timestamp', 'id', 'line_id', 'perk', 'note', 'expires', 'revoked_at', 'key'];
var LIB_HEADERS = ['created', 'id', 'name', 'effect', 'line', 'retired_at', 'updated'];
var LIB_NAME_MAX = 12, LIB_LINE_MAX = 30;

function gameAdminLogin(input) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('gaLoginFails') || 0);
  if (fails >= LOGIN_FAILS_LIMIT) return { result: 'error', error: '試太多次了，十分鐘後再來' };
  var password = PropertiesService.getScriptProperties().getProperty('GAME_ADMIN_PASSWORD');
  if (!password) return { result: 'error', error: 'admin 後台的密碼還沒設定（指令碼屬性 GAME_ADMIN_PASSWORD）' };
  if (String(input.password || '') !== password) {
    cache.put('gaLoginFails', String(fails + 1), 600);
    return { result: 'error', error: '密碼不對' };
  }
  var token = Utilities.getUuid();
  cache.put('gadmin:' + token, '1', ADMIN_TOKEN_SECONDS);
  return { result: 'success', token: token };
}

function isGameAdmin(token) {
  return !!token && CacheService.getScriptCache().get('gadmin:' + String(token)) === '1';
}

function playerKey(lineId) {
  return Utilities.computeHmacSha256Signature(String(lineId), 'dongbuli-player-key')
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('').slice(0, 12);
}

function perksSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Perks');
  if (!sheet) { sheet = ss.insertSheet('Perks'); sheet.appendRow(PERK_HEADERS); }
  return sheet;
}

function readPerks() {
  var rows = perksSheet().getDataRange().getValues(), now = Date.now(), out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1]) continue;
    var ex = r[5] instanceof Date ? r[5].getTime() : (r[5] ? Date.parse(r[5]) : 0), rv = r[6] instanceof Date ? r[6].getTime() : (r[6] ? Date.parse(r[6]) : 0);
    var at = r[0] instanceof Date ? r[0].getTime() : Date.parse(r[0]) || 0;
    out.push({ row: i + 1, id: String(r[1]), lineId: String(r[2]), perk: String(r[3]), note: String(r[4] || '').replace(/^'/, ''),
      at: at, expires: ex || 0, revokedAt: rv || 0, key: String(r[7] || ''),
      active: !rv && (!ex || ex > now) });
  }
  return out;
}

// 道具庫分頁：第一次用的時候開，順便把原本的「全店六折」放進去（id 就叫 shop60，以前發的 perk 欄就是 shop60，直接對得上）
function libSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('PerkLib');
  if (!sheet) {
    sheet = ss.insertSheet('PerkLib'); sheet.appendRow(LIB_HEADERS);
    var now = new Date();
    Object.keys(PERK_TYPES).forEach(function (k) { sheet.appendRow([now, k, PERK_TYPES[k].name, k, '', '', now]); });
  }
  return sheet;
}

function libClean(v, max) {
  return String(v == null ? '' : v).replace(/^'/, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// { id: { row, id, name, effect, line, retiredAt, created } }；create=false 時分頁還沒有就用 PERK_TYPES 當預設（玩家同步時不要開分頁）
function readLib(create) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = create ? libSheet() : ss.getSheetByName('PerkLib'), out = {};
  if (!sheet) {
    Object.keys(PERK_TYPES).forEach(function (k) { out[k] = { row: 0, id: k, name: PERK_TYPES[k].name, effect: k, line: '', retiredAt: 0, created: 0 }; });
    return out;
  }
  var rows = sheet.getDataRange().getValues(), t = function (v) { return v instanceof Date ? v.getTime() : (v ? Date.parse(v) || 0 : 0); };
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i], id = String(r[1] || '');
    if (!id) continue;
    out[id] = { row: i + 1, id: id, name: libClean(r[2], LIB_NAME_MAX) || id, effect: String(r[3] || ''), line: libClean(r[4], LIB_LINE_MAX),
      retiredAt: t(r[5]), created: t(r[0]) };
  }
  // 新加的效果（2026-11-21d 磁力夾、探照燈）：道具庫裡還沒有這種效果的，自動放一個同名的進去，admin 後台打開就能發
  if (create) {
    var have = {}; Object.keys(out).forEach(function (id) { have[out[id].effect] = 1; have[id] = 1; });
    Object.keys(PERK_TYPES).forEach(function (k) {
      if (have[k]) return;
      var now = new Date(); sheet.appendRow([now, k, PERK_TYPES[k].name, k, '', '', now]);
      out[k] = { row: sheet.getLastRow(), id: k, name: PERK_TYPES[k].name, effect: k, line: '', retiredAt: 0, created: now.getTime() };
    });
  }
  return out;
}

// 發出去的那筆是什麼：道具庫有就用道具庫的名字；沒有（舊資料）就看是不是效果 key
function perkInfo(perk, lib) {
  var x = lib[perk];
  if (x) return { name: x.name, effect: x.effect, line: x.line };
  if (PERK_TYPES[perk]) return { name: PERK_TYPES[perk].name, effect: perk, line: '' };
  return { name: perk, effect: '', line: '' };
}

// 玩家：暱稱、頭像、錢、賺、花、店面、功德、最近同步；外加他身上的道具
function gaPlayerRows() {
  var rows = playersSheet().getDataRange().getValues(), out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i], lineId = String(r[1] || '');
    if (!lineId) continue;
    var earned = {}, gongde = {}, shop = {};
    try { earned = cleanEarned(JSON.parse(r[6] || '{}')) || {}; } catch (e) { }
    try { gongde = JSON.parse(r[8] || '{}') || {}; } catch (e) { }
    try { shop = JSON.parse(r[9] || '{}') || {}; } catch (e) { }
    var earnedTotal = 0, bySource = {};
    Object.keys(earned).forEach(function (k) { var t = Number(earned[k] && earned[k].total) || 0; earnedTotal += t; bySource[k] = { total: t, times: Number(earned[k].times) || 0, best: Number(earned[k].best) || 0 }; });
    var lv = 0, items = 0; Object.keys(shop.lv || {}).forEach(function (k) { lv += Number(shop.lv[k]) || 0; items++; });
    var nick = String(r[12] || '').replace(/^'/, '').trim().slice(0, 12), av = String(r[13] || '');
    var t = function (v) { return v instanceof Date ? v.getTime() : (Date.parse(v) || 0); };
    out.push({ lineId: lineId, key: playerKey(lineId), name: nick || String(r[2] || '') || '旅人', lineName: String(r[2] || ''), nick: nick,
      picture: String(r[3] || ''), avatar: AVATAR_KEYS.indexOf(av) >= 0 ? av : '',
      money: Number(r[4]) || 0, spent: Number(r[5]) || 0, earned: earnedTotal, sources: bySource,
      shopLv: lv, shopItems: items, shopSpent: Number(shop.spent) || 0, donated: Number(gongde.donated) || 0, lit: Number(gongde.lit) || 0,
      created: t(r[0]), updated: t(r[7]) });
  }
  return out;
}

function gaPerkView(x, names, lib) {
  var info = perkInfo(x.perk, lib), t = PERK_TYPES[info.effect] || { name: '（沒有這種效果）', live: false };
  return { id: x.id, key: x.key, who: names[x.lineId] || '（找不到這個玩家）', perk: x.perk, perkName: info.name, effect: info.effect, effectName: t.name, live: !!t.live, note: x.note,
    at: x.at, expires: x.expires, revokedAt: x.revokedAt, active: x.active };
}

function gaPlayers() {
  var players = gaPlayerRows(), perks = readPerks(), lib = readLib(true), names = {};
  players.forEach(function (p) { names[p.lineId] = p.name; });
  var active = {}, count = {};
  perks.forEach(function (x) {
    var c = count[x.perk] || (count[x.perk] = { active: 0, total: 0 }); c.total++;
    if (x.active) { c.active++; (active[x.lineId] = active[x.lineId] || []).push(perkInfo(x.perk, lib).name); }
  });
  var effects = Object.keys(PERK_TYPES).map(function (k) { return { key: k, name: PERK_TYPES[k].name, desc: PERK_TYPES[k].desc, live: !!PERK_TYPES[k].live }; });
  return {
    result: 'success', now: Date.now(),
    players: players.map(function (p) { var o = {}; Object.keys(p).forEach(function (k) { if (k !== 'lineId') o[k] = p[k]; }); o.perks = active[p.lineId] || []; return o; }),
    perks: perks.slice().reverse().map(function (x) { return gaPerkView(x, names, lib); }),
    lib: Object.keys(lib).map(function (id) {
      var x = lib[id], t = PERK_TYPES[x.effect] || { name: '（沒有這種效果）', desc: '', live: false }, c = count[id] || { active: 0, total: 0 };
      return { id: id, name: x.name, effect: x.effect, effectName: t.name, effectDesc: t.desc, live: !!t.live, line: x.line, retired: !!x.retiredAt, created: x.created, active: c.active, total: c.total };
    }).sort(function (a, b) { return (a.retired - b.retired) || (a.created - b.created); }),
    effects: effects,
    perkTypes: effects   // 舊版 admin.html 用的
  };
}

// 道具庫：新增或改名 { id?, name, effect（新增才看）, line? }。名字 1～12 字、不能跟其他還在用的撞名；效果建了就不能改（發出去的會跟著變）
function gaLibSave(input) {
  var lib = readLib(true), id = String(input.id || ''), name = libClean(input.name, 40), line = libClean(input.line, 40);
  if (!name) return { result: 'error', error: '道具要有名字' };
  if (name.length > LIB_NAME_MAX) return { result: 'error', error: '名字最多 ' + LIB_NAME_MAX + ' 個字' };
  if (line.length > LIB_LINE_MAX) return { result: 'error', error: '那句話最多 ' + LIB_LINE_MAX + ' 個字' };
  var clash = Object.keys(lib).some(function (k) { return k !== id && !lib[k].retiredAt && lib[k].name === name; });
  if (clash) return { result: 'error', error: '道具庫已經有「' + name + '」了' };
  var sheet = libSheet(), now = new Date(), out;
  if (id) {
    var x = lib[id];
    if (!x || !x.row) return { result: 'error', error: '道具庫找不到這個道具' };
    sheet.getRange(x.row, 3).setValue(asText(name));
    sheet.getRange(x.row, 5).setValue(line ? asText(line) : '');
    sheet.getRange(x.row, 7).setValue(now);
    CacheService.getScriptCache().remove('perks:v1');   // 改名：拿到的人下次同步就看到新名字
    out = gaPlayers(); out.saved = id; return out;
  }
  if (!PERK_TYPES[input.effect]) return { result: 'error', error: '沒有這種效果' };
  if (Object.keys(lib).length >= 100) return { result: 'error', error: '道具庫最多 100 個' };
  id = 'p' + Utilities.getUuid().replace(/-/g, '').slice(0, 9);
  sheet.appendRow([now, id, asText(name), input.effect, line ? asText(line) : '', '', now]);
  out = gaPlayers(); out.saved = id; return out;
}

// 停用／恢復 { id, retired }：停用的不能再發，已經發出去的照樣有效（要收回去「道具」那邊收）
function gaLibRetire(input) {
  var lib = readLib(true), x = lib[String(input.id || '')];
  if (!x || !x.row) return { result: 'error', error: '道具庫找不到這個道具' };
  if (!input.retired && Object.keys(lib).some(function (k) { return k !== x.id && !lib[k].retiredAt && lib[k].name === x.name; })) return { result: 'error', error: '道具庫已經有同名的「' + x.name + '」，先改名再恢復' };
  libSheet().getRange(x.row, 6).setValue(input.retired ? new Date() : '');
  return gaPlayers();
}

// 發道具：{ key（玩家）, perk（道具庫的 id）, days（0 或沒帶＝永久，最多 3650）, note? }。同一個人同一個道具還有效的話不重發
function gaPerkGrant(input) {
  var lib = readLib(true), item = lib[String(input.perk || '')];
  if (!item || !PERK_TYPES[item.effect]) return { result: 'error', error: '道具庫沒有這個道具' };
  if (item.retiredAt) return { result: 'error', error: '「' + item.name + '」停用了，不能再發' };
  var key = String(input.key || ''), who = null;
  gaPlayerRows().forEach(function (p) { if (p.key === key) who = p; });
  if (!who) return { result: 'error', error: '找不到這個玩家' };
  if (readPerks().some(function (x) { return x.active && x.lineId === who.lineId && x.perk === item.id; })) return { result: 'error', error: who.name + ' 已經有「' + item.name + '」了' };
  var days = Math.floor(Number(input.days) || 0);
  if (days < 0 || days > 3650) return { result: 'error', error: '期限要在 0～3650 天' };
  var note = String(input.note || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60);
  var now = new Date(), id = 'k' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  perksSheet().appendRow([now, id, who.lineId, item.id, note ? asText(note) : '', days ? new Date(now.getTime() + days * 864e5) : '', '', who.key]);
  CacheService.getScriptCache().remove('perks:v1');
  var out = gaPlayers(); out.granted = id; return out;
}

// 玩家自己的道具（錢包回傳時帶著，只給本人）：[{ perk（效果 key）, name（道具庫的名字）, line, expires }]，只回 live 的、還沒過期的。
// 整份名單快取 10 分鐘（'perks:v1'），發、收回時清掉；Perks 分頁還沒有就是沒有人有
function perksFor(lineId) {
  if (!lineId) return [];
  var cache = CacheService.getScriptCache(), map = null, raw = cache.get('perks:v1');
  if (raw) { try { map = JSON.parse(raw); } catch (e) { } }
  if (!map) {
    map = {};
    if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Perks')) {
      var lib = readLib(false);
      readPerks().forEach(function (x) {
        if (!x.active) return;
        var info = perkInfo(x.perk, lib);
        (map[x.lineId] = map[x.lineId] || []).push({ perk: info.effect, name: info.name, line: info.line, expires: x.expires });
      });
    }
    try { cache.put('perks:v1', JSON.stringify(map), 600); } catch (e) { }
  }
  var now = Date.now();
  return (map[lineId] || []).filter(function (x) { return PERK_TYPES[x.perk] && PERK_TYPES[x.perk].live && (!x.expires || x.expires > now); });
}

function gaPerkRevoke(input) {
  var x = readPerks().filter(function (y) { return y.id === String(input.id || ''); })[0];
  if (!x) return { result: 'error', error: '找不到這筆道具' };
  if (!x.revokedAt) perksSheet().getRange(x.row, 7).setValue(new Date());
  CacheService.getScriptCache().remove('perks:v1');
  return gaPlayers();
}

// 經濟體檢：只讀 Players，很快
function gaEcon() {
  var ps = gaPlayerRows(), now = Date.now(), sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
  var money = ps.map(function (p) { return p.money; }), med = econMedian(money);
  var sources = {};
  ps.forEach(function (p) { Object.keys(p.sources).forEach(function (k) { var s = sources[k] || (sources[k] = { total: 0, times: 0, people: 0, bests: [] }); s.total += p.sources[k].total; s.times += p.sources[k].times; if (p.sources[k].total) s.people++; if (p.sources[k].best) s.bests.push(p.sources[k].best); }); });
  var top = ps.slice().sort(function (a, b) { return b.money - a.money; }).slice(0, 5).map(function (p) { return { name: p.name, money: p.money, earned: p.earned, spent: p.spent }; });
  var flags = [];
  ps.forEach(function (p) {
    if (p.money >= WALLET_MAX * 0.9) flags.push({ name: p.name, why: '錢包快到上限（一兆）' });
    else if (med > 0 && p.money > med * 10 && p.money > 100000) flags.push({ name: p.name, why: '錢是全站中位數的 ' + Math.round(p.money / med) + ' 倍' });
    Object.keys(p.sources).forEach(function (k) {
      var b = p.sources[k].best, mb = econMedian(sources[k].bests);
      if (sources[k].bests.length >= 3 && mb > 0 && b > mb * 4 && b > 20000) flags.push({ name: p.name, why: (ECON_NAMES[k] || k) + ' 一場賺 $' + Math.round(b) + '，是大家中位數的 ' + Math.round(b / mb) + ' 倍' });
    });
  });
  var earnedAll = sum(ps.map(function (p) { return p.earned; }));
  return {
    result: 'success', now: now,
    players: ps.length, active7: ps.filter(function (p) { return p.updated && now - p.updated < 7 * 864e5; }).length,
    active1: ps.filter(function (p) { return p.updated && now - p.updated < 864e5; }).length,
    money: sum(money), median: med, topRatio: med > 0 ? Math.round(Math.max.apply(null, money) / med * 10) / 10 : 0,
    earned: earnedAll, spent: sum(ps.map(function (p) { return p.spent; })),
    shopSpent: sum(ps.map(function (p) { return p.shopSpent; })), donated: sum(ps.map(function (p) { return p.donated; })), lit: sum(ps.map(function (p) { return p.lit; })),
    sources: Object.keys(sources).map(function (k) { return { key: k, name: ECON_NAMES[k] || k, total: sources[k].total, times: sources[k].times, people: sources[k].people, share: earnedAll ? Math.round(sources[k].total / earnedAll * 1000) / 10 : 0 }; })
      .sort(function (a, b) { return b.total - a.total; }),
    top: top, flags: flags.slice(0, 30)
  };
}
var ECON_NAMES = { xitou: '坐洗・泡', clean: '房務・淨', farm: '菜園・拔', wifi: '蹭・網', zaocan: '早餐・煎', ship: '貨運・航', dessert: '甜點・轉', stack: '疊・巢', mine: '礦坑・挖',
  scratch: '刮刮樂', bonus: '紅包', caishen: '財神燈', insure: '保險', wish: '許願池' };

// 真人工資：照紀錄分頁算（跟 econReport 一樣，但只回傳、不寫「對帳」分頁）。{ days?: 30 }
function gaWage(input) {
  var days = Math.floor(Number(input.days) || 0);
  var r = econCompute(days > 0 ? days : 0);
  return { result: 'success', head: ECON_HEAD, rows: r.out, days: days };
}

