// 公司・開的五間辦公室（現代像素・細顆粒，一顆一個 CSS 像素）：從 docs/plans/company/office5.html 搬出來，company.html 和 office5.html 共用。
// CompanyOffice.paint(canvas, 第幾階 1～5) → 畫好，回傳每個坐墊的位置 [[x, y], …]（角色坐在那裡，y 是桌面）。
// 畫布寬：車庫、小辦公室、整層樓 375，二十七樓 600、自己的大樓 1160（手機上左右滑），高都是 190。
window.CompanyOffice = (() => {
const DRAWS = {};
const stage = (id, draw) => { DRAWS[id] = draw; };

const W = 375, H = 190;
const C = { ink0: '#1c2229', ink: '#26303a', ink2: '#3a4656', ink3: '#56677a', g1: '#7a8c9d', g2: '#9fb1c0', g3: '#c2d0da', g4: '#e6ecf0', g5: '#f2f6f8', wh: '#ffffff',
  sky1: '#c3d8e4', sky2: '#d3e3eb', sky3: '#e2edf2', c1: '#a3bccb', c2: '#869fb1', c3: '#c3d6e1', cy0: '#4fa9bf', cy: '#8fd3e0', cy2: '#c9f0f6',
  b0: '#2b5290', b1: '#3d6fb6', au0: '#8a5a14', au1: '#e2b44a', au2: '#ffe9a0', gr0: '#2f6e47', gr1: '#3f8a5a', gr2: '#6cb487',
  kr: '#e8d6b0', kr2: '#c9ad7c', kr0: '#8f7448', wd: '#c99a68', wd2: '#a77a4c', wd0: '#5e4026', rg: '#e9d8bf', rg2: '#d6bf9d', rg3: '#c98f6b', pk: '#f08a80', yl: '#f2c94c', cn: '#b9bcbd', cn2: '#a2a6a8', cn3: '#cfd2d2',
  bk: '#1f2228', bk2: '#2c3038', red: '#d8433a', warm: '#f4dfa8', o2: '#f0a04b', pk2: '#f8c3bc', cl: '#f6fafc' };
let SIGN = null;   // 門牌上的字（paint 時設定）
const DON = ['..x...x..', '..x...x..', 'xxxxxxxxx', '..x...x..', '..x.x.x..', '..x...x..', 'xxxxxxxxx', '..x...x..', '.x.....x.'];   // 「丼」

function paintOn(cv, id, draw) {
  const x = cv.getContext('2d'), W = cv.width;
  const R = (a, b, w, h, c) => { x.fillStyle = c; x.fillRect(Math.round(a), Math.round(b), Math.round(w), Math.round(h)); };
  const px = (a, b, c) => R(a, b, 1, 1, c);
  const el = (cx, cy, rx, ry, c) => { for (let j = Math.floor(cy - ry); j <= cy + ry; j++) for (let i = Math.floor(cx - rx); i <= cx + rx; i++) { const u = (i + .5 - cx) / rx, v = (j + .5 - cy) / ry; if (u * u + v * v <= 1) px(i, j, c); } };
  const checker = (a, b, w, h, c1, c2) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(a + i, b + j, (i + j) % 2 ? c1 : c2); };
  const dither = (a, b, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((a + i + b + j) % 2 === 0) px(a + i, b + j, c); };
  const glyph = (rows, a, b, c, s = 1) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === 'x') R(a + i * s, b + j * s, s, s, c); }));
  // 城市（三層）：窗戶裡的景
  const city = (a, b, w, h, seed, low = 0) => {
    R(a, b, w, h * .45, C.sky3); R(a, b + h * .45, w, h * .3, C.sky2); R(a, b + h * .75, w, h * .25, C.sky1);
    let r = seed; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    for (const [col, base, hh] of [[C.c3, .35, .5], [C.c1, .5, .45], [C.c2, .68, .35]]) { let i = 0; while (i < w) { const bw = 6 + Math.floor(rnd() * 12), bh = h * (hh * (.4 + rnd() * .6)) * (1 - low); R(a + i, b + h - bh - (low ? 0 : 0), Math.min(bw, w - i), bh, col); if (col === C.c2) for (let k = 2; k < bh - 2; k += 3) for (let q = 2; q < bw - 2; q += 3) if (rnd() > .55) px(a + i + q, b + h - bh + k, C.sky3); i += bw + 1; } }
  };
  const glassDesk = (cx, y, w, holo) => { const L = Math.round(cx - w / 2);   // 玻璃桌：看得到頂面、有厚度、兩道反光、桌腳有腳座和橫桿
    R(L + 2, y - 3, w - 4, 1, C.g3); checker(L + 1, y - 2, w - 2, 2, C.cy2, C.sky3);   // 頂面（往後退一點，看得到一片玻璃）
    for (let k = 0; k < 2; k++) { const rx = L + 6 + k * Math.round(w * .45); px(rx, y - 1, C.wh); px(rx + 1, y - 2, C.wh); px(rx + 2, y - 3, C.wh); }   // 反光
    R(L, y, w, 1, C.wh); checker(L, y + 1, w, 2, C.sky3, C.cy2); R(L, y + 3, w, 1, C.g2);   // 前緣厚度
    [L + 3, L + w - 5].forEach(lx => { R(lx, y + 4, 2, 14, C.g2); R(lx, y + 4, 1, 14, C.g3); R(lx - 1, y + 18, 4, 1, C.g1); });   // 桌腳＋腳座
    R(L + 5, y + 12, w - 10, 1, C.g3);   // 橫桿
    if (holo) { const sx = cx + w / 2 - 15, sy = y - 17, sw = 13, sh = 9;   // 全息螢幕：半透明面板＋掃描線、青色發光邊、投影器往上打一道光束
      R(sx + 4, y - 3, 5, 2, C.ink2); px(sx + 6, y - 4, C.cy2);   // 投影器
      for (let j = sy + sh + 1; j < y - 4; j++) { const t = (y - 4 - j) / (y - 4 - sy - sh), half = 1 + t * 4; for (let i = Math.round(sx + 6 - half); i <= sx + 6 + half; i++) if ((i + j) % 2 === 0) px(i, j, C.cy2); }   // 光束
      R(sx - 1, sy - 1, sw + 2, 1, C.cy); R(sx - 1, sy + sh, sw + 2, 1, C.cy); R(sx - 1, sy, 1, sh, C.cy); R(sx + sw, sy, 1, sh, C.cy);   // 發光邊
      checker(sx, sy, sw, sh, C.cy2, C.sky3); for (let j = sy + 1; j < sy + sh; j += 2) R(sx, j, sw, 1, C.cy2);   // 半透明＋掃描線
      R(sx, sy, sw, 1, C.wh); [[2, 2, 7], [2, 4, 9], [2, 6, 5]].forEach(([a, b, ww]) => R(sx + a, sy + b, ww, 1, C.cy0)); } };
  const monitor = (cx, y) => { const L = Math.round(cx - 7); FX.mon.push([L + 1, y - 10, 12, 6]);   // 螢幕：外框、畫面裡一個視窗（標題列＋三行字）、反光、電源燈、支架＋底座
    R(L, y - 13, 14, 10, C.ink2); R(L + 1, y - 12, 12, 8, C.cy); R(L + 1, y - 12, 12, 2, C.b1); px(L + 11, y - 12, C.wh);
    R(L + 2, y - 9, 7, 1, C.cy0); R(L + 2, y - 7, 9, 1, C.cy0); R(L + 2, y - 5, 5, 1, C.cy0); px(L + 9, y - 10, C.cy2); px(L + 10, y - 11, C.cy2);
    px(L + 12, y - 4, C.gr2); R(L + 6, y - 3, 2, 2, C.ink3); R(L + 4, y - 1, 6, 1, C.ink3); };
  const FX = (window.OFX = window.OFX || {})[id] = { mon: [], bulb: [] };   // 會動的地方（頁面拿去做動畫）：螢幕的字、燈泡的光
  const SEATS = (window.SEATS = window.SEATS || {})[id] = [];   // 每個坐墊的位置（介面樣張拿去貼角色）
  const cushion = (cx, y) => { SEATS.push([cx, y]); const L = Math.round(cx - 8), w = 16;   // 公司配發的坐墊：方方鼓鼓、四角小穗、正面一排繡線（跟一般員工那張一致）
    [[2, C.g1], [1, C.g4], [0, C.g4], [0, C.g3], [0, C.g3], [1, C.g2], [2, C.g1]].forEach(([ins, c], j) => R(L + ins, y - 7 + j, w - ins * 2, 1, c));
    R(L, y - 5, 1, 3, C.g1); R(L + w - 1, y - 5, 1, 3, C.g1); R(L + 1, y - 6, 1, 1, C.g1); R(L + w - 2, y - 6, 1, 1, C.g1); R(L + 1, y - 2, 1, 1, C.g1); R(L + w - 2, y - 2, 1, 1, C.g1);
    for (let i = L + 3; i < L + w - 3; i += 2) px(i, y - 3, C.g1);   // 繡線
    [[L - 1, y - 7], [L + w, y - 7], [L - 1, y - 2], [L + w, y - 2]].forEach(([a, b]) => px(a, b, C.g2)); };   // 四角小穗
  const leaf = (x0, y0, len, ang, wmax) => { const cs = Math.cos(ang), sn = Math.sin(ang);   // 一片尖尖的葉子：兩半深淺不同、中間葉脈
    for (let t = 0; t <= len; t += .5) { const wd = Math.sin(Math.PI * t / len) * wmax, cx = x0 + cs * t, cy = y0 + sn * t;
      for (let k = -wd; k <= wd; k += .5) px(Math.round(cx - sn * k), Math.round(cy + cs * k), k < 0 ? C.gr1 : C.gr0);
      if (t > 1 && t < len - 1) px(Math.round(cx), Math.round(cy), C.gr2); } };
  const plant = (a, b, s = 1) => {   // 大盆栽：上寬下窄的花盆＋盆口＋一層土、莖分枝、尖葉
    const ph = Math.round(8 * s); for (let j = 0; j < ph; j++) { const hw = Math.round(5 * s - j * .35); R(a - hw, b - ph + j, hw * 2, 1, C.g2); R(a + hw - Math.max(1, Math.round(s)), b - ph + j, Math.max(1, Math.round(s)), 1, C.g1); }
    R(a - 6 * s, b - ph - 2, 12 * s, 2, C.g4); R(a - 6 * s, b - ph, 12 * s, 1, C.g1); R(a - 5 * s, b - ph - 3, 10 * s, 1, C.wd0);
    const top = b - ph - 3; R(a, top - 15 * s, 1, 15 * s, C.gr0); R(a - 3 * s, top - 9 * s, 3 * s, 1, C.gr0); R(a + 1, top - 12 * s, 3 * s, 1, C.gr0);
    leaf(a - 3 * s, top - 9 * s, 9 * s, Math.PI * 1.12, 2.6 * s); leaf(a + 3 * s, top - 12 * s, 9 * s, -Math.PI * .1, 2.6 * s);
    leaf(a, top - 15 * s, 8 * s, -Math.PI * .5, 2.4 * s); leaf(a - 1, top - 6 * s, 8 * s, Math.PI * .85, 2.2 * s); leaf(a + 1, top - 5 * s, 8 * s, Math.PI * .08, 2.2 * s); };
  const sign = (a, b, kind) => {   // 門口的銘牌：紙名片 → 木牌 → 拉絲銀牌 → 黑底金字 → 黑漆金框（字是公司名字的第一個字，12×12；沒有就是 9×9 的「丼」，牌子跟著字大小長大 e 格）
    const G = SIGN, e = Math.max(G.length, G[0].length) - 9;
    if (kind === 1) { R(a, b, 22 + e, 13 + e, C.wh); R(a, b + 12 + e, 22 + e, 1, C.g2); R(a + 21 + e, b, 1, 13 + e, C.g2); glyph(G, a + 3, b + 2, C.ink2); R(a + 14 + e, b + 4, 5, 1, C.g2); R(a + 14 + e, b + 7, 4, 1, C.g2); R(a + 10, b - 1, 2, 2, C.red); }
    if (kind === 2) { R(a, b, 26 + e, 15 + e, C.wd); R(a, b, 26 + e, 1, C.kr); R(a, b + 14 + e, 26 + e, 1, C.wd0); R(a + 25 + e, b, 1, 15 + e, C.wd2); for (let i = 3; i < 24 + e; i += 5) R(a + i, b + 4, 3, 1, C.wd2); glyph(G, a + 8, b + 3, C.wd0); px(a + 2, b + 2, C.g1); px(a + 23 + e, b + 2, C.g1); }
    if (kind === 3) { R(a, b, 30 + e, 15 + e, C.g3); for (let j = 1; j < 14 + e; j += 2) R(a, b + j, 30 + e, 1, C.g4); R(a + 1, b + 1, 28 + e, 1, C.g1); R(a + 1, b + 13 + e, 28 + e, 1, C.g1); R(a + 1, b + 1, 1, 13 + e, C.g1); R(a + 28 + e, b + 1, 1, 13 + e, C.g1); R(a, b, 30 + e, 1, C.wh); glyph(G, a + 4, b + 3, C.ink2); R(a + 16 + e, b + 6, 9, 1, C.ink3); R(a + 16 + e, b + 9, 7, 1, C.ink3); }
    if (kind === 4) { R(a, b, 34 + e, 16 + e, C.bk); R(a, b, 34 + e, 1, C.bk2); glyph(G, a + 4, b + 4, C.au1); R(a + 17 + e, b + 6, 12, 1, C.au1); R(a + 17 + e, b + 9, 9, 1, C.au0); if (!e) px(a + 5, b + 4, C.au2); }
    if (kind === 5) { R(a, b, 44 + e, 20 + e, C.au0); R(a + 1, b + 1, 42 + e, 18 + e, C.au1); R(a + 2, b + 2, 40 + e, 16 + e, C.bk); R(a + 3, b + 3, 38 + e, 1, C.bk2); glyph(G, a + 6, b + 6 - (e ? 1 : 0), C.au1); R(a + 19 + e, b + 8, 15, 1, C.au1); R(a + 19 + e, b + 11, 11, 1, C.au0);
      [[-3, 9], [44 + e, 9]].forEach(([dx, dy]) => { px(a + dx + 1, b + dy - 1, C.au1); R(a + dx, b + dy, 3, 1, C.au1); px(a + dx + 1, b + dy + 1, C.au1); }); if (!e) px(a + 7, b + 6, C.au2); }
  };
  const halo = (cx, cy, r) => { for (let j = Math.floor(cy - r); j <= cy + r; j++) for (let i = Math.floor(cx - r); i <= cx + r; i++) { const d = Math.hypot(i + .5 - cx, j + .5 - cy); if (d <= r && d > 4 && (i + j) % 2 === 0) px(i, j, C.warm); } };   // 燈泡旁邊一小圈圓圓的光暈
  const cone = () => {};   // 往下打的點點光線不畫了（使用者：燈光的光線很多餘）
  const newLamp = (lx, top, len) => { FX.bulb.push([lx, top + len + 7, 0]); R(lx, top, 1, len, C.ink2); el(lx, top + len + 3, 7, 4, C.bk2); R(lx - 7, top + len + 3, 15, 4, C.bk2); R(lx - 6, top + len + 3, 13, 1, C.ink3); R(lx - 5, top + len + 6, 11, 1, C.au2); dither(lx - 5, top + len + 7, 11, 2, C.warm); };   // 新的吊燈：黑色燈罩
  const lamp = (lx, top, len) => { const by = top + len; FX.bulb.push([lx + .5, by + 8, 1]);   // 車庫那顆舊燈泡（每次搬家都帶走）：電線、纏一圈牛皮紙膠帶（翹一角）、金屬燈座、梨形玻璃燈泡＋燈絲、一小圈光暈
    R(lx, top, 1, len, C.ink2);
    R(lx - 1, by - 9, 3, 3, C.kr); px(lx - 1, by - 9, C.kr0); px(lx + 1, by - 7, C.kr2); px(lx + 2, by - 9, C.kr); px(lx + 3, by - 10, C.kr);   // 膠帶＋翹起的一角
    halo(lx, by + 7, 9);
    R(lx - 2, by, 5, 4, C.ink3); R(lx - 2, by + 1, 5, 1, C.g1); R(lx - 2, by + 3, 5, 1, C.g1);   // 金屬燈座（有紋路）
    el(lx + .5, by + 8, 4, 4.5, C.au1); el(lx + .5, by + 8, 3.2, 3.7, C.au2); R(lx - 1, by + 4, 3, 1, C.au2);   // 梨形玻璃
    px(lx - 1, by + 7, C.o2); px(lx, by + 8, C.o2); px(lx + 1, by + 7, C.o2); px(lx + 2, by + 8, C.o2); px(lx - 1, by + 6, C.o2); px(lx + 2, by + 6, C.o2);   // 燈絲
    px(lx - 2, by + 6, C.wh); px(lx - 2, by + 7, C.wh); };
  const txt = (str, a, b, size, col, rot = 0) => { x.save(); x.translate(a, b); x.rotate(rot); x.fillStyle = col; x.font = `${size}px "Noto Sans TC", sans-serif`; x.textBaseline = 'top'; x.fillText(str, 0, 0); x.restore(); };
  const rug = (a, b, w, h, c1, c2) => {   // 地毯：後窄前寬（平鋪在地上的透視）、一圈有花紋的滾邊、細織紋、前緣一排流蘇
    for (let j = 0; j < h; j++) { const ins = Math.round((1 - j / h) * 4), L = a + ins, ww = w - ins * 2, edge = j < 3 || j >= h - 3;
      R(L, b + j, ww, 1, edge ? c2 : c1); if (!edge) { R(L, b + j, 3, 1, c2); R(L + ww - 3, b + j, 3, 1, c2); if (j % 3 === 0) for (let i = L + 6; i < L + ww - 6; i += 4) px(i + (j % 6 ? 2 : 0), b + j, c2); }
      if (j === 1 || j === h - 2) for (let i = L + 2; i < L + ww - 2; i += 3) px(i, b + j, c1); }
    for (let i = a + 1; i < a + w - 1; i += 2) { px(i, b + h, c2); px(i, b + h + 1, c2); } };
  draw({ R, px, el, checker, dither, glyph, city, glassDesk, monitor, cushion, plant, sign, lamp, newLamp, txt, rug, W, x, cone, leaf });
}

