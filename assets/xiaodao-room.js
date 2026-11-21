// 我的小島：屋內（第四批）。照 docs/plans/jiayuan/interior.html 的畫法：正上方、把屋頂拿掉；北邊的牆看得到牆面（壁紙、窗、掛畫），其他牆只看到牆頂；一格 10 顆。
// 一層一張圖：房間由左到右排，中間隔一道牆（留門），一樓客廳下面是大門。家具從 assets/xiaodao/furn.png 切，轉方向、加影子照設計圖的 place()。
// 用法：XiaodaoRoom.load().then(() => { const o = XiaodaoRoom.render(state, 第幾層, { canvas, night }); o.rooms → 每一間在圖上的位置 })
(function (root) {
  'use strict';
  const X = root.XiaodaoRules, hash = X.hash, T = 10, F = 16, TOP = 20;   // 牆頂 4 顆＋牆面 16 顆，地板從第 20 顆開始
  const WALLTOP = '#6e5a46', WALLTOP2 = '#5a4838';
  const FLOOR_PAL = [['#d8b892', '#c9a882', '#e4c8a4', '#a8865e'], ['#c89b6a', '#bb8d5c', '#d3a776', '#9a6a40'], ['#a8764a', '#986a40', '#b98656', '#6e4528'], 'tile', 'marble', 'tatami'];
  const PAPER = [
    (i, j) => (i % 6 < 3) ? '#efe4cf' : '#e4d5b6',
    (i, j) => (hash(i, j) > .93) ? '#cfdcd3' : '#dfe8e1',
    (i, j) => (i % 6 === 2 && j % 6 === 2) || (i % 6 === 5 && j % 6 === 5) ? '#c9a24a' : '#f1e9dc',
    (i, j) => (i % 8 === 0) ? '#2a3a5a' : (hash(i, j) > .95 ? '#3d5078' : '#33456a'),
    (i, j) => hash(i * 3, j * 5) > .96 ? '#e2dccd' : hash(i, j) > .985 ? '#c9a24a' : '#f4efe4',
    (i, j) => { const row = Math.floor(j / 4), off = row % 2 ? 4 : 0; return (j % 4 === 3 || (i + off) % 8 === 7) ? '#d9cfc2' : hash(Math.floor((i + off) / 8), row) > .5 ? '#b5654a' : '#a65a40'; },
  ];

  // ---- 像素 ----
  const cache = new Map();
  const rgba = c => { let v = cache.get(c); if (v) return v; if (c[0] === '#') v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1]; else { const m = c.match(/[\d.]+/g).map(Number); v = [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; } cache.set(c, v); return v; };
  function Buf(W, H) { this.W = W; this.H = H; this.d = new Uint8ClampedArray(W * H * 4); }
  Buf.prototype.P = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.W || y >= this.H) return; const [r, g, b, a] = rgba(c), k = (y * this.W + x) * 4, d = this.d; if (a >= 1) { d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255; } else { d[k] = d[k] * (1 - a) + r * a; d[k + 1] = d[k + 1] * (1 - a) + g * a; d[k + 2] = d[k + 2] * (1 - a) + b * a; d[k + 3] = 255; } };
  Buf.prototype.R = function (x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.P(x + i, y + j, c); };
  Buf.prototype.poly = function (pts, c) {
    const ys = pts.map(p => p[1]), xs = pts.map(p => p[0]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) for (let X2 = Math.floor(Math.min(...xs)); X2 <= Math.ceil(Math.max(...xs)); X2++) {
      const px = X2 + .5, py = y + .5; let ins = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) ins = !ins; }
      if (ins) this.P(X2, y, c);
    }
  };

  // ---- 地板 ----
  function floor(B, a, b, w, h, kind) {
    const p = FLOOR_PAL[kind] || FLOOR_PAL[1];
    if (p === 'tile') { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = (Math.floor(i / 8) + Math.floor(j / 8)) % 2, edge = i % 8 === 7 || j % 8 === 7; B.P(a + i, b + j, edge ? '#c9c2b4' : c ? '#ebe6dc' : '#ddd6c8'); } return; }
    if (p === 'marble') { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = Math.sin((i + j * 1.7) / 5 + hash(Math.floor(i / 6), Math.floor(j / 6)) * 3); B.P(a + i, b + j, i % 20 === 19 || j % 15 === 14 ? '#d6d1c7' : v > .93 ? '#b9b4ab' : hash(i, j) > .97 ? '#e4e0d8' : '#f1eee8'); } return; }
    if (p === 'tatami') { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const edge = j % 20 === 0 || j % 20 === 19 || i % 40 === 0 || i % 40 === 39; B.P(a + i, b + j, edge ? '#3d4a36' : (i % 2 ? '#c2c48a' : '#b5b77c')); } return; }
    for (let j = 0; j < h; j++) { const row = Math.floor(j / 5), off = hash(row, 7) * 30; for (let i = 0; i < w; i++) { const n = hash(a + i, b + j), seam = (j % 5 === 4) || ((i + off) % 30 < 1); B.P(a + i, b + j, seam ? p[3] : n > .9 ? p[2] : n < .12 ? p[1] : p[0]); } }
  }
  function northWall(B, a, w, paper) { B.R(a, 0, w, 4, WALLTOP); B.R(a, 3, w, 1, WALLTOP2); const f = PAPER[paper] || PAPER[0]; for (let j = 0; j < F; j++) for (let i = 0; i < w; i++) B.P(a + i, 4 + j, f(a + i, j)); B.R(a, 4 + F - 2, w, 2, '#8a6a4a'); B.R(a, 4 + F, w, 1, 'rgba(40,30,20,.25)'); }
  const vWall = (B, a, b, h) => { B.R(a, b, 4, h, WALLTOP); B.R(a + 3, b, 1, h, WALLTOP2); };
  const hWall = (B, a, b, w) => { B.R(a, b, w, 4, WALLTOP); B.R(a, b + 3, w, 1, WALLTOP2); };
  function windowN(B, a, w, night) {
    B.R(a, 6, w, F - 6, '#f3f1ec'); B.R(a + 1, 7, w - 2, F - 8, night ? '#2a3550' : '#a8cdd6'); B.R(a + 1, 7, 3, F - 8, night ? '#3d4a6e' : '#e2f1f3'); B.R(a + Math.floor(w / 2), 7, 1, F - 8, '#f3f1ec');
    if (!night) B.poly([[a + 1, 4 + F], [a + w - 1, 4 + F], [a + w + 6, 4 + F + 22], [a + 8, 4 + F + 22]], 'rgba(255,240,200,.18)');   // 窗光落在地上
  }
  function stairs(B, a, b, w, h) { B.R(a, b, w, h, '#9a6a40'); for (let j = 0; j < h; j += 4) { B.R(a, b + j, w, 1, '#c48d5c'); B.R(a, b + j + 3, w, 1, '#6e4528'); } B.R(a, b, 1, h, '#5e3c22'); B.R(a + w - 1, b, 1, h, '#5e3c22'); }
  function doormat(B, a, b, w) { B.R(a, b, w, 5, '#8e8070'); for (let i = 1; i < w - 1; i += 2) B.P(a + i, b + 2, '#a99c88'); }

  // ---- 家具（切圖、轉、影子） ----
  let ATLAS = null, loading = null;
  function load(base = 'assets/xiaodao/', ver = '') {
    if (loading) return loading;
    loading = new Promise(ok => { const im = new Image(); im.onload = () => { ATLAS = im; ok(); }; im.onerror = () => ok(); im.src = base + 'furn.png' + (ver ? '?v=' + ver : ''); });
    return loading;
  }
  const SHADOW_D = { wall: 3, rug: 0, rugone: 0, pic: 0 };
  // 一件家具畫成一張小圖（轉好方向）：回 canvas
  const tileCache = new Map();
  function tile(k, c, rot, night) {
    const f = X.FURN[k], col = f.colors[c] || f.colors[0], src = night && col.nt ? col.nt : col.d, id = k + c + rot + (night && col.nt ? 'n' : '');
    if (tileCache.has(id)) return tileCache.get(id);
    const [sx, sy, sw, sh] = src, rw = rot & 1 ? sh : sw, rh = rot & 1 ? sw : sh, r = document.createElement('canvas'); r.width = rw; r.height = rh; const x = r.getContext('2d'); x.imageSmoothingEnabled = false;
    if (rot === 1) { x.translate(rw, 0); x.rotate(Math.PI / 2); } else if (rot === 2) { x.translate(rw, rh); x.rotate(Math.PI); } else if (rot === 3) { x.translate(0, rh); x.rotate(-Math.PI / 2); }
    if (ATLAS) x.drawImage(ATLAS, sx, sy, sw, sh, 0, 0, sw, sh);
    if (ATLAS) tileCache.set(id, r); return r;   // 圖還沒載好的不存（不然之後一直是空的）
  }
  function drawFurn(x, k, c, rot, a, b, night, alpha) {
    const t = tile(k, c, rot, night), d = SHADOW_D[X.FURN[k].kind] != null ? SHADOW_D[X.FURN[k].kind] : 2;
    if (alpha != null) x.globalAlpha = alpha;
    if (d) { const s = document.createElement('canvas'); s.width = t.width; s.height = t.height; const sx = s.getContext('2d'); sx.drawImage(t, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = 'rgba(40,30,20,.22)'; sx.fillRect(0, 0, t.width, t.height); x.drawImage(s, a + d, b + d); }
    x.drawImage(t, a, b); x.globalAlpha = 1;
  }

  // 一層的版面：每一間在圖上的位置 { id, name, w, h, x0, y0（地板左上） }
  function layout(s, fi) {
    const fl = X.floorsOf(s)[fi]; if (!fl) return null;
    const H = Math.max(...fl.rooms.map(r => r.h)); let x = 4; const rooms = [];
    fl.rooms.forEach(r => { rooms.push(Object.assign({}, r, { x0: x, y0: TOP })); x += r.w * T + 4; });
    return { n: fl.n, rooms, W: x, H: TOP + H * T + 4 + (fi === 0 ? 6 : 0) };
  }
  // 畫一層：opt.night 亮燈、opt.ghost 半透明預覽 { k, c, rot, room, x, y, bad }、opt.hide 不畫的那件（正在移動）
  function render(s, fi, opt = {}) {
    const L = layout(s, fi); if (!L) return null;
    const B = new Buf(L.W, L.H), night = !!opt.night;
    B.R(0, 0, L.W, L.H, '#3a3029');
    L.rooms.forEach((r, i) => {
      const st = X.styleOf(s, r.id), w = r.w * T, h = r.h * T;
      northWall(B, r.x0 - 4, w + 8, st.paper);
      floor(B, r.x0, TOP, w, h, st.floor);
      // 窗：每 6 格一扇，有掛畫的地方不開窗
      const pics = X.placedIn(s, r.id).filter(t => X.FURN[t.key].kind === 'pic').map(t => [t.at[0], t.at[0] + X.FURN[t.key].w]);
      for (let c = 1; c + 2 <= r.w - 1; c += 6) if (!pics.some(([a, b]) => c < b + 0.5 && a < c + 2.5)) windowN(B, r.x0 + c * T + 2, 2 * T - 4, night);
      (r.block || []).forEach(([bx, by, bw, bh]) => stairs(B, r.x0 + bx * T, TOP + by * T, bw * T, bh * T));
    });
    // 牆：左右外牆、房間之間（中間留門）、下面（一樓客廳留大門）
    vWall(B, 0, 0, L.H - (fi === 0 ? 6 : 0)); vWall(B, L.W - 4, 0, L.H - (fi === 0 ? 6 : 0));
    const bottom = L.H - 4 - (fi === 0 ? 6 : 0);
    L.rooms.forEach((r, i) => {
      if (i) { const a = r.x0 - 4, mid = TOP + Math.floor(r.h / 2) * T - 12; vWall(B, a, 0, mid); vWall(B, a, mid + 24, bottom - mid - 24); floor(B, a, mid, 4, 24, X.styleOf(s, r.id).floor); }
      if (fi === 0 && r.id === 'main') { const d = r.x0 + Math.floor(r.w / 2) * T - 8; hWall(B, r.x0 - 4, bottom, d - r.x0 + 4); hWall(B, d + 16, bottom, r.x0 + r.w * T - d - 16 + 4); floor(B, d, bottom, 16, 4, X.styleOf(s, r.id).floor); doormat(B, d, bottom + 4, 16); }
      else hWall(B, r.x0 - 4, bottom, r.w * T + 8);
    });
    const cv = opt.canvas || document.createElement('canvas'); if (cv.width !== L.W || cv.height !== L.H) { cv.width = L.W; cv.height = L.H; }
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.putImageData(new ImageData(B.d, L.W, L.H), 0, 0);
    // 家具：地毯 → 其他照 y 排 → 掛畫
    L.rooms.forEach(r => {
      const list = X.placedIn(s, r.id).filter(t => t.id !== opt.hide), lay = t => X.layerOf(t.key);
      const at = t => [r.x0 + t.at[0] * T, lay(t) === 'pic' ? 4 : TOP + t.at[1] * T];
      list.filter(t => lay(t) === 'rug').forEach(t => { const [a, b] = at(t); drawFurn(x, t.key, t.c, t.rot, a, b, night); });
      list.filter(t => lay(t) === 'obj').sort((p, q) => p.at[1] - q.at[1]).forEach(t => { const [a, b] = at(t); drawFurn(x, t.key, t.c, t.rot, a, b, night); });
      list.filter(t => lay(t) === 'pic').forEach(t => { const [a, b] = at(t); drawFurn(x, t.key, t.c, 0, a, b, night); });
      const g = opt.ghost; if (g && g.room === r.id) {
        const pic = X.FURN[g.k].kind === 'pic', a = r.x0 + g.x * T, b = pic ? 4 : TOP + g.y * T, [fw, fh] = X.fpOf(g.k, g.rot);
        drawFurn(x, g.k, g.c, g.rot, a, b, night, .6);
        x.strokeStyle = g.bad ? 'rgba(179,58,47,.95)' : '#ffffff'; x.lineWidth = 1; x.setLineDash([2, 2]); x.strokeRect(a + .5, b + .5, fw * T - 1, (pic ? F : fh * T) - 1); x.setLineDash([]);
      }
    });
    if (night) { x.fillStyle = 'rgba(20,24,48,.28)'; x.fillRect(0, 0, L.W, L.H); }
    return { canvas: cv, layout: L };
  }
  // 地板、壁紙的小樣（商店、換地板壁紙用）：回 dataURL
  function swatch(kind, i, w = 40, h = 30) {
    const B = new Buf(w, h);
    if (kind === 'floor') floor(B, 0, 0, w, h, i); else { const f = PAPER[i] || PAPER[0]; for (let j = 0; j < h; j++) for (let x = 0; x < w; x++) B.P(x, j, f(x, j)); B.R(0, h - 3, w, 3, '#8a6a4a'); }
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(B.d, w, h), 0, 0); return c.toDataURL();
  }
  // 家具小圖（不轉、白天）：回 dataURL
  const thumbCache = new Map();
  function thumb(k, c) { const id = k + ':' + c; if (thumbCache.has(id)) return thumbCache.get(id); const u = tile(k, c, 0, false).toDataURL(); if (ATLAS) thumbCache.set(id, u); return u; }
  root.XiaodaoRoom = { load, render, layout, T, TOP, F, tile, thumb, swatch, FLOOR_PAL, PAPER };
})(window);
