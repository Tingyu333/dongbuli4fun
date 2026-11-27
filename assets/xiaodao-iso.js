// 我的小島：屋內「斜四十五度」畫法（2026-11-23 使用者看過 docs/plans/jiayuan/interior-iso.png 說好）。
// 一次畫一間：後面兩道牆（北牆在右後、西牆在左後）看得到牆面，前面兩道剖開只剩矮矮的牆頂，地板下面一層底座，像模型屋。
// 存檔不變：家具還是照格子（x 往右下、y 往左下）、四個方向 rot；每件家具用「盒子」拼（在自己的座標裡寫一次，轉方向自動算），
// 所以四個方向都畫得出來；朝裡面（背對鏡頭）的家具就看到背面。
// 用法：XiaodaoIso.load().then(() => { const o = XiaodaoIso.render(state, 第幾層, 房間 id, { canvas, z, night, ghost, hide }); o.pick(px, py) → 哪一格；o.hit(px, py) → 點到哪一件 })
(function (root) {
  'use strict';
  const X = root.XiaodaoRules, hash = X.hash;
  const TW = 12, TH = 6, WH = 44, SLAB = 7, M = 12, WT = .35;   // 一格寬 24 顆高 12 顆；牆高 44；底座 7；牆厚 .35 格

  // ---------- 顏色 ----------
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const shadeCache = new Map();
  function sh(c, f) {   // f > 0 變亮（往白）、f < 0 變暗
    const id = c + f; let v = shadeCache.get(id); if (v) return v;
    const a = hex(c); v = toHex(f > 0 ? a.map(x => x + (255 - x) * f) : a.map(x => x * (1 + f))); shadeCache.set(id, v); return v;
  }
  const WOOD = { 淺木: '#c9a072', 胡桃木: '#8a5a36', 白: '#ece7dc', 黑: '#3d4246', 原色: '#b07f50' };   // 黑（2026-11-27 使用者同意）：原本 #3d3b38 右側、腳會暗到接近黑，改成家門口那組深灰
  const FAB = { 藍: '#5f80a8', 綠: '#7d9a8c', 米: '#ddd0b4', 朱: '#b33a2f', 深藍: '#34476e', 灰: '#8f8c87', 皮革咖啡: '#7a4e32', 金: '#d4a83c', 白: '#ece7dc', 黑: '#3d4246', 原色: '#b07f50', 淺木: '#c9a072', 胡桃木: '#8a5a36' };
  // 一件家具的顏色：名字拆成「材質・配色」
  function colorsOf(k, c) {
    const f = X.FURN[k], n = (f.colors[c] || f.colors[0]).n, [a, b] = n.split('・');
    return { a, b, wood: WOOD[a] || WOOD.原色, fab: FAB[b || a] || FAB.米, main: FAB[a] || WOOD[a] || '#b07f50' };
  }

  // ---------- 地板、壁紙（一顆一顆算） ----------
  const FLOOR = [
    { t: 'wood', p: ['#dcbf98', '#d2b48b', '#e5cba6', '#b08e66'] },
    { t: 'wood', p: ['#c99a66', '#bf8f5b', '#d3a674', '#9c6e42'] },
    { t: 'wood', p: ['#a8764a', '#9b6b42', '#b58457', '#6e4528'] },
    { t: 'tile' }, { t: 'marble' }, { t: 'tatami' }
  ];
  // 2026-11-27 審稿：接縫都是連續的一顆線（原本是點點虛線，像郵票打孔）；木紋順著木板方向、只留一成；
  // 磁磚兩色分明＋左上亮邊；大理石每塊自己的彎曲紋、四成不畫；榻榻米布邊一顆、短邊接縫畫出來、草紋順著長邊
  // 帳篷裡的預設地板（第 1 種）畫成帆布地墊（2026-11-27 第二輪：木地板讓帳篷像一間房間）
  // 第三輪：橄欖綠一格一格像人工草皮，改灰綠 #8c9a7a、兩格一片、接縫少
  const GROUND = (i, j) => { const a = Math.floor(i / 2), b = Math.floor(j / 2), fa = i / 2 - a, fb = j / 2 - b; if (fa < .03 || fb < .03) return '#7d8a6c'; return hash(a, b) > .5 ? '#8c9a7a' : '#909e7e'; };
  function floorPx(kind, i, j, px, py, lv) {   // i、j 是格子座標（小數）；lv 是家的等級
    if (lv === 1 && kind === 1) return GROUND(i, j);
    const F = FLOOR[kind] || FLOOR[1];
    if (F.t === 'wood') { const row = Math.floor(j * 2), fr = j * 2 - row, off = ((row * 7) % 5) * .64, u = (i + off) / 3.2, seg = Math.floor(u), fi = u - seg;
      if (fr < .17 || fi < .03) return F.p[3];
      const base = F.p[Math.floor(hash(row, seg) * 3)];
      if (fr > .42 && fr < .62 && hash(row * 13 + seg, Math.floor(i * 5)) > .84) return sh(base, -.07);   // 木紋：順著木板的短線
      return base; }
    if (F.t === 'tile') { const a = Math.floor(i), b = Math.floor(j), fa = i - a, fb = j - b, dk = (a + b) % 2;
      if (fa < .085 || fb < .085) return '#b3ab9e';
      if (fa < .17 || fb < .17) return dk ? '#e2dccf' : '#fbf9f5';
      return dk ? '#d6cfc2' : '#f1ede5'; }
    if (F.t === 'marble') { const a = Math.floor(i / 2), b = Math.floor(j / 2), fa = i / 2 - a, fb = j / 2 - b;
      if (fa < .0425 || fb < .0425) return '#dcd7ce';
      // 紋路（第三輪：交界線在 1 倍下斷成虛線、還有孤立短線）：每塊石板只有一條斜斜、微彎的紋，
      // 用「這一顆在正邊、旁邊一顆（畫面上一顆的距離）在負邊」判斷，線才會一顆接一顆連起來
      const s0 = hash(a * 3 + 1, b * 5 + 2); if (s0 < .4) return '#f1eee8';
      const k = (hash(a + 7, b + 3) - .5) * 1.6, c = .55 + hash(a * 5 + 2, b + 9) * .9;
      const V = (u, w) => (u / 2 - a) * 2 - ((w / 2 - b) * 2 * k + c) - .16 * Math.sin((w / 2 - b) * 4.6 + s0 * 6);
      if (V(i, j) > 0 && (V(i - 1 / 24, j + 1 / 24) <= 0 || V(i + 1 / 24, j - 1 / 24) <= 0 || V(i - 1 / 12, j - 1 / 12) <= 0 || V(i + 1 / 12, j + 1 / 12) <= 0)) return s0 > .8 ? '#cfc8bc' : '#dbd5ca';
      return '#f1eee8'; }
    // 榻榻米（第三輪：2 × 2 一組橫直交錯，會有四疊的角碰在同一點）：改「風車」鋪法，
    // 3 × 3 格一組：四疊繞著中間半疊轉一圈；布邊畫在長邊、短邊一條接縫，半疊只有一邊布邊
    const bi = Math.floor(i / 3), bj = Math.floor(j / 3), u = i - bi * 3, w = j - bj * 3, cu = Math.floor(u), cw = Math.floor(w);
    const M = cu === 1 && cw === 1 ? [1, 1, 2, 2, 2] : cw === 0 && cu < 2 ? [0, 0, 2, 1, 0] : cu === 2 && cw < 2 ? [2, 0, 3, 2, 1] : cw === 2 && cu > 0 ? [1, 2, 3, 3, 0] : [0, 1, 1, 3, 1];
    const [x0, y0, x1, y1, o] = M, lu = u - x0, lw = w - y0, lx = x1 - u, ly = y1 - w;   // o：0 橫放（長邊沿 i）、1 直放、2 半疊
    const across = o === 1 ? Math.min(lu, lx) : Math.min(lw, ly), along = o === 1 ? Math.min(lw, ly) : Math.min(lu, lx);
    if (o === 2 ? lw < .085 : across < .05) return '#6b7a4c';
    if (o === 2 ? (lu < .045 || lx < .045 || ly < .045) : along < .045) return '#9c9a62';
    const fL = o === 1 ? lu : lw;
    return hash(px, py) > .97 ? '#d0cc8e' : Math.floor(fL * 9) % 2 ? '#c4c68c' : '#bcbe84';
  }
  // 壁紙：s 是沿著牆的距離（顆）、z 是高度（顆）
  // 2026-11-27 審稿：薄荷綠綠一點＋小菱形；金點規則錯開；深藍的直紋改成稍亮的細線；和紙乾淨底色＋零星纖維；紅磚小一點、縫暖灰、上亮下暗
  const PAPER = [
    (s, z) => Math.floor(s / 3) % 2 ? '#e5d9bf' : '#efe6d2',
    (s, z) => { const ds = (((s % 8) + 8) % 8) - 4, dz = (((z + (Math.floor(s / 8) % 2) * 4) % 8) + 8) % 8 - 4, d = Math.abs(ds) + Math.abs(dz); return d === 0 ? '#f0f6f2' : d === 1 ? '#e2eee6' : '#cfe3d6'; },
    (s, z) => { const off = Math.floor(z / 6) % 2 ? 3 : 0, u = (s + off) % 6; return z % 6 === 3 && u === 0 ? '#c9a24a' : z % 6 === 3 && u === 1 ? '#e6cc86' : '#f1e9dc'; },
    (s, z) => s % 10 === 0 ? '#3d5078' : '#33456a',
    (s, z) => { const h = hash((s >> 2) * 7 + 1, (z >> 2) * 3 + 2); if (h > .7) { const a = s & 3, b = z & 3; if (hash(s >> 2, z >> 2) > .5 ? a === b : a === 3 - b) return h > .85 ? '#e0d6c4' : '#f8f4ec'; } return '#f1ebdf'; },
    (s, z) => { const row = Math.floor(z / 4), off = row % 2 ? 4 : 0, t = ((z % 4) + 4) % 4, u = (s + off) % 8; if (t === 3 || u === 7) return '#cdbfae';
      const h = hash(Math.floor((s + off) / 8), row), base = h > .66 ? '#b5654a' : h > .33 ? '#a65a40' : '#9c5038'; return t === 2 ? sh(base, .12) : t === 0 ? sh(base, -.1) : base; },
  ];
  // 帳篷的帆布、小木屋的圓木牆（第 0 種壁紙在這兩種家畫成這樣，跟外面一樣）
  const CANVAS = (s, z) => s % 18 === 0 ? '#c9b88f' : hash(s, z) > .97 ? '#dccca8' : '#e6d8b5';
  const LOGS = (s, z) => { const t = ((z % 6) + 6) % 6; return t === 0 ? '#6e4528' : t === 5 ? '#c99a66' : t === 4 ? '#b5875a' : hash(s >> 1, z) > .9 ? '#9a6a40' : '#a8784a'; };
  function paperPx(kind, s, z, lv) { return kind === 0 && lv === 1 ? CANVAS(s, z) : kind === 0 && lv === 2 ? LOGS(s, z) : (PAPER[kind] || PAPER[0])(s, z); }

  // ---------- 圖（藏品；展示櫃、浣熊大王肖像用） ----------
  let COLL = null, loading = null;
  function load(base = 'assets/xiaodao/', ver = '') {
    if (loading) return loading;
    loading = new Promise(ok => { const im = new Image(); im.onload = () => { COLL = im; ok(); }; im.onerror = () => ok(); im.src = base + 'collect.png' + (ver ? '?v=' + ver : ''); });
    return loading;
  }

  // ---------- 一間房間的版面 ----------
  function roomInfo(s, fi, rid) {
    const fl = X.floorsOf(s)[fi]; if (!fl) return null;
    const idx = Math.max(0, fl.rooms.findIndex(r => r.id === rid)), r = fl.rooms[idx];
    const OX = M + (r.h + WT) * TW, OY = M + WH + 4;
    return { r, idx, n: fl.rooms.length, fl, fi, OX, OY, W: Math.ceil(OX + (r.w + WT) * TW + M), H: Math.ceil(OY + (r.w + r.h + WT) * TH + SLAB + M) };
  }

  // ---------- 畫 ----------
  // 多邊形：掃描線，一顆一顆判斷（硬邊）；x 已經 setTransform 成放大 z 倍，所以座標都用一倍的顆
  function poly(x, pts, col) {
    let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
    for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; }
    y0 = Math.floor(y0); y1 = Math.ceil(y1); x0 = Math.floor(x0); x1 = Math.ceil(x1); x.fillStyle = col;
    const n = pts.length;
    for (let y = y0; y <= y1; y++) { const py = y + .5, xs = [];
      for (let i = 0, j = n - 1; i < n; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py)) xs.push((xj - xi) * (py - yi) / (yj - yi) + xi); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) { const a = Math.ceil(xs[k] - .5), b = Math.floor(xs[k + 1] - .5); if (b >= a) x.fillRect(a, y, b - a + 1, 1); } }
  }
  const inPoly = (pts, px, py) => { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) ins = !ins; } return ins; };

  // 一件家具：在自己的座標畫（u 沿寬、v 沿深，v = 0 是背面、v = h 是正面；z 往上，單位是顆），轉到房間的格子
  // rot 0 背貼北牆（正面朝 +y）、1 貼東牆（朝 −x）、2 貼南牆（朝 −y）、3 貼西牆（朝 +x），跟 xiaodao-room.js 的轉法一樣
  function xform(rot, ax, ay, w, h) {
    return [(u, v) => [ax + u, ay + v], (u, v) => [ax + (h - v), ay + u], (u, v) => [ax + (w - u), ay + (h - v)], (u, v) => [ax + v, ay + (w - u)]][rot & 3];
  }
  // 自己座標的哪一面，轉完朝哪：看得到的只有 +x、+y
  const NORMAL = { '+v': ['+y', '-x', '-y', '+x'], '-v': ['-y', '+x', '+y', '-x'], '+u': ['+x', '+y', '-x', '-y'], '-u': ['-x', '-y', '+x', '+y'] };

  function makeView(x, OX, OY) {
    const iso = (i, j, z = 0) => [OX + (i - j) * TW, OY + (i + j) * TH - z];
    return { iso };
  }

  // 燈罩（2026-11-27 家具審稿：原本是一塊平板像路牌）：上窄下寬的梯形，左亮右暗、頂一列亮、下緣一列暗（晚上下緣最亮）；bowl 是碗形（弧形落地燈）
  function shade(x, a, b2, wTop, wBot, h, col, nt, bowl) {
    const body = nt ? sh(col, .3) : col;
    for (let r = 0; r < h; r++) { const f = r / Math.max(1, h - 1), w = Math.round(wTop + (wBot - wTop) * (bowl ? Math.sqrt(f) : f)), x0 = a - Math.floor(w / 2), y = b2 - h + r;
      for (let i = 0; i < w; i++) { const t = w > 1 ? i / (w - 1) : .5;
        x.fillStyle = r === 0 ? sh(body, .3) : r === h - 1 ? (nt ? '#ffe7a8' : sh(col, -.25)) : t < .28 ? sh(body, .2) : t > .74 ? sh(body, -.18) : body; x.fillRect(x0 + i, y, 1, 1); } }
  }
  // 圓花瓶插三朵花（六人長桌，原本是一塊橘色方塊像盒子）
  function vase(x, a, b2) {
    [[2, 0], [3, 1], [3, 2], [3, 3], [2, 4], [1, 5], [1, 6]].forEach(([hw, r]) => { for (let i = -hw; i < hw; i++) { x.fillStyle = i === -hw ? '#fbf9f4' : i === hw - 1 ? '#c4bcae' : '#e9e1cf'; x.fillRect(a + i, b2 - 1 - r, 1, 1); } });
    x.fillStyle = '#5e8a46'; [[-2, 7], [-2, 8], [0, 7], [0, 8], [0, 9], [1, 7], [2, 8]].forEach(([u, r]) => x.fillRect(a + u, b2 - 1 - r, 1, 1));
    x.fillStyle = '#7da35e'; x.fillRect(a - 3, b2 - 9, 1, 1); x.fillRect(a + 2, b2 - 10, 1, 1);
    [[-3, 10, '#b33a2f', '#d9665a'], [-1, 11, '#e8c35a', '#f6e3a0'], [2, 10, '#f3efe6', '#ffffff']].forEach(([u, r, c1, c2]) => { x.fillStyle = c1; x.fillRect(a + u, b2 - 1 - r, 2, 2); x.fillStyle = c2; x.fillRect(a + u, b2 - 1 - r, 1, 1); });
  }

  // 小盆栽的葉子（後 20 件審稿：原本是幾條橫的綠長條）：尖橢圓葉從中心往外長，兩三個綠、一條葉脈
  function leaf(x, ax, ay, ang, len, wid, c1, c2, rib) {
    const ca = Math.cos(ang), sa = Math.sin(ang), R = Math.ceil(len + wid);
    for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) { const s0 = xx * ca + yy * sa, t0 = -xx * sa + yy * ca; if (s0 < 0 || s0 > len) continue; const hw = wid * Math.sin(Math.PI * s0 / len); if (Math.abs(t0) > hw) continue;
      x.fillStyle = Math.abs(t0) < .5 && s0 > 1 && s0 < len - 1 ? rib : t0 < 0 ? c2 : c1; x.fillRect(ax + xx, ay + yy, 1, 1); }
  }
  function sprout(x, a, b2) { [[-2.5, 6, 1.7], [-2.05, 7, 1.8], [-1.6, 8, 1.9], [-1.15, 7, 1.8], [-.7, 6, 1.7], [-1.8, 5, 1.4], [-1.35, 5, 1.4]].forEach(([ang, len, wid], i) => leaf(x, a, b2 - 1, ang, len, wid, i % 2 ? '#5e8a46' : '#6e9a53', '#8ab86a', '#4f7a3e')); }
  // 小橘子樹的樹冠（後 20 件審稿）：三個色階（左上亮、右下暗）、邊緣葉叢凹凸、橘子有亮點
  function crown(x, a, b2) {
    const cy = b2 - 7;
    for (let yy = -8; yy <= 8; yy++) for (let xx = -8; xx <= 8; xx++) { const th = Math.atan2(yy, xx), rr = 6.6 + .9 * Math.sin(th * 6 + .7) + .5 * Math.sin(th * 11), d = Math.hypot(xx, yy); if (d > rr) continue;
      const l = (-xx - yy) / 9 + (hash(xx + 9, yy + 9) - .5) * .35; const hh2 = hash(xx * 3 + 31, yy * 5 + 17); x.fillStyle = d > rr - 1 && xx + yy > 2 ? '#3b5e2e' : l > .45 ? (hh2 > .72 ? '#7fae5e' : '#9cc576') : l > -.05 ? (hh2 > .85 ? '#5e8a46' : '#6e9a53') : '#4f7a3e'; x.fillRect(a + xx, cy + yy, 1, 1); }
    [[-3, -3], [3, -1], [-4, 2], [1, 3], [4, -4], [-1, -5], [5, 2]].forEach(([u, v]) => { x.fillStyle = '#f08a2c'; x.fillRect(a + u, cy + v, 2, 2); x.fillStyle = '#ffc07a'; x.fillRect(a + u, cy + v, 1, 1); x.fillStyle = '#c96a1c'; x.fillRect(a + u + 1, cy + v + 1, 1, 1); });
  }
  // 龜背芋（後 20 件審稿：原本像花椰菜）：五片大心形葉、葉緣斜的裂口、中脈旁邊幾個小洞，葉柄從盆裡長出來
  function monstera(x, a, b2) {
    const L = [[-2.6, 12, 6, 9], [-1.95, 13, 6.4, 16], [-1.2, 13, 6.4, 15], [-.55, 12, 6, 8]];   // 第二輪：葉子細細分岔像棕櫚 → 四片寬的大心形葉、外緣幾道缺口
    L.forEach(([ang, len, wid, rise]) => { const ca = Math.cos(ang), sa = Math.sin(ang), bx = a + Math.round(ca * rise * .55), by = b2 - Math.round(rise);
      for (let t = 0; t <= 1; t += .05) { x.fillStyle = '#4f7a3e'; x.fillRect(Math.round(a + (bx - a) * t), Math.round(b2 - 1 + (by - b2 + 1) * t), 1, 1); }
      const R = Math.ceil(len + wid);
      for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) { const s0 = xx * ca + yy * sa, t0 = -xx * sa + yy * ca, at = Math.abs(t0); if (s0 < 0 || s0 > len) continue;
        const hw = wid * Math.sqrt(Math.max(0, 1 - Math.pow((s0 - len * .5) / (len * .5), 2))); if (at > hw) continue;
        if (s0 < len * .2 && at < (len * .2 - s0) * .9) continue;   // 心形的凹口
        if (at > hw * .5 && at > 2 && [.36, .58, .8].some(f => Math.abs(s0 - (len * f + at * .35)) < .5)) continue;   // 斜的裂口
        if ([[.46, 2.4], [.66, -2.4]].some(([f, tt]) => Math.hypot(s0 - len * f, t0 - tt) < 1.1)) continue;   // 小洞（第二輪：一顆的洞又多，1 倍下碎碎的 → 兩個、大一點）
        x.fillStyle = at < .5 ? '#3f6a33' : t0 < 0 ? '#7aa65a' : '#5e8a46'; x.fillRect(bx + xx, by + yy, 1, 1); } });
  }
  // 掛畫（後 20 件審稿）：一顆一顆照北牆斜著畫（原本浣熊圖是正的貼上去、糊邊）；on(i, z) 是牆上的點
  // 牆每 2 顆降 1 顆：畫的內容以兩欄為一組、同一組一起往下移，五官、框才不會被切成一階一階（第二輪美術指導）
  function paintWall(x, on, a0, a1, z0, z1, fn) {
    const [ox, oy] = on(0, 0), sx0 = Math.floor(ox + a0 * TW), sx1 = Math.ceil(ox + a1 * TW), nW = sx1 - sx0;
    for (let sx = sx0; sx < sx1; sx++) { const gx = sx - sx0, ig = (sx0 + Math.floor(gx / 2) * 2 + .5 - ox) / TW, i = (sx + .5 - ox) / TW;
      for (let sy = Math.floor(oy + ig * TH - z1) - 1; sy <= Math.ceil(oy + ig * TH - z0) + 1; sy++) { const zz = oy + ig * TH - (sy + .5); if (zz < z0 || zz > z1) continue;
        const c = fn(i - a0, zz - z0, gx, nW); if (c) { x.fillStyle = c; x.fillRect(sx, sy, 1, 1); } } }
  }
  // 浣熊大王肖像（藏品圖縮小會糊掉、看不出臉）：手畫一張 9 × 11 的小像素肖像——小皇冠、耳朵、白眉、一條深灰面罩、白吻部、黑鼻子、紅披風
  // 第二輪：一欄是兩顆寬（跟牆的台階對齊），4 欄 × 11 列；鼻子比眼睛大（浣熊專家說過）
  // 第三輪（妹妹：兩顆一欄的版本像條碼）：回到一顆一欄、8 × 11，一定要有尖耳朵、面罩裡兩顆亮的眼睛、明顯的黑鼻子；皇冠小一點
  const RAC = ['........', 'g..yy..g', 'gg.YY.gg', 'gGGGGGGg', 'wwGGGGww', 'dedddded', 'ddGwwGdd', '.gwwwwg.', '..wkkw..', 'r.gkkg.r', 'rrrrrrrr'];   // 最上面空一列，皇冠不要貼著畫框
  const RACC = { g: '#9a9590', G: '#c4bfb8', d: '#55505a', e: '#ffffff', w: '#f3efe6', k: '#3d4246', y: '#f6d77a', Y: '#e8c35a', r: '#b33a2f', R: '#8f2c24' };
  const PIC = { pic1: { a0: .06, a1: -.06, z0: 19, z1: 32 }, pic2: { a0: .03, a1: -.03, z0: 19, z1: 33 } };   // a1 從右邊算（加上 w）
  function picFn(k, wU, hZ) {
    const fz = 1.3, IH = hZ - 2 * fz;
    return (du, dz, gx, nW) => {
      const Lf = gx === 0, Rt = gx === nW - 1, Tp = dz > hZ - fz, Bt = dz < fz;   // 框：左右各一顆、上下約一顆多（第二輪：右框有時取不到樣）
      if (Lf || Rt || Tp || Bt) { if (k === 'pic2' && (Lf || Rt) && (Tp || Bt)) return '#f6e3a0'; return (Lf || Tp) && !(Rt || Bt) ? '#e8c35a' : (Rt || Bt) && !(Lf || Tp) ? '#a77f25' : '#d4a83c'; }
      const IW = nW - 2, px = gx - .5, row = Math.floor(hZ - fz - dz), u = px / IW, v = (hZ - fz - dz) / IH;
      if (k === 'pic1') {
        if (gx === 1 || row === 0) return '#8a9aa6';   // 框的內緣一顆暗（畫凹進去）
        const py = v * IH, sx = IW * .76, sy = IH * .26; if (Math.hypot(px - sx, (py - sy) * 1.6) < IH * .2) return px - sx + py - sy < -1 ? '#fbe3a6' : '#f6cd72';
        const far = .56 - .32 * Math.max(0, 1 - Math.abs(u - .3) / .28) - .2 * Math.max(0, 1 - Math.abs(u - .6) / .2), near = .72 - .06 * Math.sin(u * 7 + 1.2);
        if (v > .88) return '#6e9a53'; if (v > near) return v < near + .08 ? '#97bb72' : '#7da35e';
        if (v > far && v < far + .07 && far < .32) return '#f1f4f6';
        if (v > far) { const pk = Math.abs(u - .3) < .28 ? .3 : .6; return u < pk ? '#a9bccb' : '#8299ac'; }
        return v < .22 ? '#9cc9df' : v < .42 ? '#b3d7e6' : '#cbe5ee';
      }
      // 浣熊大王：一顆一欄、從框裡第一顆開始；畫底提亮到下限以上
      const c2 = gx - 1 - Math.max(0, Math.floor((nW - 10) / 2)), ch = c2 >= 0 && c2 < 8 && row >= 0 ? (RAC[row] || '')[c2] : null; if (ch && ch !== '.') return RACC[ch];
      return row === 0 ? '#4a4466' : '#55486a';
    };
  }
  // 圓地毯（屋內和商店小圖共用；後 20 件審稿：小圖原本只是三顆素色橢圓）
  function discDraw(x, P, p) {
    const pts = [], cx = (p.u0 + p.u1) / 2, cy = (p.v0 + p.v1) / 2, rr = (p.u1 - p.u0) / 2, [ca, cc] = P(cx, cy, .6);
    for (let k2 = 0; k2 < 32; k2++) { const th = k2 / 32 * Math.PI * 2; pts.push(P(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, .6)); }
    const ring = f => pts.map(([a, c]) => [ca + (a - ca) * f, cc + (c - cc) * f]);
    [[1, '#e9dcc3'], [.92, p.col], [.8, sh(p.col, .35)], [.74, p.col], [.55, sh(p.col, -.15)], [.38, sh(p.col, .3)], [.26, p.col]].forEach(([f, col]) => poly(x, ring(f), col));
    return ring(1);
  }

  // 一件家具的「零件」：盒子、貼在某一面的方塊、自己畫的東西、燈
  function build(k, c, night) {
    const f = X.FURN[k], C = colorsOf(k, c), parts = [], lights = [];
    // 木頭色（淺木、胡桃木、原色）的大盒子畫幾條淡木紋（2026-11-27 審稿：全部平塗放在木地板上像塑膠積木）；白、黑是漆的，不畫
    const woody = !!{ 淺木: 1, 胡桃木: 1, 原色: 1 }[C.a];
    const B = (u0, v0, u1, v1, z0, z1, col, o = {}) => { const p = Object.assign({ t: 'box', u0, v0, u1, v1, z0, z1, col }, o); if (p.grain == null) p.grain = woody && col === C.wood; parts.push(p); return p; };
    const D = (box, face, a0, a1, z0, z1, col) => { (box.dec = box.dec || []).push({ face, a0, a1, z0, z1, col }); };   // 貼在 box 的某一面：a 沿那一面的寬（+v、-v 是 u；+u、-u 是 v）
    const T = (box, u0, v0, u1, v1, col) => { (box.top = box.top || []).push({ u0, v0, u1, v1, col }); };                // 貼在 box 的頂面
    const FN = (u, v, z, h, draw) => { parts.push({ t: 'fn', u0: u - .05, v0: v - .05, u1: u + .05, v1: v + .05, z0: z, z1: z + h, u, v, z, draw }); };
    const L = (u, v, z, kind) => lights.push({ u, v, z, kind });
    const legs = (u0, v0, u1, v1, h, col, t = .1) => [[u0, v0], [u1 - t, v0], [u0, v1 - t], [u1 - t, v1 - t]].forEach(([a, b]) => B(a, b, a + t, b + t, 0, h, col));
    // 靠背椅（2026-11-27 審稿：椅背太高又是實心板，把餐桌圍成箱子）：椅背到 18 顆，兩根直柱＋上下兩條橫條，中間空的
    let gid = 0;
    // 盆（後 20 件審稿：原本是一個方塊）：上寬下窄三段、盆緣亮一點、上面露一點土；tub 是木桶（兩條暗的箍）
    const pot = (u, v, r, h, col, tub) => {
      if (tub) {   // 木桶（第二輪：上寬下尖的陀螺形、放在木地板上看不見）：直筒、兩圈灰色鐵箍、比地板深兩階
        const t = B(u - r, v - r, u + r, v + r, 0, h, col); [1, h - 3].forEach(z0 => [['+v', u], ['+u', v]].forEach(([fc, m]) => { D(t, fc, m - r, m + r, z0, z0 + 1, '#8e8a84'); D(t, fc, m - r, m + r, z0 + 1, z0 + 2, '#c3c8c9'); }));   // 鐵箍（第三輪：一格灰一格咖啡像斑點）：整顆高的連續兩條，上面一條亮
        T(t, u - r * .8, v - r * .8, u + r * .8, v + r * .8, '#5e3c22'); return; }
      const lo = B(u - r * .72, v - r * .72, u + r * .72, v + r * .72, 0, Math.round(h * .55), sh(col, -.05)); D(lo, '+v', u - r, u + r, 0, 1, sh(col, -.3));
      B(u - r * .86, v - r * .86, u + r * .86, v + r * .86, Math.round(h * .55), h - 1, col);
      const rim = B(u - r, v - r, u + r, v + r, h - 1, h, sh(col, .2)); T(rim, u - r * .78, v - r * .78, u + r * .78, v + r * .78, '#6e4a30'); };
    // 螢幕（晚上整片發光，畫完家具後再亮一層；後 20 件審稿：原本螢幕中間一顆圓亮點像燈泡）
    const DG = (box, ...a) => { D(box, ...a); box.dec[box.dec.length - 1].glow = true; };
    const chair = (u, v, face, wd, fb) => { const st0 = parts.length;
      legs(u + .1, v + .1, u + .9, v + .9, 8, sh(wd, -.25), .08);
      B(u + .08, v + .08, u + .92, v + .92, 8, 10, wd, { grain: false });
      const ax = face === '+v' || face === '-v', bk = { '+v': v + .08, '-v': v + .78, '+u': u + .08, '-u': u + .78 }[face], lo = ax ? u : v;
      const bar = (i0, i1, z0, z1, d0, d1) => ax ? B(i0, bk + d0, i1, bk + d1, z0, z1, wd, { grain: false }) : B(bk + d0, i0, bk + d1, i1, z0, z1, wd, { grain: false });
      bar(lo + .08, lo + .2, 10, 18, 0, .14); bar(lo + .8, lo + .92, 10, 18, 0, .14); bar(lo + .2, lo + .8, 16, 18, .01, .13); bar(lo + .2, lo + .8, 12.5, 13.5, .02, .12);
      if (fb) B(u + .18, v + .18, u + .82, v + .82, 10, 11.5, fb);
      gid++; parts.slice(st0).forEach(p => { p.grp = gid; });
    };
    // 一排書（2026-11-27 審稿：書高一倍像彩色長條）：顏色降一點飽和、高低不一、偶爾一格空位或一疊橫躺的書
    const book = (box, face, a0, a1, z0, z1, row = 0) => { const cols = ['#a8473c', '#45557a', '#c9a54e', '#7d9a8c', '#e9e1cf', '#6e4a30', '#8c7299']; let a = a0, n = 0;
      while (a < a1 - .05) { const h = hash(n + row * 17, k.length + row * 3), cc = cols[Math.floor(hash(n * 3 + row, (a * 10 | 0) + row) * cols.length)];
        if (h > .9 && a < a1 - .4) { a += .26; n++; continue; }
        if (h > .8 && a < a1 - .45) { for (let s2 = 0; s2 < 3; s2++) D(box, face, a + .02 * s2, a + .32 - .04 * s2, z0 + s2 * 1.1, z0 + s2 * 1.1 + 1, cols[(n + s2 * 2) % cols.length]); a += .38; n++; continue; }
        const w = .08 + hash(n, k.length + row) * .08, bh = z1 - z0 - hash(k.length + row, n) * 2.2; D(box, face, a, Math.min(a1, a + w), z0, z0 + bh, cc); a += w + .02; n++; } };
    const W = f.w, H = f.h;
    switch (k) {
      // ---- 床（2026-11-27 審稿）：床架離地四隻腳、白色床墊側邊看得到、被子兩側和床尾垂下來、靠枕頭那頭摺一截、枕頭鼓一點、床頭板有一塊面板 ----
      case 'bed1': case 'bed2': case 'bed3': {
        const post = k === 'bed3', fc = C.fab, hbz = post ? 22 : 15;
        legs(.08, .08, W - .08, H - .08, 1.5, sh(C.wood, -.22), .14);
        B(.05, .05, W - .05, H - .05, 1.5, 4.5, C.wood);
        B(.12, .3, W - .12, H - .12, 4.5, 10, '#f3efe6');
        B(.08, 1.85, W - .08, H - .07, 7, 10.6, fc);
        B(.08, 1.4, W - .08, 1.85, 7, 11.2, sh(fc, .3));
        const np = k === 'bed1' ? 1 : 2; for (let i = 0; i < np; i++) { const w = (W - .5) / np, a = .3 + i * w; B(a, .42, a + w - .2, 1.15, 10, 12.6, '#f6f3ec'); B(a + .08, .5, a + w - .28, 1.07, 12.6, 13.6, '#fbf9f4'); }
        const hb = B(0, 0, W, .25, 0, hbz, C.wood); D(hb, '+v', .2, W - .2, 11, hbz - 1.5, sh(C.wood, .1)); B(0, 0, W, .3, hbz, hbz + 1.2, sh(C.wood, -.1), { grain: false });
        // 四柱床（審稿：黑色款像鐵籠、只有框沒有布）：柱子粗一點、柱頂圓頭；頂框一圈布幔、四根柱子都綁布簾（金色綁帶）；床尾一條橫毯
        if (post) { const pc = sh(C.wood, -.08), pw = .26, vc = sh(fc, .18);
          [[0, 0], [W - pw, 0], [0, H - pw], [W - pw, H - pw]].forEach(([a, b]) => { B(a, b, a + pw, b + pw, 0, 40, pc, { grain: false }); B(a + .04, b + .04, a + pw - .04, b + pw - .04, 40, 41.3, sh(pc, .12), { grain: false }); B(a + .07, b + .07, a + pw - .07, b + pw - .07, 41.3, 43, '#d4a83c'); });
          [[0, 0, W, .15], [0, H - .15, W, H], [0, 0, .15, H], [W - .15, 0, W, H]].forEach(([a0, b0, a1, b1]) => B(a0, b0, a1, b1, 38, 40, pc, { grain: false }));
          [[pw, .15, W - pw, .3, '+v'], [pw, H - .3, W - pw, H - .15, '+v'], [.15, pw, .3, H - pw, '+u'], [W - .3, pw, W - .15, H - pw, '+u']].forEach(([a0, b0, a1, b1, fc2]) => { const vb = B(a0, b0, a1, b1, 35, 38, vc); const L0 = fc2 === '+v' ? a0 : b0, L1 = fc2 === '+v' ? a1 : b1; for (let t = L0 + .05; t < L1 - .2; t += .4) { if (fc2 === '+v') B(t, b0, t + .22, b1, 34, 35, vc); else B(a0, t, a1, t + .22, 34, 35, vc); } });   // 布幔下緣一排波浪
          // 布簾（第二輪：直直一根像柱子變粗）：上下寬、綁帶處窄的沙漏形，一條直的皺褶
          [[pw, .3], [W - pw - .3, .3], [pw, H - .5], [W - pw - .3, H - .5]].forEach(([a, b]) => { const m = a + .15;
            [[34.5, 30, .15], [30, 25.5, .11], [25.5, 23, .07], [21.5, 18, .08], [18, 14, .12], [14, 10.8, .16]].forEach(([z1, z0, hw]) => { const cb = B(m - hw, b + .2 - hw, m + hw, b + .2 + hw, z0, z1, vc); D(cb, '+v', m - .01, m + .02, z0, z1, sh(vc, -.18)); });
            B(m - .08, b + .12, m + .08, b + .28, 21.5, 23, '#d4a83c'); });
          B(.06, H - 1.05, W - .06, H - .55, 7, 11, sh(fc, -.28)); }
        break;
      }
      // ---- 燈 ----
      case 'lamp1': {   // 床頭櫃＋小檯燈（貼牆）；審稿：抽屜面板＋縫＋圓把手、下面一格開放層板、梯形燈罩
        legs(.12, .08, .88, .82, 1, sh(C.wood, -.25), .1);
        const b = B(.1, .05, .9, .85, 1, 10, C.wood);
        D(b, '+v', .16, .84, 6, 9.2, sh(C.wood, .08)); D(b, '+v', .16, .84, 5, 6, sh(C.wood, -.28)); D(b, '+v', .45, .55, 7.2, 8.2, '#d4a83c');
        D(b, '+v', .16, .84, 1.8, 5, sh(C.wood, -.32)); D(b, '+v', .22, .5, 1.8, 3.6, '#7d9a8c');
        B(.35, .25, .65, .55, 10, 11, '#8e8070'); B(.47, .37, .53, .43, 11, 15, '#5e5a55');
        FN(.5, .4, 15, 6, (x, a, b2, nt) => shade(x, a, b2, 4, 7, 5, '#efe2c4', nt));
        L(.5, .4, 15.5, 'warm'); break;
      }
      case 'lamp2': {   // 立燈（審稿：燈罩是平板像路牌、高到快碰天花板像路燈）：約 160 公分，梯形燈罩
        B(.28, .28, .72, .72, 0, 1.5, '#4a4f53'); B(.46, .46, .54, .54, 1.5, 24, '#5a5f63');
        FN(.5, .5, 24, 9, (x, a, b2, nt) => shade(x, a, b2, 7, 11, 8, C.main, nt));
        L(.5, .5, 24.5, 'warm'); break;
      }
      case 'lamp3': {   // 弧形落地燈（審稿：像釣竿、燈罩像吐司）：桿子和弧 2 顆粗、碗形燈罩直接掛在弧的尾巴
        B(.15, .15, .75, .75, 0, 2, '#4a4f53');
        FN(.45, .45, 2, 36, (x, a, b2, nt, P) => { const top = P(.45, .45, 36), end = P(1.65, .55, 31.5), t0 = Math.round(top[1]);
          x.fillStyle = '#6e7377'; x.fillRect(a - 1, t0, 1, b2 - t0); x.fillStyle = '#4a4f53'; x.fillRect(a, t0, 1, b2 - t0);
          for (let t = 0; t <= 1; t += .02) { const px = Math.round(top[0] + (end[0] - top[0]) * t), py = Math.round(top[1] + (end[1] - top[1]) * t - Math.sin(t * Math.PI) * 6); x.fillStyle = '#6e7377'; x.fillRect(px, py, 1, 1); x.fillStyle = '#4a4f53'; x.fillRect(px, py + 1, 1, 1); } });
        FN(1.65, .55, 24.5, 8, (x, a, b2, nt) => shade(x, a, b2, 5, 14, 7, C.main, nt, true));
        L(1.65, .55, 25, 'warm'); break;
      }
      // ---- 櫃子 ----
      case 'store1': case 'store2': {   // 衣櫃（審稿：門縫明顯、門板有框線、四隻短腳；三門的中間是鏡子）
        const n = k === 'store1' ? 2 : 3, dw = (W - .2) / n; legs(.1, .1, W - .1, H - .15, 1.5, sh(C.wood, -.3), .12);
        const b = B(.05, .05, W - .05, H - .1, 1.5, 36, C.wood);
        B(.02, .02, W - .02, H - .06, 36, 38, sh(C.wood, -.08), { grain: false });
        for (let i = 0; i < n; i++) { const a0 = .1 + i * dw, a1 = a0 + dw - .05, mir = k === 'store2' && i === 1;
          D(b, '+v', a0, a1, 3, 34.5, sh(C.wood, .06));
          if (i) D(b, '+v', a0 - .05, a0, 3, 34.5, sh(C.wood, -.38));
          if (mir) { D(b, '+v', a0 + .1, a1 - .1, 6, 31.5, '#cfe3ea'); D(b, '+v', a0 + .1, a1 - .1, 6, 7, '#a9c3cc');
            for (let t = 0; t < 7; t++) { D(b, '+v', a0 + .18 + t * .05, a0 + .26 + t * .05, 14 + t * 1.8, 15.8 + t * 1.8, '#f4fbfd'); if (t < 5) D(b, '+v', a0 + .42 + t * .05, a0 + .46 + t * .05, 11 + t * 1.8, 12.8 + t * 1.8, '#e6f3f7'); } }
          else { D(b, '+v', a0 + .1, a1 - .1, 6, 31.5, sh(C.wood, .12)); D(b, '+v', a0 + .1, a1 - .1, 6, 7, sh(C.wood, -.12)); D(b, '+v', a0 + .1, a1 - .1, 30.5, 31.5, sh(C.wood, .22)); }
          const hx = i < n / 2 - .01 ? a1 - .14 : a0 + .08; D(b, '+v', hx, hx + .05, 16, 21, '#d4a83c'); }
        break;
      }
      case 'store3': case 'store4': {   // 書櫃（審稿：背板不要接近黑；書矮一點、高低不一、幾格空位和橫躺的一疊；書牆 6 層）
        const tall = k === 'store4', hh = tall ? 40 : 16, rows = tall ? 6 : 2, b = B(.05, .05, W - .05, H - .1, 0, hh, C.wood);
        D(b, '+v', .1, W - .1, 1.5, hh - 1.5, C.a === '黑' ? '#30353a' : C.a === '白' ? '#c4bcae' : sh(C.wood, -.3));
        for (let r2 = 0; r2 < rows; r2++) { const z0 = 1.5 + r2 * (hh - 3) / rows, z1 = z0 + (hh - 3) / rows - 1; book(b, '+v', .15, W - .15, z0, z1, r2); D(b, '+v', .1, W - .1, z1, z1 + 1, sh(C.wood, .05)); }
        if (!tall) { B(.25, .25, .55, .55, 16, 21, '#e9e1cf'); B(W - .7, .3, W - .3, .7, 16, 18, '#7d9a8c'); }
        break;
      }
      case 'store5': case 'store6': {   // 展示櫃：框、層板、玻璃；藏品在 render 裡擺。審稿：金框改深一點的金、背板和底是深色絨布、頂上一塊小山牆；空的就空
        const gold = k === 'store6', fr = gold ? '#b8892e' : C.wood, hh = gold ? 30 : 17, rows = gold ? 2 : 1;
        const base = B(.05, .05, W - .05, H - .1, 0, 2, fr, { grain: false }); B(.05, .05, W - .05, H - .1, hh - 2, hh, fr, { grain: false });
        [[.05, .05], [W - .17, .05], [.05, H - .22], [W - .17, H - .22]].forEach(([a, b]) => B(a, b, a + .12, b + .12, 2, hh - 2, gold ? '#c9982f' : sh(fr, -.1), { grain: false }));
        B(.05, .05, W - .05, .12, 2, hh - 2, gold ? '#3a2f4a' : sh(fr, -.25), { grain: false });
        T(base, .17, .17, W - .17, H - .22, gold ? '#4a3d5e' : sh(fr, -.12));
        if (rows === 2) B(.12, .12, W - .12, H - .17, 14.5, 15.3, '#dfeef2', { glass: true });   // 中間層板是玻璃（原本一大片白板）
        if (gold) { B(W / 2 - .45, .06, W / 2 + .45, .22, hh, hh + 2.2, fr); B(W / 2 - .2, .08, W / 2 + .2, .2, hh + 2.2, hh + 3.4, '#e8c35a'); }
        parts.push({ t: 'case', u0: .1, v0: .1, u1: W - .1, v1: H - .15, z0: 2, z1: hh - 2, rows, hh, gold });
        break;
      }
      // ---- 桌子、椅子 ----
      case 'table1': case 'table2': {   // 書桌／電腦桌（正面朝 +v）；審稿：右邊的抽屜盒浮在半空 → 落地的三層抽屜櫃
        const lc = sh(C.wood, -.2); [[.1, .1], [.1, H - .22]].forEach(([a, b]) => B(a, b, a + .12, b + .12, 0, 12, lc, { grain: false }));
        B(.05, .05, W - .05, H - .05, 12, 14, C.wood);
        const dr = B(W - 1.1, .12, W - .12, H - .12, 0, 12, C.wood, { grain: false });
        // 抽屜（第二輪：半顆的縫斷成一排點像音響網孔）：縫一顆高、每個抽屜中間一個 2 顆寬的把手
        [[1, 4], [5, 8], [9, 11.5]].forEach(([z0, z1]) => { D(dr, '+v', W - 1.03, W - .19, z0, z1, sh(C.wood, .08)); D(dr, '+v', W - 1.03, W - .19, z1, z1 + 1, sh(C.wood, -.3)); D(dr, '+v', W - .7, W - .52, (z0 + z1) / 2 - .5, (z0 + z1) / 2 + .5, '#d4a83c'); });
        if (k === 'table1') { B(.4, .2, .7, .5, 14, 15, '#5e5a55'); B(.52, .32, .58, .38, 15, 20, '#5e5a55');
          FN(.55, .35, 20, 5, (x, a, b2, nt) => shade(x, a, b2, 3, 6, 4, '#e8c35a', nt)); L(.55, .35, 20.5, 'warm');
          const nb = B(1.05, .3, 1.95, .8, 14, 14.6, '#f3efe6'); T(nb, 1.48, .3, 1.52, .8, '#c4bcae'); [.42, .54, .66].forEach(v => { T(nb, 1.13, v, 1.4, v + .03, '#cfc8bb'); T(nb, 1.58, v, 1.85, v + .03, '#cfc8bb'); });
          B(1.3, .64, 1.78, .7, 14.6, 15.2, '#c9a54e'); }
        else {   // 電腦桌：兩台螢幕（原本螢幕的畫面貼錯位置，看起來像兩台；審稿妹妹喜歡，就真的畫兩台）、支架和底座、鍵盤一顆顆鍵、滑鼠
          [[.45, 1.4], [1.6, 2.55]].forEach(([a0, a1]) => { const m = (a0 + a1) / 2, mon = B(a0, .15, a1, .3, 17, 25.5, '#3d4246');
            DG(mon, '+v', a0 + .06, a1 - .06, 18, 24.7, nt(night, '#8fb0e0', '#3b4a5e')); if (!night) D(mon, '+v', a0 + .12, a0 + .38, 22, 24.4, '#55677e');
            B(m - .2, .17, m + .2, .42, 14, 14.6, '#4a4f53'); B(m - .05, .2, m + .05, .28, 14.6, 17, '#4a4f53'); L(m, .4, 21, 'screen'); });
          const kb = B(1, .5, 2, .8, 14, 14.8, '#e9e3d6'); for (let i = 0; i < 9; i++) for (let j = 0; j < 3; j++) T(kb, 1.05 + i * .105, .54 + j * .085, 1.12 + i * .105, .59 + j * .085, '#c4bcae');
          B(2.2, .56, 2.34, .74, 14, 14.9, '#e9e3d6'); }
        break;
      }
      case 'table3': {   // 木椅凳（審稿：像小茶几、太高）：坐面 8 顆、十字橫撐、一塊坐墊
        const lc = sh(C.wood, -.2); legs(.15, .15, .85, .85, 6.5, lc, .1); B(.2, .45, .8, .55, 2.5, 3.2, lc, { grain: false }); B(.45, .2, .55, .8, 2.5, 3.2, lc, { grain: false });
        B(.1, .1, .9, .9, 6.5, 8, C.wood, { grain: false });
        { const cc = { 淺木: '#7d9a8c', 胡桃木: '#c9a54e', 黑: '#a8473c' }[C.a] || '#7d9a8c'; B(.22, .16, .78, .84, 8, 9.4, cc); B(.16, .22, .84, .78, 8, 9.4, cc); } break; }   // 坐墊（第二輪：白色方塊像豆腐）：有顏色、四個角切掉
      case 'table4': { chair(0, 0, '+v', C.wood, C.fab); break; }
      case 'table5': case 'table6': {   // 茶几（審稿：比沙發坐面低一點）
        const glass = k === 'table6', lc = sh(C.wood, -.18);
        if (glass) {   // 玻璃茶几（審稿：像雙人床、黑色款像黑地毯）：玻璃四邊亮邊＋斜反光、下層板縮進去讓地板露出來、細腳；桌上一本書、一小盆花
          legs(.1, .1, W - .1, H - .1, 6.6, lc, .09);
          B(.35, .35, W - .35, H - .35, 1.6, 2.4, C.wood);
          const g = B(.05, .05, W - .05, H - .05, 6.6, 7.4, '#cfe6ea', { glass: true });
          for (let i = 0; i < 6; i++) T(g, .3 + i * .09, .18 + i * .07, .42 + i * .09, .25 + i * .07, '#f4fbfd');
          // 兩本疊著的書：側面是米白的書頁、頂面是封面
          const bk = B(.5, .45, 1.2, .95, 7.4, 8.6, '#f3efe6'); T(bk, .5, .45, 1.2, .95, '#45557a'); const bk2 = B(.6, .5, 1.1, .88, 8.6, 9.6, '#efe9dc'); T(bk2, .6, .5, 1.1, .88, '#a8473c');
          B(W - .95, .65, W - .65, .95, 7.4, 8.8, '#c96f4a');
          FN(W - .8, .8, 8.8, 4, (x, a, b2) => { x.fillStyle = '#6e9a53'; x.fillRect(a - 2, b2 - 3, 4, 3); x.fillStyle = '#4f7a3e'; x.fillRect(a, b2 - 1, 2, 1); x.fillStyle = '#e8c35a'; x.fillRect(a - 1, b2 - 3, 1, 1); x.fillStyle = '#b33a2f'; x.fillRect(a + 1, b2 - 4, 1, 1); }); }
        else {   // 木茶几（審稿：紅方塊像坐墊）：一個托盤、茶壺、兩個杯子
          legs(.1, .1, W - .1, H - .1, 6.2, lc, .1); B(.05, .05, W - .05, H - .05, 6.2, 7.5, C.wood);
          B(.3, .22, 1.5, .8, 7.5, 7.9, '#a8473c');
          B(.45, .35, .78, .65, 7.9, 10.4, '#f3efe6'); B(.53, .43, .7, .57, 10.4, 11.2, '#e9e1cf'); B(.78, .46, .9, .53, 8.6, 9.8, '#f3efe6');
          B(1.02, .38, 1.16, .52, 7.9, 9, '#f3efe6'); B(1.22, .52, 1.36, .66, 7.9, 9, '#f3efe6'); }
        break;
      }
      case 'table7': {   // 四人方桌：桌子在中間，四邊各一張椅子（審稿：椅子比桌子暗一階）
        const cw = sh(C.wood, C.a === '淺木' ? -.2 : -.12); legs(.8, .8, 3.2, 3.2, 12, sh(C.wood, -.2), .14); B(.75, .75, 3.25, 3.25, 12, 14, C.wood);
        chair(1.5, 0, '+v', cw); chair(1.5, 3, '-v', cw); chair(0, 1.5, '+u', cw); chair(3, 1.5, '-u', cw);
        B(1.7, 1.7, 2.3, 2.3, 14, 14.8, '#f3efe6'); break;
      }
      case 'table8': {   // 六人長桌（審稿：椅子暗一階；中間的橘方塊像盒子 → 桌巾＋圓花瓶插花）
        const cw = sh(C.wood, C.a === '淺木' ? -.2 : -.12); legs(.6, .8, 5.4, 3.2, 12, sh(C.wood, -.2), .14); B(.55, .75, 5.45, 3.25, 12, 14, C.wood);
        [1, 2.5, 4].forEach(u => { chair(u, 0, '+v', cw); chair(u, 3, '-v', cw); });
        B(2.4, 1.82, 3.6, 2.18, 14, 14.4, '#efe6d2'); FN(3, 2, 14.4, 13, (x, a, b2) => vase(x, a, b2));
        break;
      }
      // ---- 沙發（背貼 v = 0，朝 +v）。2026-11-27 家具審稿（後 20 件）：坐面到 7.5（原本比茶几低）、椅背比扶手高、坐墊鼓一點縫看得出來、
      //      木頭小腳、底下一條暗邊、扶手上緣圓一點、抱枕換顏色；皮沙發左上一顆亮線（原本的白點像水滴）----
      case 'sofa1': case 'sofa2': case 'sofa3': case 'sofa4': case 'sofa5': {
        // 第二輪（美術指導）：不到一顆高的薄盒子、半顆開始的面在斜線上變成一排小牙 → 高度都用整顆（坐面 8、扶手 11、圓頂 1 顆）；
        // 抱枕放在靠背墊前面（原本在沒轉向的那張被靠背墊蓋掉）
        const fab = C.main, leather = k === 'sofa4', wing = k === 'sofa2', one = k === 'sofa1';
        const arm = one ? .15 : wing ? .2 : .32, back = one ? .3 : .42, deep = one ? H : 2, seat = 8, armz = 11, hi = wing ? 21 : 17;
        legs(.1, .1, W - .1, deep - .1, 2, '#5e3c22', .1);
        const base = B(.05, .05, W - .05, deep - .05, 2, 5, sh(fab, -.08)); D(base, '+v', .05, W - .05, 2, 3, sh(fab, -.3)); D(base, '+u', .05, deep - .05, 2, 3, sh(fab, -.3));
        const bk = B(.05, .05, W - .05, back, 2, hi, fab);
        if (wing) { for (let r2 = 0; r2 < 2; r2++) for (let c2 = 0; c2 < 3; c2++) D(bk, '+v', .55 + c2 * .3, .65 + c2 * .3, 13 + r2 * 3, 14 + r2 * 3, sh(fab, -.28)); }   // 拉扣
        [[.05, .05 + arm], [W - .05 - arm, W - .05]].forEach(([u0, u1]) => { B(u0, .05, u1, deep - .05, 2, armz, fab); B(u0 + .02, back, u1 - .02, deep - .07, armz, armz + 1, sh(fab, .1));
          if (wing) { B(u0, .05, u1, 1.15, armz + 1, armz + 5, fab); B(u0, .05, u1, .8, armz + 5, hi - 1, fab); B(u0 + .02, .05, u1 - .02, .6, hi - 1, hi, sh(fab, .08)); } });   // 高背椅的翼板：從扶手一路連到椅背頂，上窄下寬
        const n = { sofa1: 1, sofa2: 1, sofa3: 2, sofa4: 3, sofa5: 3 }[k], sw = (W - arm * 2 - .1) / n;
        for (let i = 0; i < n; i++) { const u0 = .05 + arm + i * sw + .045, u1 = u0 + sw - .09;   // 坐墊之間的縫超過一顆寬（第三輪：一格亮一格暗像拉鍊）
          B(u0, back, u1, deep - .08, 5, seat - 1, sh(fab, .05)); const pf = B(u0 + .06, back + .05, u1 - .06, deep - .14, seat - 1, seat, sh(fab, .1));
          if (leather) T(pf, u0 + .08, back + .08, u0 + .2, deep - .2, sh(fab, .32));
          if (!one && !wing) { const bc = B(u0 + .04, back, u1 - .04, back + .24, seat, hi - 1, sh(fab, .06)); if (leather) D(bc, '+v', u0 + .06, u0 + .18, seat + 1, hi - 2, sh(fab, .3)); } }
        if (k === 'sofa5') {   // 貴妃位（右邊往前伸）
          legs(W - 1.65, deep, W - .1, H - .1, 2, '#5e3c22', .1);
          B(W - 1.7, deep - .1, W - .05, H - .05, 2, 5, sh(fab, -.08)); B(W - 1.68, deep - .08, W - .07 - arm, H - .08, 5, seat - 1, sh(fab, .05)); B(W - 1.62, deep, W - .13 - arm, H - .14, seat - 1, seat, sh(fab, .1));
          B(W - .05 - arm, deep - .1, W - .05, H - .05, 2, armz, fab); B(W - .03 - arm, deep - .1, W - .07, H - .07, armz, armz + 1, sh(fab, .1)); }
        // 抱枕（顏色照沙發換，不要五款都同一顆黃的）；有靠背墊的放在靠背墊前面
        const pil = { sofa3: ['#e8c35a'], sofa4: ['#d9cdb3'], sofa5: ['#c96f4a', '#7d9a8c'], sofa2: [{ 朱: '#e9dcc3', 深藍: '#c9a54e', 皮革咖啡: '#7d9a8c' }[C.a] || '#e9dcc3'] }[k] || [], pv = wing ? back + .02 : back + .28;
        pil.forEach((pc, i) => { const u0 = i ? W - arm - .85 : arm + .15; B(u0, pv, u0 + .55, pv + .28, seat, seat + (wing ? 4 : 5), pc); });
        break;
      }
      // ---- 電視櫃（後 20 件審稿）：薄型寬螢幕、小腳座、降低；大電視的落地喇叭放在兩端地上（一大一小兩個單體）；黑統一用 #3d4246 那組；螢幕晚上整片發光 ----
      case 'tv1': case 'tv2': {
        const big = k === 'tv2', cab = C.wood, c0 = big ? .6 : .05, c1 = big ? W - .6 : W - .05, b = B(c0, .05, c1, H - .1, 0, big ? 8 : 9, cab);
        const nd = big ? 3 : 3, cw2 = (c1 - c0) / nd; for (let i = 1; i < nd; i++) D(b, '+v', c0 + i * cw2 - .02, c0 + i * cw2 + .02, 1, big ? 7 : 8, sh(cab, -.4));
        for (let i = 0; i < nd; i++) D(b, '+v', c0 + (i + .5) * cw2 - .05, c0 + (i + .5) * cw2 + .05, 4.5, 5.5, '#d4a83c');
        D(b, '+v', c0, c1, 0, 1, sh(cab, -.3));   // 底邊暗一階（第二輪：淺木櫃放在淺木地板上分不出邊）
        const tw = big ? 3 : 2.1, t0 = (W - tw) / 2, bz = big ? 8 : 9, tz0 = bz + 2, tz1 = big ? 27 : 20.5;
        B(W / 2 - .32, .22, W / 2 + .32, .48, bz, bz + .6, '#4a4f53'); B(W / 2 - .05, .3, W / 2 + .05, .36, bz + .6, tz0, '#4a4f53');
        const tv = B(t0, .28, t0 + tw, .4, tz0, tz1, '#3d4246'); DG(tv, '+v', t0 + .07, t0 + tw - .07, tz0 + .8, tz1 - .8, nt(night, '#8fb0e0', '#3b4a5e'));
        DG(tv, '+v', t0 + tw * .55, t0 + tw - .07, tz0 + .8, (tz0 + tz1) / 2, nt(night, '#7f9fd0', '#344153'));   // 右下暗一階
        if (!night) D(tv, '+v', t0 + .14, t0 + .55, tz1 - 4, tz1 - 1.2, '#55677e');
        L(W / 2, .6, (tz0 + tz1) / 2, 'screen');
        if (big) [.08, W - .52].forEach(a => { const sp = B(a, .1, a + .44, .5, 0, 19, '#3d4246'); D(sp, '+v', a + .08, a + .36, 3.5, 9.5, '#6a7075'); D(sp, '+v', a + .14, a + .3, 5, 8, '#4f555a'); D(sp, '+v', a + .15, a + .29, 12.5, 15, '#6a7075'); D(sp, '+v', a + .19, a + .25, 13.3, 14.2, '#8e8a84'); });
        else { const sp = B(.25, .25, .55, .5, 9, 13.5, '#4a4f53'); D(sp, '+v', .3, .5, 9.8, 11.8, '#6a7075'); D(sp, '+v', .37, .43, 12.3, 13, '#8e8a84'); }
        break;
      }
      // ---- 地毯（平的）。後 20 件審稿：中間一排白短線像停車場、跑道 → 內框、菱形紋、短邊流蘇 ----
      case 'rug1': case 'rug3': {
        const r = B(0, 0, W, H, 0, .6, '#e9dcc3', { flat: true }), lng = k === 'rug1', m = C.main, lt = sh(m, .38);
        T(r, .18, .18, W - .18, H - .18, m); T(r, .4, .4, W - .4, H - .4, lt); T(r, .48, .48, W - .48, H - .48, m);
        // 花紋（第二輪：一階一階拼的菱形畫面上像長方形、邊有小牙）：跟地毯邊平行的正方形，畫面上就是 2:1 的菱形
        const dia = (cu, cv, ru) => { T(r, cu - ru, cv - ru, cu + ru, cv + ru, lt); T(r, cu - ru * .7, cv - ru * .7, cu + ru * .7, cv + ru * .7, sh(m, -.15)); T(r, cu - ru * .35, cv - ru * .35, cu + ru * .35, cv + ru * .35, lt); };
        if (lng) { dia(W / 2, H / 2, .85); [[.75, .75], [W - .75, .75], [.75, H - .75], [W - .75, H - .75]].forEach(([cu, cv]) => T(r, cu - .12, cv - .12, cu + .12, cv + .12, lt)); }
        else [H * .22, H / 2, H * .78].forEach(cv => dia(W / 2, cv, .42));
        // 流蘇：短邊（rug1 是左右兩邊、rug3 是前後兩邊）
        if (lng) for (let t = .15; t < H - .1; t += .22) { T(r, 0, t, .14, t + .08, '#f6f1e6'); T(r, W - .14, t, W, t + .08, '#f6f1e6'); }
        else for (let t = .15; t < W - .1; t += .22) { T(r, t, 0, t + .08, .14, '#f6f1e6'); T(r, t, H - .14, t + .08, H, '#f6f1e6'); }
        break;
      }
      case 'rug2': parts.push({ t: 'disc', u0: 0, v0: 0, u1: W, v1: H, z0: 0, z1: .6, col: C.main }); break;
      // ---- 植物（後 20 件審稿）：盆上寬下窄、有盆緣、露一點土；小盆栽尖葉從中心長出來；橘子樹三個色階、葉叢凹凸；龜背芋大心形葉、裂口和洞 ----
      case 'plant1': pot(.5, .5, .2, 5, '#c96f4a'); FN(.5, .5, 5, 11, (x, a, b2) => sprout(x, a, b2)); break;
      case 'plant2': pot(.5, .5, .22, 6, '#7c5230', true); B(.46, .46, .54, .54, 6, 14, '#6e4528'); FN(.5, .5, 14, 15, (x, a, b2) => crown(x, a, b2)); break;
      case 'plant3': pot(1, 1, .42, 7, '#efe9dc'); FN(1, 1, 7, 26, (x, a, b2) => monstera(x, a, b2)); break;
      // ---- 廚房（貼牆，正面朝 +v）。後 20 件審稿：檯面約 90 公分、檯面板薄一點（三件等高）；水槽挖一個槽、彎的水龍頭、洗碗精；
      //      瓦斯爐烤箱門把、玻璃、旋鈕、爐架、小鍋子；流理台砧板和調味罐 ----
      case 'kitchen1': case 'kitchen2': case 'kitchen3': {
        const b = B(.05, .05, W - .05, H - .1, 0, 14, '#ece7dc'), top = B(0, 0, W, H - .05, 14, 15, '#9a948a');
        D(b, '+v', .05, W - .05, 0, 1.2, '#4a4f53');
        if (k !== 'kitchen3') for (let i = 0; i < W; i++) { D(b, '+v', i + .1, i + .9, 2, 12.6, '#f6f3ec'); D(b, '+v', i + .1, i + .9, 2, 3, '#ddd6ca'); D(b, '+v', i + .74, i + .8, 8.5, 11.5, '#8e8070'); if (i) D(b, '+v', i - .03, i + .03, 1.2, 14, '#cfc8bb'); }
        if (k === 'kitchen1') { const cb = B(.3, .22, 1.15, .7, 15, 15.6, '#d4a373'); T(cb, .3, .22, 1.15, .28, '#e6b98a'); B(.5, .38, .95, .44, 15.6, 15.9, '#c3c8c9');
          [[2.1, '#efe6d2', '#a8473c'], [2.32, '#efe6d2', '#c9a54e'], [2.54, '#7d5a3a', '#e9e3d6']].forEach(([u, c1, c2]) => { B(u, .18, u + .16, .34, 15, 17.6, c1); B(u + .02, .2, u + .14, .32, 17.6, 18.4, c2); }); }
        if (k === 'kitchen2') { T(top, .16, .18, .84, .72, '#a9a49b'); T(top, .16, .18, .84, .32, '#7d7870'); T(top, .16, .18, .3, .72, '#8e8a84'); T(top, .3, .6, .84, .72, '#d6d2ca'); T(top, .52, .4, .64, .5, '#4a4f53');   // 槽（第二輪：一片灰色雜點）：後緣、左緣內側暗，前緣內側亮，排水孔
          B(.46, .05, .54, .13, 15, 21.5, '#c3c8c9'); B(.46, .05, .54, .4, 20.7, 21.5, '#c3c8c9'); B(.46, .32, .54, .4, 19, 20.7, '#c3c8c9');
          B(.74, .12, .86, .24, 15, 18.2, '#7d9a8c'); B(.77, .15, .83, .21, 18.2, 19.2, '#e9e3d6'); }
        if (k === 'kitchen3') { T(top, .08, .1, .92, .82, '#4a4f53'); [[.3, .3], [.7, .3], [.3, .64], [.7, .64]].forEach(([u, v]) => { T(top, u - .13, v - .1, u + .13, v + .1, '#6a7075'); T(top, u - .07, v - .05, u + .07, v + .05, '#3d4246'); T(top, u - .13, v - .01, u + .13, v + .01, '#30353a'); T(top, u - .01, v - .1, u + .01, v + .1, '#30353a'); });
          B(.56, .52, .84, .76, 15, 18, '#b9b4ab'); B(.58, .54, .82, .74, 18, 19, '#d6d2ca'); B(.66, .6, .74, .68, 19, 20, '#4a4f53'); B(.84, .6, .96, .68, 17, 18, '#4a4f53');   // 小鍋子：鍋身、亮的鍋蓋、蓋子小把手、鍋柄
          D(b, '+v', .1, .9, 12, 13.6, '#ddd6ca'); [.2, .4, .6, .8].forEach(u => D(b, '+v', u - .05, u + .05, 12.3, 13.4, '#3d4246'));
          const od = D(b, '+v', .12, .88, 2.5, 11, '#3d4246'); D(b, '+v', .22, .78, 4, 8.6, '#4f555a'); D(b, '+v', .26, .4, 6.5, 8.2, '#6a7075'); D(b, '+v', .2, .8, 9.4, 10.3, '#c3c8c9'); }
        break;
      }
      case 'kitchen4': case 'kitchen5': {   // 冰箱（後 20 件審稿）：單門一扇門、約 1.5 公尺；雙門約 1.8 公尺；長把手亮一階＋亮點；黑統一用 #3d4246 那組
        const two = k === 'kitchen5', col = C.a === '白' ? '#eceae4' : C.a === '黑' ? '#3d4246' : C.wood, hh = two ? 30 : 26, b = B(.05, .05, W - .05, H - .1, 0, hh, col);
        const hc = C.a === '黑' ? '#6a7075' : C.a === '白' ? '#8e8a84' : '#8e8070', hl = C.a === '黑' ? '#8e9396' : '#d6d2ca';
        D(b, '+v', .05, W - .05, 0, 1.2, sh(col, -.25));
        if (two) { D(b, '+v', W / 2 - .045, W / 2 + .045, 1.2, hh - .5, sh(col, -.3)); [[W / 2 - .24, W / 2 - .12], [W / 2 + .12, W / 2 + .24]].forEach(([a0, a1]) => { D(b, '+v', a0, a1, hh * .35, hh * .75, hc); D(b, '+v', a0, a0 + .05, hh * .45, hh * .7, hl); }); }   // 第二輪：門縫、把手不到一顆寬會不見
        else { D(b, '+v', .08, W - .08, 1.6, hh - .6, sh(col, .04)); D(b, '+v', W - .28, W - .16, hh * .35, hh * .75, hc); D(b, '+v', W - .28, W - .23, hh * .45, hh * .7, hl); }
        break;
      }
    }
    return { parts, lights, C };
  }
  const nt = (night, a, b) => night ? a : b;

  // 盒子在房間格子裡的範圍、看得到的面
  function worldBox(p, tf) {
    const pts = [tf(p.u0, p.v0), tf(p.u1, p.v0), tf(p.u0, p.v1), tf(p.u1, p.v1)];
    return { x0: Math.min(...pts.map(q => q[0])), x1: Math.max(...pts.map(q => q[0])), y0: Math.min(...pts.map(q => q[1])), y1: Math.max(...pts.map(q => q[1])), z0: p.z0, z1: p.z1 };
  }
  // 誰在後面：x 或 y 完全在前面那個的後面，或疊在一起時看高度、再看中心
  function behind(a, b) {
    if (a.x1 <= b.x0 + 1e-6) return true; if (b.x1 <= a.x0 + 1e-6) return false;
    if (a.y1 <= b.y0 + 1e-6) return true; if (b.y1 <= a.y0 + 1e-6) return false;
    if (a.z1 <= b.z0 + 1e-6) return true; if (b.z1 <= a.z0 + 1e-6) return false;
    return (a.x0 + a.x1 + a.y0 + a.y1) < (b.x0 + b.x1 + b.y0 + b.y1);
  }
  function depthSort(list) {   // 拓撲排序（n 小，兩兩比）
    const n = list.length, out = [], done = new Array(n).fill(false);
    for (let step = 0; step < n; step++) {
      let pick = -1;
      for (let i = 0; i < n && pick < 0; i++) { if (done[i]) continue; let ok = true; for (let j = 0; j < n; j++) if (j !== i && !done[j] && behind(list[j].wb, list[i].wb) && !behind(list[i].wb, list[j].wb)) { ok = false; break; } if (ok) pick = i; }
      if (pick < 0) { let best = -1, bv = Infinity; for (let i = 0; i < n; i++) if (!done[i]) { const v = list[i].wb.x0 + list[i].wb.y0; if (v < bv) { bv = v; best = i; } } pick = best; }
      done[pick] = true; out.push(list[pick]);
    }
    return out;
  }

  // 一組家具（餐桌＋椅子）的畫的順序（2026-11-27 第二輪：遠側的椅子、桌腳畫到桌面上面）：
  // 椅子各自一組（grp），在桌子中心後面的先畫、桌子、在前面的後畫；每一組裡面再照前後排
  function orderParts(list) {
    if (!list.some(p => p.grp)) return depthSort(list);
    const ctr = p => (p.wb.x0 + p.wb.x1 + p.wb.y0 + p.wb.y1) / 2, base = list.filter(p => !p.grp);
    if (!base.length) return depthSort(list);
    const mid = base.reduce((a, p) => a + ctr(p), 0) / base.length, groups = {};
    list.filter(p => p.grp).forEach(p => (groups[p.grp] = groups[p.grp] || []).push(p));
    const gs = Object.values(groups).map(g => ({ g, c: g.reduce((a, p) => a + ctr(p), 0) / g.length })).sort((a, b) => a.c - b.c), out = [];
    gs.filter(o => o.c < mid).forEach(o => out.push(...depthSort(o.g))); out.push(...depthSort(base)); gs.filter(o => o.c >= mid).forEach(o => out.push(...depthSort(o.g)));
    return out;
  }
  // 最暗收在 #30353a（第二輪：黑色款的右側、背板、腳還有幾處更暗）
  const LUM_MIN = 52;   // #30353a 的亮度（第三輪：照最亮那個色版算會漏掉 (42,47,51) 這種，改照亮度）
  const clampDark = c => { if (c[0] !== '#') return c; const a = hex(c); return a[0] * .3 + a[1] * .59 + a[2] * .11 < LUM_MIN ? '#30353a' : c; };
  // 影子只在底座下面的（立燈、弧形落地燈；第二輪：小圖底下一大塊菱形像墊了地磚）：自己座標的 [u0, v0, u1, v1]
  const SHADOW = { lamp2: [.25, .25, .75, .75], lamp3: [.12, .12, .78, .78], table7: [.7, .7, 3.3, 3.3], table8: [.5, .6, 5.5, 3.4], sofa5: [[0, 0, 5, 2], [3.3, 2, 5, 4]] };
  const shadowRects = k => { const s0 = SHADOW[k]; return s0 ? (Array.isArray(s0[0]) ? s0 : [s0]) : null; };   // L 型沙發（後 20 件審稿：整個 5×4 的影子連缺角也有）分兩塊   // 餐桌（第三輪：四角是空的，整格的影子像墊了一塊地毯）只在桌子下面
  // 一個盒子（屋內和商店小圖共用）：正面原色、右側暗、頂面亮。2026-11-27 家具審稿：
  // 頂面前緣一顆亮邊（跟家門口屋簷、欄杆一樣）、木頭色的大面畫幾條淡木紋、很淺的顏色右側再暗一點（不然在米白底上看不見）、玻璃四邊亮邊
  const lum = c => { const a = hex(c); return a[0] * .3 + a[1] * .59 + a[2] * .11; };
  function drawBox(x, iso, p, b, P, vis, onGlow) {
    const q = (pts, col) => poly(x, pts, clampDark(col)), ga = x.globalAlpha;
    const top = [iso(b.x0, b.y0, b.z1), iso(b.x1, b.y0, b.z1), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)];
    const fy = [iso(b.x0, b.y1, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)], fx = [iso(b.x1, b.y0, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x1, b.y0, b.z1)];
    const dk = lum(p.col) > 200 ? -.22 : -.16, dx = b.x1 - b.x0, dy = b.y1 - b.y0, dz = b.z1 - b.z0;
    if (p.glass) x.globalAlpha = ga * .5;
    q(fy, p.col); q(fx, sh(p.col, dk)); q(top, sh(p.col, .14));
    if (p.glass) { x.globalAlpha = ga; q([iso(b.x0, b.y1, b.z1 - .8), iso(b.x1, b.y1, b.z1 - .8), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)], '#eef8fa'); q([iso(b.x1, b.y0, b.z1 - .8), iso(b.x1, b.y1, b.z1 - .8), iso(b.x1, b.y1, b.z1), iso(b.x1, b.y0, b.z1)], '#dcecf0'); }
    if (p.grain) {   // 木紋：正面、右側各兩三條短線（夠大才畫），頂面順著長的那一邊
      const gc = sh(p.col, -.08), gt = sh(p.col, .06), seed = Math.round((b.x0 * 7 + b.y0 * 13 + b.z0) * 10);
      if (dz >= 5) { if (dx >= .8) for (let k2 = 0; k2 < (dx > 1.6 ? 3 : 2); k2++) { const zs = Math.round(b.z0 + dz * (.25 + .28 * k2) + (hash(seed, k2) - .5) * 2), xa = b.x0 + dx * hash(k2, seed) * .45, xb = Math.min(b.x1 - .05, xa + dx * (.3 + hash(seed + 1, k2) * .3)); q([iso(xa, b.y1, zs), iso(xb, b.y1, zs), iso(xb, b.y1, zs + 1), iso(xa, b.y1, zs + 1)], gc); }
        if (dy >= .8) for (let k2 = 0; k2 < 2; k2++) { const zs = Math.round(b.z0 + dz * (.3 + .35 * k2) + (hash(seed + 2, k2) - .5) * 2), ya = b.y0 + dy * hash(k2 + 5, seed) * .45, yb = Math.min(b.y1 - .05, ya + dy * (.3 + hash(seed + 3, k2) * .3)); q([iso(b.x1, ya, zs), iso(b.x1, yb, zs), iso(b.x1, yb, zs + 1), iso(b.x1, ya, zs + 1)], sh(gc, -.1)); } }
      if (dx * dy >= 1.2 && Math.min(dx, dy) >= .6) for (let k2 = 0; k2 < 3; k2++) { const f = .22 + .28 * k2 + (hash(seed + 4, k2) - .5) * .08, a0 = .1 + hash(k2, seed + 6) * .3, a1 = Math.min(.95, a0 + .3 + hash(seed + 7, k2) * .35);
        q(dx >= dy ? [iso(b.x0 + dx * a0, b.y0 + dy * f, b.z1), iso(b.x0 + dx * a1, b.y0 + dy * f, b.z1), iso(b.x0 + dx * a1, b.y0 + dy * f + .17, b.z1), iso(b.x0 + dx * a0, b.y0 + dy * f + .17, b.z1)]
          : [iso(b.x0 + dx * f, b.y0 + dy * a0, b.z1), iso(b.x0 + dx * f + .17, b.y0 + dy * a0, b.z1), iso(b.x0 + dx * f + .17, b.y0 + dy * a1, b.z1), iso(b.x0 + dx * f, b.y0 + dy * a1, b.z1)], gt); }
    }
    if (!p.glass && dx >= .25 && dy >= .25 && dz >= 2.5) { q([iso(b.x0, b.y1, b.z1 - 1), iso(b.x1, b.y1, b.z1 - 1), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)], sh(p.col, .22)); q([iso(b.x1, b.y0, b.z1 - 1), iso(b.x1, b.y1, b.z1 - 1), iso(b.x1, b.y1, b.z1), iso(b.x1, b.y0, b.z1)], sh(p.col, dk / 3)); }
    if (p.shine) { const [a, c] = iso((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z1); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(Math.round(a) - 2, Math.round(c), 4, 1); }
    (p.top || []).forEach(d => q([P(d.u0, d.v0, b.z1), P(d.u1, d.v0, b.z1), P(d.u1, d.v1, b.z1), P(d.u0, d.v1, b.z1)], d.col));
    (p.dec || []).forEach(d => { const n = vis(d.face); if (!n) return; let pts;
      if (d.face === '+v' || d.face === '-v') { const v = d.face === '+v' ? p.v1 : p.v0; pts = [P(d.a0, v, d.z0), P(d.a1, v, d.z0), P(d.a1, v, d.z1), P(d.a0, v, d.z1)]; }
      else { const u = d.face === '+u' ? p.u1 : p.u0; pts = [P(u, d.a0, d.z0), P(u, d.a1, d.z0), P(u, d.a1, d.z1), P(u, d.a0, d.z1)]; }
      q(pts, n === '+x' ? sh(d.col, -.12) : d.col); if (d.glow && onGlow) onGlow(pts); });
    return [top, fy, fx];
  }
  // 展示櫃的玻璃（2026-11-27 審稿：一倍下看起來像空的木框）：淡淡一層、上緣和左緣一顆亮邊、兩條粗的斜反光
  function caseGlass(x, iso, b) {
    const q = (pts, col) => poly(x, pts, col), ga = x.globalAlpha;
    x.globalAlpha = ga * .24; q([iso(b.x0, b.y1, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)], '#dff1f5'); q([iso(b.x1, b.y0, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x1, b.y0, b.z1)], '#cde6ec');
    x.globalAlpha = ga * .8; q([iso(b.x0, b.y1, b.z1 - 1), iso(b.x1, b.y1, b.z1 - 1), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)], '#f4fbfd'); q([iso(b.x0, b.y1, b.z0), iso(b.x0 + .07, b.y1, b.z0), iso(b.x0 + .07, b.y1, b.z1), iso(b.x0, b.y1, b.z1)], '#f4fbfd');
    x.globalAlpha = ga * .6; [[.18, .16], [.58, .08]].forEach(([f, w]) => { const s0 = b.x0 + (b.x1 - b.x0) * f; q([iso(s0, b.y1, b.z0 + 2), iso(s0 + w, b.y1, b.z0 + 2), iso(s0 + w + .22, b.y1, b.z1 - 2), iso(s0 + .22, b.y1, b.z1 - 2)], '#ffffff'); });
    x.globalAlpha = ga;
  }

  // ---------- 畫一間 ----------
  // opt.z 放大幾倍、opt.night、opt.ghost { k, c, rot, room, x, y, bad }、opt.hide（移動中那件不畫）、opt.canvas
  const shellCache = new Map();
  function render(s, fi, rid, opt = {}) {
    const R = roomInfo(s, fi, rid); if (!R) return null;
    const { r, OX, OY, W, H } = R, night = !!opt.night, z = Math.max(1, Math.round(opt.z || 1)), st = X.styleOf(s, r.id);
    const iso = (i, j, zz = 0) => [OX + (i - j) * TW, OY + (i + j) * TH - zz];
    const cv = opt.canvas || document.createElement('canvas'); if (cv.width !== W * z || cv.height !== H * z) { cv.width = W * z; cv.height = H * z; }
    let x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.imageSmoothingEnabled = false;   // 晚上家具畫在另一層（見下面「3. 家具」），x 會暫時換成那一層
    const q = (pts, col) => poly(x, pts, col);
    const hits = [];   // 點選用：每一件畫出來的多邊形

    // 房間的門窗（給殼和點選用）
    const pics = X.placedIn(s, r.id).filter(t => X.FURN[t.key].kind === 'pic').map(t => [t.at[0], t.at[0] + X.FURN[t.key].w]);
    const tent = X.level(s, 'house') === 1;   // 帳篷：牆是帆布、沒有窗
    const LV = X.level(s, 'house');
    // 窗平均分佈在牆上（2026-11-27：原本從第 1 格開始每 6 格一扇，窄的房間只有一扇擠在角落）
    const spread = len => { const n = Math.max(1, Math.floor((len + 2) / 6)), gap = (len - 2 * n) / (n + 1), out = []; for (let k = 0; k < n; k++) out.push(gap + k * (2 + gap)); return out; };
    const winN = tent ? [] : spread(r.w).filter(c => !pics.some(([a, b]) => c < b + .5 && a < c + 2.5));
    // 門寬 1.2 格（2026-11-23 使用者說 2.4 格太寬、不正常）
    const mid = Math.floor(r.h / 2), doorW = R.idx > 0 ? [mid - .6, mid + .6] : null, doorE = R.idx < R.n - 1 ? [mid - .6, mid + .6] : null;
    const doorS = R.fi === 0 && r.id === 'main' ? [r.w / 2 - .6, r.w / 2 + .6] : null;
    const winW = R.idx === 0 && !tent ? spread(r.h) : [];

    // 1. 殼：背景、底座、地板、兩道牆（一顆一顆，存起來）
    const key = [r.id, r.w, r.h, st.floor, st.paper, R.idx, R.n, R.fi, LV, JSON.stringify(r.block || []), JSON.stringify(winN), JSON.stringify(winW)].join('|');
    let shell = shellCache.get(key);
    if (!shell) {
      shell = document.createElement('canvas'); shell.width = W; shell.height = H; const sx = shell.getContext('2d'), img = sx.createImageData(W, H), d = img.data;
      const put = (px, py, col) => { const k = (py * W + px) * 4, [a, b, c2] = hex(col); d[k] = a; d[k + 1] = b; d[k + 2] = c2; d[k + 3] = 255; };
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const a = (px + .5 - OX) / TW, b = (py + .5 - OY) / TH, i = (a + b) / 2, j = (b - a) / 2;
        if (i >= 0 && j >= 0 && i < r.w && j < r.h) { put(px, py, floorPx(st.floor, i, j, px, py, LV)); continue; }
        // 牆面：左牆在 x = 0（沿 y）、右牆在 y = 0（沿 x）
        let along, zz, side;
        if (px + .5 <= OX) { along = (OX - px - .5) / TW; zz = OY + along * TH - (py + .5); side = 'L'; if (along > r.h) continue; }
        else { along = (px + .5 - OX) / TW; zz = OY + along * TH - (py + .5); side = 'R'; if (along > r.w) continue; }
        if (zz < 0 || zz > WH) continue;
        const sA = Math.round(along * TW);
        let col = paperPx(st.paper, sA, Math.round(zz), LV);
        if (LV === 2 && st.paper === 0) { const k0 = Math.floor(zz / 6), k1 = Math.floor((zz + 1) / 6), t = zz - k0 * 6; col = k0 !== k1 ? '#6e4528' : t > 4.2 ? '#c99a66' : t > 3.2 ? '#b5875a' : hash(sA >> 1, k0) > .9 ? '#9a6a40' : '#a8784a'; }
        // 帳篷：牆頂往內收的帆布邊（暗一點、下緣有點波浪）
        if (tent) { const band = WH - 9 - (Math.floor(sA / 5) % 2); if (zz > band + 1) col = sh(col, -.1); else if (zz > band) col = '#a8966f'; }
        // 光從西邊來：西牆（左）朝東、在陰影裡，比北牆暗一點
        if (side === 'L') col = sh(col, -.08);
        // 踢腳板 2 顆木色（原本 4 顆深棕，像描邊）
        if (!tent && zz < 2) col = zz < 1 ? '#9a6a40' : '#b5875a';
        if (zz > WH - 2) col = '#d8ccb3';
        put(px, py, col);
      }
      sx.putImageData(img, 0, 0);
      shellCache.set(key, shell); if (shellCache.size > 30) shellCache.delete(shellCache.keys().next().value);
    }
    x.fillStyle = night ? '#141826' : '#e4ddd0'; x.fillRect(0, 0, W * z, H * z);
    x.setTransform(z, 0, 0, z, 0, 0);
    // 底座（前面兩面）
    q([iso(0, r.h + WT), iso(r.w + WT, r.h + WT), iso(r.w + WT, r.h + WT, -SLAB), iso(0, r.h + WT, -SLAB)], '#6e5338');
    q([iso(r.w + WT, -WT), iso(r.w + WT, r.h + WT), iso(r.w + WT, r.h + WT, -SLAB), iso(r.w + WT, -WT, -SLAB)], '#5a432c');
    x.drawImage(shell, 0, 0);
    // 牆頂（看得到牆的厚度）、剖面
    q([iso(0, -WT, WH), iso(0, r.h + WT, WH), iso(-WT, r.h + WT, WH), iso(-WT, -WT, WH)], '#e9dfca');
    q([iso(-WT, -WT, WH), iso(r.w + WT, -WT, WH), iso(r.w + WT, 0, WH), iso(0, 0, WH)], '#e9dfca');
    q([iso(-WT, r.h + WT, WH), iso(-WT, r.h + WT, -SLAB), iso(0, r.h + WT, -SLAB), iso(0, r.h + WT, WH)], '#cbbd9f');
    q([iso(r.w + WT, -WT, WH), iso(r.w + WT, -WT, -SLAB), iso(r.w + WT, 0, -SLAB), iso(r.w + WT, 0, WH)], '#bfb08f');
    // 西牆南端、北牆東端：牆的內側在地板外面那一截（原本沒畫，白天露出米色底看不出來，晚上變一條暗縫）
    q([iso(0, r.h, 0), iso(0, r.h + WT, 0), iso(0, r.h + WT, WH), iso(0, r.h, WH)], '#d9cdb3'); q([iso(r.w, 0, 0), iso(r.w + WT, 0, 0), iso(r.w + WT, 0, WH), iso(r.w, 0, WH)], '#cfc2a6');
    // 地板和牆中間那條（牆厚的切面）
    if (tent) { const [a, b] = iso(0, 0); x.fillStyle = '#8a5a36'; x.fillRect(Math.round(a) - 1, Math.round(b) - WH, 2, WH); x.fillStyle = '#a8784a'; x.fillRect(Math.round(a) - 1, Math.round(b) - WH, 1, WH); }
    q([iso(0, r.h, 0), iso(0, r.h + WT, 0), iso(-WT, r.h + WT, 0), iso(-WT, r.h, 0)], '#cbbd9f');

    // 窗（北牆、西牆）：白天窗光照在地上
    const onN = (i, zz) => iso(i, 0, zz), onWl = (j, zz) => iso(0, j, zz);
    function windowOn(at, a0, a1) {
      const z0 = 16, z1 = 36, m = (a0 + a1) / 2;
      q([at(a0 - .15, z0 - 2), at(a1 + .15, z0 - 2), at(a1 + .15, z1 + 2), at(a0 - .15, z1 + 2)], '#f6f1e6');
      q([at(a0, z0), at(a1, z0), at(a1, z1), at(a0, z1)], night ? '#1f2c4f' : '#a8d4e8');
      if (!night) q([at(a0, z1 - 6), at(a1, z1 - 6), at(a1, z1), at(a0, z1)], '#d4ecf5');
      else for (let k = 0; k < 6; k++) { const [a, b] = at(a0 + .2 + hash(k, a0 | 0) * (a1 - a0 - .4), z0 + 3 + hash(a0 | 0, k) * 14); x.fillStyle = '#f4eed8'; x.fillRect(Math.round(a), Math.round(b), 1, 1); }
      q([at(m - .05, z0), at(m + .05, z0), at(m + .05, z1), at(m - .05, z1)], '#f6f1e6');
      q([at(a0, (z0 + z1) / 2), at(a1, (z0 + z1) / 2), at(a1, (z0 + z1) / 2 + 1), at(a0, (z0 + z1) / 2 + 1)], '#f6f1e6');
      q([at(a0 - .15, z0 - 3), at(a1 + .15, z0 - 3), at(a1 + .15, z0 - 2), at(a0 - .15, z0 - 2)], '#d9cfbb');
      [[a0 - .45, a0 - .05], [a1 + .05, a1 + .45]].forEach(([b0, b1]) => { q([at(b0, z0 - 5), at(b1, z0 - 5), at(b1, z1 + 4), at(b0, z1 + 4)], '#e7d7b4'); for (let t = b0 + .12; t < b1; t += .17) q([at(t, z0 - 5), at(t + .04, z0 - 5), at(t + .04, z1 + 4), at(t, z1 + 4)], '#cbb68c'); });
      q([at(a0 - .6, z1 + 4), at(a1 + .6, z1 + 4), at(a1 + .6, z1 + 5), at(a0 - .6, z1 + 5)], '#5e3c22');
    }
    winN.forEach(c => windowOn(onN, c, c + 2)); winW.forEach(c => { if (!doorW || c + 2 < doorW[0] || c > doorW[1]) windowOn(onWl, c, c + 2); });
    // 窗光（2026-11-27 審稿）：北窗、西窗照同一個太陽，每高 1 格往 (x +1, y +.45) 偏；窗台約 1.18 格高、窗頂約 2.67 格高；
    // 分成四塊，中間留窗框的影子；超出房間的切掉
    if (!night) { x.save(); x.globalAlpha = .28; x.beginPath(); [iso(0, 0), iso(r.w, 0), iso(r.w, r.h), iso(0, r.h)].forEach((p, k2) => k2 ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.clip();
      const S0 = 1.18, S1 = 2.67, SM = (S0 + S1) / 2, lightN = (a0, a1, h0, h1) => q([iso(a0 + h0, h0 * .45), iso(a1 + h0, h0 * .45), iso(a1 + h1, h1 * .45), iso(a0 + h1, h1 * .45)], '#ffe9b8');
      const lightW = (a0, a1, h0, h1) => q([iso(h0, a0 + h0 * .45), iso(h0, a1 + h0 * .45), iso(h1, a1 + h1 * .45), iso(h1, a0 + h1 * .45)], '#ffe9b8');
      const four = (f, c) => { const m = c + 1; [[c + .1, m - .04], [m + .04, c + 1.9]].forEach(([a0, a1]) => { f(a0, a1, S0, SM - .04); f(a0, a1, SM + .04, S1); }); };
      winN.forEach(c => four(lightN, c));
      winW.forEach(c => { if (!doorW || c + 2 < doorW[0] || c > doorW[1]) four(lightW, c); });
      x.restore(); }
    // 西牆的門（往左邊那間）
    if (doorW) { const [a0, a1] = doorW; q([onWl(a0 - .1, 0), onWl(a1 + .1, 0), onWl(a1 + .1, 35), onWl(a0 - .1, 35)], '#5e3c22'); q([onWl(a0, 0), onWl(a1, 0), onWl(a1, 34), onWl(a0, 34)], '#8a5a36');
      q([onWl(a0 + .12, 3), onWl(a1 - .12, 3), onWl(a1 - .12, 16), onWl(a0 + .12, 16)], '#7c5230'); q([onWl(a0 + .12, 19), onWl(a1 - .12, 19), onWl(a1 - .12, 31), onWl(a0 + .12, 31)], '#7c5230');
      const [ka, kb] = onWl(a1 - .22, 17); x.fillStyle = '#d4a83c'; x.fillRect(Math.round(ka), Math.round(kb), 1, 2); }
    // 樓梯（block）：一樓往上、二樓以上是往下的樓梯口（2026-11-27 審稿重畫）
    // 一樓：12 階（每階深 1/3 格、高 WH/12），從南往北走上去，最上面一階到天花板（頂面用牆的剖面色＝上面被模型切掉）；兩邊欄杆扶手
    // 二樓：地上一個洞，樓梯從北邊往南走下去；沒貼牆的邊（北邊是入口除外）有欄杆，高約 110 公分、柱子密一點；洞裡往下越亮（一樓有光）
    const railPost = (px, py, z0, hz, w2 = .04) => q([iso(px - w2, py, z0), iso(px + w2, py, z0), iso(px + w2, py, z0 + hz), iso(px - w2, py, z0 + hz)], '#7c5230');
    const handrail = (x0, y0, z0, x1, y1, z1) => { q([iso(x0, y0, z0), iso(x1, y1, z1), iso(x1, y1, z1 + 2), iso(x0, y0, z0 + 2)], '#9a6a40'); q([iso(x0, y0, z0 + 2), iso(x1, y1, z1 + 2), iso(x1, y1, z1 + 2.8), iso(x0, y0, z0 + 2.8)], '#c48d5c'); };
    (r.block || []).forEach(([bx, by, bw, bh]) => { const n = Math.round(bh * 3), d = bh / n, st2 = WH / n;
      if (R.fi === 0) {
        // 扶手做到天花板下面為止（上面被模型切掉）
        const top2 = Math.max(1, Math.floor((WH - 20) / st2)), sideRail = sx => { for (let k2 = 0; k2 < top2; k2++) railPost(sx, by + bh - (k2 + .5) * d, (k2 + 1) * st2, 18); handrail(sx, by + bh - .5 * d, st2 + 18, sx, by + bh - (top2 - .5) * d, top2 * st2 + 18); };
        if (bx > 0) sideRail(bx + .06);
        for (let k2 = n - 1; k2 >= 0; k2--) { const y0 = by + bh - (k2 + 1) * d, y1 = y0 + d, hz = (k2 + 1) * st2, p = { x0: bx, x1: bx + bw }, last = k2 === n - 1;
          q([iso(p.x0, y1, 0), iso(p.x1, y1, 0), iso(p.x1, y1, hz), iso(p.x0, y1, hz)], '#8a5a36');
          q([iso(p.x1, y0, 0), iso(p.x1, y1, 0), iso(p.x1, y1, hz), iso(p.x1, y0, hz)], '#7c5230');
          q([iso(p.x1, y0, hz), iso(p.x1, y1, hz), iso(p.x1, y1, hz - .8), iso(p.x1, y0, hz - .8)], '#5e3c22');
          q([iso(p.x0, y0, hz), iso(p.x1, y0, hz), iso(p.x1, y1, hz), iso(p.x0, y1, hz)], last ? '#e9dfca' : '#c48d5c');
          if (!last) q([iso(p.x0, y1, hz), iso(p.x1, y1, hz), iso(p.x1, y1, hz - 1), iso(p.x0, y1, hz - 1)], '#ecc48f'); }
        // 樓梯下的收納小門（側面一大片深棕太單調）
        { const x1 = bx + bw, ya = by + 1, yb = by + 1.8; q([iso(x1, ya, 0), iso(x1, yb, 0), iso(x1, yb, 20), iso(x1, ya, 20)], '#5e3c22'); q([iso(x1, ya + .06, 0), iso(x1, yb - .06, 0), iso(x1, yb - .06, 19), iso(x1, ya + .06, 19)], '#6e4528'); q([iso(x1, ya + .06, 18), iso(x1, yb - .06, 18), iso(x1, yb - .06, 19), iso(x1, ya + .06, 19)], '#8a5a36'); const [ka, kb] = iso(x1, yb - .2, 10); x.fillStyle = '#d4a83c'; x.fillRect(Math.round(ka), Math.round(kb), 1, 2); }
        if (bx + bw < r.w) sideRail(bx + bw - .06);
        return; }
      const hole = [iso(bx, by), iso(bx + bw, by), iso(bx + bw, by + bh), iso(bx, by + bh)], D = n * st2 + 8;
      x.save(); x.beginPath(); hole.forEach((pt, i2) => i2 ? x.lineTo(pt[0], pt[1]) : x.moveTo(pt[0], pt[1])); x.closePath(); x.clip();
      q(hole, '#4a3a2c');
      for (let k2 = 0; k2 < 6; k2++) { const z0 = -k2 * D / 6, z1 = -(k2 + 1) * D / 6, f = k2 * .05;
        q([iso(bx, by, z0), iso(bx, by + bh, z0), iso(bx, by + bh, z1), iso(bx, by, z1)], sh('#5a4634', f));
        q([iso(bx, by, z0), iso(bx + bw, by, z0), iso(bx + bw, by, z1), iso(bx, by, z1)], sh('#6b5540', f)); }
      q([iso(bx, by, 0), iso(bx + bw, by, 0), iso(bx + bw, by, -1), iso(bx, by, -1)], '#d9a670');
      for (let k2 = 0; k2 < n; k2++) { const y0 = by + k2 * d, y1 = y0 + d, zt = -(k2 + 1) * st2, f = -k2 * .025;
        q([iso(bx, y0, zt), iso(bx + bw, y0, zt), iso(bx + bw, y1, zt), iso(bx, y1, zt)], sh('#c48d5c', f));
        q([iso(bx, y1, zt), iso(bx + bw, y1, zt), iso(bx + bw, y1, zt - st2), iso(bx, y1, zt - st2)], sh('#8a5a36', f));
        q([iso(bx, y0, zt), iso(bx + bw, y0, zt), iso(bx + bw, y0, zt - .8), iso(bx, y0, zt - .8)], sh('#ecc48f', f)); }
      x.restore();
      // 樓梯口的邊（地板的切面）
      q([iso(bx, by + bh), iso(bx + bw, by + bh), iso(bx + bw, by + bh, -1.5), iso(bx, by + bh, -1.5)], '#6e4528');
      q([iso(bx + bw, by), iso(bx + bw, by + bh), iso(bx + bw, by + bh, -1.5), iso(bx + bw, by, -1.5)], '#5e3c22');
      const rail = (x0, y0, x1, y1) => { const L2 = Math.hypot(x1 - x0, y1 - y0), m2 = Math.max(1, Math.round(L2 / .25));
        for (let k2 = 0; k2 <= m2; k2++) { const px = x0 + (x1 - x0) * k2 / m2, py = y0 + (y1 - y0) * k2 / m2; railPost(px, py, 0, 18.5, k2 === 0 || k2 === m2 ? .08 : .04); }
        q([iso(x0, y0, 18.5), iso(x1, y1, 18.5), iso(x1, y1, 20), iso(x0, y0, 20)], '#9a6a40'); q([iso(x0, y0, 20), iso(x1, y1, 20), iso(x1, y1, 20.8), iso(x0, y0, 20.8)], '#c48d5c'); };
      if (bx > 0) rail(bx, by + .1, bx, by + bh);
      if (by + bh < r.h) rail(bx, by + bh, bx + bw, by + bh);
      if (bx + bw < r.w) rail(bx + bw, by + .1, bx + bw, by + bh);
    });

    // 2. 掛畫（北牆）
    const placed = X.placedIn(s, r.id).filter(t => t.id !== opt.hide);
    function drawPic(k, at0, alpha) {
      const f = X.FURN[k], P0 = PIC[k], a0 = at0 + P0.a0, a1 = at0 + f.w + P0.a1, z0 = P0.z0, z1 = P0.z1; if (alpha != null) x.globalAlpha = alpha;
      const pts = [onN(a0, z0), onN(a1, z0), onN(a1, z1), onN(a0, z1)];
      q([onN(a0 + .06, z0 - 1), onN(a1 + .06, z0 - 1), onN(a1 + .06, z1 - 1), onN(a0 + .06, z1 - 1)], 'rgba(40,28,18,.16)');   // 畫框在牆上的影子（右下一點）
      paintWall(x, onN, a0, a1, z0, z1, picFn(k, a1 - a0, z1 - z0));
      x.globalAlpha = 1; return pts;
    }
    placed.filter(t => X.FURN[t.key].kind === 'pic').forEach(t => hits.push({ id: t.id, pts: [drawPic(t.key, t.at[0])] }));
    const g = opt.ghost && opt.ghost.room === r.id ? opt.ghost : null;
    if (g && X.FURN[g.k].kind === 'pic') { const pts = drawPic(g.k, g.x, .65); x.save(); x.strokeStyle = g.bad ? '#b33a2f' : '#ffffff'; x.lineWidth = 1; x.setLineDash([2, 2]); x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.stroke(); x.restore(); }

    // 3. 家具
    const lights = [], emit = [];
    function itemFor(t, isGhost) {
      const f = X.FURN[t.key], rot = (f.kind === 'one' || f.kind === 'rugone') ? 0 : t.rot & 3, tf = xform(rot, t.at[0], t.at[1], f.w, f.h), bd = build(t.key, t.c, night);
      const [fw, fh] = X.fpOf(t.key, rot);
      return { t, f, rot, tf, bd, wb: { x0: t.at[0], x1: t.at[0] + fw, y0: t.at[1], y1: t.at[1] + fh, z0: 0, z1: 40 }, ghost: isGhost, rug: X.layerOf(t.key) === 'rug' };
    }
    const items = placed.filter(t => X.FURN[t.key].kind !== 'pic').map(t => itemFor(t));
    if (g && X.FURN[g.k].kind !== 'pic') items.push(itemFor({ id: '_ghost', key: g.k, c: g.c, rot: g.rot, at: [g.x, g.y] }, true));
    // 燈的位置先算好（晚上地上、牆上的光要在家具之前畫，才不會蓋到家具和前面的矮牆；第三輪審稿）
    items.filter(it => !it.ghost).forEach(it => { const P = (u, v, zz) => { const [a, b] = it.tf(u, v); return iso(a, b, zz); };
      it.bd.lights.forEach(l => lights.push({ at: P(l.u, l.v, l.z), fl: P(l.u, l.v, 0), kind: l.kind }));
      it.bd.parts.forEach(p => { if (p.t !== 'case') return; const b = worldBox(p, it.tf); lights.push({ at: iso((b.x0 + b.x1) / 2, b.y1, (b.z0 + b.z1) / 2), fl: iso((b.x0 + b.x1) / 2, b.y1 + .3, 0), kind: 'case' }); }); });
    // 影子（地毯以外，先全部畫）
    x.save(); x.fillStyle = 'rgba(40,28,18,.18)';
    items.filter(it => !it.rug && !it.ghost).forEach(it => { const rs = shadowRects(it.t.key), s2 = .22;
      const boxes = rs ? rs.map(r2 => { const p0 = it.tf(r2[0], r2[1]), p1 = it.tf(r2[2], r2[3]); return [Math.min(p0[0], p1[0]), Math.min(p0[1], p1[1]), Math.max(p0[0], p1[0]), Math.max(p0[1], p1[1]), 0]; }) : [[it.wb.x0, it.wb.y0, it.wb.x1, it.wb.y1, ['plant1', 'plant2', 'plant3'].includes(it.t.key) ? .3 : .06]];
      boxes.forEach(([x0, y0, x1, y1, sm]) => poly(x, [iso(x0 + sm + s2, y0 + sm + s2 * .4), iso(x1 - sm + s2, y0 + sm + s2 * .4), iso(x1 - sm + s2, y1 - sm + s2), iso(x0 + sm + s2, y1 - sm + s2)], 'rgba(40,28,18,.18)')); });
    x.restore();
    const rugs = items.filter(it => it.rug), objs = depthSort(items.filter(it => !it.rug));
    // 預覽的地上框：綠白、紅
    function footprint(it) { const b = it.wb, pts = [iso(b.x0, b.y0), iso(b.x1, b.y0), iso(b.x1, b.y1), iso(b.x0, b.y1)];
      x.save(); x.globalAlpha = .35; poly(x, pts, it.ghost && opt.ghost.bad ? '#b33a2f' : '#ffffff'); x.restore();
      x.save(); x.strokeStyle = opt.ghost.bad ? '#b33a2f' : '#ffffff'; x.lineWidth = 1; x.setLineDash([2, 2]); x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.stroke(); x.restore(); }
    const drawOne = it => {
      if (it.ghost) { footprint(it); x.globalAlpha = .7; }
      const shapes = drawItem(it);
      x.globalAlpha = 1;
      if (!it.ghost) hits.push({ id: it.t.id, pts: shapes, rug: it.rug });
    };
    rugs.forEach(drawOne);
    // 晚上：房間（地板、牆、地毯）先調暗、提亮一點點（最暗不接近黑），再畫地上、牆上的光；家具和前面的矮牆畫在另一層，自己調暗後再貼上來
    // （第三輪審稿：光暈畫在家具之後，會把矮牆頂、床頭櫃照得比白天還亮、蓋掉立燈底座）
    const LT = { warm: [42, '255,196,110', .58, '255,230,170'], screen: [26, '120,160,230', .3, '170,200,245'], case: [22, '255,210,130', .26, '255,225,160'] };
    const glow = (a, b, rad, col, al, flat) => { x.save(); x.translate(a, b); if (flat) x.scale(1, .5); const gr = x.createRadialGradient(0, 0, 0, 0, 0, rad); gr.addColorStop(0, `rgba(${col},${al})`); gr.addColorStop(.55, `rgba(${col},${al * .45})`); gr.addColorStop(1, `rgba(${col},0)`); x.fillStyle = gr; x.fillRect(-rad, -rad, rad * 2, rad * 2); x.restore(); };
    const clipTo = pts => { x.beginPath(); pts.forEach((pt, i2) => i2 ? x.lineTo(pt[0], pt[1]) : x.moveTo(pt[0], pt[1])); x.closePath(); x.clip(); };
    const darken = () => { x.save(); x.globalCompositeOperation = 'multiply'; x.fillStyle = '#5b6189'; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'lighter'; x.fillStyle = 'rgb(20,20,26)'; x.fillRect(0, 0, W, H); x.restore(); };
    const main = x; let lay = null;
    if (night) {
      darken();
      x.save(); clipTo([iso(0, 0), iso(r.w, 0), iso(r.w, r.h), iso(0, r.h)]); x.globalCompositeOperation = 'lighter';
      lights.forEach(l => { const t = LT[l.kind] || LT.case, [a, b] = l.fl || l.at; glow(a, b, t[0], t[1], t[2], true); }); x.restore();
      x.save(); clipTo([iso(0, r.h, 0), iso(0, r.h, WH), iso(0, 0, WH), iso(r.w, 0, WH), iso(r.w, 0, 0), iso(0, 0, 0)]); x.globalCompositeOperation = 'lighter';
      lights.forEach(l => { const t = LT[l.kind] || LT.case, [a, b] = l.at; glow(a, b, t[0] * .6, t[1], t[2] * .55); });
      winN.forEach(c => { const [a, b] = onN(c + 1, 26); glow(a, b, 16, '150,175,230', .14); }); winW.forEach(c => { const [a, b] = onWl(c + 1, 26); glow(a, b, 16, '150,175,230', .14); }); x.restore();
      lay = document.createElement('canvas'); lay.width = cv.width; lay.height = cv.height; x = lay.getContext('2d'); x.imageSmoothingEnabled = false; x.setTransform(z, 0, 0, z, 0, 0);
    }
    objs.forEach(drawOne);
    function drawItem(it) {
      const { tf, bd, rot, t } = it, P = (u, v, zz) => { const [a, b] = tf(u, v); return iso(a, b, zz); }, shapes = [];
      const vis = face => { const n = NORMAL[face][rot]; return n === '+x' || n === '+y'; };
      const list = bd.parts.map(p => Object.assign({ wb: worldBox(p, tf) }, p));
      orderParts(list).forEach(p => {
        const b = p.wb;
        if (p.t === 'box') shapes.push(...drawBox(x, iso, p, b, P, face => { const n = NORMAL[face][rot]; return n === '+x' || n === '+y' ? n : null; }, night ? pts => emit.push(() => { x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = .32; poly(x, pts, '#6f8fc8'); x.restore(); }) : null));
        else if (p.t === 'fn') { const [a, c] = P(p.u, p.v, p.z); p.draw(x, Math.round(a), Math.round(c), night, (u, v, zz) => P(u, v, zz)); shapes.push([[a - 8, c - (p.z1 - p.z0) - 4], [a + 8, c - (p.z1 - p.z0) - 4], [a + 8, c + 3], [a - 8, c + 3]]); }
        else if (p.t === 'disc') shapes.push(discDraw(x, P, p));
        else if (p.t === 'case') {   // 展示櫃：藏品擺在層板上，外面一層玻璃
          const hold = X.HOLD[t.key], list2 = t.id === '_ghost' ? [] : X.caseItems(s, t.id), per = Math.ceil(hold.n / p.rows);
          list2.forEach(itm => { const row = Math.floor(itm.at / per), col = itm.at % per, u = p.u0 + (col + .5) * (p.u1 - p.u0) / per, v = (p.v0 + p.v1) / 2, zz = p.z0 + 1 + row * (p.hh - 4) / p.rows;
            const [a, c] = P(u, v, zz), cdat = X.COLL[itm.key];
            if (cdat.r !== 'n') { x.fillStyle = X.RARE[cdat.r][1]; x.fillRect(Math.round(a) - 3, Math.round(c), 7, 1); }
            if (COLL) { x.save(); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; const sz = p.gold ? 9 : 10; x.drawImage(COLL, cdat.d[0], cdat.d[1], cdat.d[2], cdat.d[3], a - sz / 2, c - sz + .5, sz, sz); x.restore(); } });
          caseGlass(x, iso, b);
          if (night) emit.push(() => { x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = .22; q([iso(b.x0, b.y1, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)], '#ffd98a'); x.restore(); });
        }
      });
      return shapes;
    }

    // 4. 前面兩道矮牆（剖開的牆）；有門的地方留空
    const lowWall = (x0, y0, x1, y1, hz, c1, c2) => { q([iso(x0, y1, 0), iso(x1, y1, 0), iso(x1, y1, hz), iso(x0, y1, hz)], c1); q([iso(x1, y0, 0), iso(x1, y1, 0), iso(x1, y1, hz), iso(x1, y0, hz)], c2); q([iso(x0, y0, hz), iso(x1, y0, hz), iso(x1, y1, hz), iso(x0, y1, hz)], '#e9dfca'); };
    const segs = (len, gap) => gap ? [[0, gap[0]], [gap[1], len]] : [[0, len]];
    segs(r.w, doorS).forEach(([a, b]) => lowWall(a - (a === 0 ? WT : 0), r.h, b, r.h + WT, 5, '#cbbd9f', '#bfb08f'));
    segs(r.h, doorE).forEach(([a, b]) => lowWall(r.w, a - (a === 0 ? WT : 0), r.w + WT, b + (b === r.h ? WT : 0), 5, '#cbbd9f', '#bfb08f'));
    // 大門（2026-11-27 審稿：原本腳踏墊掛在底座側面像一塊污漬）：門檻木條、門外一塊小台階，上面一塊棕色椰纖墊
    if (doorS) { const [a0, a1] = doorS, j0 = r.h + WT, j1 = j0 + .8;
      q([iso(a0, r.h), iso(a1, r.h), iso(a1, j0), iso(a0, j0)], '#b5875a');
      q([iso(a0 - .2, j1, 0), iso(a1 + .2, j1, 0), iso(a1 + .2, j1, -SLAB), iso(a0 - .2, j1, -SLAB)], '#6e5338');
      q([iso(a1 + .2, j0, 0), iso(a1 + .2, j1, 0), iso(a1 + .2, j1, -SLAB), iso(a1 + .2, j0, -SLAB)], '#5a432c');
      q([iso(a0 - .2, j0, 0), iso(a1 + .2, j0, 0), iso(a1 + .2, j1, 0), iso(a0 - .2, j1, 0)], '#8a6a48');
      q([iso(a0, j0 + .08, 0), iso(a1, j0 + .08, 0), iso(a1, j1 - .1, 0), iso(a0, j1 - .1, 0)], '#a07a4a');
      for (let t = j0 + .2; t < j1 - .15; t += .14) q([iso(a0 + .04, t, 0), iso(a1 - .04, t, 0), iso(a1 - .04, t + .04, 0), iso(a0 + .04, t + .04, 0)], '#8a6538');
      q([iso(a0, j1 - .14, 0), iso(a1, j1 - .14, 0), iso(a1, j1 - .1, 0), iso(a0, j1 - .1, 0)], '#c49a64'); }

    // 5. 夜晚：家具那一層調暗（只調有畫的地方）後貼回去，最後燈泡一小團亮、展示櫃的玻璃發光
    if (night) {
      const mk = document.createElement('canvas'); mk.width = lay.width; mk.height = lay.height; mk.getContext('2d').drawImage(lay, 0, 0);
      darken(); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-in'; x.drawImage(mk, 0, 0); x.restore();
      // 調暗之後再過一次最暗下限（第四輪：黑色電腦桌晚上掉到下限以下）：亮度不到 52 的，三個色版一起往上補到 52，色調不變
      { const im = x.getImageData(0, 0, lay.width, lay.height), d = im.data; for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const L = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; if (L < LUM_MIN) { const add = LUM_MIN - L; d[i] += add; d[i + 1] += add; d[i + 2] += add; } } x.putImageData(im, 0, 0); }
      x = main; x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(lay, 0, 0); x.restore();
      x.save(); clipTo([iso(0, r.h + WT, 0), iso(0, r.h + WT, WH), iso(0, 0, WH), iso(r.w + WT, 0, WH), iso(r.w + WT, 0, 0), iso(r.w + WT, r.h + WT, 0)]); x.globalCompositeOperation = 'lighter';
      lights.forEach(l => { const t = LT[l.kind] || LT.case, [a, b] = l.at; if (l.kind === 'warm') glow(a, b, 5, t[3], .55); }); x.restore();   // 燈泡（螢幕不畫，螢幕是整片亮）
      emit.forEach(e => e());
    }
    x.setTransform(1, 0, 0, 1, 0, 0);

    // 點選：哪一格（地板；北牆那條給掛畫 y = −1）、點到哪一件
    const pick = (px, py) => {
      const a = (px - OX) / TW, b = (py - OY) / TH, i = (a + b) / 2, j = (b - a) / 2;
      if (i >= 0 && j >= 0 && i < r.w && j < r.h) return { r, x: Math.floor(i), y: Math.floor(j) };
      if (px > OX) { const al = (px - OX) / TW, zz = OY + al * TH - py; if (al >= 0 && al < r.w && zz > 0 && zz < WH) return { r, x: Math.floor(al), y: -1 }; }
      if (i >= -1 && j >= -1 && i < r.w + 1 && j < r.h + 1) return { r, x: Math.max(0, Math.min(r.w - 1, Math.floor(i))), y: Math.max(0, Math.min(r.h - 1, Math.floor(j))) };
      return null;
    };
    const hit = (px, py) => { for (let k2 = hits.length - 1; k2 >= 0; k2--) { const h = hits[k2]; if (h.rug) continue; if (h.pts.some(ps => inPoly(ps, px, py))) return h.id; }
      for (let k2 = hits.length - 1; k2 >= 0; k2--) { const h = hits[k2]; if (h.rug && h.pts.some(ps => inPoly(ps, px, py))) return h.id; } return null; };
    return { canvas: cv, layout: { W, H, n: R.fl.n, name: r.name, rooms: [r] }, z, pick, hit };
  }

  // 家具小圖（商店、倉庫、擺放的托盤）：一件單獨畫，白天、正面朝左前
  const thumbCache = new Map();
  function thumb(k, c) {
    const id = k + ':' + c; if (thumbCache.has(id)) return thumbCache.get(id);
    const f = X.FURN[k], w = f.kind === 'pic' ? f.w : f.w, h = f.kind === 'pic' ? .3 : f.h, OX = M / 2 + h * TW, OY = (f.kind === 'pic' ? 40 : 44) + 4;
    const W = Math.ceil(OX + w * TW + M / 2), H = Math.ceil(OY + (w + h) * TH + 6), cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.setTransform(2, 0, 0, 2, 0, 0);
    const iso = (i, j, zz = 0) => [OX + (i - j) * TW, OY + (i + j) * TH - zz];
    if (f.kind === 'pic') {
      const on = (i, zz) => iso(i, 0, zz), P0 = PIC[k], a0 = P0.a0, a1 = f.w + P0.a1, z0 = P0.z0 - 12, z1 = P0.z1 - 12;
      paintWall(x, on, a0, a1, z0, z1, picFn(k, a1 - a0, z1 - z0));
    } else {
      const bd = build(k, c, false), tf = xform(0, 0, 0, f.w, f.h), P = (u, v, zz) => { const [a, b] = tf(u, v); return iso(a, b, zz); };
      // 小圖也畫地上的影子（2026-11-27 審稿：白、米色的家具在商店的米白底上看不見）
      if (f.kind !== 'rug' && f.kind !== 'rugone') { const s2 = .22; (shadowRects(k) || [[0, 0, f.w, f.h]]).forEach(([x0, y0, x1, y1]) => { const sm = SHADOW[k] ? 0 : ['plant1', 'plant2', 'plant3'].includes(k) ? .3 : .06; poly(x, [iso(x0 + sm + s2, y0 + sm + s2 * .4), iso(x1 - sm + s2, y0 + sm + s2 * .4), iso(x1 - sm + s2, y1 - sm + s2), iso(x0 + sm + s2, y1 - sm + s2)], 'rgba(40,28,18,.18)'); }); }
      const list = orderParts(bd.parts.map(p => Object.assign({ wb: worldBox(p, tf) }, p)));
      list.forEach(p => { const b = p.wb;
        if (p.t === 'box') drawBox(x, iso, p, b, P, face => face === '+v' ? '+y' : face === '+u' ? '+x' : null);
        else if (p.t === 'fn') { const [a, cc] = P(p.u, p.v, p.z); p.draw(x, Math.round(a), Math.round(cc), false, P); }
        else if (p.t === 'disc') discDraw(x, P, p);
        else if (p.t === 'case') caseGlass(x, iso, b); });
    }
    // 切掉四周空白
    const d = x.getImageData(0, 0, cv.width, cv.height).data; let a0 = cv.width, a1 = -1, b0 = cv.height, b1 = -1;
    for (let yy = 0; yy < cv.height; yy++) for (let xx = 0; xx < cv.width; xx++) if (d[(yy * cv.width + xx) * 4 + 3] > 10) { if (xx < a0) a0 = xx; if (xx > a1) a1 = xx; if (yy < b0) b0 = yy; if (yy > b1) b1 = yy; }
    const out = document.createElement('canvas'); out.width = Math.max(1, a1 - a0 + 3); out.height = Math.max(1, b1 - b0 + 3); out.getContext('2d').drawImage(cv, 1 - a0, 1 - b0);
    const res = { url: out.toDataURL(), w: out.width / 2, h: out.height / 2 }; thumbCache.set(id, res); return res;
  }

  root.XiaodaoIso = { load, render, thumb, roomInfo, floorPx, paperPx, TW, TH, WH };
})(window);