// 第四版（2026-11-25，室內設計師）：每間左邊有門、銘牌掛在門邊牆上；桌子兩三張一組、中間留走道；窗外跟著樓層變；
// 天花板一階一階不一樣（車庫裸露低樑 → 輕鋼架 → 管線外露漆白 → 木格柵＋線型燈 → 大廳挑高）；舊燈泡永遠掛在元老座位正上方。
const C2 = { ap: '#d9cdb8', ap2: '#c4b69c', grill: '#5d6670', tarp: '#5f7f9a', tarp2: '#4a6880', tire: '#2c3038', stone: '#30343b', stone2: '#3a3f47', brass: '#c9a35a', brass2: '#9c7a38' };
const kit = K => { const { R, px, el, checker, dither, glyph, cushion, glassDesk, monitor, x, W, leaf } = K;
  return {
    door: (a, top0, bot, style) => { const w = 26, top = bot - 58;   // 門：框＋門板＋把手；固定正常比例（使用者：門比例很怪，原本又窄又高像置物櫃）
      const fr = style === 1 ? C.g1 : style === 2 ? C.wd0 : style === 3 ? C.g1 : style === 4 ? C.bk : C2.brass2, pn = style === 1 ? C.g3 : style === 2 ? C.wd : style === 3 ? C.cy2 : style === 4 ? C.wd2 : C.cy2;
      R(a - 2, top - 2, w + 4, bot - top + 2, fr); R(a, top, w, bot - top, pn);
      if (style === 3 || style === 5) { dither(a + 1, top + 1, w - 2, bot - top - 2, C.wh); R(a + w / 2, top, 1, bot - top, fr); } else if (style === 4) { } else { R(a + 2, top + 3, w - 4, 1, C.g4); R(a + 2, top + 3, 1, bot - top - 6, C.g4); }
      R(a + w - 5, top + (bot - top) / 2, 2, 5, style === 5 ? C.au1 : C.ink3); },
    // 一組桌子：n 張靠在一起，第一個 k 是元老位（回傳每張的中心）
    cluster: (a, y, n, w, opt = {}) => { const xs = []; for (let k = 0; k < n; k++) { const cx = a + w / 2 + k * w; glassDesk(cx, y, w - 1, opt.holo && (k % 2 === 0)); if (!opt.holo && (k % 2 === 1 || n === 1)) monitor(cx + w / 4, y); if (opt.holo && k % 2) monitor(cx + w / 4, y); cushion(cx - w / 5, y); xs.push(cx - w / 5); } return xs; },
    // 四角壓暗：一圈一圈階梯式（像素感）
    vignette: (cx, cy, r1, r2, k = .72) => { const im = x.getImageData(0, 0, W, 190), d = im.data;
      for (let j = 0; j < 190; j++) for (let i = 0; i < W; i++) { const t = Math.hypot((i - cx) / (W * .5), (j - cy) / (190 * .5)), f = t < 1.05 ? 1 : t < 1.2 ? .95 : .9;   /* 只有四個角落淡淡暗一點（妹妹：整圈像監視器畫面） */ if (f < 1) { const o = (j * W + i) * 4; d[o] *= f; d[o + 1] *= f; d[o + 2] *= f; } }
      x.putImageData(im, 0, 0); },
    glare: (a, top, h, step, x2) => { for (let i = a; i + 12 < x2; i += step) for (let k = 0; k < 2; k++) { const o = i + 8 + k * 5, len = k ? 6 : 10; for (let j = 0; j < len; j++) px(o + len - j, top + 4 + j + k * 2, j % 3 === 2 ? C.sky3 : C.wh); } },   // 窗玻璃反光：每一格兩道斜斜的白光
    lowPlant: (a, b0, w) => { const b = b0 - 8, fl = b + 18;   // 矮盆栽隔間：從地板立起來的長條木花槽（高度到桌面）、木紋、三片高高低低的尖葉；b 是桌面高度
      R(a, b + 6, w, fl - b - 6, C.wd2); R(a, b + 5, w, 2, C.kr); R(a, fl - 1, w, 1, C.wd0); R(a + Math.floor(w / 2), b + 8, 1, fl - b - 10, C.wd); R(a + w - 1, b + 7, 1, fl - b - 8, C.wd0); R(a + 1, b + 4, w - 2, 1, C.wd0);
      leaf(a + w / 2, b + 4, 9, -Math.PI * .58, 1.8); leaf(a + 1, b + 5, 7, -Math.PI * .82, 1.6); leaf(a + w - 1, b + 5, 7, -Math.PI * .2, 1.6); },
  }; };

