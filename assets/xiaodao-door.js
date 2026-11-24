// 我的小島：家門口（斜四十五度的院子和整棟房子），五種房子各一個樣子。2026-11-23 先做樣張（docs/plans/jiayuan/doorstep5.html），使用者看過再接進網站。
// 用法：XiaodaoDoor.render(房子等級 1～5, { canvas, z, night, cat, mail }) → { canvas, W, H, spots: { door, mail, diary } }（spots 是點選用的範圍，一倍的顆）
(function (root) {
  'use strict';
  const TW = 12, TH = 6, SLAB = 8, M = 14;
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const sh = (c, f) => { const a = hex(c); return '#' + (f > 0 ? a.map(x => x + (255 - x) * f) : a.map(x => x * (1 + f))).map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); };

  function poly(x, pts, col) {
    let y0 = Infinity, y1 = -Infinity; for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    x.fillStyle = col;
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) { const py = y + .5, xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py)) xs.push((xj - xi) * (py - yi) / (yj - yi) + xi); }
      xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) { const a = Math.ceil(xs[k] - .5), b = Math.floor(xs[k + 1] - .5); if (b >= a) x.fillRect(a, y, b - a + 1, 1); } }
  }

  // 每一種房子：院子多大、最高到哪（決定畫布大小）、畫什麼
  const SPEC = {
    1: { name: '帳篷', YW: 9, YD: 8, top: 34 },
    2: { name: '小木屋', YW: 10, YD: 9, top: 52 },
    3: { name: '平房', YW: 12, YD: 10, top: 62 },
    4: { name: '兩層樓', YW: 13, YD: 11, top: 88 },
    5: { name: '海景別墅', YW: 14, YD: 12, top: 72 },
  };


  // ---------- 來玩的角色（2026-11-24 樣張）：網站的九個角色坐在家門口 ----------
  // 用半顆的格子畫（畫在放大後的畫布上，比院子細一倍），原點在腳底中間；x 往右、y 往上是負的。白天才來。
  const GUEST_KEYS = ['julie', 'appleduck', 'raccoon', 'captain', 'cat', 'dog', 'mole', 'nugget', 'xiaowu'];
  const GUEST_NAME = { julie: '茱莉鴨', appleduck: '蘋果鴨', raccoon: '浣熊大王', captain: '青江菜船長', cat: '店貓', dog: '坐洗部的狗', mole: '鼴鼠', nugget: '雞塊', xiaowu: '小吳鴨' };
  function guest(x, key, a, b) {
    const U = .5, c = (i, j, w, h, col) => { x.fillStyle = col; x.fillRect(a + i * U, b + j * U, w * U, h * U); };
    const el = (cx, cy, rx, ry, col) => { x.fillStyle = col; for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++) for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) { const u = (i + .5 - cx) / rx, v = (j + .5 - cy) / ry; if (u * u + v * v <= 1) x.fillRect(a + i * U, b + j * U, U, U); } };
    const K = '#2e2a27', WH = '#ffffff';
    el(0, 0, 9, 2.2, 'rgba(40,28,18,.22)');   // 影子
    const eyes = (y, dx = 3, big) => { c(-dx - 1, y, 2, big ? 2 : 2, K); c(dx - 1, y, 2, big ? 2 : 2, K); c(-dx - 1, y, 1, 1, WH); c(dx - 1, y, 1, 1, WH); };
    const blush = (y, dx = 5, col = '#f3a6a0') => { c(-dx - 1, y, 2, 1, col); c(dx - 1, y, 2, 1, col); };
    const D = {
      julie() {   // 白鴨、橘嘴、睡眼、藍領結
        const W = '#f8f6f1', S = '#dcd7cc', O = '#f0a04b', o = '#c97a2e', B = '#3d6fb6', b2 = '#2b5290';
        c(-6, -1, 4, 1, O); c(2, -1, 4, 1, O);
        el(.6, -7, 8.4, 7, S); el(0, -7, 8, 7, W); el(.5, -18, 7.6, 7, S); el(0, -18, 7.4, 7, W);
        c(-8, -9, 1, 4, S); c(7, -9, 1, 4, S);
        c(-5, -20, 3, 1, K); c(2, -20, 3, 1, K); c(-5, -21, 3, 1, S); c(2, -21, 3, 1, S);   // 半睜眼
        el(0, -14.5, 5, 2.2, O); c(-4, -13, 8, 1, o);
        c(-4, -11, 3, 3, B); c(1, -11, 3, 3, B); c(-1, -10, 2, 1, b2);
      },
      appleduck() {   // 黃鴨、頭上一顆蘋果、藍圍巾
        const Y = '#f6cf4a', y = '#d9a92d', O = '#f08a3a', R = '#d6402f', r = '#a8291f', G = '#5d9a3a', B = '#4a78c2';
        c(-6, -1, 4, 1, O); c(2, -1, 4, 1, O);
        el(.6, -7, 8.4, 7, y); el(0, -7, 8, 7, Y); c(6, -10, 3, 2, y); el(.5, -18, 7.4, 7, y); el(0, -18, 7.2, 7, Y);
        eyes(-20, 3); el(0, -15, 4.5, 1.8, O); c(-3, -14, 6, 1, '#c96a24'); blush(-17, 5);
        c(-6, -11, 12, 2, B); c(-2, -10, 3, 3, B); c(1, -9, 2, 3, '#3a62a6');
        el(0, -27, 3.4, 3, R); c(1, -28, 1, 2, '#f08070'); c(-1, -25, 3, 1, r); c(0, -31, 1, 2, '#6b4a2a'); c(1, -31, 3, 1, G); c(2, -32, 1, 1, G);
      },
      raccoon() {   // 灰浣熊、黑眼罩、金皇冠、紅披風白毛領
        const g = '#9aa0a6', gs = '#7d838a', d = '#3f4247', w = '#f2f0ea', C = '#e2b23a', cc = '#b48618', R = '#c0392b', r = '#8e2a20';
        el(10, -4, 3, 2, gs); c(8, -5, 1, 2, d); c(11, -5, 1, 2, d);   // 尾巴
        el(0, -6, 9.5, 7, r); el(-.4, -6.4, 9, 6.6, R); el(0, -6, 6, 6, g); c(-4, -1, 3, 1, d); c(1, -1, 3, 1, d);
        el(0, -11, 7, 1.8, w); for (let k = -6; k <= 5; k += 3) c(k, -11, 1, 1, '#d8d3c8');
        el(-6, -23, 2.2, 2.2, d); el(6, -23, 2.2, 2.2, d); el(0, -18, 7.4, 6.4, gs); el(-.3, -18.3, 7, 6, g);
        c(-5, -22, 3, 1, w); c(2, -22, 3, 1, w);   // 白眉毛
        el(-3.2, -18.5, 3, 2, d); el(3.2, -18.5, 3, 2, d); c(-1, -19, 2, 1, d);   // 黑眼罩（一條橫帶）
        c(-4, -19, 2, 2, '#e9e6de'); c(2, -19, 2, 2, '#e9e6de'); c(-3, -19, 1, 1, K); c(2, -19, 1, 1, K);
        el(0, -14.5, 3.4, 2.2, w); c(-1, -16, 2, 1, K); c(-1, -14, 2, 1, '#cfc9bd');
        c(-4, -27, 8, 3, C); c(-4, -29, 1, 2, C); c(-1, -30, 2, 3, C); c(3, -29, 1, 2, C); c(-4, -25, 8, 1, cc); c(-3, -27, 1, 1, R); c(0, -27, 1, 1, '#3f7bd0'); c(2, -27, 1, 1, R);
      },
      captain() {   // 青江菜船長：葉子當頭髮、白頂黑簷船長帽、氣噗噗的臉
        const L = '#4f8f3a', l = '#3a7029', V = '#7fb85a', S = '#dfeec0', s2 = '#c3dc98', H = '#f4f2ec';
        el(0, -7, 6.5, 7.5, s2); el(-.5, -7, 6, 7.3, S); for (let k = -3; k <= 3; k += 3) c(k, -12, 1, 9, '#eef7d8');
        c(-4, -1, 3, 1, s2); c(1, -1, 3, 1, s2);
        // 三片葉子（左、右、中間），中間一條淺色的葉脈、斜的細脈
        [[-5.5, -18, 5, 5.6], [5.5, -18, 5, 5.6], [0, -20.5, 5.6, 6.4]].forEach(([i, j, rx, ry]) => { el(i, j, rx + .6, ry + .6, l); el(i - .3, j - .3, rx, ry, L); });
        c(0, -26, 1, 10, V); c(-6, -21, 1, 6, V); c(5, -21, 1, 6, V);
        [[-2, -23], [1, -23], [-2, -20], [1, -20], [-8, -19], [-4, -19], [3, -19], [7, -19]].forEach(([i, j]) => c(i, j, 1, 1, V));
        c(-4, -11, 2, 2, K); c(2, -11, 2, 2, K); c(-4, -11, 1, 1, WH); c(2, -11, 1, 1, WH);
        c(-5, -13, 1, 1, '#2e4a22'); c(-4, -12.5, 2, 1, '#2e4a22'); c(4, -13, 1, 1, '#2e4a22'); c(2, -12.5, 2, 1, '#2e4a22');   // 氣噗噗的眉毛
        c(-2, -7, 4, 1, '#5f7f42'); c(-2, -8, 1, 1, '#5f7f42'); c(1, -8, 1, 1, '#5f7f42');
        el(0, -26, 6, 2.2, H); c(-6, -25, 12, 1, K); c(-7, -24, 14, 1, '#1e1e1e'); c(-1, -27, 2, 1, '#d9b23a');
      },
      cat() {   // 橘色虎斑店貓
        const O = '#e3a25a', o = '#c2803c', T = '#b06e2e', Wm = '#f6e6cf';
        el(9, -3, 3.5, 1.6, o); c(11, -6, 2, 3, o);   // 尾巴捲起來
        el(.6, -6, 7.4, 6.4, o); el(0, -6, 7, 6, O); el(0, -5, 3.5, 4, Wm); c(-4, -1, 3, 1, O); c(1, -1, 3, 1, O);
        c(-7, -25, 3, 3, O); c(-6, -26, 2, 1, O); c(4, -25, 3, 3, O); c(4, -26, 2, 1, O); c(-6, -24, 1, 1, '#f3b8a8'); c(5, -24, 1, 1, '#f3b8a8');
        el(.4, -18, 7.4, 6.2, o); el(0, -18, 7, 6, O);
        c(-1, -24, 2, 3, T); c(-3, -23, 1, 2, T); c(2, -23, 1, 2, T);   // M 字紋
        c(-7, -18, 2, 1, T); c(5, -18, 2, 1, T);
        el(0, -15, 3, 2, Wm); c(-4, -18, 2, 1, K); c(2, -18, 2, 1, K); c(-5, -17, 1, 1, K); c(4, -17, 1, 1, K);   // 瞇瞇眼
        c(-1, -16, 2, 1, '#e58a8a');
      },
      dog() {   // 坐洗部的狗：奶油色、垂耳、舌頭、頭上洗髮泡泡
        const C2 = '#f1dcae', c3 = '#d9be86', E = '#c99a5a', P = '#ef8a95', Bu = '#ffffff', bo = '#bfe0ee';
        el(.6, -6, 7.6, 6.6, c3); el(0, -6, 7.2, 6.4, C2); c(-4, -1, 3, 1, c3); c(1, -1, 3, 1, c3);
        el(.4, -17, 7, 6, c3); el(0, -17, 6.8, 5.8, C2); el(-7, -16, 2.2, 4, E); el(7, -16, 2.2, 4, E);
        eyes(-18, 3); el(0, -14, 3, 2, '#f8ecd0'); c(-1, -15, 2, 1, K); c(-1, -13, 2, 2, P);
        [[-4, -24, 2.6], [0, -25, 3], [4, -24, 2.4], [-1, -28, 2], [3, -28, 1.6]].forEach(([i, j, r]) => { el(i, j, r + .6, r + .6, bo); el(i, j, r, r, Bu); });
        c(6, -29, 1, 1, bo); c(-7, -28, 1, 1, bo);
      },
      mole() {   // 鼴鼠：咖啡色、粉紅鼻子和手、黃色工地帽
        const Bn = '#7a5a44', bn = '#5e4433', P = '#f2a0aa', Y = '#f0c23a', y = '#c99a1e';
        el(.6, -7, 8, 7.4, bn); el(0, -7, 7.6, 7.2, Bn); el(.4, -17, 7, 5.6, bn); el(0, -17, 6.6, 5.4, Bn);
        c(-4, -18, 1, 1, K); c(3, -18, 1, 1, K); el(0, -14.5, 2.4, 1.6, P); c(-1, -15, 1, 1, '#ffd0d6');
        el(-4, -8, 2, 1.6, P); el(4, -8, 2, 1.6, P); c(-4, -1, 3, 1, P); c(1, -1, 3, 1, P);
        el(0, -22, 7, 3.4, Y); c(-8, -21, 16, 1, y); c(-1, -25, 2, 2, '#fff6c4'); c(-2, -23, 4, 1, y);
      },
      nugget() {   // 雞塊：金黃色、凹凸、腮紅、笑臉
        const N = '#e3aa4a', n2 = '#c98a2c', H = '#f3c66e', Cr = '#b8792a';
        el(.8, -10, 9.4, 9.6, n2); el(0, -10.4, 9, 9.2, N); el(-3, -14, 4, 3, H);
        c(-9, -14, 1, 3, n2); c(8, -6, 1, 2, n2);
        [[-5, -5], [3, -16], [6, -11], [-6, -16], [1, -3], [5, -4], [-2, -18], [-7, -9], [7, -15]].forEach(([i, j]) => c(i, j, 1, 1, Cr));
        eyes(-12, 3); blush(-9, 5); c(-2, -8, 4, 1, K); c(-3, -9, 1, 1, K); c(2, -9, 1, 1, K);
      },
      xiaowu() {   // 小吳鴨：黑色、圓眼鏡、藍掛繩黃色識別證
        const Bk = '#2a2c33', bk = '#3c4150', Sh = '#5a6378', Gd = '#d9b23a', Bl = '#3d6fb6', Yc = '#f3d36a';
        c(-4, -1, 2, 1, '#555'); c(2, -1, 2, 1, '#555');
        el(-7, -6, 3, 5, Bk); el(7, -6, 3, 5, Bk); c(8, -4, 3, 2, Bk);
        el(0, -7, 7, 7, Bk); el(-1, -8, 5, 5, bk); el(0, -18, 7, 6.4, Bk); el(-2, -20, 3, 2, Sh); c(-1, -26, 1, 3, Bk); c(1, -25, 1, 2, Bk);
        el(-3, -18, 2.4, 2.4, Gd); el(3, -18, 2.4, 2.4, Gd); el(-3, -18, 1.6, 1.6, '#dfe9ef'); el(3, -18, 1.6, 1.6, '#dfe9ef'); c(-4, -19, 2, 2, K); c(2, -19, 2, 2, K); c(-1, -18, 2, 1, Gd);
        c(-2, -15, 4, 2, '#4a4e57'); c(-1, -13, 2, 1, '#4a4e57');
        c(-3, -11, 1, 4, Bl); c(2, -11, 1, 4, Bl); c(-3, -8, 6, 4, Yc); c(-2, -7, 4, 1, '#b48618'); c(-2, -5, 3, 1, '#c9a24a');
      },
    };
    (D[key] || D.cat)();
  }

  // 每種房子的座位 [i, j, 高度]：第一個是原本店貓坐的地方（台階、門廊），後面是院子
  const SEATS = {
    1: [[4.45, 5.7, 4], [6.55, 7.1, 4], [4.75, 7.2, 4], [2.6, 5.6, 0], [7.2, 7.9, 0]],   // 營火旁的三個木頭凳子＋草地
    2: [[4.7, 5.8, 1.2], [6.2, 7.4, 0], [2.6, 7.2, 0], [7.8, 7.6, 0], [5.4, 8.2, 0]],
    3: [[5.6, 6.5, 1.6], [7.4, 8.4, 0], [2.2, 7.0, 0], [9.6, 8.4, 0], [5.2, 9.2, 0]],
    4: [[5.9, 7.0, 1.2], [8.6, 9.6, 0], [3.2, 9.6, 0], [10.6, 9.2, 0], [6.2, 10.2, 0]],
    5: [[10.6, 8.7, 3], [9.2, 11.2, 0], [4.2, 10.6, 0], [12.2, 6.2, 0], [6.6, 11.2, 0]],
  };
  function render(lv, opt = {}) {
    const sp = SPEC[lv] || SPEC[3], { YW, YD } = sp, night = !!opt.night, z = Math.max(1, Math.round(opt.z || 1)), cat = false, mail = opt.mail !== false;   // 店貓 2026-11-24 起改用 guests 畫（catAt 不用了）
    const guests = night ? [] : (opt.guests || (opt.cat === false ? [] : ['cat'])), seats = (SEATS[lv] || []).slice();
    const OX = M + YD * TW, OY = M + sp.top, W = OX + YW * TW + M, H = OY + (YW + YD) * TH + SLAB + M;
    const cv = opt.canvas || document.createElement('canvas'); if (cv.width !== W * z || cv.height !== H * z) { cv.width = W * z; cv.height = H * z; }
    const main = cv.getContext('2d'); main.setTransform(1, 0, 0, 1, 0, 0); main.imageSmoothingEnabled = false;
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    let x = off.getContext('2d'); x.imageSmoothingEnabled = false;   // 院子和房子都先畫在一倍的透明底上，最後放大貼過去
    const iso = (i, j, zz = 0) => [OX + (i - j) * TW, OY + (i + j) * TH - zz];
    const q = (pts, col) => poly(x, pts, col);
    const P = (a, b, col, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(Math.round(a), Math.round(b), w, h); };
    const top = (i0, j0, i1, j1, zz, col) => q([iso(i0, j0, zz), iso(i1, j0, zz), iso(i1, j1, zz), iso(i0, j1, zz)], col);
    const box = (i0, j0, i1, j1, z0, z1, col, cR) => { q([iso(i0, j1, z0), iso(i1, j1, z0), iso(i1, j1, z1), iso(i0, j1, z1)], col); q([iso(i1, j0, z0), iso(i1, j1, z0), iso(i1, j1, z1), iso(i1, j0, z1)], cR || sh(col, -.16)); top(i0, j0, i1, j1, z1, sh(col, .14)); };
    const onY = Y => (i, zz) => iso(i, Y, zz), onX = X => (j, zz) => iso(X, j, zz);
    const rect = (at, a0, a1, z0, z1, col) => q([at(a0, z0), at(a1, z0), at(a1, z1), at(a0, z1)], col);
    const emit = [], spots = {};
    const glow = (a, b, r, col, al) => { const g = x.createRadialGradient(a, b, 0, a, b, r); g.addColorStop(0, `rgba(${col},${al})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(a - r, b - r, r * 2, r * 2); };
    const spot = (k, pts) => { spots[k] = pts; };

    // ---------- 天空（別墅多一條海）----------
    main.fillStyle = '#000'; main.fillRect(0, 0, W * z, H * z); main.setTransform(z, 0, 0, z, 0, 0);
    const sky = main.createLinearGradient(0, 0, 0, H);
    if (night) { sky.addColorStop(0, '#141a30'); sky.addColorStop(1, '#232a44'); } else { sky.addColorStop(0, '#dbe9ee'); sky.addColorStop(1, '#f1ece2'); }
    main.fillStyle = sky; main.fillRect(0, 0, W, H);
    if (night) for (let k = 0; k < 50; k++) { main.fillStyle = hash(k, k) > .7 ? '#f4eed8' : '#8f96b8'; main.fillRect(Math.round(hash(k, 1) * W), Math.round(hash(2, k) * H * .45), 1, 1); }
    else [[.12, .1], [.78, .07], [.88, .17]].forEach(([a, b]) => { const px = Math.round(a * W), py = Math.round(b * H); main.fillStyle = '#ffffff'; main.fillRect(px, py, 18, 4); main.fillRect(px + 4, py - 3, 10, 3); main.fillStyle = '#e8f1f4'; main.fillRect(px, py + 3, 18, 1); });
    if (lv === 5) {   // 遠方的海
      const sy = Math.round(H * .42); main.fillStyle = night ? '#1b2a4a' : '#4fbcd0'; main.fillRect(0, sy, W, H - sy); main.fillStyle = night ? '#26385e' : '#9ee6dc'; main.fillRect(0, sy, W, 2);
      for (let k = 0; k < 40; k++) { main.fillStyle = night ? 'rgba(200,215,255,.5)' : 'rgba(255,255,255,.8)'; main.fillRect(Math.round(hash(k, 9) * W), sy + 4 + Math.round(hash(9, k) * (H - sy - 4)), 3, 1); }
      if (night) { main.fillStyle = '#f6efc9'; main.fillRect(Math.round(W * .82), Math.round(H * .12), 5, 5); for (let k = 0; k < 8; k++) { main.fillStyle = 'rgba(246,239,201,.5)'; main.fillRect(Math.round(W * .82) - 3 + (k % 2) * 3, sy + 3 + k * 4, 8 - (k % 3), 1); } }
    }

    // ---------- 底座、草地 ----------
    q([iso(0, YD), iso(YW, YD), iso(YW, YD, -SLAB), iso(0, YD, -SLAB)], '#6e5338'); q([iso(YW, 0), iso(YW, YD), iso(YW, YD, -SLAB), iso(YW, 0, -SLAB)], '#5a432c');
    q([iso(0, YD), iso(YW, YD), iso(YW, YD, -2), iso(0, YD, -2)], '#5f8a45'); q([iso(YW, 0), iso(YW, YD), iso(YW, YD, -2), iso(YW, 0, -2)], '#4f763a');
    { const img = x.getImageData(0, 0, W, H), d = img.data;
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) { const a = (px + .5 - OX) / TW, b = (py + .5 - OY) / TH, i = (a + b) / 2, j = (b - a) / 2;
        if (i < 0 || j < 0 || i >= YW || j >= YD) continue;
        const h0 = hash(px, py), h1 = hash(px >> 2, py >> 1); let col = h1 > .55 ? '#8fbf62' : '#86b65a'; if (h0 > .9) col = '#a6cf74'; else if (h0 < .07) col = '#6f9e48';
        if (lv === 1 && hash(px >> 1, py) > .8) col = '#7aa94f';
        const k = (py * W + px) * 4, [r, g, bb] = hex(col); d[k] = r; d[k + 1] = g; d[k + 2] = bb; d[k + 3] = 255; }
      x.putImageData(img, 0, 0); }

    // ---------- 共用的小東西 ----------
    const shadow = (i0, j0, i1, j1, dz = 1.3) => { x.save(); x.globalAlpha = .18; q([iso(i0 + .3, j1), iso(i1 + dz * .7, j1), iso(i1 + dz * .7, j1 + dz), iso(i0 + .3, j1 + dz)], '#2b2418'); q([iso(i1, j0 + .3), iso(i1 + dz, j0 + .3), iso(i1 + dz, j1 + dz), iso(i1, j1)], '#2b2418'); x.restore(); };
    function stones(i0, i1, j0, j1, col = '#cfc9bb') { for (let j = j0; j < j1 - .1; j += .75) { const o = (Math.floor(j * 4) % 2) * .15; top(i0 + o, j, i1 + o, j + .6, .3, sh(col, -.1)); top(i0 + .1 + o, j + .05, i1 - .1 + o, j + .5, .3, col); } }
    function stonesX(i0, i1, j0, j1, col = '#cfc9bb') { for (let i = i0; i < i1 - .1; i += .75) { const o = (Math.floor(i * 4) % 2) * .15; top(i, j0 + o, i + .6, j1 + o, .3, sh(col, -.1)); top(i + .05, j0 + .1 + o, i + .5, j1 - .1 + o, .3, col); } }
    function dirt(i0, i1, j0, j1) { top(i0, j0, i1, j1, .2, '#b8956a'); for (let k = 0; k < 30; k++) { const [a, b] = iso(i0 + hash(k, 2) * (i1 - i0), j0 + hash(2, k) * (j1 - j0), .2); P(a, b, hash(k, 7) > .5 ? '#a5835a' : '#c9a77c'); } }
    function tree(i, j, kind = 'round', s = 1) { const [a, b] = iso(i, j);
      x.save(); x.globalAlpha = .2; x.fillStyle = '#2b2418'; x.beginPath(); x.ellipse(a + 4, b + 1, 10 * s, 4 * s, 0, 0, Math.PI * 2); x.fill(); x.restore();
      if (kind === 'palm') { for (let k = 0; k < 30 * s; k++) { const t = k / (30 * s); P(a + Math.sin(t * 1.6) * 5 * s, b - k, k % 4 === 0 ? '#8a6a48' : '#a8845a', 2, 1); }
        const tx = a + Math.sin(1.6) * 5 * s, ty = b - 30 * s; [[-1, 0], [1, 0], [-.7, .5], [.7, .5], [0, -.6], [-.4, -.4], [.4, -.4]].forEach(([u, v]) => { for (let k = 0; k < 13 * s; k++) { const px = tx + u * k, py = ty + v * k + (k * k) / (12 * s); P(px, py, k > 9 ? '#5e8e44' : '#4a7436', 2, 2); } }); P(tx - 1, ty, '#7a5a38', 3, 3); return; }
      if (kind === 'pine') { x.fillStyle = '#6e4528'; x.fillRect(a - 1, b - 6, 3, 6); for (let k = 0; k < 4; k++) { const w = (10 - k * 2) * s, yy = b - 6 - k * 7 * s; for (let r = 0; r < 9 * s; r++) { const ww = Math.round(w * (r / (9 * s))); P(a - ww, yy - 9 * s + r, r < 3 ? '#4f7a3e' : '#3b5e2e', ww * 2 + 1, 1); } } return; }
      x.fillStyle = '#6e4528'; x.fillRect(a - 1, b - 14 * s, 3, 14 * s); x.fillStyle = '#8a5a36'; x.fillRect(a - 1, b - 14 * s, 1, 14 * s);
      const R = 12 * s; for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) { const e = (xx * xx + yy * yy) / (R * R); if (e > 1 || hash(xx + 40, yy + 40) > .97) continue; P(a + xx, b - 26 * s + yy, yy + xx * .3 < -4 * s ? '#7fae58' : yy < 4 * s ? '#5e8e44' : '#4a7436'); } }
    function bush(i, j, r = 3, col = '#5e8e44') { const [a, b] = iso(i, j); for (let yy = -r; yy <= 1; yy++) for (let xx = -r - 2; xx <= r + 2; xx++) if (xx * xx / ((r + 2) * (r + 2)) + yy * yy / (r * r) <= 1) P(a + xx, b - 2 + yy, yy < -r / 2 ? sh(col, .2) : col); }
    function flowers(i0, j0, i1, j1, n = 14, zz = 3) { for (let k = 0; k < n; k++) { const i = i0 + hash(k, 5) * (i1 - i0), j = j0 + hash(5, k) * (j1 - j0), [a, b] = iso(i, j, zz); P(a, b + 1, '#4f7a3e', 1, 2); P(a - 1, b - 1, ['#e46a5c', '#f2c14e', '#f5f0e6', '#c49ae0'][k % 4], 3, 2); } }
    function groundLamp(i, j, hz = 4) { box(i, j, i + .18, j + .18, 0, hz, '#3a3836'); top(i + .02, j + .02, i + .16, j + .16, hz, night ? '#fff0c4' : '#d9cfbf'); if (night) emit.push(() => { const [a, b] = iso(i + .09, j + .09, hz); glow(a, b + 2, 14, '255,210,140', .45); }); }
    function lampPost(i, j) { box(i, j, i + .15, j + .15, 0, 24, '#3a3836'); box(i - .1, j - .1, i + .25, j + .25, 24, 28, night ? '#fff0c4' : '#e9e1cf'); top(i - .15, j - .15, i + .3, j + .3, 28, '#3a3836'); if (night) emit.push(() => { const [a, b] = iso(i + .07, j + .07, 26); glow(a, b, 34, '255,200,120', .45); glow(a, b, 6, '255,240,200', .8); }); }
    function picket(i0, j0, i1, j1, col = '#f6f1e6') { const L = Math.hypot(i1 - i0, j1 - j0), n = Math.max(1, Math.round(L / .4));
      for (let k = 0; k <= n; k++) { const i = i0 + (i1 - i0) * k / n, j = j0 + (j1 - j0) * k / n; q([iso(i - .05, j, 0), iso(i + .05, j, 0), iso(i + .05, j, 8), iso(i, j, 9), iso(i - .05, j, 8)], col); }
      q([iso(i0, j0, 5), iso(i1, j1, 5), iso(i1, j1, 6), iso(i0, j0, 6)], sh(col, -.1)); q([iso(i0, j0, 2), iso(i1, j1, 2), iso(i1, j1, 3), iso(i0, j0, 3)], sh(col, -.1)); }
    function railFence(i0, j0, i1, j1) { const L = Math.hypot(i1 - i0, j1 - j0), n = Math.max(1, Math.round(L / 1.5));
      for (let k = 0; k <= n; k++) { const i = i0 + (i1 - i0) * k / n, j = j0 + (j1 - j0) * k / n; box(i - .08, j - .08, i + .08, j + .08, 0, 10, '#8a6a48'); }
      [4, 8].forEach(h => q([iso(i0, j0, h), iso(i1, j1, h), iso(i1, j1, h + 1.2), iso(i0, j0, h + 1.2)], '#a8845a')); }
    function hedge(i0, j0, i1, j1) { box(i0, j0, i1, j1, 0, 7, '#4f7a3e', '#3f6532'); for (let k = 0; k < (i1 - i0 + j1 - j0) * 8; k++) { const [a, b] = iso(i0 + hash(k, 3) * (i1 - i0), j0 + hash(3, k) * (j1 - j0), 7); P(a, b, '#6e9a53'); } }
    function mailbox(i, j, style) {
      if (style === 'crate') { box(i + .2, j + .2, i + .32, j + .32, 0, 10, '#7c5230'); box(i, j, i + .6, j + .5, 10, 16, '#b08a5a'); q([iso(i, j + .5, 12), iso(i + .6, j + .5, 12), iso(i + .6, j + .5, 12.5), iso(i, j + .5, 12.5)], '#8a6a48'); }
      else if (style === 'pillar') { box(i, j, i + .7, j + .7, 0, 15, '#a6574a', '#8a483d'); for (let zz = 2; zz < 15; zz += 2.5) q([iso(i, j + .7, zz), iso(i + .7, j + .7, zz), iso(i + .7, j + .7, zz + .4), iso(i, j + .7, zz + .4)], '#d9cfc2'); box(i + .05, j + .1, i + .65, j + .6, 15, 20, '#2e2d2c'); }
      else if (style === 'modern') { box(i, j, i + .5, j + .5, 0, 16, '#d6d1c7'); box(i - .05, j + .05, i + .55, j + .45, 16, 21, '#8a5a36'); }
      else { box(i + .3, j + .15, i + .45, j + .3, 0, 13, '#7c5230'); box(i, j, i + .75, j + .5, 13, 19, '#f3efe6'); top(i, j, i + .75, j + .5, 21, '#fbf9f4'); q([iso(i, j + .5, 19), iso(i + .75, j + .5, 19), iso(i + .75, j + .5, 21), iso(i, j + .5, 21)], '#e2dccf');
        box(i + .75, j + .1, i + .82, j + .17, 16, 24, '#b33a2f'); box(i + .75, j + .1, i + .82, j + .4, 22, 24, '#b33a2f'); }
      const zt = style === 'crate' ? 16 : style === 'pillar' ? 20 : style === 'modern' ? 21 : 21;
      if (mail) { q([iso(i + .15, j + .25, zt), iso(i + .5, j + .25, zt), iso(i + .5, j + .25, zt + 4), iso(i + .15, j + .25, zt + 4)], '#f6e8c8'); const [a, b] = iso(i + .4, j + .25, zt + 3.5); P(a, b, '#b33a2f', 2, 1); }
      const [a, b] = iso(i + .35, j + .25, zt / 2); spot('mail', [a - 8, b - zt / 2 - 8, 16, zt + 10]);
    }
    function diary(i, j, zz) { box(i, j, i + .45, j + .4, zz, zz + 1.3, '#b33a2f'); top(i, j, i + .45, j + .4, zz + 1.3, '#c9493c'); const [a, b] = iso(i + .22, j + .2, zz + 1.4); P(a - 1, b, '#d4a83c', 3, 1); spot('diary', [a - 8, b - 6, 16, 10]); }
    function smallTable(i, j, zz0 = 0, col = '#5e3c22') { [[i, j], [i + .7, j], [i, j + .5], [i + .7, j + .5]].forEach(([a, b]) => box(a, b, a + .08, b + .08, zz0, zz0 + 7, col)); box(i - .1, j - .1, i + .88, j + .68, zz0 + 7, zz0 + 8, sh(col, .25)); return zz0 + 8; }
    function catAt(i, j, zz) { if (!cat) return; const [a, b] = iso(i, j, zz);
      x.fillStyle = 'rgba(40,28,18,.2)'; x.fillRect(a - 4, b + 1, 9, 2);
      x.fillStyle = '#c2803c'; x.fillRect(a - 3, b - 6, 7, 7); x.fillStyle = '#e3a25a'; x.fillRect(a - 3, b - 7, 6, 6);
      x.fillStyle = '#e3a25a'; x.fillRect(a - 2, b - 12, 6, 5); x.fillStyle = '#c2803c'; x.fillRect(a - 2, b - 13, 1, 1); x.fillRect(a + 3, b - 13, 1, 1);
      x.fillStyle = '#b06e2e'; x.fillRect(a, b - 12, 1, 2); x.fillRect(a - 2, b - 5, 1, 3); x.fillRect(a + 1, b - 5, 1, 3);
      x.fillStyle = '#5a3d28'; x.fillRect(a - 1, b - 9, 1, 1); x.fillRect(a + 2, b - 9, 1, 1);
      x.fillStyle = '#c2803c'; x.fillRect(a + 4, b - 1, 3, 1); x.fillRect(a + 6, b - 3, 1, 2);
      x.fillStyle = '#9aa7b3'; x.fillRect(a + 6, b - 15, 1, 1); x.fillRect(a + 8, b - 17, 2, 1); }
    // 窗：at 是哪一面（onY(Y) 或 onX(X)），a0～a1 沿牆、z0～z1 高度
    function win(at, a0, a1, z0, z1, o = {}) {
      const fr = o.frame || '#f8f4ea', gl = night ? '#ffd98a' : (o.glass || '#a8d4e8');
      rect(at, a0 - .12, a1 + .12, z0 - 1.5, z1 + 1.5, fr); rect(at, a0, a1, z0, z1, gl);
      if (!night) rect(at, a0, a1, z1 - Math.min(4, (z1 - z0) / 3), z1, sh(gl, .45));
      if (!o.big) { const m = (a0 + a1) / 2; rect(at, m - .04, m + .04, z0, z1, fr); rect(at, a0, a1, (z0 + z1) / 2, (z0 + z1) / 2 + .8, fr); }
      else for (let t = a0 + 1.2; t < a1 - .2; t += 1.2) rect(at, t - .03, t + .03, z0, z1, fr);
      if (o.shutter) [[a0 - .55, a0 - .15], [a1 + .15, a1 + .55]].forEach(([b0, b1]) => { rect(at, b0, b1, z0, z1, o.shutter); for (let zz = z0 + 1.5; zz < z1; zz += 2) rect(at, b0 + .05, b1 - .05, zz, zz + .6, sh(o.shutter, -.2)); });
      if (o.flowers) { rect(at, a0 - .1, a1 + .1, z0 - 4, z0 - 1.5, '#9a6a40'); for (let t = a0; t < a1; t += .22) { const [p, r] = at(t, z0 - 1); P(p, r - 1, hash(t * 10 | 0, 3) > .5 ? '#e46a5c' : '#f2c14e'); P(p, r, '#4f7a3e'); } }
      if (night) { const [p, r] = at((a0 + a1) / 2, (z0 + z1) / 2); emit.push(() => glow(p, r + 6, o.big ? 34 : 22, '255,200,120', .35)); lit.push([at, a0, a1, z0, z1, o.big]); }
    }
    const lit = [];
    function door(at, a0, a1, h, col = '#8a5a36', glassTop = true) {
      rect(at, a0 - .15, a1 + .15, 0, h + 1, '#f8f4ea'); rect(at, a0, a1, 0, h, col);
      rect(at, a0 + .15, a1 - .15, h * .52, h * .88, sh(col, -.1)); rect(at, a0 + .15, a1 - .15, h * .12, h * .44, sh(col, -.1));
      if (glassTop) rect(at, a0 + .3, a1 - .3, h * .62, h * .82, night ? '#ffd98a' : '#bfe0ea');
      const [ka, kb] = at(a1 - .12, h * .46); P(ka, kb, '#d4a83c', 1, 2);
      const [c0, c1] = at((a0 + a1) / 2, h / 2); spot('door', [c0 - 10, c1 - h / 2 - 4, 20, h + 6]);
    }
    function wallLamp(at, a, zz) { rect(at, a - .15, a + .15, zz - 2, zz + 2, '#3a3836'); rect(at, a - .1, a + .1, zz - 1.5, zz + 1.5, night ? '#fff4d6' : '#f1e3c0'); if (night) { const [p, r] = at(a, zz); emit.push(() => { glow(p, r, 28, '255,196,110', .5); glow(p, r, 6, '255,240,200', .8); }); lit.push(['lamp', p, r]); } }
    // 牆的紋路：木板（橫線）、圓木、灰泥
    function siding(at, a0, a1, z0, z1, col, kind) {
      rect(at, a0, a1, z0, z1, col);
      if (kind === 'plank') for (let zz = z0 + 4; zz < z1; zz += 3) rect(at, a0, a1, zz, zz + .6, sh(col, -.07));
      if (kind === 'log') for (let zz = z0; zz < z1; zz += 3.2) { rect(at, a0, a1, zz, zz + .8, sh(col, -.3)); rect(at, a0, a1, zz + 2.2, zz + 3, sh(col, .15)); }
      if (kind === 'stucco') for (let k = 0; k < (a1 - a0) * (z1 - z0) * .5; k++) { const [p, r] = at(a0 + hash(k, 11) * (a1 - a0), z0 + hash(11, k) * (z1 - z0)); P(p, r, sh(col, hash(k, 4) > .5 ? -.05 : .05)); }
    }
    // 人字屋頂：屋脊沿著 x，正面那片看得到（一排一排瓦）、東邊的山牆三角形
    function gable(X0, X1, Y0, Y1, wallH, ridgeH, col, wallCol, wallKind, o = {}) {
      const RO = o.ro || .3, RY = (Y0 + Y1) / 2, eave = wallH - 3;
      // 山牆三角形（東邊）
      q([iso(X1, Y0 - RO * 0, wallH), iso(X1, Y1, wallH), iso(X1, RY, ridgeH)], sh(wallCol, -.12));
      if (wallKind === 'plank' || wallKind === 'log') for (let zz = wallH + 3; zz < ridgeH - 2; zz += 3) { const t = (zz - wallH) / (ridgeH - wallH), a0 = Y0 + t * (Y1 - Y0) / 2, a1 = Y1 - t * (Y1 - Y0) / 2; q([iso(X1, a0, zz), iso(X1, a1, zz), iso(X1, a1, zz + .6), iso(X1, a0, zz + .6)], sh(wallCol, -.2)); }
      if (o.gableWin) { const [a, b] = iso(X1, RY, wallH + (ridgeH - wallH) * .45); x.fillStyle = '#5e3c22'; x.fillRect(Math.round(a) - 2, Math.round(b) - 2, 4, 4); x.fillStyle = night ? '#ffd98a' : '#a8d4e8'; x.fillRect(Math.round(a) - 1, Math.round(b) - 1, 2, 2); }
      q([iso(X0 - RO, Y0 - RO, eave), iso(X1 + RO, Y0 - RO, eave), iso(X1 + RO, RY, ridgeH), iso(X0 - RO, RY, ridgeH)], sh(col, -.25));
      q([iso(X0 - RO, RY, ridgeH), iso(X1 + RO, RY, ridgeH), iso(X1 + RO, Y1 + RO, eave), iso(X0 - RO, Y1 + RO, eave)], col);
      const rows = o.rows || 6; for (let k = 1; k < rows; k++) { const t = k / rows, jj = RY + t * (Y1 + RO - RY), zz = ridgeH + t * (eave - ridgeH); q([iso(X0 - RO, jj, zz), iso(X1 + RO, jj, zz), iso(X1 + RO, jj + .08, zz - .7), iso(X0 - RO, jj + .08, zz - .7)], sh(col, -.18)); }
      for (let i = X0; i < X1 + RO; i += .5) for (let t = 0; t < 1; t += 1 / rows) { if (hash(i * 10 | 0, t * 10 | 0) > .82) { const [a, b] = iso(i, RY + (t + .5 / rows) * (Y1 + RO - RY), ridgeH + (t + .5 / rows) * (eave - ridgeH)); P(a, b, sh(col, .15), 2, 1); } }
      q([iso(X0 - RO, Y1 + RO, eave), iso(X1 + RO, Y1 + RO, eave), iso(X1 + RO, Y1 + RO, eave - 2), iso(X0 - RO, Y1 + RO, eave - 2)], sh(col, -.3));
      q([iso(X1 + RO, RY, ridgeH), iso(X1 + RO, Y1 + RO, eave), iso(X1 + RO, Y1 + RO, eave - 2), iso(X1 + RO, RY, ridgeH - 2)], sh(col, -.38));
      q([iso(X1 + RO, Y0 - RO, eave), iso(X1 + RO, RY, ridgeH), iso(X1 + RO, RY, ridgeH - 2), iso(X1 + RO, Y0 - RO, eave - 2)], sh(col, -.38));
      q([iso(X0 - RO, RY - .1, ridgeH + 1.5), iso(X1 + RO, RY - .1, ridgeH + 1.5), iso(X1 + RO, RY + .1, ridgeH), iso(X0 - RO, RY + .1, ridgeH)], sh(col, -.3));
    }
    // 曬衣繩：A、B 兩根柱子（posts = false 就不畫柱子，例如掛在陽台欄杆上），h 是繩子多高；衣服照 clothes 一件一件掛
    // clothes：[{ t: 'top'|'coat'|'bottom'|'skirt'|'dress'|'cape'|'towel', c: 色 }]；沒有就空著（跟島上平房的曬衣繩一樣）
    const CLOTHES = opt.clothes || [];
    function hang(A, B, h, o = {}) {
      const L = (t, zz) => iso(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, zz), len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      if (o.posts !== false) [A, B].forEach(([i, j]) => { box(i - .06, j - .06, i + .06, j + .06, o.z0 || 0, h + 1, '#8a6a48'); box(i - .25, j - .04, i + .25, j + .04, h, h + 1, '#8a6a48'); });
      const [p0, r0] = L(0, h), [p1, r1] = L(1, h); x.strokeStyle = '#e9e1cf'; x.lineWidth = .7; x.beginPath(); x.moveTo(p0, r0); x.lineTo(p1, r1); x.stroke();
      const list = CLOTHES.slice(0, o.max || 5), n = list.length; if (!n) return;
      const w = Math.min(.75, len / (n + .5)) / len, gap = (1 - n * w) / (n + 1);
      list.forEach((it, k) => { const t0 = gap + k * (w + gap), t1 = t0 + w, tm = (t0 + t1) / 2, c = it.c, R = (a, b, z0, z1, col) => q([L(a, z0), L(b, z0), L(b, z1), L(a, z1)], col);
        const sw = .18 * w / .75;
        if (it.t === 'bottom') { R(t0, t1, h - 2.2, h - .2, c); R(t0, tm - .02 * w / .2, h - 9, h - 2, c); R(tm + .02 * w / .2, t1, h - 9, h - 2, sh(c, -.08)); R(t0, t1, h - 1, h - .4, sh(c, -.25)); }
        else if (it.t === 'skirt') q([L(t0 + w * .15, h - .3), L(t1 - w * .15, h - .3), L(t1 + w * .08, h - 7), L(t0 - w * .08, h - 7)], c);
        else if (it.t === 'towel') { R(t0, t1, h - 10, h - .2, c); R(t0, t1, h - 8, h - 7, '#ffffff'); }
        else { const long = it.t === 'dress' || it.t === 'cape' || it.t === 'coat', bottom = long ? (it.t === 'coat' ? h - 9 : h - 11) : h - 7;
          if (it.t === 'dress') q([L(t0 + w * .1, h - 3), L(t1 - w * .1, h - 3), L(t1 + w * .12, bottom), L(t0 - w * .12, bottom)], c);
          else R(t0, t1, bottom, h - .3, c);
          if (it.t !== 'cape') { R(t0 - sw, t0, h - 3.5, h - .3, sh(c, -.06)); R(t1, t1 + sw, h - 3.5, h - .3, sh(c, -.12)); }
          R(t0, t1, h - .8, h - .3, sh(c, .25)); R(tm - w * .12, tm + w * .12, h - 1.2, h - .3, sh(c, -.3)); }
        R(t1 - w * .12, t1, Math.min(h - 7, h - 2), h - .3, 'rgba(0,0,0,.08)');
        [t0 + w * .15, t1 - w * .15].forEach(t => { const [a, b] = L(t, h); P(a, b - 1, '#a8845a', 1, 2); }); });
    }
    function chimney(i0, j0, i1, j1, z0, z1, col = '#a0948a') { box(i0, j0, i1, j1, z0, z1, col); top(i0 + .05, j0 + .05, i1 - .05, j1 - .05, z1, '#4a4440');
      if (!night) [[0, 0], [2, -4], [5, -9]].forEach(([u, v], k) => { const [a, b] = iso((i0 + i1) / 2, (j0 + j1) / 2, z1 + 2); x.fillStyle = `rgba(255,255,255,${.7 - k * .2})`; x.fillRect(Math.round(a + u), Math.round(b + v - 3), 4 + k, 3); }); }

    // ---------- 五種房子 ----------
    if (lv === 1) {   // 帳篷：營火、曬衣繩、木箱當信箱
      tree(.9, 1.2, 'round', .8); tree(8.2, 1.1, 'pine'); bush(.8, 6.5, 2); bush(8.3, 4.4, 2);
      dirt(3.6, 7.6, 4.6, 7.7);
      // 曬衣繩（沿 y，在左邊）
      hang([.96, 3.1], [.96, 6.8], 16, { max: 4 });
      // 帳篷：屋脊沿 x，入口在東邊的三角形
      const X0 = 2.3, X1 = 6.2, Y0 = 1.2, Y1 = 4.2, YC = (Y0 + Y1) / 2, RH = 22;
      shadow(X0, Y0, X1, Y1, 1);
      q([iso(X0, YC, RH), iso(X1, YC, RH), iso(X1 + .2, Y1 + .2, 0), iso(X0 - .2, Y1 + .2, 0)], '#d9c9a2');
      for (let t = .2; t < 1; t += .2) q([iso(X0 + (X1 - X0) * t, YC, RH), iso(X0 + (X1 - X0) * t + .04, YC, RH), iso(X0 + (X1 - X0) * t + .04, Y1 + .2, 0), iso(X0 + (X1 - X0) * t, Y1 + .2, 0)], '#c9b88f');
      q([iso(X1 + .2, Y0 - .2, 0), iso(X1 + .2, Y1 + .2, 0), iso(X1, YC, RH)], '#c4b28a');
      q([iso(X1 + .21, YC - .9, 0), iso(X1 + .21, YC + .9, 0), iso(X1 + .21, YC, 15)], night ? '#ffcf7a' : '#4a3a2c');
      q([iso(X1 + .21, YC + .2, 0), iso(X1 + .21, YC + .9, 0), iso(X1 + .21, YC, 15), iso(X1 + .6, YC + 1.3, 2)], '#e6d8b5');   // 掀開的門簾
      q([iso(X0 - .1, YC, RH + 1), iso(X1 + .3, YC, RH + 1), iso(X1 + .3, YC, RH), iso(X0 - .1, YC, RH)], '#8a6a48');
      [[X1 + .9, Y1 + .9], [X1 + .9, Y0 - .5]].forEach(([a, b]) => { const [p0, r0] = iso(X1 + .2, YC, RH), [p1, r1] = iso(a, b, 0); x.strokeStyle = '#e9e1cf'; x.lineWidth = .6; x.beginPath(); x.moveTo(p0, r0); x.lineTo(p1, r1); x.stroke(); box(a - .05, b - .05, a + .05, b + .05, 0, 2, '#5e3c22'); });
      const [d0, d1] = iso(X1 + .2, YC, 7); spot('door', [d0 - 10, d1 - 9, 20, 18]);
      if (night) emit.push(() => { glow(d0, d1, 26, '255,196,110', .4); });
      // 營火
      const FI = 5.4, FJ = 6, [fa, fb] = iso(FI, FJ);
      for (let k = 0; k < 10; k++) { const th = k / 10 * Math.PI * 2, [a, b] = iso(FI + Math.cos(th) * .5, FJ + Math.sin(th) * .5); P(a - 1, b - 1, '#8f8a82', 3, 2); }
      box(FI - .35, FJ - .08, FI + .35, FJ + .08, 0, 1.5, '#6e4528'); box(FI - .08, FJ - .35, FI + .08, FJ + .35, 0, 1.5, '#5e3c22');
      const fl = (s) => { P(fa - 2 * s, fb - 4 * s, '#f08a2c', 4 * s, 3 * s); P(fa - 1 * s, fb - 7 * s, '#f2c14e', 3 * s, 4 * s); P(fa, fb - 9 * s, '#fff0c4', 1 * s, 3 * s); };
      fl(night ? 1.6 : 1); if (night) { emit.push(() => { glow(fa, fb - 6, 42, '255,150,70', .5); glow(fa, fb - 6, 12, '255,230,160', .9); }); lit.push(['fire', fa, fb]); }
      [[4.2, 5.5], [6.3, 6.9], [4.5, 7.0]].forEach(([i, j]) => box(i, j, i + .5, j + .4, 0, 4, '#8a5a36'));
      catAt(4.6, 6.7, 0);
      // 木箱桌（放日記）、提燈
      box(7.2, 3.8, 8, 4.5, 0, 6, '#b08a5a'); q([iso(7.2, 4.5, 3), iso(8, 4.5, 3), iso(8, 4.5, 3.5), iso(7.2, 4.5, 3.5)], '#8a6a48');
      diary(7.35, 3.9, 6);
      box(7.75, 4.0, 7.95, 4.2, 6, 9, night ? '#fff0c4' : '#d9a64a'); if (night) emit.push(() => { const [a, b] = iso(7.85, 4.1, 8); glow(a, b, 18, '255,210,130', .5); });
      mailbox(7.6, 6.9, 'crate');
      [[2.2, 7.3], [8.4, 7.3], [3, 0.5]].forEach(([i, j]) => { const [a, b] = iso(i, j); for (let k = 0; k < 5; k++) P(a + k - 2, b - 1 - (k % 2) * 2, '#6f9e48', 1, 2 + (k % 2) * 2); });
    }

    if (lv === 2) {   // 小木屋：圓木牆、綠色屋頂、石頭煙囪、門廊搖椅、柴堆、木柵欄
      tree(9.1, 1.2, 'pine'); tree(.8, 7.4, 'pine', .8); tree(.7, 5.6, 'pine', .9); bush(9.2, 6.6, 2);
      dirt(4.2, 5.2, 5.6, YD - .1);
      const X0 = 2, X1 = 7.4, Y0 = 1, Y1 = 4.4, WHh = 24, RH = 42;
      shadow(X0, Y0, X1, Y1);
      siding(onY(Y1), X0, X1, 0, WHh, '#a8784a', 'log'); siding(onX(X1), Y0, Y1, 0, WHh, '#93683f', 'log');
      for (let zz = 1.6; zz < WHh; zz += 3.2) { const [a, b] = iso(X1, Y1, zz); P(a - 1, b - 1, '#c99a66', 3, 3); P(a, b, '#8a5a36'); }   // 圓木的頭
      win(onY(Y1), 2.6, 3.7, 10, 18, { shutter: '#8f4532', frame: '#e9dcc3' }); win(onX(X1), 2, 3.2, 10, 18, { frame: '#e9dcc3' });
      door(onY(Y1), 4.25, 5.15, 19, '#6e4528', false); wallLamp(onY(Y1), 5.6, 18);
      gable(X0, X1, Y0, Y1, WHh, RH, '#4f6b4a', '#93683f', 'log', { gableWin: true, ro: .4 });
      chimney(5.9, 1.6, 6.6, 2.3, 30, 50, '#9a958b');
      // 門廊：木頭地板、台階
      box(X0, Y1, X1, Y1 + 1.2, 0, 2.5, '#9a6a40'); for (let i = X0 + .2; i < X1; i += .45) q([iso(i, Y1, 2.5), iso(i + .03, Y1, 2.5), iso(i + .03, Y1 + 1.2, 2.5), iso(i, Y1 + 1.2, 2.5)], '#8a5a36');
      box(4.25, Y1 + 1.2, 5.15, Y1 + 1.6, 0, 1.2, '#8a6a48');
      // 搖椅、木桶當桌子
      box(6.1, 4.65, 6.7, 5.25, 2.5, 6, '#8a5a36'); box(6.1, 4.6, 6.7, 4.75, 6, 14, '#8a5a36'); q([iso(6.05, 5.3, 2.5), iso(6.75, 5.3, 2.5), iso(6.75, 5.3, 3.3), iso(6.05, 5.3, 3.3)], '#5e3c22');
      box(2.4, 4.7, 3, 5.3, 2.5, 8, '#a8784a'); q([iso(2.4, 5.3, 4), iso(3, 5.3, 4), iso(3, 5.3, 4.6), iso(2.4, 5.3, 4.6)], '#5e5a55'); diary(2.5, 4.8, 8);
      // 柴堆
      box(8, 4.6, 9.4, 5.4, 0, 8, '#8a5a36'); for (let zz = 1; zz < 8; zz += 2.2) for (let t = 8.15; t < 9.3; t += .4) { const [a, b] = iso(t, 5.4, zz); P(a - 1, b - 1, '#c99a66', 3, 2); P(a, b - 1, '#a8784a'); }
      catAt(4.7, 5.8, 1.2);
      hang([7.2, 6.6], [9.4, 7.6], 15, { max: 3 });   // 柴堆前面拉一條
      mailbox(3.1, 7.9, 'post');
      railFence(0, YD - .1, 4, YD - .1); railFence(5.4, YD - .1, YW - .1, YD - .1); railFence(YW - .1, 2, YW - .1, YD - .1);
    }

    if (lv === 3) {   // 平房（第一張樣張）
      stones(5.35, 6.65, 6.9, YD);
      const X0 = 2, X1 = 10, Y0 = 1, Y1 = 5, WHh = 30;
      shadow(X0, Y0, X1, Y1);
      siding(onY(Y1), X0, X1, 0, WHh, '#efe4cc', 'plank'); siding(onX(X1), Y0, Y1, 0, WHh, '#ddd0b4', 'plank');
      rect(onY(Y1), X0, X1, 0, 3, '#9a958b'); rect(onX(X1), Y0, Y1, 0, 3, '#86827a');
      win(onY(Y1), 2.7, 4.2, 12, 23, { shutter: '#7d9a8c', flowers: true }); win(onY(Y1), 7.8, 9.3, 12, 23, { shutter: '#7d9a8c', flowers: true }); win(onX(X1), 2.4, 3.6, 12, 23, { shutter: '#7d9a8c' });
      door(onY(Y1), 5.45, 6.55, 24); wallLamp(onY(Y1), 4.9, 23);
      rect(onY(Y1), 6.85, 7.35, 18, 22, '#5e3c22');
      gable(X0, X1, Y0, Y1, WHh, 50, '#b0573f', '#ddd0b4', 'plank', { gableWin: true, rows: 6 });
      chimney(3.2, 2.2, 3.9, 2.9, 40, 56);
      box(4.3, Y1, 8.7, 6.2, 0, 3, '#b07f50'); for (let i = 4.5; i < 8.7; i += .45) q([iso(i, Y1, 3), iso(i + .03, Y1, 3), iso(i + .03, 6.2, 3), iso(i, 6.2, 3)], '#9a6a40');
      box(5.2, 6.2, 6.8, 6.8, 0, 1.6, '#c9bfae');
      const tz = smallTable(7.45, 5.3, 3); diary(7.6, 5.4, tz);
      box(2.3, Y1 + .1, 4.1, 5.9, 0, 3, '#7c5230'); flowers(2.45, 5.2, 3.95, 5.8, 14, 4);
      catAt(5.6, 6.5, 1.6);
      hang([11.1, 1.4], [11.1, 5.4], 16, { max: 5 });   // 東邊側院的曬衣繩（島上平房那條）
      tree(10.9, 7.2); bush(1.2, 6.2, 3); bush(9.6, 6, 3); bush(1.4, 8.3, 2);
      mailbox(3.6, 8.75, 'post');
      groundLamp(5.1, 7.6); groundLamp(6.9, 8.6);
      picket(0, YD - .1, 5.2, YD - .1); picket(6.8, YD - .1, YW - .1, YD - .1); picket(YW - .1, 3, YW - .1, YD - .1);
    }

    if (lv === 4) {   // 兩層樓：二樓陽台、門廊在陽台下面、路燈、樹籬、磚頭信箱
      stones(5.55, 6.85, 7, YD); tree(.9, 2.2, 'round', .9);   // 房子西邊的樹先畫（在房子後面）
      const X0 = 2, X1 = 10.4, Y0 = 1, Y1 = 5.4, F1 = 28, WHh = 56;
      shadow(X0, Y0, X1, Y1, 1.8);
      siding(onY(Y1), X0, X1, 0, WHh, '#eee7da', 'plank'); siding(onX(X1), Y0, Y1, 0, WHh, '#dcd3c3', 'plank');
      rect(onY(Y1), X0, X1, 0, 4, '#a6574a'); rect(onX(X1), Y0, Y1, 0, 4, '#8a483d');
      rect(onY(Y1), X0, X1, F1 - 1, F1 + 1, '#c9bfae'); rect(onX(X1), Y0, Y1, F1 - 1, F1 + 1, '#b9af9e');
      win(onY(Y1), 2.6, 4.1, 10, 22, { shutter: '#34476e' }); win(onY(Y1), 8.3, 9.8, 10, 22, { shutter: '#34476e' });
      win(onY(Y1), 2.6, 4.1, 36, 48, { shutter: '#34476e', flowers: true }); win(onY(Y1), 8.3, 9.8, 36, 48, { shutter: '#34476e', flowers: true });
      win(onX(X1), 2, 3.4, 10, 22, { shutter: '#34476e' }); win(onX(X1), 2, 3.4, 36, 48, { shutter: '#34476e' });
      door(onY(Y1), 5.65, 6.75, 24, '#34476e'); wallLamp(onY(Y1), 5.1, 22); wallLamp(onY(Y1), 7.3, 22);
      // 二樓的落地門（陽台）
      rect(onY(Y1), 5.4, 7, F1 + 2, F1 + 22, '#f8f4ea'); rect(onY(Y1), 5.55, 6.85, F1 + 2, F1 + 21, night ? '#ffd98a' : '#a8d4e8'); rect(onY(Y1), 6.17, 6.23, F1 + 2, F1 + 21, '#f8f4ea');
      if (night) lit.push([onY(Y1), 5.55, 6.85, F1 + 2, F1 + 21, true]);
      gable(X0, X1, Y0, Y1, WHh, 78, '#56606e', '#dcd3c3', 'plank', { gableWin: true, rows: 7 });
      // 門廊地板＋陽台（陽台下面就是門廊）
      box(4.2, Y1, 8.2, 6.8, 0, 2.5, '#c9bfae'); box(5.6, 6.8, 6.8, 7.2, 0, 1.2, '#c9bfae');
      [[4.25, 6.55], [7.95, 6.55]].forEach(([a, b]) => box(a, b, a + .2, b + .2, 2.5, F1 - 1, '#f3efe6'));
      box(4.1, Y1, 8.3, 6.9, F1 - 1, F1 + 1, '#e2dccf');
      for (let i = 4.2; i <= 8.2; i += .35) q([iso(i, 6.85, F1 + 1), iso(i + .05, 6.85, F1 + 1), iso(i + .05, 6.85, F1 + 9), iso(i, 6.85, F1 + 9)], '#3a3836');
      for (let j = Y1 + .2; j <= 6.85; j += .35) q([iso(8.25, j, F1 + 1), iso(8.25, j + .05, F1 + 1), iso(8.25, j + .05, F1 + 9), iso(8.25, j, F1 + 9)], '#3a3836');
      q([iso(4.1, 6.9, F1 + 9), iso(8.3, 6.9, F1 + 9), iso(8.3, 6.9, F1 + 10), iso(4.1, 6.9, F1 + 10)], '#3a3836'); q([iso(8.3, Y1, F1 + 9), iso(8.3, 6.9, F1 + 9), iso(8.3, 6.9, F1 + 10), iso(8.3, Y1, F1 + 10)], '#2b2b2e');
      box(4.5, 5.6, 5, 6.1, F1 + 1, F1 + 5, '#c96f4a'); bush(4.75, 5.85, 2, '#5e8e44');
      hang([5.2, 6.95], [8.15, 6.95], F1 + 10, { posts: false, max: 4 });   // 衣服晾在二樓陽台的欄杆上
      const tz = smallTable(7.15, 5.55, 2.5, '#3a3836'); diary(7.3, 5.65, tz);
      catAt(5.9, 7.0, 1.2);
      hedge(.3, 5.8, 1.6, 9.2); hedge(10.9, 5.8, 12.2, 8.8);
      tree(12, 2.4, 'round', 1.1);
      box(10.6, 9.2, 12.2, 9.7, 3, 4, '#8a5a36'); [[10.7, 9.25], [12, 9.25]].forEach(([a, b]) => box(a, b, a + .12, b + .4, 0, 3, '#3a3836'));   // 長椅
      lampPost(4.7, 9.2);
      mailbox(7.6, 10.1, 'pillar');
      hedge(0, YD - .5, 5.3, YD - .1); hedge(7.1, YD - .5, YW - .1, YD - .1); hedge(YW - .5, 3, YW - .1, YD - .5);
    }

    if (lv === 5) {   // 海景別墅：白色方塊、大落地窗、屋頂露台、泳池、躺椅、棕櫚樹
      // 木平台＋泳池
      top(1.6, 6, 11.2, 10.6, .6, '#b88553'); for (let i = 1.7; i < 11.2; i += .45) q([iso(i, 6, .6), iso(i + .03, 6, .6), iso(i + .03, 10.6, .6), iso(i, 10.6, .6)], '#9c6e42');
      q([iso(1.6, 10.6, .6), iso(11.2, 10.6, .6), iso(11.2, 10.6, 0), iso(1.6, 10.6, 0)], '#7c5230'); q([iso(11.2, 6, .6), iso(11.2, 10.6, .6), iso(11.2, 10.6, 0), iso(11.2, 6, 0)], '#6e4528');
      const PX0 = 2.4, PX1 = 9.4, PY0 = 6.8, PY1 = 9.8, pool = [iso(PX0, PY0, .6), iso(PX1, PY0, .6), iso(PX1, PY1, .6), iso(PX0, PY1, .6)];
      top(PX0 - .3, PY0 - .3, PX1 + .3, PY1 + .3, .7, '#ece7dc');
      x.save(); x.beginPath(); pool.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.clip();
      q(pool, night ? '#2fa6b8' : '#5fc6d6');
      q([iso(PX0, PY0, .6), iso(PX0, PY1, .6), iso(PX0, PY1, -12), iso(PX0, PY0, -12)], night ? '#4fb3c3' : '#8fd8e2');
      q([iso(PX0, PY0, .6), iso(PX1, PY0, .6), iso(PX1, PY0, -12), iso(PX0, PY0, -12)], night ? '#5cc0cf' : '#a3e0e8');
      for (let k = 0; k < 60; k++) { const [a, b] = iso(PX0 + hash(k, 21) * (PX1 - PX0), PY0 + hash(21, k) * (PY1 - PY0), .6); P(a, b, night ? '#7fe0ec' : '#c8f0f4', 3, 1); }
      x.restore();
      [[PX1 - .6, PY0 + .02]].forEach(([i, j]) => { [0, .3].forEach(d => box(i + d, j, i + d + .05, j + .05, -3, 6, '#c3c8c9')); for (let zz = 0; zz < 6; zz += 2) q([iso(i, j + .02, zz), iso(i + .35, j + .02, zz), iso(i + .35, j + .02, zz + .4), iso(i, j + .02, zz + .4)], '#c3c8c9'); });
      if (night) { emit.push(() => { const [a, b] = iso((PX0 + PX1) / 2, (PY0 + PY1) / 2, 0); glow(a, b, 70, '90,220,235', .35); }); lit.push(['pool', pool]); }
      // 房子：一樓長方塊、二樓往左縮一點；屋頂平的
      const X0 = 1.5, X1 = 10.5, Y0 = 1, Y1 = 5.2, F1 = 28, X2 = 7.2, Y2 = 4.6, F2 = 54;
      shadow(X0, Y0, X1, Y1, 1.6);
      siding(onY(Y1), X0, X1, 0, F1, '#f4f2ee', 'stucco'); siding(onX(X1), Y0, Y1, 0, F1, '#e2dfd8', 'stucco');
      win(onY(Y1), 2, 5.4, 3, 25, { big: true, frame: '#3a3836' }); win(onY(Y1), 7.6, 10, 3, 25, { big: true, frame: '#3a3836' });
      rect(onY(Y1), 5.7, 7.3, 0, F1, '#8a5a36'); for (let zz = 2; zz < F1; zz += 2.5) rect(onY(Y1), 5.7, 7.3, zz, zz + .4, '#7c5230');
      door(onY(Y1), 6.05, 6.95, 24, '#5e3c22', false);
      win(onX(X1), 1.6, 4.4, 8, 22, { big: true, frame: '#3a3836' });
      box(X0 - .15, Y0 - .15, X1 + .15, Y1 + .15, F1, F1 + 2, '#d6d1c7');
      // 二樓
      siding(onY(Y2), X0, X2, F1 + 2, F2, '#f4f2ee', 'stucco'); siding(onX(X2), Y0, Y2, F1 + 2, F2, '#e2dfd8', 'stucco');
      win(onY(Y2), 2, 6.8, 34, 48, { big: true, frame: '#3a3836' }); win(onX(X2), 1.6, 4, 34, 48, { big: true, frame: '#3a3836' });
      rect(onY(Y2), X0, 2.6, F1 + 2, F2, '#8a5a36'); for (let zz = F1 + 4; zz < F2; zz += 2.5) rect(onY(Y2), X0, 2.6, zz, zz + .4, '#7c5230');
      box(X0 - .15, Y0 - .15, X2 + .15, Y2 + .15, F2, F2 + 2, '#d6d1c7');
      // 屋頂露台（一樓屋頂右邊）：玻璃欄杆、陽傘、躺椅
      for (let j = Y0; j <= Y1; j += .02) {}
      x.save(); x.globalAlpha = .45; q([iso(X2, Y1 + .1, F1 + 2), iso(X1 + .1, Y1 + .1, F1 + 2), iso(X1 + .1, Y1 + .1, F1 + 9), iso(X2, Y1 + .1, F1 + 9)], '#d6eef2'); q([iso(X1 + .1, Y0, F1 + 2), iso(X1 + .1, Y1 + .1, F1 + 2), iso(X1 + .1, Y1 + .1, F1 + 9), iso(X1 + .1, Y0, F1 + 9)], '#c3e2e8'); x.restore();
      q([iso(X2, Y1 + .1, F1 + 9), iso(X1 + .1, Y1 + .1, F1 + 9), iso(X1 + .1, Y1 + .1, F1 + 9.6), iso(X2, Y1 + .1, F1 + 9.6)], '#9aa3a8'); q([iso(X1 + .1, Y0, F1 + 9), iso(X1 + .1, Y1 + .1, F1 + 9), iso(X1 + .1, Y1 + .1, F1 + 9.6), iso(X1 + .1, Y0, F1 + 9.6)], '#8a9398');
      box(8.8, 2.6, 8.9, 2.7, F1 + 2, F1 + 20, '#efe9dc');
      { const [a, b] = iso(8.85, 2.65, F1 + 20); for (let r = 0; r < 6; r++) { const w = 3 + r * 2; P(a - w, b + r - 1, r % 2 ? '#f3efe6' : '#b33a2f', w * 2 + 1, 1); } }
      box(9.4, 3.3, 10.2, 4.8, F1 + 2, F1 + 4, '#f3efe6'); box(9.4, 3.3, 10.2, 3.6, F1 + 4, F1 + 8, '#f3efe6');
      hang([7.6, 1.6], [10, 1.6], F1 + 12, { z0: F1 + 2, max: 4 });   // 屋頂露台的曬衣架
      // 泳池邊的躺椅、小圓桌放日記
      [[10, 7], [10, 8.4]].forEach(([i, j], n) => { box(i, j, i + 1, j + .6, .6, 3, '#f3efe6'); box(i, j, i + .3, j + .6, 3, 6.5, '#f3efe6'); if (n === 0) { top(i + .35, j + .05, i + .95, j + .55, 3.2, '#5fc6d6'); top(i + .45, j + .05, i + .55, j + .55, 3.3, '#ffffff'); } if (n === 1) catAt(i + .6, j + .3, 3); });   // 一張躺椅鋪著海灘巾
      { const tz = smallTable(10.3, 7.75, .6, '#d6d1c7'); diary(10.4, 7.8, tz); }
      tree(12.6, 3.4, 'palm', 1.2); tree(.9, 11, 'palm'); tree(12.8, 10.6, 'palm', .9); bush(.9, 6.6, 3); bush(1, 8.6, 2);
      stonesX(11.4, YW, 10.9, 11.7, '#e2ded5'); stones(11.5, 12.3, 6.2, 10.9, '#e2ded5');
      groundLamp(11.1, 9.4); groundLamp(12.6, 9.4); groundLamp(2, 10.9); groundLamp(8.6, 10.9);
      mailbox(12.6, 11.8, 'modern');
      box(0, YD - .35, 11.4, YD - .05, 0, 5, '#f4f2ee', '#e2dfd8'); box(YW - .35, 2, YW - .05, 10.8, 0, 5, '#f4f2ee', '#e2dfd8');
    }

    // ---------- 夜晚：調暗後貼到夜空上，再把燈畫亮 ----------
    if (night) { x.save(); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(16,22,58,.6)'; x.fillRect(0, 0, W, H); x.restore(); }
    main.imageSmoothingEnabled = false; main.drawImage(off, 0, 0); x = main;
    if (night) {
      x.save(); x.globalCompositeOperation = 'lighter'; emit.forEach(e => e()); x.restore();
      lit.forEach(l => { if (l[0] === 'lamp') { P(l[1] - 1, l[2] - 1, '#fff4d6', 2, 3); return; } if (l[0] === 'fire') { P(l[1] - 3, l[2] - 6, '#f08a2c', 6, 5); P(l[1] - 2, l[2] - 11, '#f2c14e', 4, 6); P(l[1], l[2] - 14, '#fff0c4', 1, 4); return; }
        if (l[0] === 'pool') { x.save(); x.globalAlpha = .35; poly(x, l[1], '#7fe0ec'); x.restore(); return; }
        const [at, a0, a1, z0, z1] = l; poly(x, [at(a0, z0), at(a1, z0), at(a1, z1), at(a0, z1)], '#ffd98a'); });
    }
    // 來玩的角色：坐在這棟房子的座位上（照前後順序畫，後面的先畫）
    if (opt.debugSeats) seats.forEach(([i, j, zz], n) => { const [a, b] = iso(i, j, zz); x.fillStyle = '#b33a2f'; x.fillRect(a - 3, b - 3, 6, 6); x.fillStyle = '#fff'; x.font = '6px sans-serif'; x.fillText(n, a - 1.6, b + 2); });
    guests.slice(0, seats.length).map((k, n) => [k, seats[n]]).sort((A, B) => (A[1][0] + A[1][1]) - (B[1][0] + B[1][1])).forEach(([k, [i, j, zz]]) => { const [a, b] = iso(i, j, zz); guest(x, k, Math.round(a * 2) / 2, Math.round(b * 2) / 2); });
    main.setTransform(1, 0, 0, 1, 0, 0);
    return { canvas: cv, W, H, spots, name: sp.name, seats: seats.length };
  }

  root.XiaodaoDoor = { render, SPEC, guest, GUEST_KEYS, GUEST_NAME };
})(window);
