// 我的小島：畫整座島（精緻像素風，照 docs/plans/jiayuan/island-stages.html 定稿的畫法）。
// 地形、樹、小路都畫在一塊像素陣列（不用 fillRect 一顆一顆畫，手機才不會卡），最後一次貼上；設施是從設計圖裁好的 png（assets/xiaodao/）。
// 用法：XiaodaoDraw.load().then(() => { const out = XiaodaoDraw.render(state); out.canvas … })
(function (root) {
  'use strict';
  const X = root.XiaodaoRules, C = X.C, WW = X.GW * C, HH = X.GH * C, hash = X.hash, TAU = Math.PI * 2;
  const K = {
    g1: '#97ad6f', g2: '#86a061', g3: '#a6bb7c', g4: '#738d51', sand: '#e6d3a3', sand2: '#d8c18b', sand3: '#efe0b8',
    sea: '#3fb0c9', sea2: '#5ec8d6', shallow: '#9ee6dc', foam: '#f4fcfa', deep: '#2b93b8',   // 2026-11-24 使用者要海開朗一點：從灰藍綠換成清澈的土耳其藍
    leaf1: '#5d7c43', leaf2: '#4a6634', leaf3: '#7a9a55', leafHi: '#9cb96f',
    stone: '#a39b8e', stone2: '#8b8377', stone3: '#bdb6aa', shadow: 'rgba(30,40,30,.24)',
  };
  const LV = [['#97ad6f', '#86a061', '#a6bb7c'], ['#a4b877', '#94aa68', '#b2c487'], ['#b1c282', '#a1b574', '#c0ce93'], ['#bfcd92', '#afc083', '#ccd8a2']];

  // ---------- 像素陣列 ----------
  const colCache = new Map();
  function rgba(c) {
    let v = colCache.get(c); if (v) return v;
    if (c[0] === '#') v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 1];
    else { const m = c.match(/[\d.]+/g).map(Number); v = [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; }
    colCache.set(c, v); return v;
  }
  function Buf(W, H) { this.W = W; this.H = H; this.d = new Uint8ClampedArray(W * H * 4); }
  Buf.prototype.P = function (x, y, c) {
    x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const [r, g, b, a] = rgba(c), k = (y * this.W + x) * 4, d = this.d;
    if (a >= 1) { d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = 255; return; }
    d[k] = d[k] * (1 - a) + r * a; d[k + 1] = d[k + 1] * (1 - a) + g * a; d[k + 2] = d[k + 2] * (1 - a) + b * a; d[k + 3] = 255;
  };
  Buf.prototype.R = function (x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.P(x + i, y + j, c); };
  Buf.prototype.circ = function (cx, cy, r, c) { for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r + r * .6) this.P(cx + xx, cy + yy, c); };

  function blur(m, W, H, r) {
    const t = new Float32Array(W * H);
    for (let j = 0; j < H; j++) { let s = 0; for (let i = -r; i <= r; i++) s += m[j * W + Math.min(W - 1, Math.max(0, i))]; for (let i = 0; i < W; i++) { t[j * W + i] = s / (2 * r + 1); s += m[j * W + Math.min(W - 1, i + r + 1)] - m[j * W + Math.max(0, i - r)]; } }
    for (let i = 0; i < W; i++) { let s = 0; for (let j = -r; j <= r; j++) s += t[Math.min(H - 1, Math.max(0, j)) * W + i]; for (let j = 0; j < H; j++) { m[j * W + i] = s / (2 * r + 1); s += t[Math.min(H - 1, j + r + 1) * W + i] - t[Math.max(0, j - r) * W + i]; } }
  }
  function vnoise(a, b, g, seed) { const i = Math.floor(a / g), j = Math.floor(b / g), u = a / g - i, v = b / g - j, h = (p, q) => hash(p + seed, q);
    return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v; }

  // 地形：陸地有高低（梯田），設施和小路底下整平（occ），高的地方靠海變岩岸；海照離岸遠近分深淺
  function terrain(B, land, occ, seed) {
    const W = B.W, H = B.H, GW = X.GW, m = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) m[j * W + i] = land[Math.floor(j / C) * GW + Math.floor(i / C)];
    blur(m, W, H, 9); blur(m, W, H, 9);
    const inner = Float32Array.from(m); blur(inner, W, H, 22);
    const lv = new Int8Array(W * H).fill(-1), F = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, m0 = m[k], amp = .25 + .75 * Math.min(1, m0 * 4);
      F[k] = m0 + ((vnoise(i, j, 9, seed) - .5) * .12 + (vnoise(i, j, 26, seed + 9) - .5) * .16) * amp;
      if (F[k] >= .5) { const h = (vnoise(i, j, 64, seed + 3) * .65 + vnoise(i, j, 23, seed + 5) * .35) * Math.min(1, inner[k] * 1.6) * (1 - occ[k]); lv[k] = h < .3 ? 0 : h < .42 ? 1 : h < .53 ? 2 : 3; }
    }
    const L = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? -1 : lv[j * W + i];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, n = hash(i + seed, j), f = F[k], d = (hash(j, i + seed) - .5) * .05; let c;
      if (f >= .5) {
        const l = lv[k], beach = f + d < .68;
        if (beach) c = l >= 2 ? (n > .6 ? K.stone : n > .3 ? K.stone2 : K.stone3) : (n > .85 ? K.sand3 : n < .2 ? K.sand2 : K.sand);
        else {
          const p = LV[Math.max(0, l)]; c = n > .9 ? p[2] : n > .72 ? p[1] : n < .04 ? '#738d51' : p[0];
          if (l === 0 && n > .993) c = ['#f0b8b0', '#f1d36b', '#ffffff'][Math.floor(hash(j, i) * 3)];
          if (L(i, j - 1) >= 0 && L(i, j - 1) > l) c = (L(i, j - 2) > l) ? '#7d6a45' : '#64804a';
          else if (L(i, j - 3) > l && L(i, j - 1) <= l) c = p[1];
          if (L(i - 1, j) > l) c = '#7f9455';
          if (L(i + 1, j) >= 0 && L(i + 1, j) < l || L(i, j + 1) >= 0 && L(i, j + 1) < l) { if (L(i, j + 1) < l) c = '#9a8558'; }
          if ((L(i, j - 1) >= 0 && L(i, j - 1) < l) || (L(i - 1, j) >= 0 && L(i - 1, j) < l)) c = '#cfdaa2';
        }
      }
      else if (f > .45) c = K.foam;
      else if (f + d > .3) c = (f + d < .34 && (i + j) % 2) ? K.sea2 : K.shallow;
      else if (f + d > .13) c = K.sea2;
      else if (f + d > .03) c = ((f + d < .045) && (i + j) % 2) ? K.deep : K.sea;
      else c = K.deep;
      if (f < .45 && n > .996) c = K.foam;
      B.P(i, j, c);
    }
    return { F, lv };
  }
  function tree(B, a, b, r) {
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) B.P(a + xx + 3, b + yy + 3, K.shadow);
    B.circ(a, b, r, K.leaf2); B.circ(a - 1, b - 1, r - 1, K.leaf1); B.circ(a - 2, b - 2, Math.max(1, r - 3), K.leaf3); B.P(a - r / 2, b - r / 2, K.leafHi); B.P(a - r / 2 + 1, b - r / 2, K.leafHi);
    for (let i = 0; i < r * 2; i++) { const t = hash(a + i, b) * TAU, rr = hash(b, a + i) * r; B.P(a + Math.cos(t) * rr, b + Math.sin(t) * rr, i % 2 ? K.leaf2 : K.leaf3); }
  }
  function forest(B, T, occ, seed) {
    const W = B.W, H = B.H;
    for (let j = 6; j < H - 6; j += 9) for (let i = 6; i < W - 6; i += 9) {
      const a = Math.round(i + (hash(i, j + seed) - .5) * 6), b = Math.round(j + (hash(j + seed, i) - .5) * 6), k = b * W + a;
      if (T.F[k] < .74 || occ[k] || T.lv[k] < 0) continue;
      if (vnoise(a, b, 40, seed + 17) + T.lv[k] * .06 < .55) continue;
      let clear = true; for (let v = -9; v <= 9 && clear; v += 3) for (let u = -9; u <= 9; u += 3) { const q = (b + v) * W + a + u; if (occ[q] || T.F[q] < .62) { clear = false; break; } }
      if (clear) tree(B, a, b, 4 + Math.floor(hash(a, b) * 4));
    }
    for (let j = 4; j < H - 4; j += 13) for (let i = 4; i < W - 4; i += 13) {   // 高處零星的大石頭
      const a = i + Math.round((hash(i, j + 3) - .5) * 8), q = j + Math.round((hash(j, i + 3) - .5) * 8), k = q * W + a;
      if (T.lv[k] === 3 && !occ[k] && T.F[k] > .74 && hash(a, q) > .55) { const r = 1 + Math.floor(hash(q, a) * 3); B.circ(a + 1, q + 1, r, 'rgba(30,40,30,.25)'); B.circ(a, q, r, K.stone2); B.circ(a - .5, q - .5, Math.max(0, r - 1), K.stone3); B.P(a - r / 2, q - r / 2, '#d6d1c7'); }
    }
  }
  // 地塊的邊（兩格之間畫點）
  function plotEdges(B, id, test, col, step) {
    const GW = X.GW, GH = X.GH;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const p = id[y * GW + x];
      if (x + 1 < GW && id[y * GW + x + 1] !== p && test(p, id[y * GW + x + 1])) for (let k = 0; k < C; k++) if (k % step < step / 2) B.P((x + 1) * C, y * C + k, col);
      if (y + 1 < GH && id[(y + 1) * GW + x] !== p && test(p, id[(y + 1) * GW + x])) for (let k = 0; k < C; k++) if (k % step < step / 2) B.P(x * C + k, (y + 1) * C, col); }
  }
  function lockIcon(B, cx, cy, col = 'rgba(142,128,112,.85)') {
    for (let t = 0; t <= 12; t++) { const g = Math.PI + t / 12 * Math.PI; B.P(cx + Math.cos(g) * 3, cy - 2 + Math.sin(g) * 3, col); }
    B.R(cx - 3, cy - 2, 1, 2, col); B.R(cx + 3, cy - 2, 1, 2, col);
    B.R(cx - 4, cy, 9, 7, col); B.R(cx - 4, cy, 9, 1, '#a99c88'); B.P(cx, cy + 2, '#e7e1d6'); B.P(cx, cy + 3, '#e7e1d6');
  }

  // ---------- 小路：從家門口走到每個設施的門口（只走自己的陸地，繞開設施） ----------
  function doorOf(k, lv) {
    const r = X.rect(k, lv), d = X.FAC[k].door;
    if (d === 'r') return [r.x + r.w + 2, r.y + r.h * .55];
    if (d === 't') return [r.x + r.w / 2, (r.shore != null ? r.shore : r.y) - 14];
    return [r.x + r.w / 2, r.y + r.h + 2];
  }
  function paths(s, landCell) {
    const GW = X.GW, GH = X.GH, built = X.FAC_KEYS.filter(k => X.level(s, k)), block = new Uint8Array(GW * GH);
    built.forEach(k => { const r = X.rect(k, X.level(s, k)); for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const cx = (x + .5) * C, cy = (y + .5) * C; if (cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h) block[y * GW + x] = 1; } });
    const cellAt = ([px, py]) => [Math.max(0, Math.min(GW - 1, Math.floor(px / C))), Math.max(0, Math.min(GH - 1, Math.floor(py / C)))];
    const ok = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && landCell[y * GW + x] && !block[y * GW + x];
    const home = built.includes('house') ? doorOf('house', X.level(s, 'house')) : null, out = [];
    if (!home) return out;
    const [hx, hy] = cellAt(home);
    built.filter(k => k !== 'house').forEach(k => {
      const door = doorOf(k, X.level(s, k)), [tx, ty] = cellAt(door);
      const okT = (x, y) => (x === tx && y === ty) || ok(x, y);   // 門口那格可能在設施的範圍裡（碼頭），還是要走得到
      if (!ok(hx, hy) || !landCell[ty * GW + tx]) return;
      // BFS（8 方向），走斜的比較順
      const prev = new Int32Array(GW * GH).fill(-2), q = [hy * GW + hx]; prev[q[0]] = -1; let found = false;
      while (q.length) { const c = q.shift(); if (c === ty * GW + tx) { found = true; break; } const x = c % GW, y = (c - x) / GW;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const X2 = x + dx, Y2 = y + dy; if (!okT(X2, Y2)) continue; if (dx && dy && (!okT(x + dx, y) || !okT(x, y + dy))) continue; const d = Y2 * GW + X2; if (prev[d] !== -2) continue; prev[d] = c; q.push(d); } }
      if (!found) return;
      const cells = []; for (let c = ty * GW + tx; c >= 0; c = prev[c]) cells.unshift(c);
      const pts = [home].concat(cells.filter((c, i) => i % 2 === 1 || i === cells.length - 1).map(c => [(c % GW + .5) * C, (Math.floor(c / GW) + .5) * C]), [door]);
      out.push({ k, pts });
    });
    return out;
  }
  function smooth(pts) {
    const dots = [];
    for (let k = 0; k < pts.length - 1; k++) { const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)], n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]));
      for (let i = 0; i <= n; i++) { const t = i / n, t2 = t * t, t3 = t2 * t; dots.push([0, 1].map(e => .5 * (2 * p1[e] + (-p0[e] + p2[e]) * t + (2 * p0[e] - 5 * p1[e] + 4 * p2[e] - p3[e]) * t2 + (-p0[e] + 3 * p1[e] - 3 * p2[e] + p3[e]) * t3))); } }
    return dots;
  }
  function trail(B, dots, r, kind) {
    const cols = kind === 'stone' ? ['#d6d1c7', '#c4beb3', '#e4e0d8', '#a39b8e'] : ['#c9b48a', '#b9a273', '#d6c49c', '#a58e62'], done = new Set();
    dots.forEach(([a, b]) => { for (let v = -Math.ceil(r); v <= Math.ceil(r); v++) for (let u = -Math.ceil(r); u <= Math.ceil(r); u++) {
      const x = Math.round(a + u), y = Math.round(b + v), k = y * B.W + x; if (done.has(k)) continue; const d = Math.hypot(u, v); if (d > r) continue; done.add(k);
      const n = hash(x, y); B.P(x, y, d > r - 1 ? cols[3] : n > .9 ? cols[2] : n < .15 ? cols[1] : cols[0]); if (n > .985) B.P(x, y, '#e4e0d8'); } });
  }

  // ---------- 設施的圖 ----------
  const IMG = {}; let loading = null;
  function load(base = 'assets/xiaodao/', ver = '') {
    if (loading) return loading;
    const list = []; X.FAC_KEYS.forEach(k => X.FAC[k].levels.forEach((n, i) => list.push(k + (i + 1))));
    (X.VEH_KEYS || []).forEach(k => list.push('v/' + k));   // 車、船（第二批）
    loading = Promise.all(list.map(n => new Promise(ok => { const im = new Image(); im.onload = () => { IMG[n] = im; ok(); }; im.onerror = () => ok(); im.src = base + n + '.png' + (ver ? '?v=' + ver : ''); })));
    return loading;
  }

  // 畫整座島 → { canvas, buyable: [地塊], sites: { 設施: 圖的範圍 }, paths, F: 離岸遠近（給浪用） }；opt.noVeh 不畫停著的車船（第六批改由 xiaodao-fx.js 每張畫，才能開走）
  function render(s, opt = {}) {
    const Wd = X.world(), GW = X.GW, own = new Set(X.island(s).plots), seed = 37;
    const land = new Uint8Array(GW * X.GH); for (let k = 0; k < land.length; k++) land[k] = Wd.id[k] >= 0 && own.has(Wd.id[k]) ? 1 : 0;
    const B = new Buf(WW, HH), occ = new Uint8Array(WW * HH);
    const fill = (x0, y0, x1, y1) => { for (let v = Math.max(0, y0 | 0); v < Math.min(HH, y1); v++) for (let u = Math.max(0, x0 | 0); u < Math.min(WW, x1); u++) occ[v * WW + u] = 1; };
    const built = X.FAC_KEYS.filter(k => X.level(s, k)), sites = {};
    built.forEach(k => { const r = X.rect(k, X.level(s, k)); sites[k] = r; fill(r.x - 8, r.y - 8, r.x + r.w + 8, (r.shore != null ? r.shore : r.y + r.h) + 8); });
    const tier = X.tierOf(s);
    // 還沒蓋、島的等級已經可以蓋的工地：先整平、不長樹（空地）
    X.FAC_KEYS.forEach(k => { if (X.level(s, k) || !(X.TIERS[tier].cap[k] >= 1)) return; const r = X.rect(k, 1); fill(r.x - 4, r.y - 4, r.x + r.w + 4, (r.shore != null ? r.shore : r.y + r.h) + 4); });
    const road = paths(s, land).map(p => ({ k: p.k, dots: smooth(p.pts) })), rr = tier >= 2 ? 3.5 : 2.4;
    road.forEach(p => p.dots.forEach(([a, b]) => fill(a - rr - 3, b - rr - 3, a + rr + 4, b + rr + 4)));
    const T = terrain(B, land, occ, seed);
    // 地塊的邊：自己的地之間淡淡白點；能買的地灰色虛線＋鎖
    const buyable = []; for (let p = 0; p < Wd.P; p++) if (X.plotInfo(s, p).ok) buyable.push(p);
    const isBuy = new Set(buyable);
    plotEdges(B, Wd.id, (a, b) => own.has(a) && own.has(b), 'rgba(255,255,255,.4)', 4);
    plotEdges(B, Wd.id, (a, b) => isBuy.has(a) && isBuy.has(b), 'rgba(215,208,196,.35)', 6);
    plotEdges(B, Wd.id, (a, b) => (isBuy.has(a) && !isBuy.has(b) && !own.has(b)) || (isBuy.has(b) && !isBuy.has(a) && !own.has(a)), '#d7d0c4', 6);
    if (opt.locks !== false) buyable.forEach(p => { const [cx, cy] = Wd.center[p]; lockIcon(B, Math.round(cx), Math.round(cy)); });
    forest(B, T, occ, seed);
    road.forEach(p => trail(B, p.dots, rr, tier >= 2 ? 'stone' : 'dirt'));
    const cv = (opt.canvas || document.createElement('canvas')); cv.width = WW; cv.height = HH;
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    x.putImageData(new ImageData(B.d, WW, HH), 0, 0);
    built.slice().sort((a, b) => (sites[a].y + sites[a].h) - (sites[b].y + sites[b].h)).forEach(k => {
      const im = IMG[k + X.level(s, k)], r = sites[k]; if (im) x.drawImage(im, r.x, r.y);
      // 平房的曬衣繩：晾你有的衣服（最多四件；設計圖原本那四塊的位置和大小），沒有衣服就空著
      if (k === 'house' && X.level(s, k) === 3 && X.CLOTH) {
        const mine = s.items.filter(i => X.CLOTH[i.key] && i.qty > 0).sort((a, b) => (a.key + a.c).localeCompare(b.key + b.c)).slice(0, 4);
        [[22, 5, 6], [29, 4, 7], [35, 5, 5], [41, 3, 4]].forEach(([u, ww, hh], j) => { const it = mine[j]; if (!it) return; const v = 26 + Math.round(Math.sin((u - 20) / 26 * Math.PI) * 2), col = X.CLOTH[it.key].colors[it.c].sw, a = r.x + u - 18, b = r.y + v - 18;
          x.fillStyle = 'rgba(30,40,30,.24)'; x.fillRect(a + 2, b + 2, ww, hh); x.fillStyle = col; x.fillRect(a, b, ww, hh); x.fillStyle = 'rgba(255,255,255,.33)'; x.fillRect(a, b, ww, 1); });
      }
      // 停著的車、船：放在位子正中間（圖本身含右下的影子）
      if (!opt.noVeh && X.slotsOf) X.slotsOf(s, k).forEach(sl => { const v = sl.v && IMG['v/' + sl.v], V = sl.v && X.VEH[sl.v]; if (!v) return;
        if (V.ax != null) x.drawImage(v, Math.round(sl.x + sl.w / 2 - V.ax), Math.round(sl.y + sl.h - V.ay));   // 火箭：地面點對齊位子的底部中間
        else x.drawImage(v, Math.round(sl.x + (sl.w - v.width) / 2 + 1), Math.round(sl.y + (sl.h - v.height) / 2 + 1)); });
    });
    return { canvas: cv, buyable, sites, paths: road, W: WW, H: HH, F: T.F };
  }
  // 島上看得到的範圍（自己的地＋能買的地，外面留一點海）
  function bounds(s, pad = 30) {
    const Wd = X.world(), own = new Set(X.island(s).plots); let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let p = 0; p < Wd.P; p++) { if (!own.has(p) && !X.plotInfo(s, p).ok) continue; Wd.cells[p].forEach(k => { const x = k % X.GW, y = Math.floor(k / X.GW); x0 = Math.min(x0, x * C); y0 = Math.min(y0, y * C); x1 = Math.max(x1, (x + 1) * C); y1 = Math.max(y1, (y + 1) * C); }); }
    X.FAC_KEYS.forEach(k => { const lv = X.level(s, k); if (!lv) return; const r = X.rect(k, lv); x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); });
    return { x: Math.max(0, x0 - pad), y: Math.max(0, y0 - pad), w: Math.min(WW, x1 + pad) - Math.max(0, x0 - pad), h: Math.min(HH, y1 + pad) - Math.max(0, y0 - pad) };
  }
  root.XiaodaoDraw = { load, render, bounds, paths, doorOf, IMG, W: WW, H: HH, lockIcon };
})(window);