// ===== 一　車庫創業：裸露的低樑、半開鐵捲門、側門＋紙名片、一顆燈泡照元老位、四角壓暗、右邊停一台機車 =====
stage('s1', K => { const { R, px, el, checker, dither, city, cushion, sign, txt, cone, W } = K, Q = kit(K);
  R(0, 0, W, H, C.cn3);
  for (let j = 30; j < 118; j += 6) { R(70, j, 190, 1, C.g2); R(70, j + 1, 190, 1, C.g4); }   // 鐵捲門的橫條
  R(66, 26, 198, 4, C.g1); R(66, 26, 4, 92, C.g1); R(260, 26, 4, 92, C.g1); R(70, 30, 190, 2, C.ink3);
  city(70, 100, 190, 18, 7); R(70, 96, 190, 4, C.g1); R(70, 96, 190, 1, C.g3); R(70, 99, 190, 1, C.ink3); [120, 206].forEach(i => { R(i, 98, 8, 1, C.ink2); R(i, 98, 1, 3, C.ink2); R(i + 7, 98, 1, 3, C.ink2); R(i, 101, 8, 1, C.ink2); });   // 鐵捲門半開：底座橫桿＋兩個拉把
  R(69, 30, 1, 88, C.ink3); R(260, 30, 1, 88, C.ink3);   // 兩側導軌
  R(0, 0, W, 10, C.cn2); for (let k = 0; k < 90; k++) px((k * 37) % W, (k * 7) % 9, k % 2 ? C.cn : '#9a9ea0');   // 混凝土板＋斑點
  for (let i = 8; i < W; i += 34) { R(i, 0, 7, 16, C.cn3); R(i, 0, 2, 16, C.wh); R(i + 5, 0, 2, 16, C.g1); R(i, 15, 7, 1, C.g1); }   // 一根根小樑：左邊受光、右邊陰影、底面
  R(0, 16, W, 5, C.cn3); R(0, 16, W, 1, C.wh); R(0, 20, W, 1, C.g1); R(0, 21, W, 1, C.cn2);   // 前面一根橫向大樑
  R(0, 18, W, 1, C.ink3); for (let i = 20; i < W; i += 40) R(i, 17, 1, 3, C.g1);   // 沿著大樑走的電線管＋固定夾
  Q.door(14, 52, 118, 1); sign(43, 66, 1);
  R(14, 66, 2, 4, C.ink3); R(14, 100, 2, 4, C.ink3); for (let j = 104; j < 114; j += 2) R(18, j, 18, 1, C.g1);   // 鐵門：鉸鏈、下方通風百葉   // 側門＋門邊的紙名片
  R(0, 118, W, 72, C.cn); for (let i = 0; i < W; i += 23) R(i, 118, 1, 72, C.cn2); R(0, 118, W, 1, C.cn2); R(0, 140, W, 1, C.cn2);
  el(250, 176, 16, 3, C.cn2);
  R(276, 36, 88, 50, C.kr); R(276, 36, 88, 1, C.kr2); for (let j = 42; j < 84; j += 6) for (let i = 280; i < 362; i += 6) px(i, j, C.kr2);   // 洞洞板工具牆
  [[289, 42], [310, 42], [329, 42], [348, 42]].forEach(([a, b]) => { R(a, b, 2, 2, C.ink3); });   // 掛勾
  R(289, 51, 3, 18, C.wd); R(289, 51, 1, 18, C.kr); R(289, 66, 3, 3, C.ink2); R(283, 45, 14, 5, C.ink3); R(283, 45, 14, 1, C.g2); R(282, 46, 2, 3, C.ink3); R(295, 47, 3, 1, C.ink3);   // 鐵鎚：鐵頭（一邊平、一邊羊角）＋木柄
  R(309, 52, 3, 14, C.g1); R(309, 52, 1, 14, C.g3); el(310.5, 49, 4, 3.5, C.g1); R(309, 45, 3, 4, C.kr); el(310.5, 68, 3.5, 3, C.g1); el(310.5, 68.5, 1.6, 1.4, C.kr);   // 扳手：一頭開口、一頭圓環
  R(328, 45, 4, 9, C.red); R(328, 45, 1, 9, '#e06a5c'); R(328, 48, 4, 1, '#8c2a22'); R(329, 54, 2, 13, C.g2); R(329, 54, 1, 13, C.wh); px(329, 67, C.g1);   // 螺絲起子：紅柄＋銀桿
  R(344, 46, 11, 11, C.yl); R(344, 46, 11, 1, '#f7e08a'); R(344, 56, 11, 1, C.o2); el(349.5, 51.5, 3, 3, C.ink3); el(349.5, 51.5, 1.4, 1.4, C.g2); R(355, 54, 3, 2, C.g2); R(357, 52, 1, 4, C.ink3);   // 黃色捲尺
  R(96, 46, 50, 34, C.wh); R(96, 46, 50, 1, C.g3); R(96, 79, 50, 1, C.g2); R(95, 46, 1, 34, C.g1); R(146, 46, 1, 34, C.g1); R(104, 80, 2, 36, C.g1); R(136, 80, 2, 36, C.g1);   // 白板
  txt('目標：', 99, 49, 9, C.b1, -.05); txt('搬家！', 104, 61, 11, C.red, -.08); R(100, 75, 30, 1, C.b1);
  // 機車（右半邊）：沒蓋布，車頭朝左的速克達。比例照真的機車量：輪徑 18px（約 55 公分）→ 軸距 42、座高 26、龍頭高 36、全長約 60
  { const bd = '#8fc1b5', bd2 = '#6fa396', bd3 = '#c3e2d9', G = 186;   // 薄荷綠車身：本色、陰影、亮面；G 是地面
    el(330, G + 1, 34, 1.5, C.cn2);   // 地上的影子
    const FX = 306, RX = 348, WY = G - 9;   // 前輪、後輪中心
    R(FX - 1, 166, 2, 11, C.g1); R(FX, 166, 1, 11, C.g3);   // 前叉（擋泥板到輪軸）
    R(328, 171, 22, 7, C.g1); R(328, 171, 22, 1, C.g2); R(346, 172, 3, 4, C.g1); R(332, 174, 10, 1, C.g3); R(326, 178, 4, 1, C.ink3);   // 引擎＋傳動箱：從腳踏板底下一路接到後輪軸
    [FX, RX].forEach(cx => { el(cx, WY, 9, 9, C2.tire); el(cx, WY, 6, 6, C.ink2); el(cx, WY, 4.5, 4.5, C.g2); el(cx, WY, 2, 2, C.g1); px(cx - 3, WY - 3, C.wh); px(cx - 2, WY - 4, C.wh); });   // 輪胎、輪框、輪軸
    el(RX, WY, 3.5, 3.5, C.g1); el(RX - 1, WY - 1, 1.5, 1.5, C.g3);   // 傳動箱的尾端：圓蓋在後輪軸上
    for (let j = 150; j <= 165; j++) { const L = Math.round(304 - (j - 150) * .2), w = 9 + Math.round(Math.max(0, j - 156) * .5); R(L, j, w, 1, bd); px(L, j, bd3); px(L + w - 1, j, bd2); }   // 車頭前罩：上窄下寬、往前斜
    for (let j = 160; j <= 173; j++) { const L = Math.max(Math.round(304 - (j - 150) * .2) + 4, FX + Math.ceil(Math.sqrt(Math.max(0, 81 - (j - WY) ** 2))) + 2), Rr = j < 166 ? L + 9 : Math.min(331, L + 9 + (j - 165) * 3); R(L, j, Rr - L, 1, bd); px(Rr - 1, j, bd2); } R(314, 170, 17, 1, bd3); R(316, 174, 15, 1, bd2);   // 前罩底部往後彎，順順地接到腳踏板   // 前罩底部往後彎，接到腳踏板
    for (let i = FX - 9; i <= FX + 6; i++) { const t = WY - Math.round(Math.sqrt(Math.max(0, 110 - (i - FX) ** 2))) - 1; px(i, t, bd3); px(i, t + 1, bd); }   // 前輪擋泥板：貼著輪胎上緣一道弧
    R(303, 147, 13, 4, bd); R(303, 147, 13, 1, bd3); R(315, 148, 1, 3, bd2);   // 龍頭罩
    el(303, 149, 2, 2, C.g3); el(303, 149, 1.3, 1.3, C.yl); px(302, 148, C.wh);   // 大燈（在龍頭罩前面）
    R(315, 147, 3, 1, C.ink0); R(317, 146, 2, 1, C.ink0); px(316, 148, C.ink2);   // 握把（往後上翹）
    R(311, 140, 1, 7, C.g1); el(311.5, 139, 2.5, 1.5, C.g1); el(311.5, 139, 1.5, 0.8, C.cy2);   // 後照鏡
    el(344, 167, 16, 7, bd); R(329, 161, 27, 13, bd); el(355, 167, 6, 6, bd); R(330, 161, 24, 1, bd3); R(331, 165, 22, 1, bd3); R(329, 173, 27, 1, bd2); px(360, 168, bd2); px(359, 171, bd2);   // 後車身：蓋住後輪上半、尾巴圓圓的
    R(327, 157, 19, 4, C.ink2); R(345, 156, 12, 5, C.ink2); R(328, 157, 17, 1, C.ink3); R(346, 156, 10, 1, C.ink3); R(327, 160, 30, 1, C.ink0); for (let i = 330; i < 355; i += 5) px(i, 158, C.ink3);   // 黑座墊：前低後高一點、縫線
    R(354, 155, 6, 1, C.g2); R(359, 155, 1, 4, C.g2);   // 後扶手
    R(359, 163, 2, 3, C.red); px(359, 163, '#e06a5c'); R(356, 168, 5, 3, C.wh); R(357, 169, 3, 1, C.ink3);   // 尾燈、車牌
    R(334, 178, 1, 8, C.g1); R(332, 185, 4, 1, C.g1); }   // 側柱
  [[14, 150, 30, 22], [20, 130, 22, 20], [52, 160, 20, 12]].forEach(([a, b, w, h]) => { R(a, b, w, h, C.kr); R(a, b, w, 2, C.kr2); R(a + w / 2 - 2, b, w > 25 ? 4 : 3, h, C.warm); R(a + w - 2, b, 2, h, C.kr2); R(a, b + h - 1, w, 1, C.kr0); R(a + 2, b + 2, w - 4, 1, C.kr0); if (w > 25) { R(a + 3, b + 8, 8, 6, C.wh); R(a + 4, b + 10, 5, 1, C.ink3); R(a + 4, b + 12, 4, 1, C.ink3); } });   // 紙箱：上蓋縫、膠帶、一張手寫標籤
  const ty = 150; R(80, ty, 210, 3, C.g5); R(80, ty + 3, 210, 1, C.g1); R(86, ty + 4, 2, 22, C.g1); R(282, ty + 4, 2, 22, C.g1); R(86, ty + 18, 198, 1, C.g2); R(85, ty + 26, 4, 1, C.ink3); R(281, ty + 26, 4, 1, C.ink3);   // 折疊桌：加長到 210（三隻坐上去會擠，使用者 2026-11-25 介面樣張時發現），桌腳底下的腳墊
  [118, 182, 250].forEach(cx => cushion(cx, ty));   // 三個位子拉開：茱莉鴨的枕頭最寬
  R(217, ty - 8, 8, 8, C.wh); R(217, ty - 8, 8, 2, C.o2); R(216, ty - 9, 10, 1, C.g2); R(222, ty - 13, 1, 5, C.wd0); R(224, ty - 13, 1, 5, C.wd0); px(238, ty - 11, C.g3); px(239, ty - 13, C.g3);
  for (let i = 60; i < 116; i++) px(i, 182 + Math.round(Math.sin(i / 6) * 2), C.ink2); R(56, 178, 8, 6, C.wh); px(58, 180, C.ink3); px(61, 180, C.ink3);
  Q.vignette(150, 100, 70, 130, .74);   // 四角壓暗，燈泡那一圈最亮
  K.lamp(118, 19, 53);   // 舊燈泡：元老位正上方（跟其他四間同一個畫法）
});

