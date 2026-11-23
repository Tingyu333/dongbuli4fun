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
  const WOOD = { 淺木: '#c9a072', 胡桃木: '#8a5a36', 白: '#ece7dc', 黑: '#3d3b38', 原色: '#b07f50' };
  const FAB = { 藍: '#5f80a8', 綠: '#7d9a8c', 米: '#ddd0b4', 朱: '#b33a2f', 深藍: '#34476e', 灰: '#8f8c87', 皮革咖啡: '#7a4e32', 金: '#d4a83c', 白: '#ece7dc', 黑: '#3d3b38', 原色: '#b07f50', 淺木: '#c9a072', 胡桃木: '#8a5a36' };
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
  function floorPx(kind, i, j, px, py) {   // i、j 是格子座標（小數）
    const F = FLOOR[kind] || FLOOR[1];
    if (F.t === 'wood') { const row = Math.floor(j * 2), fr = j * 2 - row, sh2 = (row % 3) * 1.3, seg = Math.floor((i + sh2) / 3.2), fi = (i + sh2) / 3.2 - seg;
      if (fr < .09 || fi < .025) return F.p[3]; return F.p[hash(px, py) > .93 ? 2 : Math.floor(hash(row, seg) * 3)]; }
    if (F.t === 'tile') { const a = Math.floor(i), b = Math.floor(j), fa = i - a, fb = j - b; if (fa < .05 || fb < .05) return '#c9c2b4'; return (a + b) % 2 ? '#ebe6dc' : '#ddd6c8'; }
    if (F.t === 'marble') { const v = Math.sin((i * 3 + j * 5.1) + hash(Math.floor(i / 2), Math.floor(j / 2)) * 3); if ((i % 2) < .04 || (j % 2) < .04) return '#d6d1c7'; return v > .95 ? '#b9b4ab' : hash(px, py) > .97 ? '#e4e0d8' : '#f1eee8'; }
    // 榻榻米：2 × 1 格一疊，一排一排錯開，邊是深色布
    const b = Math.floor(j), off = b % 2, a = Math.floor((i + off) / 2), fa = (i + off) / 2 - a, fb = j - b;
    if (fb < .08 || fb > .92) return '#4a5a3e'; if (fa < .02 || fa > .98) return '#a9a66d'; return (px + py) % 3 === 0 ? '#d0cc8e' : py % 2 ? '#c2c48a' : '#b9bb80';
  }
  // 壁紙：s 是沿著牆的距離（顆）、z 是高度（顆）
  const PAPER = [
    (s, z) => Math.floor(s / 3) % 2 ? '#e5d9bf' : '#efe6d2',
    (s, z) => hash(s, z) > .93 ? '#cfdcd3' : '#dfe8e1',
    (s, z) => ((s % 8 === 2 && z % 8 === 2) || (s % 8 === 6 && z % 8 === 6)) ? '#c9a24a' : '#f1e9dc',
    (s, z) => s % 10 === 0 ? '#2a3a5a' : hash(s, z) > .95 ? '#3d5078' : '#33456a',
    (s, z) => hash(s >> 1, z >> 1) > .5 ? (hash(s, z * 7) > .96 ? '#ddd3bf' : '#f1ece0') : '#e9e2d2',
    (s, z) => { const row = Math.floor(z / 5), off = row % 2 ? 5 : 0; return (z % 5 === 4 || (s + off) % 10 === 9) ? '#d9cfc2' : hash(Math.floor((s + off) / 10), row) > .5 ? '#b5654a' : '#a65a40'; },
  ];

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

  // 一件家具的「零件」：盒子、貼在某一面的方塊、自己畫的東西、燈
  function build(k, c, night) {
    const f = X.FURN[k], C = colorsOf(k, c), parts = [], lights = [];
    const B = (u0, v0, u1, v1, z0, z1, col, o = {}) => { const p = Object.assign({ t: 'box', u0, v0, u1, v1, z0, z1, col }, o); parts.push(p); return p; };
    const D = (box, face, a0, a1, z0, z1, col) => { (box.dec = box.dec || []).push({ face, a0, a1, z0, z1, col }); };   // 貼在 box 的某一面：a 沿那一面的寬（+v、-v 是 u；+u、-u 是 v）
    const T = (box, u0, v0, u1, v1, col) => { (box.top = box.top || []).push({ u0, v0, u1, v1, col }); };                // 貼在 box 的頂面
    const FN = (u, v, z, h, draw) => { parts.push({ t: 'fn', u0: u - .05, v0: v - .05, u1: u + .05, v1: v + .05, z0: z, z1: z + h, u, v, z, draw }); };
    const L = (u, v, z, kind) => lights.push({ u, v, z, kind });
    const legs = (u0, v0, u1, v1, h, col, t = .1) => [[u0, v0], [u1 - t, v0], [u0, v1 - t], [u1 - t, v1 - t]].forEach(([a, b]) => B(a, b, a + t, b + t, 0, h, col));
    const chair = (u, v, face, wd, fb) => {   // 靠背椅：(u,v) 是座位左上，face 是朝哪（'+v' 等）
      legs(u + .1, v + .1, u + .9, v + .9, 8, sh(wd, -.25), .08);
      B(u + .08, v + .08, u + .92, v + .92, 8, 10, wd);
      const back = { '+v': [u + .08, v + .08, u + .92, v + .22], '-v': [u + .08, v + .78, u + .92, v + .92], '+u': [u + .08, v + .08, u + .22, v + .92], '-u': [u + .78, v + .08, u + .92, v + .92] }[face];
      B(back[0], back[1], back[2], back[3], 10, 22, wd);
      if (fb) B(u + .18, v + .18, u + .82, v + .82, 10, 11.5, fb);
    };
    const book = (box, face, a0, a1, z0, z1) => { let a = a0, n = 0; const cols = ['#b33a2f', '#34476e', '#d4a83c', '#7d9a8c', '#e9e1cf', '#5e3c22', '#8f6aa0']; while (a < a1 - .05) { const w = .08 + hash(n, k.length) * .1, hh = z1 - z0 - (hash(k.length, n) * 3 | 0); D(box, face, a, Math.min(a1, a + w), z0, z0 + hh, cols[Math.floor(hash(n * 3, a * 10 | 0) * cols.length)]); a += w + .02; n++; } };
    const W = f.w, H = f.h;
    switch (k) {
      // ---- 床：床架、床墊、被子、枕頭、床頭板 ----
      case 'bed1': case 'bed2': case 'bed3': {
        const post = k === 'bed3';
        B(.05, .05, W - .05, H - .05, 0, 6, C.wood);
        B(.15, .35, W - .15, H - .15, 6, 10, '#f3efe6');
        const bl = B(.12, 1.5, W - .12, H - .1, 6, 10.6, C.fab); T(bl, .12, 1.5, W - .12, 1.75, sh(C.fab, .35));
        const np = k === 'bed1' ? 1 : 2; for (let i = 0; i < np; i++) { const w = (W - .5) / np; B(.3 + i * w, .45, .3 + i * w + w - .2, 1.05, 10, 12.5, '#fbf9f4'); }
        B(0, 0, W, .25, 0, post ? 18 : 15, C.wood);
        if (post) { [[0, 0], [W - .2, 0], [0, H - .2], [W - .2, H - .2]].forEach(([a, b]) => B(a, b, a + .2, b + .2, 0, 40, sh(C.wood, -.1)));
          B(0, 0, W, .15, 38, 40, sh(C.wood, -.1)); B(0, H - .15, W, H, 38, 40, sh(C.wood, -.1)); B(0, 0, .15, H, 38, 40, sh(C.wood, -.1)); B(W - .15, 0, W, H, 38, 40, sh(C.wood, -.1));
          [[.05, H - .5], [W - .25, H - .5]].forEach(([a, b]) => B(a, b, a + .2, b + .45, 12, 38, sh(C.fab, .15))); }
        break;
      }
      // ---- 燈 ----
      case 'lamp1': {   // 床頭櫃＋小檯燈（貼牆）
        const b = B(.1, .05, .9, .85, 0, 10, C.wood); D(b, '+v', .15, .85, 5.5, 6, sh(C.wood, -.3)); D(b, '+v', .45, .55, 7.5, 8, '#d4a83c');
        B(.35, .25, .65, .55, 10, 11, '#8e8070'); B(.47, .37, .53, .43, 11, 16, '#5e5a55');
        FN(.5, .4, 16, 5, (x, a, b2, nt) => { x.fillStyle = nt ? '#fff0c4' : '#f1e3c0'; x.fillRect(a - 3, b2 - 5, 6, 4); x.fillStyle = nt ? '#ffd98a' : '#d8c39a'; x.fillRect(a - 3, b2 - 1, 6, 1); });
        L(.5, .4, 18, 'warm'); break;
      }
      case 'lamp2': {   // 立燈
        B(.3, .3, .7, .7, 0, 1.5, '#4a4744'); B(.47, .47, .53, .53, 1.5, 30, '#4a4744');
        FN(.5, .5, 30, 9, (x, a, b2, nt) => { const s = C.main; x.fillStyle = sh(s, -.35); x.fillRect(a - 5, b2 - 9, 10, 1); x.fillRect(a - 5, b2, 10, 1); x.fillStyle = nt ? sh(s, .6) : sh(s, .2); x.fillRect(a - 5, b2 - 8, 10, 6); x.fillStyle = nt ? sh(s, .4) : s; x.fillRect(a - 5, b2 - 2, 10, 2); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(a - 4, b2 - 8, 2, 5); });
        L(.5, .5, 33, 'warm'); break;
      }
      case 'lamp3': {   // 弧形落地燈：底座在一角，彎過去吊一個燈罩
        B(.15, .15, .75, .75, 0, 2, '#4a4744');
        FN(.45, .45, 2, 36, (x, a, b2, nt, iso) => { const top = iso(.45, .45, 36), end = iso(1.65, .55, 31);
          x.fillStyle = '#3a3836'; x.fillRect(Math.round(a), Math.round(top[1]), 1, Math.round(b2 - top[1]));
          for (let t = 0; t <= 1; t += .04) { const px = top[0] + (end[0] - top[0]) * t, py = top[1] + (end[1] - top[1]) * t - Math.sin(t * Math.PI) * 6; x.fillRect(Math.round(px), Math.round(py), 1, 1); } });
        FN(1.65, .55, 23, 8, (x, a, b2, nt) => { const s = C.main === '#ddd0b4' ? '#efe2c4' : C.main; x.fillStyle = sh(s, -.35); x.fillRect(a - 6, b2 - 7, 12, 1); x.fillRect(a - 7, b2 - 1, 14, 1); x.fillStyle = nt ? '#fff0c4' : sh(s, .15); x.fillRect(a - 6, b2 - 6, 12, 3); x.fillStyle = nt ? '#ffd98a' : sh(s, -.1); x.fillRect(a - 7, b2 - 3, 14, 2); });
        L(1.65, .55, 23, 'warm'); break;
      }
      // ---- 櫃子 ----
      case 'store1': case 'store2': {   // 衣櫃：門、把手
        const n = k === 'store1' ? 2 : 3, b = B(.05, .05, W - .05, H - .1, 0, 36, C.wood);
        B(.02, .02, W - .02, H - .08, 36, 38, sh(C.wood, -.1));
        for (let i = 0; i < n; i++) { const a0 = .1 + i * (W - .2) / n, a1 = a0 + (W - .2) / n - .04; D(b, '+v', a0, a1, 2, 34, sh(C.wood, .08)); D(b, '+v', a1 - .12, a1 - .08, 16, 21, '#d4a83c'); }
        D(b, '+v', .05, W - .05, 0, 1.5, sh(C.wood, -.3)); break;
      }
      case 'store3': case 'store4': {   // 書櫃：前面空的，擺滿書
        const tall = k === 'store4', hh = tall ? 40 : 16, rows = tall ? 4 : 2, b = B(.05, .05, W - .05, H - .1, 0, hh, C.wood);
        D(b, '+v', .1, W - .1, 1.5, hh - 1.5, sh(C.wood, -.45));
        for (let r = 0; r < rows; r++) { const z0 = 1.5 + r * (hh - 3) / rows, z1 = z0 + (hh - 3) / rows - 1.2; book(b, '+v', .15, W - .15, z0, z1); D(b, '+v', .1, W - .1, z1, z1 + 1.2, C.wood); }
        if (!tall) { B(.25, .25, .55, .55, 16, 21, '#e9e1cf'); B(W - .7, .3, W - .3, .7, 16, 18, '#7d9a8c'); }
        break;
      }
      case 'store5': case 'store6': {   // 展示櫃：框、層板、玻璃；藏品在 render 裡擺
        const gold = k === 'store6', fr = gold ? '#d4a83c' : C.wood, hh = gold ? 30 : 17, rows = gold ? 2 : 1;
        B(.05, .05, W - .05, H - .1, 0, 2, fr); B(.05, .05, W - .05, H - .1, hh - 2, hh, fr);
        [[.05, .05], [W - .17, .05], [.05, H - .22], [W - .17, H - .22]].forEach(([a, b]) => B(a, b, a + .12, b + .12, 2, hh - 2, sh(fr, -.1)));
        B(.05, .05, W - .05, .12, 2, hh - 2, sh(fr, -.25));
        if (rows === 2) B(.12, .12, W - .12, H - .17, 14.5, 15.5, '#efe6d2');
        parts.push({ t: 'case', u0: .1, v0: .1, u1: W - .1, v1: H - .15, z0: 2, z1: hh - 2, rows, hh, gold });
        break;
      }
      // ---- 桌子、椅子 ----
      case 'table1': case 'table2': {   // 書桌／電腦桌（正面朝 +v）
        legs(.1, .1, W - .1, H - .1, 12, sh(C.wood, -.2), .12);
        const top = B(.05, .05, W - .05, H - .05, 12, 14, C.wood);
        const dr = B(W - 1.1, .15, W - .15, H - .15, 6, 12, C.wood); D(dr, '+v', .1, .9, 8.5, 9, sh(C.wood, -.3));
        if (k === 'table1') { B(.4, .2, .7, .5, 14, 15, '#5e5a55'); B(.52, .32, .58, .38, 15, 21, '#5e5a55'); FN(.55, .35, 21, 4, (x, a, b2, nt) => { x.fillStyle = nt ? '#fff0c4' : '#e8c35a'; x.fillRect(a - 3, b2 - 4, 6, 3); x.fillStyle = nt ? '#ffd98a' : '#c9a446'; x.fillRect(a - 3, b2 - 1, 6, 1); }); L(.55, .35, 22, 'warm');
          B(1.2, .35, 1.9, .8, 14, 15, '#f3efe6'); }
        else { const mon = B(.9, .15, 2.1, .3, 16, 26, '#2b2b2e'); D(mon, '+v', .05, 1.15, 17, 25, nt(night, '#8fb0e0', '#3b4a5e')); B(1.42, .2, 1.58, .35, 14, 16, '#2b2b2e'); B(1, .5, 2, .8, 14, 14.8, '#e9e3d6'); L(1.5, .4, 21, 'screen'); }
        break;
      }
      case 'table3': { legs(.15, .15, .85, .85, 8, sh(C.wood, -.2), .1); B(.1, .1, .9, .9, 8, 10, C.wood); break; }
      case 'table4': { chair(0, 0, '+v', C.wood, C.fab); break; }
      case 'table5': case 'table6': {   // 茶几
        const glass = k === 'table6';
        legs(.1, .1, W - .1, H - .1, 7, sh(C.wood, -.15), .1);
        if (glass) { B(.15, .15, W - .15, H - .15, 2, 3, C.wood); B(.05, .05, W - .05, H - .05, 7, 8, '#cfe6ea', { glass: true }); B(.6, .5, 1.1, .9, 8, 9.2, '#b33a2f'); B(W - .9, .6, W - .6, .9, 8, 10, '#f3efe6'); }
        else { B(.05, .05, W - .05, H - .05, 7, 8.5, C.wood); B(.35, .3, .65, .6, 8.5, 11, '#f3efe6'); B(1.1, .25, 1.75, .8, 8.5, 9.7, '#b33a2f'); }
        break;
      }
      case 'table7': {   // 四人方桌：桌子在中間，四邊各一張椅子
        legs(.8, .8, 3.2, 3.2, 12, sh(C.wood, -.2), .14); B(.75, .75, 3.25, 3.25, 12, 14, C.wood);
        chair(1.5, 0, '+v', C.wood); chair(1.5, 3, '-v', C.wood); chair(0, 1.5, '+u', C.wood); chair(3, 1.5, '-u', C.wood);
        B(1.7, 1.7, 2.3, 2.3, 14, 16, '#f3efe6'); break;
      }
      case 'table8': {   // 六人長桌
        legs(.6, .8, 5.4, 3.2, 12, sh(C.wood, -.2), .14); B(.55, .75, 5.45, 3.25, 12, 14, C.wood);
        [1, 2.5, 4].forEach(u => { chair(u, 0, '+v', C.wood); chair(u, 3, '-v', C.wood); });
        B(2.7, 1.7, 3.3, 2.3, 14, 18, '#c96f4a'); FN(3, 2, 18, 4, (x, a, b2) => { x.fillStyle = '#6e9a53'; x.fillRect(a - 3, b2 - 4, 6, 3); x.fillStyle = '#e8c35a'; x.fillRect(a - 1, b2 - 4, 2, 1); });
        break;
      }
      // ---- 沙發（背貼 v = 0，朝 +v）----
      case 'sofa1': case 'sofa2': case 'sofa3': case 'sofa4': case 'sofa5': {
        const fab = C.main, hi = k === 'sofa2' ? 24 : 15, seat = 6.5, arm = k === 'sofa2' ? .3 : .4, deep = k === 'sofa1' ? H : 2;
        legs(.15, .15, W - .15, deep - .15, 2, '#5e3c22', .1);
        B(.05, .05, W - .05, .55, 2, hi, fab);                                    // 靠背
        B(.05, .05, arm, deep - .05, 2, 10, fab); B(W - arm, .05, W - .05, deep - .05, 2, 10, fab);   // 扶手
        const n = { sofa1: 1, sofa2: 1, sofa3: 2, sofa4: 3, sofa5: 3 }[k], sw = (W - arm * 2) / n;
        for (let i = 0; i < n; i++) B(arm + i * sw + .02, .55, arm + (i + 1) * sw - .02, deep - .1, 2, seat, sh(fab, .05));
        if (k === 'sofa2') { B(.05, .05, .4, .9, hi - 6, hi, sh(fab, -.08)); B(W - .4, .05, W - .05, .9, hi - 6, hi, sh(fab, -.08)); }
        if (k === 'sofa4') parts.forEach(p => { if (p.t === 'box' && p.z1 >= seat) p.shine = true; });
        if (k === 'sofa5') { B(W - 1.6, deep - .1, W - .05, H - .05, 2, seat, sh(fab, .05)); B(W - arm, deep - .1, W - .05, H - .05, 2, 10, fab); B(W - 1.6, H - .3, W - arm, H - .05, 2, 9, fab); }
        if (k === 'sofa3' || k === 'sofa4' || k === 'sofa5') B(arm + .15, .55, arm + .75, .9, seat, seat + 5, '#e8c35a');
        break;
      }
      // ---- 電視櫃 ----
      case 'tv1': case 'tv2': {
        const big = k === 'tv2', cab = C.a === '黑' ? '#3d3b38' : C.wood, b = B(.05, .05, W - .05, H - .1, 0, 9, cab);
        const nd = big ? 4 : 3; for (let i = 1; i < nd; i++) D(b, '+v', i * (W - .1) / nd, i * (W - .1) / nd + .04, 1, 8, sh(cab, -.3));
        for (let i = 0; i < nd; i++) D(b, '+v', (i + .5) * (W - .1) / nd - .03, (i + .5) * (W - .1) / nd + .03, 5, 6, '#d4a83c');
        const tw = big ? 3 : 1.9, t0 = (W - tw) / 2, tv = B(t0, .2, t0 + tw, .45, big ? 10 : 10, big ? 30 : 24, '#232326');
        D(tv, '+v', t0 + .1, t0 + tw - .1, big ? 11.5 : 11.5, big ? 28.5 : 22.5, nt(night, '#8fb0e0', '#3b4a5e'));
        if (!night) D(tv, '+v', t0 + .2, t0 + .6, big ? 24 : 19, big ? 28 : 22, '#55677e');
        B(W / 2 - .12, .25, W / 2 + .12, .45, 9, 10, '#232326'); L(W / 2, .5, big ? 20 : 17, 'screen');
        if (big) [.15, W - .55].forEach(a => { const sp = B(a, .1, a + .4, .5, 9, 24, '#2b2b2e'); D(sp, '+v', .1, .3, 12, 15, '#555'); D(sp, '+v', .1, .3, 17, 21, '#555'); });
        else B(.25, .25, .6, .6, 9, 13, '#e9e3d6');
        break;
      }
      // ---- 地毯（平的）----
      case 'rug1': case 'rug3': {
        const r = B(0, 0, W, H, 0, .6, '#e9dcc3', { flat: true });
        T(r, .2, .2, W - .2, H - .2, C.main); T(r, .55, .55, W - .55, H - .55, sh(C.main, -.15));
        if (k === 'rug1') for (let i = 0; i < 8; i++) T(r, .55 + (W - 1.1) * i / 8, H / 2 - .25, .55 + (W - 1.1) * i / 8 + .12, H / 2 + .25, sh(C.main, .35));
        else for (let j = 1; j < 6; j++) T(r, .55, j * H / 6 - .05, W - .55, j * H / 6 + .05, sh(C.main, .3));
        break;
      }
      case 'rug2': parts.push({ t: 'disc', u0: 0, v0: 0, u1: W, v1: H, z0: 0, z1: .6, col: C.main }); break;
      // ---- 植物 ----
      case 'plant1': B(.25, .25, .75, .75, 0, 7, '#c96f4a'); FN(.5, .5, 7, 12, (x, a, b2) => { [[0, -9], [-4, -6], [4, -5], [-2, -12], [3, -10], [0, -4]].forEach(([u, v], i) => { x.fillStyle = i % 2 ? '#4f7a3e' : '#6e9a53'; x.fillRect(a + u - 2, b2 + v, 4, 3); x.fillStyle = '#3b5e2e'; x.fillRect(a + u - 2, b2 + v + 2, 4, 1); }); }); break;
      case 'plant2': B(.25, .25, .75, .75, 0, 7, '#d9cfbf'); B(.46, .46, .54, .54, 7, 14, '#6e4528');
        FN(.5, .5, 14, 14, (x, a, b2) => { for (let yy = -7; yy <= 7; yy++) for (let xx = -7; xx <= 7; xx++) if (xx * xx + yy * yy <= 50) { x.fillStyle = yy < -2 ? '#6e9a53' : yy < 3 ? '#4f7a3e' : '#3b5e2e'; x.fillRect(a + xx, b2 - 7 + yy, 1, 1); }
          [[-3, -9], [3, -6], [-4, -3], [2, -1], [5, -10], [0, -5]].forEach(([u, v]) => { x.fillStyle = '#f08a2c'; x.fillRect(a + u, b2 + v, 2, 2); x.fillStyle = '#ffc07a'; x.fillRect(a + u, b2 + v, 1, 1); }); }); break;
      case 'plant3': B(.55, .55, 1.45, 1.45, 0, 8, '#efe9dc');
        FN(1, 1, 8, 26, (x, a, b2) => {
          [[-7, -8], [6, -10], [-2, -18], [5, -21], [-8, -19], [1, -27], [9, -16]].forEach(([u, v]) => { for (let q = 0; q <= 8; q++) { x.fillStyle = '#3b5e2e'; x.fillRect(Math.round(a + u * q / 8), Math.round(b2 + v * q / 8), 1, 1); } });
          [[1, -27, 0], [-8, -19, 1], [5, -21, 0], [9, -15, 1], [-2, -17, 0], [-7, -8, 1], [6, -9, 0]].forEach(([u, v, s], n) => { const cx = a + u, cy = b2 + v;
            for (let yy = -4; yy <= 4; yy++) for (let xx = -6; xx <= 6; xx++) { const e = xx * xx / 36 + yy * yy / 16; if (e > 1) continue; if (Math.abs(xx) > 2 && Math.abs(yy) > 1 && (Math.abs(xx) + n) % 4 === 0 && e > .5) continue;
              x.fillStyle = xx === 0 ? '#3b5e2e' : yy < -1 ? (s ? '#8ab86a' : '#6e9a53') : yy < 2 ? (s ? '#6e9a53' : '#4f7a3e') : '#3b5e2e'; x.fillRect(cx + xx, cy + yy, 1, 1); } }); }); break;
      // ---- 廚房（貼牆，正面朝 +v）----
      case 'kitchen1': case 'kitchen2': case 'kitchen3': {
        const b = B(.05, .05, W - .05, H - .1, 0, 15, '#ece7dc'); B(0, 0, W, H - .05, 15, 16.5, '#9a948a');
        const nd = W; for (let i = 0; i < nd; i++) { D(b, '+v', i + .1, i + .9, 2, 13, '#f6f3ec'); D(b, '+v', i + .45, i + .55, 10, 11, '#8e8070'); }
        D(b, '+v', .05, W - .05, 0, 1.5, '#5a554e');
        if (k === 'kitchen1') { B(.3, .25, 1.2, .75, 16.5, 17.3, '#d4a373'); B(2, .3, 2.5, .6, 16.5, 22, '#e9e3d6'); }
        if (k === 'kitchen2') { const top = parts[1]; T(top, .15, .2, .85, .75, '#c8c4bc'); T(top, .2, .25, .8, .7, '#a9a49b'); B(.45, .05, .55, .2, 16.5, 23, '#c3c8c9'); B(.45, .05, .55, .45, 22, 23, '#c3c8c9'); }
        if (k === 'kitchen3') { const top = parts[1]; T(top, .1, .15, .9, .85, '#2e2d2c'); [[.3, .3], [.7, .3], [.3, .65], [.7, .65]].forEach(([u, v]) => T(top, u - .1, v - .08, u + .1, v + .08, '#55524f')); D(b, '+v', .15, .85, 4, 11, '#2e2d2c'); }
        break;
      }
      case 'kitchen4': case 'kitchen5': {   // 冰箱
        const two = k === 'kitchen5', col = C.main === WOOD.白 || C.a === '白' ? '#eceae4' : C.a === '黑' ? '#3a3a3d' : C.wood, hh = two ? 36 : 32, b = B(.05, .05, W - .05, H - .1, 0, hh, col);
        if (two) { D(b, '+v', W / 2 - .02, W / 2 + .02, 1, hh - 1, sh(col, -.3)); D(b, '+v', W / 2 - .15, W / 2 - .1, 12, 24, '#b9b4ab'); D(b, '+v', W / 2 + .1, W / 2 + .15, 12, 24, '#b9b4ab'); }
        else { D(b, '+v', .05, W - .05, hh * .62, hh * .62 + .8, sh(col, -.3)); D(b, '+v', W - .2, W - .15, hh * .68, hh * .9, '#b9b4ab'); D(b, '+v', W - .2, W - .15, hh * .3, hh * .55, '#b9b4ab'); }
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

  // ---------- 畫一間 ----------
  // opt.z 放大幾倍、opt.night、opt.ghost { k, c, rot, room, x, y, bad }、opt.hide（移動中那件不畫）、opt.canvas
  const shellCache = new Map();
  function render(s, fi, rid, opt = {}) {
    const R = roomInfo(s, fi, rid); if (!R) return null;
    const { r, OX, OY, W, H } = R, night = !!opt.night, z = Math.max(1, Math.round(opt.z || 1)), st = X.styleOf(s, r.id);
    const iso = (i, j, zz = 0) => [OX + (i - j) * TW, OY + (i + j) * TH - zz];
    const cv = opt.canvas || document.createElement('canvas'); if (cv.width !== W * z || cv.height !== H * z) { cv.width = W * z; cv.height = H * z; }
    const x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.imageSmoothingEnabled = false;
    const q = (pts, col) => poly(x, pts, col);
    const hits = [];   // 點選用：每一件畫出來的多邊形

    // 房間的門窗（給殼和點選用）
    const pics = X.placedIn(s, r.id).filter(t => X.FURN[t.key].kind === 'pic').map(t => [t.at[0], t.at[0] + X.FURN[t.key].w]);
    const tent = X.level(s, 'house') === 1;   // 帳篷：牆是帆布、沒有窗
    const winN = []; if (!tent) for (let c = 1; c + 2 <= r.w - 1; c += 6) if (!pics.some(([a, b]) => c < b + .5 && a < c + 2.5)) winN.push(c);
    const mid = Math.floor(r.h / 2), doorW = R.idx > 0 ? [mid - 1.2, mid + 1.2] : null, doorE = R.idx < R.n - 1 ? [mid - 1.2, mid + 1.2] : null;
    const doorS = R.fi === 0 && r.id === 'main' ? [r.w / 2 - .8, r.w / 2 + .8] : null;
    const winW = []; if (R.idx === 0 && !tent) for (let c = 1; c + 2 <= r.h - 1; c += 6) winW.push(c);

    // 1. 殼：背景、底座、地板、兩道牆（一顆一顆，存起來）
    const key = [r.id, r.w, r.h, st.floor, st.paper, R.idx, R.n, R.fi, tent, JSON.stringify(r.block || [])].join('|');
    let shell = shellCache.get(key);
    if (!shell) {
      shell = document.createElement('canvas'); shell.width = W; shell.height = H; const sx = shell.getContext('2d'), img = sx.createImageData(W, H), d = img.data;
      const put = (px, py, col) => { const k = (py * W + px) * 4, [a, b, c2] = hex(col); d[k] = a; d[k + 1] = b; d[k + 2] = c2; d[k + 3] = 255; };
      const paper = PAPER[st.paper] || PAPER[0];
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const a = (px + .5 - OX) / TW, b = (py + .5 - OY) / TH, i = (a + b) / 2, j = (b - a) / 2;
        if (i >= 0 && j >= 0 && i < r.w && j < r.h) { put(px, py, floorPx(st.floor, i, j, px, py)); continue; }
        // 牆面：左牆在 x = 0（沿 y）、右牆在 y = 0（沿 x）
        let along, zz, side;
        if (px + .5 <= OX) { along = (OX - px - .5) / TW; zz = OY + along * TH - (py + .5); side = 'L'; if (along > r.h) continue; }
        else { along = (px + .5 - OX) / TW; zz = OY + along * TH - (py + .5); side = 'R'; if (along > r.w) continue; }
        if (zz < 0 || zz > WH) continue;
        const sA = Math.round(along * TW);
        let col = tent ? (sA % 18 === 0 ? '#c9b88f' : zz > WH - 8 ? '#d9c9a2' : hash(sA, Math.round(zz)) > .97 ? '#dccca8' : '#e6d8b5') : paper(sA, Math.round(zz));
        if (side === 'R') col = sh(col, -.06);
        if (!tent && zz < 4) col = zz < 1 ? '#5e3c22' : zz > 3 ? '#9a6a40' : '#7c5230';
        if (zz > WH - 2) col = '#d8ccb3';
        put(px, py, col);
      }
      sx.putImageData(img, 0, 0);
      shellCache.set(key, shell); if (shellCache.size > 30) shellCache.delete(shellCache.keys().next().value);
    }
    x.fillStyle = night ? '#141826' : '#efe9de'; x.fillRect(0, 0, W * z, H * z);
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
    // 地板和牆中間那條（牆厚的切面）
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
    if (!night) { x.save(); x.globalAlpha = .2;
      winN.forEach(c => q([iso(c + .2, .1), iso(c + 1.9, .1), iso(c + 3.2, 3.4), iso(c + 1.5, 3.4)], '#fff6d8'));
      winW.forEach(c => { if (!doorW || c + 2 < doorW[0] || c > doorW[1]) q([iso(.1, c + .2), iso(.1, c + 1.9), iso(2.6, c + 2.9), iso(2.6, c + 1.2)], '#fff6d8'); });
      x.restore(); }
    // 西牆的門（往左邊那間）
    if (doorW) { const [a0, a1] = doorW; q([onWl(a0 - .1, 0), onWl(a1 + .1, 0), onWl(a1 + .1, 32), onWl(a0 - .1, 32)], '#5e3c22'); q([onWl(a0, 0), onWl(a1, 0), onWl(a1, 31), onWl(a0, 31)], '#8a5a36');
      q([onWl(a0 + .15, 3), onWl(a1 - .15, 3), onWl(a1 - .15, 14), onWl(a0 + .15, 14)], '#7c5230'); q([onWl(a0 + .15, 17), onWl(a1 - .15, 17), onWl(a1 - .15, 28), onWl(a0 + .15, 28)], '#7c5230');
      const [ka, kb] = onWl(a1 - .35, 15); x.fillStyle = '#d4a83c'; x.fillRect(Math.round(ka), Math.round(kb), 1, 2); }
    // 樓梯（block）
    (r.block || []).forEach(([bx, by, bw, bh]) => { const n = bh * 2; for (let k2 = n - 1; k2 >= 0; k2--) { const y0 = by + bh - (k2 + 1) * .5, hz = (k2 + 1) * 3.5;
      const p = { x0: bx, x1: bx + bw, y0, y1: y0 + .5 };
      q([iso(p.x0, p.y1, 0), iso(p.x1, p.y1, 0), iso(p.x1, p.y1, hz), iso(p.x0, p.y1, hz)], '#9a6a40'); q([iso(p.x1, p.y0, 0), iso(p.x1, p.y1, 0), iso(p.x1, p.y1, hz), iso(p.x1, p.y0, hz)], '#7c5230');
      q([iso(p.x0, p.y0, hz), iso(p.x1, p.y0, hz), iso(p.x1, p.y1, hz), iso(p.x0, p.y1, hz)], '#c48d5c'); q([iso(p.x0, p.y1, hz), iso(p.x1, p.y1, hz), iso(p.x1, p.y1, hz - 1), iso(p.x0, p.y1, hz - 1)], '#d9a670'); } });

    // 2. 掛畫（北牆）
    const placed = X.placedIn(s, r.id).filter(t => t.id !== opt.hide);
    function drawPic(k, at0, alpha) {
      const f = X.FURN[k], a0 = at0 + .1, a1 = at0 + f.w - .1, z0 = 20, z1 = 34; if (alpha != null) x.globalAlpha = alpha;
      const pts = [onN(a0, z0), onN(a1, z0), onN(a1, z1), onN(a0, z1)];
      q(pts, '#d4a83c'); q([onN(a0, z0 - 1), onN(a1, z0 - 1), onN(a1, z0), onN(a0, z0)], '#a77f25');
      if (k === 'pic1') { q([onN(a0 + .12, z0 + 2), onN(a1 - .12, z0 + 2), onN(a1 - .12, z1 - 2), onN(a0 + .12, z1 - 2)], '#bfe0ea'); q([onN(a0 + .12, z0 + 2), onN(a1 - .12, z0 + 2), onN(a1 - .12, z0 + 6), onN(a0 + .12, z0 + 6)], '#8fb36a');
        q([onN(a0 + .4, z0 + 6), onN(a0 + .9, z1 - 4), onN(a0 + 1.4, z0 + 6)], '#7d8fa0'); q([onN(a0 + .75, z1 - 5), onN(a0 + .9, z1 - 4), onN(a0 + 1.05, z1 - 5)], '#ffffff'); const [a, b] = onN(a1 - .4, z1 - 4); x.fillStyle = '#f2c14e'; x.fillRect(Math.round(a) - 1, Math.round(b) - 1, 3, 3); }
      else { q([onN(a0 + .1, z0 + 2), onN(a1 - .1, z0 + 2), onN(a1 - .1, z1 - 2), onN(a0 + .1, z1 - 2)], '#3a2f4a');
        if (COLL) { const s0 = X.COLL.c_raccoon.d, [a, b] = onN((a0 + a1) / 2, (z0 + z1) / 2); x.save(); x.imageSmoothingEnabled = true; x.drawImage(COLL, s0[0], s0[1], 24, 24, a - 5, b - 5, 10, 10); x.restore(); } }
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
    // 影子（地毯以外，先全部畫）
    x.save(); x.fillStyle = 'rgba(40,28,18,.18)';
    items.filter(it => !it.rug && !it.ghost).forEach(it => { const b = it.wb, s2 = .22, sm = ['lamp2', 'lamp3', 'plant1', 'plant2', 'plant3'].includes(it.t.key) ? .3 : .06;
      poly(x, [iso(b.x0 + sm + s2, b.y0 + sm + s2 * .4), iso(b.x1 - sm + s2, b.y0 + sm + s2 * .4), iso(b.x1 - sm + s2, b.y1 - sm + s2), iso(b.x0 + sm + s2, b.y1 - sm + s2)], 'rgba(40,28,18,.18)'); });
    x.restore();
    const rugs = items.filter(it => it.rug), objs = depthSort(items.filter(it => !it.rug));
    // 預覽的地上框：綠白、紅
    function footprint(it) { const b = it.wb, pts = [iso(b.x0, b.y0), iso(b.x1, b.y0), iso(b.x1, b.y1), iso(b.x0, b.y1)];
      x.save(); x.globalAlpha = .35; poly(x, pts, it.ghost && opt.ghost.bad ? '#b33a2f' : '#ffffff'); x.restore();
      x.save(); x.strokeStyle = opt.ghost.bad ? '#b33a2f' : '#ffffff'; x.lineWidth = 1; x.setLineDash([2, 2]); x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.stroke(); x.restore(); }
    [...rugs, ...objs].forEach(it => {
      if (it.ghost) { footprint(it); x.globalAlpha = .7; }
      const shapes = drawItem(it);
      x.globalAlpha = 1;
      if (!it.ghost) hits.push({ id: it.t.id, pts: shapes, rug: it.rug });
    });
    function drawItem(it) {
      const { tf, bd, rot, t } = it, P = (u, v, zz) => { const [a, b] = tf(u, v); return iso(a, b, zz); }, shapes = [];
      const vis = face => { const n = NORMAL[face][rot]; return n === '+x' || n === '+y'; };
      const list = bd.parts.map(p => Object.assign({ wb: worldBox(p, tf) }, p));
      depthSort(list).forEach(p => {
        const b = p.wb;
        if (p.t === 'box') {
          const glass = p.glass, top = [iso(b.x0, b.y0, b.z1), iso(b.x1, b.y0, b.z1), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)];
          const fy = [iso(b.x0, b.y1, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)], fx = [iso(b.x1, b.y0, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x1, b.y0, b.z1)];
          if (glass) { x.save(); x.globalAlpha = (x.globalAlpha || 1) * .5; }
          q(fy, p.col); q(fx, sh(p.col, -.16)); q(top, sh(p.col, .14));
          if (p.shine) { const [a, c] = iso((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z1); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(Math.round(a) - 2, Math.round(c), 4, 1); }
          if (glass) x.restore();
          (p.top || []).forEach(d => q([P(d.u0, d.v0, b.z1), P(d.u1, d.v0, b.z1), P(d.u1, d.v1, b.z1), P(d.u0, d.v1, b.z1)], d.col));
          (p.dec || []).forEach(d => { if (!vis(d.face)) return; let pts;
            if (d.face === '+v' || d.face === '-v') { const v = d.face === '+v' ? p.v1 : p.v0; pts = [P(d.a0, v, d.z0), P(d.a1, v, d.z0), P(d.a1, v, d.z1), P(d.a0, v, d.z1)]; }
            else { const u = d.face === '+u' ? p.u1 : p.u0; pts = [P(u, d.a0, d.z0), P(u, d.a1, d.z0), P(u, d.a1, d.z1), P(u, d.a0, d.z1)]; }
            const fn = NORMAL[d.face][rot]; q(pts, fn === '+x' ? sh(d.col, -.12) : d.col); });
          shapes.push(top, fy, fx);
        } else if (p.t === 'fn') { const [a, c] = P(p.u, p.v, p.z); p.draw(x, Math.round(a), Math.round(c), night, (u, v, zz) => P(u, v, zz)); shapes.push([[a - 8, c - (p.z1 - p.z0) - 4], [a + 8, c - (p.z1 - p.z0) - 4], [a + 8, c + 3], [a - 8, c + 3]]); }
        else if (p.t === 'disc') { const pts = [], cx = (p.u0 + p.u1) / 2, cy = (p.v0 + p.v1) / 2, rr = (p.u1 - p.u0) / 2; for (let k2 = 0; k2 < 32; k2++) { const th = k2 / 32 * Math.PI * 2; pts.push(P(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr, .6)); }
          const ring = f => pts.map(([a, c]) => { const [ca, cc] = P(cx, cy, .6); return [ca + (a - ca) * f, cc + (c - cc) * f]; });
          q(ring(1), '#e9dcc3'); q(ring(.9), p.col); q(ring(.6), sh(p.col, -.15)); q(ring(.35), sh(p.col, .3)); q(ring(.25), p.col); shapes.push(ring(1)); }
        else if (p.t === 'case') {   // 展示櫃：藏品擺在層板上，外面一層玻璃
          const hold = X.HOLD[t.key], list2 = t.id === '_ghost' ? [] : X.caseItems(s, t.id), per = Math.ceil(hold.n / p.rows);
          list2.forEach(itm => { const row = Math.floor(itm.at / per), col = itm.at % per, u = p.u0 + (col + .5) * (p.u1 - p.u0) / per, v = (p.v0 + p.v1) / 2, zz = p.z0 + 1 + row * (p.hh - 4) / p.rows;
            const [a, c] = P(u, v, zz), cdat = X.COLL[itm.key];
            if (cdat.r !== 'n') { x.fillStyle = X.RARE[cdat.r][1]; x.fillRect(Math.round(a) - 3, Math.round(c), 7, 1); }
            if (COLL) { x.save(); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; const sz = p.gold ? 9 : 10; x.drawImage(COLL, cdat.d[0], cdat.d[1], cdat.d[2], cdat.d[3], a - sz / 2, c - sz + .5, sz, sz); x.restore(); } });
          // 玻璃：看得到的兩面＋頂
          x.save(); x.globalAlpha = .28;
          q([iso(b.x0, b.y1, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)], '#d6eef2'); q([iso(b.x1, b.y0, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x1, b.y0, b.z1)], '#c3e2e8');
          x.globalAlpha = .5; for (let k2 = 0; k2 < 3; k2++) { const s0 = b.x0 + (k2 + .3) * (b.x1 - b.x0) / 3; q([iso(s0, b.y1, b.z0 + 2), iso(s0 + .08, b.y1, b.z0 + 2), iso(s0 - .04, b.y1, b.z1 - 2), iso(s0 - .12, b.y1, b.z1 - 2)], '#ffffff'); }
          x.restore();
          if (night) emit.push(() => { x.save(); x.globalCompositeOperation = 'lighter'; x.globalAlpha = .22; q([iso(b.x0, b.y1, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)], '#ffd98a'); x.restore(); });
          lights.push({ at: iso((b.x0 + b.x1) / 2, b.y1, (b.z0 + b.z1) / 2), kind: 'case' });
        }
      });
      bd.lights.forEach(l => lights.push({ at: P(l.u, l.v, l.z), kind: l.kind }));
      return shapes;
    }

    // 4. 前面兩道矮牆（剖開的牆）；有門的地方留空
    const lowWall = (x0, y0, x1, y1, hz, c1, c2) => { q([iso(x0, y1, 0), iso(x1, y1, 0), iso(x1, y1, hz), iso(x0, y1, hz)], c1); q([iso(x1, y0, 0), iso(x1, y1, 0), iso(x1, y1, hz), iso(x1, y0, hz)], c2); q([iso(x0, y0, hz), iso(x1, y0, hz), iso(x1, y1, hz), iso(x0, y1, hz)], '#e9dfca'); };
    const segs = (len, gap) => gap ? [[0, gap[0]], [gap[1], len]] : [[0, len]];
    segs(r.w, doorS).forEach(([a, b]) => lowWall(a - (a === 0 ? WT : 0), r.h, b, r.h + WT, 5, '#cbbd9f', '#bfb08f'));
    segs(r.h, doorE).forEach(([a, b]) => lowWall(r.w, a - (a === 0 ? WT : 0), r.w + WT, b + (b === r.h ? WT : 0), 5, '#cbbd9f', '#bfb08f'));
    if (doorS) { const [a0, a1] = doorS; q([iso(a0, r.h + WT + .05), iso(a1, r.h + WT + .05), iso(a1, r.h + WT + .7), iso(a0, r.h + WT + .7)], '#8e8070'); }

    // 5. 夜晚：整間調暗，燈亮起來
    if (night) {
      x.save(); x.globalCompositeOperation = 'multiply'; x.fillStyle = '#5b6189'; x.fillRect(0, 0, W, H); x.restore();
      const glow = (a, b, rad, col, al) => { const gr = x.createRadialGradient(a, b, 0, a, b, rad); gr.addColorStop(0, `rgba(${col},${al})`); gr.addColorStop(1, `rgba(${col},0)`); x.fillStyle = gr; x.fillRect(a - rad, b - rad, rad * 2, rad * 2); };
      x.save(); x.globalCompositeOperation = 'lighter';
      lights.forEach(l => { const [a, b] = l.at; if (l.kind === 'warm') { glow(a, b + 14, 44, '255,196,110', .4); glow(a, b, 9, '255,230,170', .7); } else if (l.kind === 'screen') glow(a, b + 6, 28, '120,160,230', .3); else glow(a, b, 24, '255,210,130', .25); });
      winN.forEach(c => { const [a, b] = onN(c + 1, 26); glow(a, b, 20, '150,175,230', .16); });
      x.restore();
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
      const on = (i, zz) => iso(i, 0, zz), a0 = .1, a1 = f.w - .1, z0 = 8, z1 = 22;
      poly(x, [on(a0, z0), on(a1, z0), on(a1, z1), on(a0, z1)], '#d4a83c');
      poly(x, [on(a0 + .12, z0 + 2), on(a1 - .12, z0 + 2), on(a1 - .12, z1 - 2), on(a0 + .12, z1 - 2)], k === 'pic1' ? '#bfe0ea' : '#3a2f4a');
      if (k === 'pic1') poly(x, [on(a0 + .12, z0 + 2), on(a1 - .12, z0 + 2), on(a1 - .12, z0 + 6), on(a0 + .12, z0 + 6)], '#8fb36a');
    } else {
      const bd = build(k, c, false), tf = xform(0, 0, 0, f.w, f.h), P = (u, v, zz) => { const [a, b] = tf(u, v); return iso(a, b, zz); };
      const list = depthSort(bd.parts.map(p => Object.assign({ wb: worldBox(p, tf) }, p)));
      list.forEach(p => { const b = p.wb;
        if (p.t === 'box') { if (p.glass) { x.save(); x.globalAlpha = .5; }
          poly(x, [iso(b.x0, b.y1, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)], p.col); poly(x, [iso(b.x1, b.y0, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x1, b.y0, b.z1)], sh(p.col, -.16)); poly(x, [iso(b.x0, b.y0, b.z1), iso(b.x1, b.y0, b.z1), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)], sh(p.col, .14));
          if (p.glass) x.restore();
          (p.top || []).forEach(d => poly(x, [P(d.u0, d.v0, b.z1), P(d.u1, d.v0, b.z1), P(d.u1, d.v1, b.z1), P(d.u0, d.v1, b.z1)], d.col));
          (p.dec || []).forEach(d => { if (d.face !== '+v' && d.face !== '+u') return; const pts = d.face === '+v' ? [P(d.a0, p.v1, d.z0), P(d.a1, p.v1, d.z0), P(d.a1, p.v1, d.z1), P(d.a0, p.v1, d.z1)] : [P(p.u1, d.a0, d.z0), P(p.u1, d.a1, d.z0), P(p.u1, d.a1, d.z1), P(p.u1, d.a0, d.z1)]; poly(x, pts, d.face === '+u' ? sh(d.col, -.12) : d.col); }); }
        else if (p.t === 'fn') { const [a, cc] = P(p.u, p.v, p.z); p.draw(x, Math.round(a), Math.round(cc), false, P); }
        else if (p.t === 'disc') { const pts = []; for (let k2 = 0; k2 < 32; k2++) { const th = k2 / 32 * Math.PI * 2; pts.push(P(f.w / 2 + Math.cos(th) * f.w / 2, f.h / 2 + Math.sin(th) * f.h / 2, .6)); } poly(x, pts, p.col); }
        else if (p.t === 'case') { x.save(); x.globalAlpha = .3; poly(x, [iso(b.x0, b.y1, b.z0), iso(b.x1, b.y1, b.z0), iso(b.x1, b.y1, b.z1), iso(b.x0, b.y1, b.z1)], '#d6eef2'); x.restore(); } });
    }
    // 切掉四周空白
    const d = x.getImageData(0, 0, cv.width, cv.height).data; let a0 = cv.width, a1 = -1, b0 = cv.height, b1 = -1;
    for (let yy = 0; yy < cv.height; yy++) for (let xx = 0; xx < cv.width; xx++) if (d[(yy * cv.width + xx) * 4 + 3] > 10) { if (xx < a0) a0 = xx; if (xx > a1) a1 = xx; if (yy < b0) b0 = yy; if (yy > b1) b1 = yy; }
    const out = document.createElement('canvas'); out.width = Math.max(1, a1 - a0 + 3); out.height = Math.max(1, b1 - b0 + 3); out.getContext('2d').drawImage(cv, 1 - a0, 1 - b0);
    const res = { url: out.toDataURL(), w: out.width / 2, h: out.height / 2 }; thumbCache.set(id, res); return res;
  }

  root.XiaodaoIso = { load, render, thumb, roomInfo, TW, TH, WH };
})(window);