// ===== 二　小辦公室：輕鋼架天花板＋一片平板燈、老公寓二樓（窗外對面是鐵窗和招牌）、分離式冷氣、門＋木牌、三張一組＋兩張一組 =====
stage('s2', K => { const { R, px, el, checker, dither, plant, sign, lamp, txt, rug, W } = K, Q = kit(K);
  R(0, 0, W, H, C.g4);
  R(0, 0, W, 14, C.g5); for (let j = 1; j < 14; j += 2) for (let i = (j % 4 === 1 ? 2 : 0); i < W; i += 4) px(i, j, C.g4);   // 礦纖板的細點
  for (let i = 0; i < W; i += 30) R(i, 0, 1, 14, C.g2); R(0, 7, W, 1, C.g2); R(0, 14, W, 2, C.g2);   // 輕鋼架格子
  R(211, 8, 29, 6, C.g3); R(212, 9, 27, 4, C.wh); R(212, 12, 27, 1, C.cy2); dither(206, 16, 39, 2, C.warm);   // 平板燈：放進一格、燈框、發光面、底下一點光暈
  R(61, 8, 29, 6, C.g3); for (let i = 63; i < 89; i += 2) R(i, 9, 1, 4, C.g1);   // 出風口
  // 窗：對面老公寓（米色磁磚、鐵窗、冷氣、招牌）
  R(104, 26, 140, 66, C.g1); R(107, 29, 134, 60, C2.ap); for (let j = 29; j < 89; j += 3) R(107, j, 134, 1, C2.ap2);
  [[114, 34], [176, 34]].forEach(([a, b]) => { R(a, b, 44, 26, C.sky1); for (let i = a; i <= a + 44; i += 4) R(i, b, 1, 28, C2.grill); R(a, b, 45, 1, C2.grill); R(a, b + 13, 45, 1, C2.grill); R(a, b + 27, 45, 1, C2.grill); el(a + 10, b + 20, 3, 4, C.gr1); });   // 鐵窗＋窗台的小盆栽
  R(120, 64, 14, 8, C.wh); R(120, 64, 14, 1, C.g3); for (let k = 0; k < 3; k++) R(122, 66 + k * 2, 10, 1, C.g2);   // 對面的冷氣
  R(170, 66, 66, 20, C.red); R(172, 68, 62, 16, C.yl); txt('麵', 178, 69, 12, C.red); txt('飯', 212, 69, 12, C.red);   // 對面一樓的招牌
  R(107, 29, 134, 5, C.g5); for (let j = 30; j < 34; j += 2) R(107, j, 134, 1, C.g3); R(107, 34, 134, 1, C.g2); R(232, 34, 1, 22, C.g1); el(232.5, 57, 1.2, 1.6, C.g1);   // 這邊的百葉拉起來收在窗上緣＋拉繩
  R(173, 29, 2, 60, C.g1);   // 窗戶中間的框
  R(100, 92, 148, 3, C.g3); R(100, 92, 148, 1, C.wh);
  R(258, 18, 46, 12, C.wh); R(258, 27, 46, 3, C.g3); R(260, 29, 42, 1, C.g2); R(298, 21, 3, 2, C.gr2);   // 分離式冷氣
  Q.door(14, 46, 114, 2); sign(46, 80, 2);
  R(18, 61, 18, 18, C.wd2); R(19, 62, 16, 16, C.wd); R(18, 84, 18, 22, C.wd2); R(19, 85, 16, 20, C.wd);   // 木門的上下兩片鑲板   // 門＋木牌
  R(258, 40, 24, 30, C.wh); R(258, 40, 24, 6, C.red); R(268, 38, 4, 3, C.ink3); for (let j = 49; j < 68; j += 4) for (let i = 261; i < 280; i += 4) px(i, j, C.g2); px(273, 57, C.red); px(274, 57, C.red);   // 月曆
  R(330, 52, 20, 60, C.wh); R(330, 52, 20, 1, C.g3); R(349, 52, 1, 60, C.g2); el(340, 42, 8, 9, C.cy2); R(337, 50, 6, 2, C.cy2); R(332, 40, 16, 1, '#a9dbe6'); R(332, 45, 16, 1, '#a9dbe6'); el(337, 38, 2.5, 2.5, C.wh);   // 倒過來插著的大水桶：桶身兩圈凹槽、瓶口插進機器、反光
  R(333, 60, 14, 14, C.g4); R(333, 60, 14, 1, C.g3);   // 出水的凹槽
  R(336, 62, 3, 2, C.b1); R(341, 62, 3, 2, C.red); R(337, 64, 1, 3, C.g1); R(342, 64, 1, 3, C.g1); R(336, 67, 3, 1, C.g1); R(341, 67, 3, 1, C.g1);   // 冷水（藍）熱水（紅）兩個出水頭
  R(334, 72, 12, 2, C.g2); for (let i = 335; i < 345; i += 2) px(i, 72, C.g1);   // 接水盤（有格柵）
  R(334, 82, 12, 18, C.g5); R(334, 82, 12, 1, C.g3); R(343, 90, 2, 3, C.g2);   // 下面的小櫃門   // 飲水機
  R(0, 114, W, 76, C.wd); for (let j = 118; j < H; j += 6) R(0, j, W, 1, C.wd2); for (let i = 0; i < W; i += 37) for (let j = 114; j < H; j += 12) R(i + (j % 24 ? 18 : 0), j, 1, 6, C.wd2);
  R(10, 114, 34, 2, C.wd0); R(12, 116, 30, 1, C.wd2);   // 門檻＋門底陰影，跟木地板分開（畫在地板之後）
  R(308, 77, 8, 10, C.red); R(308, 76, 8, 1, '#8c2a22'); for (let i = 308; i < 316; i += 2) px(i, 75, '#8c2a22'); R(309, 79, 6, 3, C.yl); px(310, 80, C.o2); px(313, 80, C.o2);   // 洋芋片：鼓鼓的袋子、封口鋸齒、正面一圈黃色標
  R(318, 79, 9, 8, C.b1); R(318, 79, 9, 1, '#6f95d4'); R(320, 81, 5, 3, C.wh); px(321, 82, C.o2); px(323, 82, C.o2);   // 一盒餅乾（盒上有餅乾圖）
  R(328, 72, 4, 14, C.gr1); R(329, 70, 2, 2, C.gr1); R(329, 69, 2, 1, C.wh); R(328, 77, 4, 3, C.kr); px(329, 78, C.gr1); px(328, 73, C.gr2);   // 一瓶綠茶
  R(317, 82, 5, 3, C.pk); px(316, 82, C.pk); px(315, 81, C.pk); px(315, 83, C.pk); px(322, 82, C.pk); px(323, 81, C.pk); px(323, 83, C.pk); px(318, 82, C.wh);   // 一顆兩頭扭起來的糖果
  R(300, 96, 40, 3, C.wd2); R(302, 99, 2, 15, C.wd0); R(336, 99, 2, 15, C.wd0); R(306, 86, 28, 10, C.kr); for (let i = 307; i < 333; i += 3) R(i, 87, 1, 8, C.kr2); R(305, 85, 30, 2, C.kr0);   // 零食籃（放在邊桌）
  plant(360, 120, 1.1);
  rug(22, 128, 330, 52, C.rg, C.rg2);
  const A = Q.cluster(30, 150, 3, 60); Q.cluster(224, 150, 2, 60);   // 三張一組＋兩張一組，中間是走道；一個位子 60 寬（角色連小窩 34～74 寬，原本 50 會擠）
  lamp(A[0], 16, 40);   // 舊燈泡：元老位正上方
});

// ===== 三　整層樓：管線外露漆白、窗外是對面的大樓、門＋拉絲銀牌、兩兩一組四組、玻璃會議室、咖啡機在矮櫃上 =====
stage('s3', K => { const { R, px, el, checker, dither, city, plant, sign, lamp, newLamp, rug, W } = K, Q = kit(K);
  R(0, 0, W, H, C.g4);
  R(0, 0, W, 18, C.wh); R(0, 0, W, 1, C.g4);   // 漆白的天花板
  [[3, C.g3], [4, C.g4], [5, C.wh], [6, C.wh], [7, C.g5], [8, C.g4], [9, C.g4], [10, C.g3], [11, C.g2]].forEach(([j, c]) => R(0, j, W, 1, c));   // 圓風管（上亮下暗）
  for (let i = 30; i < W; i += 60) { R(i, 3, 2, 9, C.g3); px(i, 5, C.wh); }   // 風管接縫
  for (let i = 15; i < W; i += 60) { R(i, 0, 1, 3, C.g1); R(i - 1, 3, 3, 1, C.g1); R(i - 1, 11, 3, 1, C.g1); R(i - 2, 3, 1, 9, C.g1); R(i + 2, 3, 1, 9, C.g1); }   // 吊桿＋扣住風管的環
  R(0, 18, W, 1, C.g3); R(0, 14, W, 2, C.g4); R(0, 15, W, 1, C.g3); for (let i = 45; i < W; i += 60) { R(i, 16, 1, 3, C.g1); R(i - 1, 19, 3, 1, C.red); }   // 下面一條細水管＋灑水頭（紅色感溫頭）
  // 窗外：對面的大樓立面
  R(56, 22, 222, 66, C.sky3); R(56, 70, 222, 18, C.sky2);
  R(70, 30, 120, 58, C.c3); for (let j = 34; j < 88; j += 8) for (let i = 74; i < 186; i += 10) { R(i, j, 7, 5, C.c1); px(i, j, C.sky3); }   // 對面大樓的窗格
  R(196, 44, 70, 44, C.c1); for (let j = 48; j < 88; j += 7) for (let i = 200; i < 262; i += 9) R(i, j, 6, 4, C.c2);
  Q.glare(56, 22, 66, 44, 280); for (let i = 56; i < 280; i += 44) R(i, 22, 2, 66, C.g5); R(56, 20, 224, 2, C.g5); R(56, 88, 224, 3, C.g5); R(56, 91, 224, 1, C.g3);
  Q.door(14, 44, 108, 3); sign(12, 32, 3);
  { const t = 108 - 58; R(14, t, 26, 58, '#e4f1f5'); R(27, t, 1, 58, C.g1);   // 玻璃門扇：淡淡透色、斜反光、中間霧面貼膜、兩支拉把
    [[16, t + 10], [29, t + 6], [17, t + 34], [30, t + 30]].forEach(([a, b]) => { for (let k = 0; k < 6; k++) { px(a + k, b + 6 - k, C.wh); px(a + k + 1, b + 6 - k, C.wh); } });
    R(14, t + 24, 26, 5, C.g5); R(14, t + 24, 26, 1, C.wh); R(14, t + 28, 26, 1, C.g3);
    R(24, t + 20, 1, 14, C.ink3); R(30, t + 20, 1, 14, C.ink3); }   // 玻璃門＋門上方的拉絲銀牌
  // 玻璃會議室（右邊）
  R(286, 30, 86, 74, C.cy2); dither(286, 30, 86, 74, C.sky3); R(286, 30, 86, 1, C.g1); R(286, 30, 1, 74, C.g1); R(328, 30, 1, 74, C.g2);
  R(300, 40, 26, 22, C.wh); R(300, 40, 26, 1, C.g2); R(303, 58, 14, 1, C.ink3); R(303, 44, 1, 14, C.ink3); [[305, 54], [308, 51], [311, 48], [314, 45]].forEach(([a, b]) => R(a, b, 2, 58 - b, C.b1)); [[318, 43, C.yl], [318, 49, C.pk], [321, 46, C.gr2]].forEach(([a, b, c]) => { R(a, b, 4, 4, c); px(a + 1, b + 1, C.ink3); px(a + 2, b + 1, C.ink3); });   // 白板：長條圖一路長高＋三張便利貼
  R(298, 80, 62, 3, C.wh); R(298, 83, 62, 1, C.g2); R(302, 84, 1, 16, C.g2); R(355, 84, 1, 16, C.g2); [314, 342].forEach(a => { R(a - 4, 70, 9, 10, C.ink3); R(a - 3, 69, 7, 1, C.ink3); R(a - 3, 71, 7, 7, C.g1); R(a - 3, 71, 1, 7, C.g2); R(a - 6, 76, 2, 1, C.ink2); R(a + 5, 76, 2, 1, C.ink2); R(a - 6, 76, 1, 4, C.ink2); R(a + 6, 76, 1, 4, C.ink2); });   // 會議椅：椅背（布面＋邊框）＋兩邊扶手
  R(0, 104, W, 86, C.wd); for (let j = 108; j < H; j += 6) R(0, j, W, 1, C.wd2); for (let j = 104, r = 0; j < H; j += 6, r++) for (let i = (r * 23) % 46; i < W; i += 46) R(i, j + 1, 1, 4, C.wd2);   // 木地板：每一排的板縫錯開
  // 咖啡機：放在矮櫃上（門跟窗中間的牆邊）
  R(40, 92, 22, 12, C.wd2); R(40, 92, 22, 1, C.kr); R(40, 103, 22, 1, C.wd0); R(50, 94, 1, 8, C.wd0);
  R(44, 74, 14, 18, C.g1); R(44, 74, 14, 1, C.g3); R(45, 66, 12, 8, C.cy2); R(45, 66, 12, 1, C.wh); for (let i = 46; i < 56; i += 2) { px(i, 71, C.wd0); px(i + 1, 72, C.wd0); }
  R(46, 78, 8, 2, C.ink2); R(54, 78, 5, 1, C.ink2); R(48, 80, 4, 1, C.ink3); px(49, 81, C.ink3); px(51, 81, C.ink3); px(55, 76, C.gr2); px(46, 76, C.red);   // 沖煮把手（往右伸出來）、兩個出水口、電源燈和按鈕
  R(46, 91, 10, 1, C.ink3); for (let i = 47; i < 56; i += 2) px(i, 91, C.g2); R(48, 85, 6, 6, C.wh); R(49, 86, 4, 2, C.wd0); R(54, 86, 1, 3, C.g3); px(51, 63, C.g3); px(50, 61, C.g3);   // 接水盤＋一杯咖啡（有把手）＋熱氣
  rug(16, 112, 300, 72, C.rg, C.rg2);
  const A = Q.cluster(22, 128, 2, 60); Q.cluster(160, 128, 2, 60);   // 後排兩組（一個位子 60 寬）
  Q.cluster(40, 170, 2, 60); Q.cluster(178, 170, 2, 60);   // 前排兩組
  lamp(A[0], 18, 34); newLamp(260, 18, 30); newLamp(150, 18, 52);
  plant(360, 190, 1.3);
});

// ===== 四　二十七樓整層：木格柵天花板＋線型燈、雲就在眼前、門（絆木牌在門柱上）＋黑底金字、兩兩一組六組、矮盆栽隔開、沙發和扭蛋機在地上 =====
stage('s4', K => { const { R, px, el, checker, dither, city, plant, sign, lamp, txt, rug, W } = K, Q = kit(K);
  R(0, 0, W, H, '#dfe7ec');
  R(0, 0, W, 16, C.bk2);   // 格柵後面的深色天花板（木條之間看得到縫）
  for (let i = 0; i < W; i += 5) { R(i, 0, 3, 15, C.wd); R(i, 0, 1, 15, C.kr); R(i + 2, 0, 1, 15, C.wd2); R(i, 14, 3, 1, C.kr); }   // 一根根木條：左亮右暗、底面亮邊
  R(38, 15, W - 76, 3, C.ink2); R(40, 16, W - 80, 1, C.au2); R(40, 17, W - 80, 1, C.warm);   // 線型燈：嵌在深色燈槽裡的發光條
  dither(40, 18, W - 80, 3, C.warm);   // 燈底下淡淡的光暈
  R(66, 22, W - 66, 70, C.sky3); R(66, 54, W - 66, 38, C.sky2); city(66, 80, W - 66, 12, 51, 0);   // 往下看：城市在很下面
  [[110, 52, 26, 6], [150, 48, 16, 4], [250, 60, 30, 7], [290, 56, 14, 4], [340, 44, 18, 5], [430, 54, 24, 6], [500, 46, 14, 4], [560, 60, 28, 7]].forEach(([a, b, rx, ry]) => { el(a, b, rx, ry, C.wh); el(a + 5, b + 2, rx * .7, ry * .6, C.cl); });   // 雲就在眼前
  Q.glare(66, 22, 70, 62, W); for (let i = 66; i < W; i += 62) R(i, 22, 2, 70, C.g5); R(66, 20, W - 66, 2, C.g5); R(66, 92, W - 66, 3, C.g5); R(66, 95, W - 66, 1, C.g2);
  R(0, 18, 66, 78, '#f1f4f6');
  Q.door(12, 34, 112, 4); sign(8, 30, 4);   // 黑牌往上挪，跟黑門框之間留空
  { const t = 112 - 58; R(12, t, 26, 58, C.wd2); for (let i = 15; i < 37; i += 4) R(i, t + 2, 1, 54, C.wd0); R(12, t, 26, 1, C.wd);   // 直向木紋
    R(32, t + 18, 2, 22, C2.brass); R(32, t + 18, 1, 22, C.au2); }   // 長長的黃銅拉把
  R(45, 40, 18, 22, C.wd); R(45, 40, 18, 1, C.kr); R(62, 40, 1, 22, C.wd0); R(45, 61, 18, 1, C.wd0); txt('絆', 46, 43, 15, C.wd0); R(53, 37, 2, 3, C.wd0);   // 門邊亮亮的牆上一塊大一點的「絆」木牌
  for (let k = 0; k < 22; k++) { px(54 + Math.round(Math.sin(k / 2.5) * 2), 62 + k, '#b33a2f'); px(55 + Math.round(Math.sin(k / 2.5) * 2), 62 + k, '#b33a2f'); } R(52, 84, 6, 3, '#b33a2f'); R(53, 87, 4, 4, '#b33a2f');   // 朱色紅線垂下來、尾端一個小結
  R(0, 112, W, 78, C.wd); for (let j = 116; j < H; j += 6) R(0, j, W, 1, C.wd2); for (let i = 0; i < W; i += 40) for (let j = 112; j < H; j += 12) R(i + (j % 24 ? 20 : 0), j, 1, 6, C.wd2);
  rug(58, 116, 410, 68, C.rg, C.rg2);
  const A = Q.cluster(64, 132, 2, 60, { holo: true }); Q.cluster(198, 132, 2, 60, { holo: true }); Q.cluster(332, 132, 2, 60, { holo: true });   // 後排三組（一個位子 60 寬）
  Q.lowPlant(187, 140, 6); Q.lowPlant(321, 140, 6);
  Q.cluster(64, 176, 2, 60, { holo: true }); Q.cluster(198, 176, 2, 60, { holo: true }); Q.cluster(332, 176, 2, 60, { holo: true });   // 前排三組
  Q.lowPlant(187, 184, 6); Q.lowPlant(321, 184, 6);
  // 休息區：沙發放在地上、旁邊扭蛋機（整組往右挪 170，放在加寬出來的那段）
  K.x.save(); K.x.translate(170, 0);
  rug(296, 140, 78, 40, C.rg3, '#b77a57');
  R(302, 146, 58, 14, C.ink2); R(302, 146, 58, 2, C.ink3); R(298, 152, 8, 16, C.ink2); R(356, 152, 8, 16, C.ink2); R(304, 160, 54, 8, C.ink3); R(304, 160, 54, 1, C.g1); R(330, 160, 1, 8, C.ink2); R(298, 152, 8, 1, C.ink3); R(356, 152, 8, 1, C.ink3); R(306, 168, 2, 4, C.wd0); R(354, 168, 2, 4, C.wd0);   // 沙發：椅背、兩邊扶手（上緣受光）、兩塊座墊（中間一條縫）、木腳
  R(316, 148, 1, 8, C.ink3); R(344, 148, 1, 8, C.ink3);   // 椅背分成三塊
  [[318, C.pk, C.pk2], [342, C.cy, C.cy2]].forEach(([a, c, c2]) => { R(a - 5, 151, 11, 8, c); px(a - 5, 151, C.ink2); px(a + 5, 151, C.ink2); px(a - 5, 158, C.ink2); px(a + 5, 158, C.ink2); R(a - 4, 152, 4, 2, c2); px(a, 155, C.ink3); });   // 兩個方抱枕：四角收尖、中間一顆釦子、亮面
  R(326, 153, 9, 6, C.yl); R(326, 153, 9, 1, '#f7e08a'); for (let i = 327; i < 335; i += 2) px(i, 159, C.o2);   // 一條摺起來的黃色毯子（有流蘇）
  R(352, 108, 18, 26, C.red); R(352, 108, 18, 2, C.pk); R(358, 120, 6, 6, C.ink2); el(361, 123, 2, 2, C.g3); R(355, 130, 12, 3, C.ink2);
  el(361, 101, 9, 8, C.cy2); el(361, 100, 8, 7, '#eaf8fb'); [[355, 104, C.yl], [361, 105, C.pk], [366, 102, C.b1], [357, 98, C.gr2], [363, 98, C.o2]].forEach(([a, b, c]) => { R(a, b - 2, 2, 1, c); R(a - 1, b - 1, 4, 1, c); px(a, b - 1, C.wh); R(a - 1, b, 4, 1, C.wh); px(a - 1, b, C.g3); px(a + 2, b, C.g3); R(a, b + 1, 2, 1, C.g3); });   // 扭蛋：上半彩色、下半透明白、中間一條接縫
  el(358, 97, 2, 1.5, C.wh); R(354, 92, 14, 2, C.red); R(358, 90, 6, 2, C.red);   // 玻璃罩反光＋頂上紅蓋
  R(352, 110, 18, 1, C.ink2); px(353, 112, C.wh); R(354, 116, 14, 1, '#8c2a22'); R(357, 116, 8, 1, C.yl);   // 機身：投幣標示
  K.x.restore();
  lamp(A[0], 18, 50);
});

// ===== 五　自己的大樓（960 寬，左右滑）：入口大門 → 挑高兩層的大廳（黑石「丼」字牆、接待櫃台、櫃台後面掛車庫名片、大樹）→ 辦公一區 → 茶水吧＋書牆 → 辦公二區 → 午睡艙 =====
stage('s5', K => { const { R, px, el, checker, dither, glyph, city, plant, sign, lamp, newLamp, txt, rug, W } = K, Q = kit(K);
  R(0, 0, W, H, C.g4);
  // 窗外：自己的屋頂花園（樹冠）＋遠方城市
  city(250, 22, W - 250, 70, 77); for (let i = 0; i < 18; i++) { const cx = 262 + i * 50; el(cx, 82, 22, 10, i % 2 ? C.gr1 : C.gr0); el(cx - 4, 78, 10, 5, C.gr2); for (let k = 0; k < 14; k++) { const t = k / 13 * Math.PI, ex = Math.round(cx - Math.cos(t) * 21), ey = Math.round(82 - Math.sin(t) * 9); px(ex, ey - 1, i % 2 ? C.gr1 : C.gr0); px(ex + (k % 2 ? 1 : -1), ey + 2, i % 2 ? C.gr0 : C.gr1); } for (let k = 0; k < 6; k++) px(cx - 8 + k * 3, 76 + (k % 2) * 2, C.gr2); }   // 屋頂花園的灌木：葉緣一點一點不規則、亮面葉子、底下樹幹
  Q.glare(250, 22, 70, 46, W); for (let i = 250; i < W; i += 46) R(i, 22, 2, 70, C.g5); R(250, 20, W - 250, 2, C.g5); R(250, 92, W - 250, 3, C.g5);
  R(250, 0, W - 250, 18, C.g5); R(250, 6, W - 250, 1, C.g4); R(250, 12, W - 250, 1, C.g4); R(250, 18, W - 250, 2, C.g3);   // 辦公區白色天花板＋淡淡的接縫
  // 大廳：挑高兩層（沒有天花板那一條）、黑石牆、入口大門
  R(0, 0, 250, H, C2.stone); for (let i = 0; i < 250; i += 30) R(i, 0, 1, 150, C2.stone2); for (let j = 0; j < 150; j += 24) R(0, j, 250, 1, C2.stone2);
  R(0, 0, 250, 3, C2.brass2); R(40, 3, 170, 5, C.sky3); R(40, 3, 170, 1, C.wh); for (let i = 40; i <= 210; i += 17) R(i, 3, 1, 5, C2.brass2); R(40, 8, 171, 1, C2.brass2);   // 挑高大廳頂上的一條天窗
  R(247, 0, 3, H, C2.brass2); R(247, 0, 1, H, C2.brass);   // 大廳和辦公區交界的黃銅收邊
  Q.door(12, 70, 150, 5); R(8, 88, 34, 2, C2.brass); txt('入口', 8, 76, 9, C2.brass);
  { const t = 150 - 58; R(12, t, 26, 58, '#eef6f8'); R(12, t + 40, 26, 18, '#d9e6dc'); R(25, t, 1, 58, C2.brass2);   // 大門玻璃：透出外面的亮光（下半是外面的路面草地）、斜反光、兩支長黃銅拉把
    [[14, t + 8], [27, t + 4], [15, t + 30], [28, t + 26]].forEach(([a, b]) => { for (let k = 0; k < 6; k++) { px(a + k, b + 6 - k, C.wh); px(a + k + 1, b + 6 - k, C.wh); } });
    R(22, t + 18, 2, 24, C2.brass); px(22, t + 18, C.au2); R(27, t + 18, 2, 24, C2.brass); px(27, t + 18, C.au2); }   // 入口大門（黃銅框玻璃門）
  glyph(DON, 92, 10, C.au1, 8);   // 黑石上的金色「丼」
  sign(105, 86, 5);   // 掛在大「丼」字下面的黑石牆上，不要疊在字上
  R(70, 120, 120, 30, C2.brass2); R(70, 120, 120, 3, C2.brass); R(72, 123, 116, 27, C.wd2); for (let i = 76; i < 186; i += 6) R(i, 124, 2, 26, C.wd); R(70, 120, 120, 1, C.au2);   // 接待櫃台（木頭＋黃銅檯面）
  R(80, 106, 22, 14, C2.brass); R(81, 107, 20, 12, C2.brass2); R(82, 108, 18, 10, C.kr); R(83, 109, 16, 8, C.wh); glyph(['.x.x.', 'xxxxx', '.xxx.', 'xxxxx', '.x.x.'], 84, 110, C.ink2); R(92, 111, 6, 1, C.g2); R(92, 113, 5, 1, C.g2); px(98, 109, C.red); R(86, 119, 10, 1, C2.brass);   /* 裱框的車庫紙名片：黃銅框、襯紙、名片上小小的丼字 */   // 櫃台上裱框的車庫紙名片
  /* 原本旁邊寫「創業那天的名片」，8px 在手機上糊成一團、又擠到銘牌，拿掉（故事寫在說明裡） */
  R(0, 150, 250, 40, '#2a2d33'); R(0, 150, 250, 1, C2.stone2); for (let i = 0; i < 250; i += 25) R(i, 150, 1, 40, '#34383f'); R(0, 170, 250, 1, '#34383f'); for (let k = 0; k < 9; k++) R(30 + k * 24, 156 + (k % 3) * 9, 8, 1, '#3e434b');   // 磨亮的黑石：石材接縫＋一點一點反光   // 黑石地
  R(214, 70, 3, 62, C.wd0); R(214, 70, 1, 62, C.wd2);   // 樹幹一路通到樹冠裡
  [[215, 100, 200, 88], [216, 92, 224, 84], [215, 78, 204, 62], [216, 70, 224, 50]].forEach(([a, b, c, d]) => { const n = Math.max(Math.abs(c - a), Math.abs(d - b)); for (let t = 0; t <= n; t++) { px(Math.round(a + (c - a) * t / n), Math.round(b + (d - b) * t / n), C.wd0); px(Math.round(a + (c - a) * t / n) + 1, Math.round(b + (d - b) * t / n), C.wd0); } });   // 分枝
  for (let k = 0; k < 7; k++) el(215 + Math.cos(k) * 14, 100 - k * 9 + Math.sin(k) * 4, 12, 9, k % 2 ? C.gr1 : C.gr0);   // 一團一團的樹冠
  for (let k = 0; k < 7; k++) { const a = 215 + Math.cos(k) * 14, b = 100 - k * 9 + Math.sin(k) * 4; K.leaf(a - 8, b - 1, 7, -Math.PI * .85, 2); K.leaf(a + 8, b - 2, 7, -Math.PI * .15, 2); K.leaf(a, b - 7, 6, -Math.PI * .5, 1.8); el(a - 3, b - 3, 3, 2, C.gr2); }   // 邊緣一片片尖葉、亮面
  R(200, 130, 30, 20, C2.brass2); R(199, 129, 32, 3, C2.brass); R(201, 130, 28, 1, C.wd0); R(200, 149, 30, 1, '#6e5526'); R(203, 134, 1, 14, C2.brass);   // 黃銅花盆：盆口、土、亮邊
  [[40, 0, 70], [170, 0, 70]].forEach(([lx, t, l]) => newLamp(lx, t, l));
  // 辦公區地板
  R(250, 96, W - 250, 94, C.wd); for (let j = 100; j < H; j += 6) R(250, j, W - 250, 1, C.wd2); for (let j = 96, r = 0; j < H; j += 6, r++) for (let i = 250 + (r * 29) % 58; i < W; i += 58) R(i, j + 1, 1, 4, C.wd2);   // 木地板：板縫錯開
  [[262, 570], [726, 1034]].forEach(([x1, x2]) => { R(x1 + 20, 18, 1, 6, C.ink3); R(x2 - 20, 18, 1, 6, C.ink3);   // 黃銅線型燈：兩條吊線、黃銅外殼、發光面、底下光暈
    R(x1, 24, x2 - x1, 3, C2.brass2); R(x1, 24, x2 - x1, 1, C2.brass); R(x1 + 1, 26, x2 - x1 - 2, 1, C.au2); dither(x1 + 2, 27, x2 - x1 - 4, 2, C.warm); });
  // 一區（10 個）
  rug(252, 106, 326, 80, C.rg, C.rg2);
  const A = Q.cluster(258, 132, 3, 60); Q.cluster(452, 132, 2, 60); Q.lowPlant(441, 140, 6);   // 一個位子 60 寬
  Q.cluster(258, 176, 3, 60); Q.cluster(452, 176, 2, 60); Q.lowPlant(441, 184, 6);
  // 茶水吧＋書牆（把二十張桌子切成兩區）：整段往右挪 96
  K.x.save(); K.x.translate(96, 0);
  R(490, 24, 116, 72, C.wd0); R(492, 26, 112, 70, C.wd2); R(490, 24, 116, 2, C.wd);   // 書櫃：外框、頂板
  { const BC = ['#c9b79c', '#a7b6a2', '#b9a3a0', '#9fb1c0', '#d8cdb8', '#8f9e8a', '#c4a98a', '#e6dccb', '#a99482'], rnd = n => { n = Math.sin(n * 91.7) * 4375.5; return n - Math.floor(n); };
    [39, 53, 67, 81, 95].forEach((j, r) => { R(492, j - 1, 112, 2, C.wd0); R(492, j - 13, 112, 1, '#8a6238');   // 每一層：層板＋上一層板下的陰影
      let i = 495, q = r * 40;
      while (i < 600) { q++; const w = 2 + Math.floor(rnd(q) * 3), hgt = 7 + Math.floor(rnd(q + 9) * 5), c = BC[Math.floor(rnd(q + 3) * 9)];
        if (rnd(q + 5) < .035 && i < 592) { for (let k = 0; k < 9; k++) R(i + Math.floor(k / 2), j - 2 - k, 3, 1, c); i += 9; continue; }   // 一本斜靠著的書
        if (rnd(q + 7) < .02 && i < 590) { R(i + 1, j - 5, 6, 4, C.wd); R(i + 1, j - 5, 6, 1, C.kr); el(i + 4, j - 8, 3, 3, C.gr1); el(i + 3, j - 9, 1.5, 1.5, C.gr2); i += 9; continue; }   // 偶爾一小盆多肉
        if (i + w > 602) break;
        R(i, j - 1 - hgt, w, hgt, c); R(i, j - 1 - hgt + 2, w, 1, 'rgba(60,40,20,.25)'); R(i, j - 4, w, 1, 'rgba(60,40,20,.18)'); px(i, j - 1 - hgt, 'rgba(255,255,255,.35)');   // 書背：上下兩條燙金線、左上一點亮
        i += w + (rnd(q + 11) < .12 ? 2 : 0); } }); }   // 書牆：書寬窄、高低不一、偶爾空一格
  R(498, 120, 100, 28, C.wd2); R(498, 118, 100, 3, C2.brass); for (let i = 502; i < 596; i += 6) R(i, 122, 2, 26, C.wd);   // 茶水吧檯
  R(512, 102, 14, 16, C.g1); R(512, 102, 14, 1, C.g3); R(513, 96, 12, 6, C.cy2); R(513, 96, 12, 1, C.wh); for (let i = 514; i < 524; i += 2) { px(i, 100, C.wd0); px(i + 1, 101, C.wd0); }   // 咖啡機：豆槽（看得到豆子）
  R(514, 105, 8, 2, C.ink2); R(522, 105, 4, 1, C.ink2); px(516, 107, C.ink3); px(519, 107, C.ink3); px(514, 103, C.red); px(523, 103, C.gr2);   // 沖煮把手、出水口、燈
  R(515, 112, 6, 5, C.wh); R(516, 113, 4, 2, C.wd0); R(521, 113, 1, 2, C.g3); R(514, 117, 9, 1, C.ink3); px(517, 93, C.g3); px(518, 91, C.g3);   // 一杯咖啡＋接水盤＋熱氣   // 咖啡機
  el(560, 114, 9, 3, C.g3); el(560, 113, 8, 2.5, C.wh); [[555, 110], [560, 109], [565, 110], [558, 107]].forEach(([a, b]) => { el(a, b, 2.5, 2, C.kr2); px(a, b - 1, C.kr); px(a - 1, b, C.wd0); });   // 一盤餅乾 el(580, 113, 5, 4, C.o2); el(582, 111, 2, 1.4, C.gr1);   // 一盤點心、一顆橘子
  [512, 548, 584].forEach(a => { el(a, 152, 6, 2, C.ink3); R(a - 6, 151, 12, 1, C.g1); R(a - 4, 161, 8, 1, C.g1); R(a - 1, 154, 2, 14, C.g1); R(a - 5, 168, 10, 1, C.g1); });   // 吧檯椅
  K.x.restore();
  // 二區（10 個）
  rug(716, 106, 326, 80, C.rg, C.rg2);
  Q.cluster(722, 132, 3, 60); Q.cluster(916, 132, 2, 60); Q.lowPlant(905, 140, 6);
  Q.cluster(722, 176, 3, 60); Q.cluster(916, 176, 2, 60); Q.lowPlant(905, 184, 6);
  lamp(A[0], 20, 54); [420, 644, 880].forEach(lx => newLamp(lx, 20, 40));
  // 茱莉鴨的午睡艙（往右挪到最後面）
  { const a = 1052, b = 118, w = 92, h = 52;
    rug(a - 6, 168, w + 12, 18, C.rg3, '#b77a57');
    el(a + 16, b + h / 2, 16, h / 2, C.g2); el(a + w - 16, b + h / 2, 16, h / 2, C.g2); R(a + 16, b, w - 32, h, C.g2);
    el(a + 16, b + h / 2, 15, h / 2 - 1, C.wh); el(a + w - 16, b + h / 2, 15, h / 2 - 1, C.wh); R(a + 16, b + 1, w - 32, h - 2, C.wh);
    R(a + 6, b + h - 10, w - 12, 6, C.g4); R(a + 10, b + 6, w - 40, 2, C.g5);
    el(a + w - 30, b + 24, 14, 12, C.cy0); el(a + w - 30, b + 24, 13, 11, C.cy2); el(a + w - 30, b + 28, 9, 4, '#f8e6cf'); el(a + w - 32, b + 27, 4, 2, '#fff6ea'); R(a + w - 40, b + 15, 6, 1, C.wh);
    el(a + 22, b + 18, 5, 5, C.au1); el(a + 24, b + 16, 4, 4, C.wh);
    R(a + w - 30, b + 30, 13, 3, C.pk); R(a + w - 30, b + 30, 13, 1, C.pk2);   // 窗裡：枕頭旁蓋著一條小被子
    el(a + w - 30, b + 24, 16, 14, C.g3); el(a + w - 30, b + 24, 14, 12, C.cy0); el(a + w - 30, b + 24, 13, 11, C.cy2);   /* 艙門：圓窗外面一圈門縫（重畫一次窗，被子才在窗裡） */
    el(a + w - 30, b + 28, 9, 4, '#f8e6cf'); el(a + w - 32, b + 27, 4, 2, '#fff6ea'); R(a + w - 38, b + 31, 15, 3, C.pk); R(a + w - 38, b + 31, 15, 1, C.pk2); R(a + w - 40, b + 15, 6, 1, C.wh);
    R(a + w - 48, b + 22, 2, 5, C.g1);   // 艙門把手
    R(a + 14, b + 30, 24, 9, C.g4); R(a + 14, b + 30, 24, 1, C.g3); for (let k = 0; k < 3; k++) { const zx = a + 16 + k * 7, zy = b + 32; R(zx, zy, 5, 1, C.cy0); px(zx + 3, zy + 1, C.cy0); px(zx + 2, zy + 2, C.cy0); px(zx + 1, zy + 3, C.cy0); R(zx, zy + 4, 5, 1, C.cy0); }   // 門邊的小螢幕：亮著 ZZZ（使用中）
    px(a + 40, b + 31, C.gr2);   // 綠色指示燈
    [[a + w - 20, b - 6, 1], [a + w - 12, b - 16, 1.34]].forEach(([zx, zy, sc]) => { const z = Math.round(5 * sc); R(zx, zy, z, 1, C.cy0); for (let k = 1; k < z - 1; k++) px(zx + z - 1 - k, zy + k, C.cy0); R(zx, zy + z - 1, z, 1, C.cy0); });
    R(a + 10, b + h, 4, 6, C.g1); R(a + w - 14, b + h, 4, 6, C.g1); }
});

const SIZE = [375, 375, 375, 600, 1160];
// 一個字變成 12×12 的像素字：用 12px 的思源黑體畫、透明度過一半的算有，空白的下緣切掉
const glyphCache = {};
function rasterGlyph(ch) {
  if (glyphCache[ch]) return glyphCache[ch];
  const N = 12, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
  x.font = '500 12px "Noto Sans TC", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, N / 2, N / 2 + .5);
  const d = x.getImageData(0, 0, N, N).data, rows = [];
  for (let j = 0; j < N; j++) { let r = ''; for (let i = 0; i < N; i++) r += d[(j * N + i) * 4 + 3] > 107 ? 'x' : '.'; rows.push(r); }
  while (rows.length > 9 && !rows[rows.length - 1].includes('x')) rows.pop();
  if (!rows.some(r => r.includes('x'))) return DON;
  return glyphCache[ch] = rows;
}
return {
  SIZE, H: 190, clearGlyphs() { for (const k in glyphCache) delete glyphCache[k]; },
  // ch：公司名字的第一個字，畫在門口的銘牌上（使用者 2026-11-25）；沒給或是「丼」就用原本 9×9 的丼
  paint(cv, n, ch) { const id = 's' + n; cv.width = SIZE[n - 1]; cv.height = 190; SIGN = ch && ch !== '丼' ? rasterGlyph(ch) : DON; paintOn(cv, id, DRAWS[id]); return (window.SEATS || {})[id] || []; },
  fx(n) { return (window.OFX || {})['s' + n] || { mon: [], bulb: [] }; },   // 畫過之後才有：螢幕 [x, y, w, h]、燈泡 [x, y, 是不是舊燈泡]
};
})();
