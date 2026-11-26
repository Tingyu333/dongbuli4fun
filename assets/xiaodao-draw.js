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
    stone: '#a39b8e', stone2: '#8b8377', stone3: '#bdb6aa', stoneHi: '#d6d1c7', shadow: 'rgba(30,40,30,.24)', seaShadow: 'rgba(20,40,50,.28)',
    // 2026-11-26 島本身審稿：地形自己的顏色收進色票（docs/plans/jiayuan/README.md「地形」）
    // 梯田四層（本色、暗、亮），每層亮 6～7%，手機上才看得出一層一層
    lv: [['#97ad6f', '#86a061', '#a6bb7c'], ['#a5bb79', '#95ab6a', '#b3c587'], ['#b3c784', '#a3b776', '#c1d292'], ['#c1d390', '#b1c381', '#cedc9e']],
    slopeTop: '#9a8558', slope: '#7d6a45', rimLit: '#cfdaa2', rimSide: '#7f9455', grassDk: '#738d51',
    flower: ['#f0b8b0', '#f1d36b', '#ffffff'], wetRock: '#7d766b', rock: '#958d80',
    reed: '#6f8a4a', reedHi: '#9cb96f', reedTop: '#a58e62',
    palm1: '#6f9a45', palmHi: '#8fb35a', palmLo: '#3d5f2c', trunk: '#7a5a3a', trunkHi: '#a07a50',
    lampPost: '#7a6e64', lampHead: '#efe9dc',
    stake: '#9a6a40', stakeHi: '#b98552', stakeLo: '#7c5230', rope: '#c9b48a', cloth: '#b33a2f', dirtSpeck: '#c9b48a',
  };
  const LV = K.lv;
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
  Buf.prototype.S = function (x, y, c) {   // 直接寫（含透明度、不跟底下混），透明圖層用
    x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const [r, g, b, a] = rgba(c), k = (y * this.W + x) * 4, d = this.d; d[k] = r; d[k + 1] = g; d[k + 2] = b; d[k + 3] = Math.round(a * 255);
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
  // 2026-11-26 島本身審稿：坡改 3 顆（坡頂受光 → 坡面 → 下一層草上的影子）、四層亮度拉開、層的邊界少而長；
  // 整平的地邊角是圓的（occ 先模糊）；草的雜點少一點、小花一叢一叢；南岸加一層低頻起伏（設施附近不加）；
  // 沙灘寬一點、岩岸是一片石頭（不是一串）、遠海不撒白點，近岸零星 2×1 的小浪
  function terrain(B, land, occ, seed) {
    const W = B.W, H = B.H, GW = X.GW, m = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) m[j * W + i] = land[Math.floor(j / C) * GW + Math.floor(i / C)];
    blur(m, W, H, 9); blur(m, W, H, 9);
    const inner = Float32Array.from(m); blur(inner, W, H, 22);
    const occS = Float32Array.from(occ); blur(occS, W, H, 11);   // 整平的地往外慢慢降下來，梯田的邊才會繞著設施彎，不會沿著設施的邊變成一條直線
    const near = occS;                                          // 「靠近設施、小路」也用同一張（南岸起伏、樹林邊緣）
    const lv = new Int8Array(W * H).fill(-1), F = new Float32Array(W * H), rock = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, m0 = m[k], amp = .25 + .75 * Math.min(1, m0 * 4);
      F[k] = m0 + ((vnoise(i, j, 9, seed) - .5) * .12 + (vnoise(i, j, 26, seed + 9) - .5) * .16) * amp
        + (m0 > .005 && near[k] < .33 ? (vnoise(i, j, 48, seed + 21) - .5) * .16 * (1 - near[k] * 3) * Math.min(1, m0 * 3) : 0);
      if (F[k] >= .5) { const h = (vnoise(i, j, 64, seed + 3) * .85 + vnoise(i, j, 23, seed + 5) * .15) * Math.min(1, inner[k] * 1.6) * Math.max(0, 1 - occS[k] * 1.6); lv[k] = h < .3 ? 0 : h < .42 ? 1 : h < .53 ? 2 : 3; }
    }
    cleanLevels(lv, W, H, land);
    const L = (i, j) => (i < 0 || j < 0 || i >= W || j >= H) ? -1 : lv[j * W + i];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, n = hash(i + seed, j), f = F[k], d = (hash(j, i + seed) - .5) * .05; let c, shade = false;
      if (f >= .5) {
        const l = lv[k], beach = f + d < .71;
        if (beach && l >= 2) { rock[k] = 1; c = f < .53 ? K.wetRock : n > .72 ? K.stone : n > .36 ? K.rock : K.stone2; }
        else if (beach) c = n > .85 ? K.sand3 : n < .2 ? K.sand2 : K.sand;
        else {
          const p = LV[Math.max(0, l)]; c = n > .94 ? p[2] : n > .84 ? p[1] : n < .03 ? K.grassDk : p[0];
          if (l === 0 && hash(j, i + 7) > .9 && vnoise(i, j, 9, seed + 40) > .74) c = K.flower[Math.floor(hash(i, j + 3) * 3)];
          let dj = 0; for (let t = 1; t <= 5; t++) if (L(i, j - t) > l) { dj = t; break; }
          if (dj === 1) c = K.slopeTop; else if (dj === 2 || dj === 3) c = K.slope; else if (dj >= 4) shade = true;
          if (L(i - 1, j) > l && dj !== 1) c = K.rimSide;
          if ((L(i, j - 1) >= 0 && L(i, j - 1) < l) || (L(i - 1, j) >= 0 && L(i - 1, j) < l)) c = K.rimLit;
        }
      }
      else if (f > .45) c = (rock[k - W] || rock[k - 1]) ? K.wetRock : K.foam;
      else if (f + d > .32) c = (f + d < .36 && (i + j) % 2) ? K.sea2 : K.shallow;
      else if (f + d > .13) c = K.sea2;
      else if (f + d > .03) c = ((f + d < .045) && (i + j) % 2) ? K.deep : K.sea;
      else c = K.deep;
      if (f < .3 && f > .05 && hash(i >> 1, j + 5) > .9985) c = K.foam;   // 近岸的小浪（2×1）
      B.P(i, j, c); if (shade) B.P(i, j, K.shadow);
    }
    return { F, lv, rock, inner, near };
  }
  // 樹：三階明暗往左上偏、影子往右下 3 顆；樹冠裡的散點照明暗分邊（左上亮葉、右下暗葉）
  // 梯田的碎層清理（第二輪審稿：整平改成慢慢降以後，會切出很窄的一條「小黃瓜」、孤零零的小台地、像梳子齒的直坡）：
  // 先 5×5 多數決一次、每一層縮 6 長 6（只在陸地的範圍裡做），再把面積小於 900 顆、外框短邊小於 14 顆、或平均寬度（面積÷長邊）不到 18 顆的一塊改成周圍最多的那一層
  function cleanLevels(LV0, W0, H0, land) {
    let bx0 = W0, by0 = H0, bx1 = -1, by1 = -1; for (let k = 0; k < land.length; k++) if (land[k]) { const i = k % X.GW, j = (k - i) / X.GW; bx0 = Math.min(bx0, i * C); bx1 = Math.max(bx1, i * C + C); by0 = Math.min(by0, j * C); by1 = Math.max(by1, j * C + C); }
    if (bx1 < 0) return; bx0 = Math.max(0, bx0 - 30); by0 = Math.max(0, by0 - 30); bx1 = Math.min(W0 - 1, bx1 + 30); by1 = Math.min(H0 - 1, by1 + 30);
    const W = bx1 - bx0 + 1, H = by1 - by0 + 1, lv = new Int8Array(W * H); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) lv[j * W + i] = LV0[(j + by0) * W0 + i + bx0];
    cleanSub(lv, W, H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) LV0[(j + by0) * W0 + i + bx0] = lv[j * W + i];
  }
  function cleanSub(lv, W, H) {
    // 5×5 多數決：每一層各算一次 5×5 的個數（橫、直兩次累加），取最多的那一層
    const box = (m, r) => { const t = new Uint16Array(W * H), o = new Uint16Array(W * H);
      for (let j = 0; j < H; j++) { let sum = 0; for (let i = -r; i <= r; i++) if (i >= 0 && i < W) sum += m[j * W + i]; for (let i = 0; i < W; i++) { t[j * W + i] = sum; if (i + r + 1 < W) sum += m[j * W + i + r + 1]; if (i - r >= 0) sum -= m[j * W + i - r]; } }
      for (let i = 0; i < W; i++) { let sum = 0; for (let j = -r; j <= r; j++) if (j >= 0 && j < H) sum += t[j * W + i]; for (let j = 0; j < H; j++) { o[j * W + i] = sum; if (j + r + 1 < H) sum += t[(j + r + 1) * W + i]; if (j - r >= 0) sum -= t[(j - r) * W + i]; } }
      return o; };
    for (let pass = 0; pass < 1; pass++) { const cnt = [0, 1, 2, 3].map(q => { const m = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) m[k] = lv[k] === q ? 1 : 0; return box(m, 2); });
      for (let k = 0; k < W * H; k++) { if (lv[k] < 0) continue; let best = lv[k]; for (let q = 0; q < 4; q++) if (cnt[q][k] > cnt[best][k]) best = q; lv[k] = best; } }
    // 一列（或一行）滑動視窗：窗內全是 1（縮）／有任何 1（長），用累加的個數算，手機上才不會慢
    const winF = (src, r, horiz, all) => { const out = new Uint8Array(W * H), need = all ? 2 * r + 1 : 1;
      if (horiz) for (let j = 0; j < H; j++) { const o = j * W; let sum = 0; for (let t = 0; t <= r && t < W; t++) sum += src[o + t];
        for (let t = 0; t < W; t++) { out[o + t] = sum >= need ? 1 : 0; if (t + r + 1 < W) sum += src[o + t + r + 1]; if (t - r >= 0) sum -= src[o + t - r]; } }
      else for (let i = 0; i < W; i++) { let sum = 0; for (let t = 0; t <= r && t < H; t++) sum += src[t * W + i];
        for (let t = 0; t < H; t++) { out[t * W + i] = sum >= need ? 1 : 0; if (t + r + 1 < H) sum += src[(t + r + 1) * W + i]; if (t - r >= 0) sum -= src[(t - r) * W + i]; } }
      return out; };
    const minF = (src, r, horiz) => winF(src, r, horiz, true), maxF = (src, r, horiz) => winF(src, r, horiz, false);
    for (let l = 3; l >= 1; l--) { const m0 = new Uint8Array(W * H); let any = 0; for (let k = 0; k < W * H; k++) { m0[k] = lv[k] >= l ? 1 : 0; any |= m0[k]; } if (!any) continue;
      const op = maxF(maxF(minF(minF(m0, 6, true), 6, false), 6, true), 6, false);
      for (let k = 0; k < W * H; k++) if (m0[k] && !op[k]) lv[k] = l - 1; }
    const seen = new Int32Array(W * H).fill(-1), q = new Int32Array(W * H); let id = 0;
    for (let k0 = 0; k0 < W * H; k0++) { if (lv[k0] < 0 || seen[k0] >= 0) continue; const l = lv[k0]; let n0 = 0, n1 = 0, n2 = 0, n3 = 0, qn = 0; q[qn++] = k0; seen[k0] = id; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let t = 0; t < qn; t++) { const k = q[t], i = k % W, j = (k - i) / W; if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
        for (let d = 0; d < 4; d++) { const i2 = d === 0 ? i + 1 : d === 1 ? i - 1 : i, j2 = d === 2 ? j + 1 : d === 3 ? j - 1 : j; if (i2 < 0 || j2 < 0 || i2 >= W || j2 >= H) continue; const k2 = j2 * W + i2, v = lv[k2]; if (v < 0) continue;
          if (v === l) { if (seen[k2] < 0) { seen[k2] = id; q[qn++] = k2; } } else if (v === 0) n0++; else if (v === 1) n1++; else if (v === 2) n2++; else n3++; } }
      if (qn < 900 || Math.min(x1 - x0 + 1, y1 - y0 + 1) < 14 || qn / Math.max(x1 - x0 + 1, y1 - y0 + 1) < 18) {   // 太小、太窄、或平均寬度不到 18 顆（細長的一條）
        const nb = [n0, n1, n2, n3]; let best = -1, bc = 0; for (let v = 0; v < 4; v++) if (nb[v] > bc) { bc = nb[v]; best = v; } if (best >= 0) for (let t = 0; t < qn; t++) lv[q[t]] = best; }
      id++; }
  }
  function tree(B, a, b, r) {
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) B.P(a + xx + 3, b + yy + 3, K.shadow);
    B.circ(a, b, r, K.leaf2); B.circ(a - 1, b - 1, r - 1, K.leaf1); B.circ(a - 2, b - 2, Math.max(1, r - 3), K.leaf3); B.P(a - r / 2, b - r / 2, K.leafHi); B.P(a - r / 2 + 1, b - r / 2, K.leafHi);
    for (let i = 0; i < r * 2; i++) { const t = hash(a + i, b) * TAU, rr = hash(b, a + i) * r, cx = Math.cos(t), cy = Math.sin(t); B.P(a + cx * rr, b + cy * rr, cx + cy < 0 ? K.leaf3 : K.leaf2); }
  }
  // 矮灌木：小、沒有亮點
  function shrub(B, a, b, r) {
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) B.P(a + xx + 2, b + yy + 2, K.shadow);
    B.circ(a, b, r, K.leaf1); B.circ(a - 1, b - 1, Math.max(1, r - 1), K.leaf3); B.P(a + r - 1, b + 1, K.leaf2);
  }
  // 椰子樹（沙灘偶爾一棵，接上別墅、展示車廊的度假感）：六片葉子、尾巴往下垂
  function palm(B, a, b) {
    for (let k = 0; k < 6; k++) { const t = k / 6 * TAU + .3; for (let q = 2; q < 10; q++) B.P(a + Math.cos(t) * q + 3, b + Math.sin(t) * q + (q > 6 ? (q - 6) * .6 : 0) + 3, K.shadow); }
    for (let k = 0; k < 6; k++) { const t = k / 6 * TAU + .3, nx = -Math.sin(t), ny = Math.cos(t); for (let q = 2; q < 10; q++) { const u = a + Math.cos(t) * q, v = b + Math.sin(t) * q + (q > 6 ? (q - 6) * .6 : 0), wd = q < 4 ? 0 : q < 8 ? 1 : 0;
      for (let z = -wd; z <= wd; z++) B.P(u + nx * z, v + ny * z, z === wd && wd ? K.palmLo : z === -wd && wd ? K.palmHi : K.palm1); } }
    B.circ(a, b, 1, K.trunk); B.P(a - 1, b - 1, K.trunkHi);
  }
  // 大石頭：大小 2～4、亮點 2 顆、影子往右下 2 顆；偶爾兩三顆擠在一起
  function boulder(B, a, q, r) {   // 扁一點、底下平一點；本色、右下一彎暗面、左上亮（2026-11-26：原本一顆顆一樣的灰圓像硬幣）
    const ry = Math.max(1, r - 1), inE = (u, v, rx, rv) => (u * u) / (rx * rx + .5) + (v * v) / (rv * rv + .5) <= 1;
    for (let v = -ry; v <= ry; v++) for (let u = -r; u <= r; u++) { if (!inE(u, v, r, ry)) continue; B.P(a + u + 2, q + v + 2, K.shadow); }
    for (let v = -ry; v <= ry; v++) for (let u = -r; u <= r; u++) { if (!inE(u, v, r, ry)) continue; const dark = !inE(u + 1, v + 1, r, ry), lit = !inE(u - 1, v - 1, r, ry);
      B.P(a + u, q + v, dark ? K.stone2 : lit ? K.stone3 : K.stone); }
    B.P(a - Math.ceil(r / 2), q - Math.ceil(ry / 2), K.stoneHi); B.P(a - Math.ceil(r / 2) + 1, q - Math.ceil(ry / 2), K.stoneHi); if (hash(a, q) > .6) B.P(a + 1, q - ry, K.leaf3);
  }
  function forest(B, T, occ, seed) {
    const W = B.W, H = B.H, trees = [];
    const near = T.near;   // 靠近設施、小路的地方（terrain 算好的，模糊 12）
    for (let j = 6; j < H - 6; j += 9) for (let i = 6; i < W - 6; i += 9) {
      const a = Math.round(i + (hash(i, j + seed) - .5) * 6), b = Math.round(j + (hash(j + seed, i) - .5) * 6), k = b * W + a;
      if (T.F[k] < .74 || occ[k] || T.lv[k] < 0) continue;
      if (vnoise(a, b, 40, seed + 17) + T.lv[k] * .06 < .55) continue;
      let clear = true; for (let v = -9; v <= 9 && clear; v += 3) for (let u = -9; u <= 9; u += 3) { const q = (b + v) * W + a + u; if (occ[q] || T.F[q] < .62) { clear = false; break; } }
      if (!clear) continue;
      const edge = near[k] > .02;
      if (edge && hash(a, b + 5) < .5) continue;   // 樹林邊緣最外排一半不種，邊才不會被切成一條直線（像綠籬）
      if (hash(b, a + 2) < .15) { const r = 2 + Math.floor(hash(a + 3, b) * 2); shrub(B, a, b, r); trees.push([a, b, r]); continue; }
      const r = Math.max(3, 3 + Math.floor(hash(a, b) * 5) - (edge ? 1 : 0)); tree(B, a, b, r); trees.push([a, b, r]);
    }
    for (let j = 4; j < H - 4; j += 13) for (let i = 4; i < W - 4; i += 13) {   // 高處零星的大石頭
      const a = i + Math.round((hash(i, j + 3) - .5) * 8), q = j + Math.round((hash(j, i + 3) - .5) * 8), k = q * W + a;
      if (T.lv[k] === 3 && !occ[k] && T.F[k] > .74 && hash(a, q) > .55) { const r = 2 + Math.floor(hash(q, a) * 3); boulder(B, a, q, r); if (hash(a + 1, q) > .7) boulder(B, a + r + 1, q + 1, Math.max(1, r - 1)); }
    }
    for (let j = 2; j < H - 2; j += 4) for (let i = 2; i < W - 2; i += 4) {   // 岩岸上一顆顆小石頭（左上亮、右下暗）
      const a = i + Math.floor(hash(i, j + 9) * 3), q = j + Math.floor(hash(j + 9, i) * 3), k = q * W + a;
      if (!T.rock[k] || hash(a, q + 4) < .45) continue; const r = 1 + Math.floor(hash(q, a + 4) * 2);
      B.circ(a + 1, q + 1, r, 'rgba(30,40,30,.2)'); B.circ(a, q, r, K.stone2); B.P(a - 1, q - 1, K.stoneHi); B.P(a, q - 1, K.stone3); B.P(a + r, q + r - 1, K.wetRock);
    }
    for (let j = 8; j < H - 8; j += 23) for (let i = 8; i < W - 8; i += 23) {   // 沙灘偶爾一棵椰子樹
      const a = i + Math.floor((hash(i, j + 11) - .5) * 12), q = j + Math.floor((hash(j + 11, i) - .5) * 12), k = q * W + a, f = T.F[k];
      if (f < .53 || f + (hash(q, a + seed) - .5) * .05 >= .7 || T.rock[k] || near[k] > .005 || hash(a, q + 21) < .72) continue; palm(B, a, q); trees.push([a, q, 6]);   // 只種在沙上
    }
    for (let j = 4; j < H - 4; j += 7) for (let i = 4; i < W - 4; i += 7) {   // 內海邊的蘆葦（被陸地圍起來的那種小湖）
      const a = i + Math.floor(hash(i, j + 13) * 5), q = j + Math.floor(hash(j + 13, i) * 5), k = q * W + a, f = T.F[k];
      if (f < .42 || f > .5 || T.inner[k] < .55 || hash(a, q + 17) < .5) continue;
      for (let z = 0; z < 3; z++) { const u = a + z * 2 - 2, hgt = 3 + Math.floor(hash(u, q) * 2); for (let t = 0; t < hgt; t++) B.P(u, q - t, t === hgt - 1 ? K.reedTop : z === 0 ? K.reedHi : K.reed); B.P(u + 1, q + 1, 'rgba(20,40,50,.28)'); }
    }
    return trees;
  }
  // 地塊的邊（兩格之間畫點）
  function plotEdges(B, id, test, col, step) {
    const GW = X.GW, GH = X.GH;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const p = id[y * GW + x];
      if (x + 1 < GW && id[y * GW + x + 1] !== p && test(p, id[y * GW + x + 1])) for (let k = 0; k < C; k++) if (k % step < step / 2) B.S((x + 1) * C, y * C + k, col);
      if (y + 1 < GH && id[(y + 1) * GW + x] !== p && test(p, id[(y + 1) * GW + x])) for (let k = 0; k < C; k++) if (k % step < step / 2) B.S(x * C + k, (y + 1) * C, col); }
  }
  // 鎖（2026-11-26：原本跟海一樣亮、像小提包）：淺色鎖身、2 顆粗的鎖環、1 顆輪廓、右下海上的影子，不超過 11×10
  function lockIcon(B, cx, cy) {
    const P = (x, y, c) => B.S(cx + x, cy + y, c), R = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P(x + i, y + j, c); };
    R(-2, 2, 9, 6, K.seaShadow);                                                                     // 影子（右下 2 顆）
    [[-1, -5], [0, -5], [1, -5], [-2, -4], [2, -4], [-3, -3], [3, -3], [-3, -2], [3, -2], [-3, -1], [3, -1]].forEach(([u, v]) => P(u, v, '#8e8070'));   // 鎖環外框
    [[-1, -4], [0, -4], [1, -4], [-2, -3], [-2, -2], [-2, -1]].forEach(([u, v]) => P(u, v, '#e7e1d6'));   // 鎖環（受光）
    [[2, -3], [2, -2], [2, -1]].forEach(([u, v]) => P(u, v, '#a99c88'));                                  // 鎖環（背光）
    R(-4, 0, 9, 6, '#8e8070'); R(-3, 1, 7, 4, '#e7e1d6'); R(-3, 1, 7, 1, '#f3f1ec'); R(3, 1, 1, 4, '#a99c88'); R(-3, 4, 6, 1, '#cfc6b6');
    R(0, 2, 1, 2, '#8e8070');                                                                          // 鑰匙孔
  }
  // 鎖放在哪：這次會買的地（不算已經買的）裡面，離中心最近的那一格（2026-11-26：原本用整塊的重心，會落在已經買的陸地上）
  function lockAt(s, p) {
    const Wd = X.world(), own = new Set(X.island(s).plots), info = X.plotInfo(s, p), g = (info.plots || X.lotOf(p)).filter(q => !own.has(q));
    const cells = []; (g.length ? g : [p]).forEach(q => Wd.cells[q].forEach(c => cells.push(c)));
    let sx = 0, sy = 0; cells.forEach(c => { sx += c % X.GW + .5; sy += Math.floor(c / X.GW) + .5; }); sx /= cells.length; sy /= cells.length;
    let best = cells[0], bd = 1e9; cells.forEach(c => { const d = Math.hypot(c % X.GW + .5 - sx, Math.floor(c / X.GW) + .5 - sy); if (d < bd) { bd = d; best = c; } });
    return [(best % X.GW + .5) * C, (Math.floor(best / X.GW) + .5) * C];
  }

  // ---------- 小路：從家門口走到每個設施的門口（只走自己的陸地，繞開設施） ----------
  function doorOf(k, lv) {
    const r = X.rect(k, lv), d = X.FAC[k].door;
    if (d === 'r') return [r.x + r.w + 2, r.y + r.h * .55];
    if (d === 't') return [r.x + r.w / 2, (r.shore != null ? r.shore : r.y) - 14];
    return [r.x + r.w / 2, r.y + r.h + 2];
  }
  // 群島（2026-11-26）：兩頭的地塊都買了的橋，小路可以從橋的這頭跳到那頭；回傳每一段 segs（land＝要畫彎彎的路，bridge＝直直的橋）
  function paths(s, landCell) {
    const GW = X.GW, GH = X.GH, built = X.FAC_KEYS.filter(k => X.level(s, k)), block = new Uint8Array(GW * GH);
    built.forEach(k => { const r = X.rect(k, X.level(s, k)); for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const cx = (x + .5) * C, cy = (y + .5) * C; if (cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h) block[y * GW + x] = 1; } });
    const cellAt = ([px, py]) => [Math.max(0, Math.min(GW - 1, Math.floor(px / C))), Math.max(0, Math.min(GH - 1, Math.floor(py / C)))];
    const ok = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && landCell[y * GW + x] && !block[y * GW + x];
    const jump = new Map(), cid = p => { const [x, y] = cellAt(p); return y * GW + x; };
    bridgesOf(s).forEach(b => { const A = [b.x1, b.y1], Bp = [b.x2, b.y2], ca = cid(A), cb = cid(Bp);
      [[ca, cb, A, Bp], [cb, ca, Bp, A]].forEach(([f, t, fp, tp]) => { if (!jump.has(f)) jump.set(f, []); jump.get(f).push({ to: t, from: fp, at: tp }); }); });
    const home = built.includes('house') ? doorOf('house', X.level(s, 'house')) : null, out = [];
    if (!home) return out;
    const [hx, hy] = cellAt(home);
    built.filter(k => k !== 'house').forEach(k => {
      const door = doorOf(k, X.level(s, k)), [tx, ty] = cellAt(door);
      const okT = (x, y) => (x === tx && y === ty) || ok(x, y);   // 門口那格可能在設施的範圍裡（碼頭），還是要走得到
      if (!ok(hx, hy) || !landCell[ty * GW + tx]) return;
      // BFS（8 方向），走斜的比較順；橋的兩頭算相鄰
      const prev = new Int32Array(GW * GH).fill(-2), via = new Map(), q = [hy * GW + hx]; prev[q[0]] = -1; let found = false;
      while (q.length) { const c = q.shift(); if (c === ty * GW + tx) { found = true; break; } const x = c % GW, y = (c - x) / GW;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const X2 = x + dx, Y2 = y + dy; if (!okT(X2, Y2)) continue; if (dx && dy && (!okT(x + dx, y) || !okT(x, y + dy))) continue; const d = Y2 * GW + X2; if (prev[d] !== -2) continue; prev[d] = c; q.push(d); }
        (jump.get(c) || []).forEach(j => { const jx = j.to % GW, jy = (j.to - jx) / GW; if (!okT(jx, jy) || prev[j.to] !== -2) return; prev[j.to] = c; via.set(j.to, j); q.push(j.to); }); }
      if (!found) return;
      const cells = []; for (let c = ty * GW + tx; c >= 0; c = prev[c]) cells.unshift(c);
      const segs = []; let cur = [home];
      cells.forEach((c, i) => { const j = i > 0 && via.get(c) && prev[c] === cells[i - 1] ? via.get(c) : null;
        if (j) { cur.push(j.from); segs.push({ t: 'land', pts: cur }); segs.push({ t: 'bridge', a: j.from, b: j.at }); cur = [j.at]; }
        else if (i % 2 === 1 || i === cells.length - 1) cur.push([(c % GW + .5) * C, (Math.floor(c / GW) + .5) * C]); });
      cur.push(door); segs.push({ t: 'land', pts: cur });
      out.push({ k, segs, pts: segs.filter(g => g.t === 'land').flatMap(g => g.pts) });
    });
    return out;
  }
  // 兩頭的地塊都買了的橋
  function bridgesOf(s) { const Wd = X.world(), own = new Set(X.island(s).plots); return (Wd.bridges || []).filter(b => own.has(b.a) && own.has(b.b)); }
  const lineDots = (a, b) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]))), o = []; for (let i = 0; i <= n; i++) o.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); return o; };
  // 一整條路的點（彎彎的陸路＋直直的橋），車子沿著這個開
  const roadDots = p => p.segs.flatMap(g => g.t === 'bridge' ? lineDots(g.a, g.b) : g.pts.length > 1 ? smooth(g.pts) : g.pts);
  // 橋（2026-11-26 群島）：只畫在海上（兩頭各多 4 顆接到岸上）；土路時期是木橋、石板路時期是石橋。光從左上來：左上那條欄杆亮、右下那條暗，影子落在右下的水上
  function bridge(B, F, a, b, kind) {
    const [x1, y1] = a, [x2, y2] = b, len = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / len, uy = (y2 - y1) / len, nx = -uy, ny = ux;
    const water = (u, v) => u >= 0 && v >= 0 && u < WW && v < HH && F[v * WW + u] < .5;
    let t0 = -1, t1 = -1; for (let t = 0; t <= len; t++) if (water(Math.round(x1 + ux * t), Math.round(y1 + uy * t))) { if (t0 < 0) t0 = t; t1 = t; }
    if (t0 < 0) return null; t0 = Math.max(0, t0 - 4); t1 = Math.min(len, t1 + 4);
    const hw = kind === 'stone' ? 4.5 : 3.5, lit = (nx + ny) * -1 > 0 ? -1 : 1;   // 哪一邊朝左上
    const inDeck = (u, v) => { const t = (u - x1) * ux + (v - y1) * uy, d = (u - x1) * nx + (v - y1) * ny; return t >= t0 && t <= t1 && Math.abs(d) <= hw ? [t, d] : null; };
    const u0 = Math.floor(Math.min(x1, x2) - 8), u1 = Math.ceil(Math.max(x1, x2) + 8), v0 = Math.floor(Math.min(y1, y2) - 8), v1 = Math.ceil(Math.max(y1, y2) + 8);
    for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) if (!inDeck(u, v) && inDeck(u - 3, v - 3) && water(u, v)) B.P(u, v, 'rgba(20,40,50,.4)');   // 第二輪：影子往右下 3 顆、濃一點（不然像貼在水上）
    if (kind === 'stone') for (let t = t0 + 8; t < t1 - 4; t += 16) { const u = Math.round(x1 + ux * t - nx * (hw + 1) * lit), v = Math.round(y1 + uy * t - ny * (hw + 1) * lit); if (!water(u, v)) continue; B.R(u, v, 2, 4, '#7d766b'); B.R(u, v + 4, 2, 1, '#e3efed'); }   // 橋墩：背光那邊每 16 顆露一根，底下一顆浪
    for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) { const h = inDeck(u, v); if (!h) continue; const [t, d] = h, side = Math.sign(d) === lit, edge = Math.abs(d) > hw - 1.2, ti = Math.floor(t);
      let c;
      if (kind === 'stone') { if (edge) c = side ? '#ece6dc' : '#9a9286'; else if (Math.abs(d) > hw - 2.2) c = side ? '#d8d1c4' : '#b3ab9e'; else c = ti % 6 === 0 ? '#b3ab9e' : (hash(Math.floor(t / 6), Math.floor(d + 9)) > .7 ? '#d6cfc2' : '#c9c2b4');
        if (edge && ti % 12 === 0) c = side ? '#f6f2ea' : '#857d71'; }
      else { if (edge) c = ti % 7 === 0 ? '#5e3c22' : side ? '#b98552' : '#7c5230'; else c = ti % 3 === 0 ? '#7c5230' : hash(Math.floor(t / 3), 5) > .6 ? '#a8784a' : '#9a6a40'; }
      B.P(u, v, c); }
    if (kind !== 'stone') for (let t = t0 + 6; t < t1 - 3; t += 14) [-1, 1].forEach(sg => { const u = Math.round(x1 + ux * t + nx * (hw + 1) * sg), v = Math.round(y1 + uy * t + ny * (hw + 1) * sg); if (water(u, v)) { B.P(u, v, '#5e3c22'); B.P(u + 1, v + 1, 'rgba(20,40,50,.28)'); } });   // 木樁
    return [t0, t1].map(t => [x1 + ux * t + nx * (hw + 3), y1 + uy * t + ny * (hw + 3)]);   // 兩頭橋頭旁邊（放路燈）
  }
  // 中間小島的圓環（2026-11-26 群島，島到伍）：石板環＋中間一圈花圃和小噴水池
  function roundabout(B, cx, cy) {   // 第二輪：外半徑 20、花圃一圈朱色和黃色、噴水池 4×4 亮藍＋中間 2×2 白色水花（手機上要看得出是圓環）
    cx = Math.round(cx); cy = Math.round(cy);
    for (let v = -24; v <= 24; v++) for (let u = -24; u <= 24; u++) { const d = Math.hypot(u + .5, v + .5), du = Math.hypot(u - 2.5, v - 2.5), lit = u + v < 0; let c = null;
      if (d <= 20.5) { if (d > 19.5) c = lit ? '#ece6dc' : '#9a9286';
        else if (d > 11.5) { const a = Math.floor((Math.atan2(v, u) + Math.PI) / (Math.PI * 2) * 40), r = d > 15.5 ? 1 : 0; c = (a + r) % 2 ? '#c9c2b4' : '#d6cfc2'; if (Math.abs(d - 15.5) < .5) c = '#b3ab9e'; }
        else if (d > 10.5) c = lit ? '#f6f2ea' : '#a29a8c';
        else if (d > 3.5) { const h = hash(u + 40, v + 40); c = h > .55 ? (h > .8 ? '#d9583f' : '#f1d36b') : h > .45 ? '#ffffff' : (lit ? '#b3c587' : '#95ab6a'); } }
      else if (du <= 20.5) c = 'rgba(30,40,30,.24)';
      if (c) B.P(cx + u, cy + v, c); }
    B.R(cx - 3, cy - 3, 6, 6, '#e6e0d6'); B.R(cx - 2, cy - 2, 4, 4, '#3fb0c9'); B.R(cx - 2, cy - 2, 4, 1, '#5ec8d6'); B.R(cx - 1, cy - 1, 2, 2, '#f4fcfa'); B.R(cx + 3, cy - 2, 1, 6, '#a29a8c'); B.R(cx - 2, cy + 3, 6, 1, '#a29a8c');
  }

  function smooth(pts) {
    const dots = [];
    for (let k = 0; k < pts.length - 1; k++) { const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)], n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]));
      for (let i = 0; i <= n; i++) { const t = i / n, t2 = t * t, t3 = t2 * t; dots.push([0, 1].map(e => .5 * (2 * p1[e] + (-p0[e] + p2[e]) * t + (2 * p0[e] - 5 * p1[e] + 4 * p2[e] - p3[e]) * t2 + (-p0[e] + 3 * p1[e] - 3 * p2[e] + p3[e]) * t3))); } }
    return dots;
  }
  // 小路（2026-11-26 島本身審稿）：
  // 土路像被踩出來的：寬窄有一點變化、邊緣零星被草蓋過、路上零星小石子；兩端是圓的（照像素中心算距離）
  // 石板路：一塊塊石板（照世界座標排的磚紋、接縫）、2 顆的邊（外面那顆半透明）、右下 1 顆影子，比土路寬也比土路亮
  function trail(B, dots, r, kind) {
    const stone = kind === 'stone', m = new Map();
    dots.forEach(([a, b], idx) => {
      const rr = stone ? r : r + (vnoise(idx, 3, 14, 11) - .5) * 1.3, ext = Math.ceil(rr + 2);
      for (let v = -ext; v <= ext; v++) for (let u = -ext; u <= ext; u++) {
        const x = Math.floor(a) + u, y = Math.floor(b) + v, e = Math.hypot(x + .5 - a, y + .5 - b) - rr, k = y * B.W + x;
        if (e > (stone ? 1 : 0)) continue; const o = m.get(k); if (o === undefined || e < o) m.set(k, e);
      }
    });
    m.forEach((e, k) => {
      const x = k % B.W, y = (k - x) / B.W, n = hash(x, y);
      if (stone) {
        if (e > 0) { B.P(x, y, 'rgba(163,155,142,.6)'); return; }
        if (e > -1) { B.P(x, y, K.stone); return; }
        const by = Math.floor(y / 4), sx = x + (by % 2) * 3, bx = Math.floor(sx / 6);
        B.P(x, y, (y % 4 === 0 || sx % 6 === 0) ? K.stone : ['#d6d1c7', '#c4beb3', '#e4e0d8'][Math.floor(hash(bx, by) * 3)]);
      } else {
        if (e > -1) { if (hash(y, x + 5) > .72) return; B.P(x, y, '#a58e62'); return; }
        B.P(x, y, n > .9 ? '#d6c49c' : n < .15 ? '#b9a273' : '#c9b48a');
        if (n > .975) { B.P(x, y, K.stone); B.P(x + 1, y, K.stoneHi); }
      }
    });
    if (stone) m.forEach((e, k) => { if (e > 0) return; const x = k % B.W, y = (k - x) / B.W, q = (y + 1) * B.W + x + 1, o = m.get(q); if (o === undefined || o > 0) B.P(x + 1, y + 1, K.shadow); });
  }
  // 路燈（白天也畫；夜裡 xiaodao-fx.js 只把燈頭點亮、加光暈）：柱子 2×3、燈頭 2×2、右下影子
  function lampPost(B, a, b) { a = Math.round(a); b = Math.round(b); B.R(a + 2, b - 1, 2, 2, K.shadow); B.R(a, b - 3, 2, 3, K.lampPost); B.P(a, b - 3, '#9a8e82'); B.R(a - 1, b - 6, 4, 1, '#8e8070'); B.R(a, b - 5, 2, 2, K.lampHead); B.P(a + 1, b - 4, '#cfc6b6'); }   // 燈柱灰一點、上面一片燈罩（第二輪：深色燈柱在手機上像一排螞蟻）
  // 工地記號（2026-11-26：取代畫面上的白色虛線框）：四角木樁（樁頂綁朱色布條）、樁跟樁之間在自己的陸地上拉麻繩、地上零星的土點
  function siteMarks(B, T, r) {
    const W = B.W, bottom = r.shore != null ? r.shore : r.y + r.h, landAt = (x, y) => { x = Math.round(x); y = Math.round(y); return x >= 0 && y >= 0 && x < W && y < B.H && T.F[y * W + x] >= .53; };
    for (let y = r.y + 2; y < bottom - 2; y++) for (let x = r.x + 2; x < r.x + r.w - 2; x++) if (landAt(x, y) && (hash(x + 7, y) > .955 || (vnoise(x, y, 7, 31) > .62 && hash(y, x + 7) > .55))) B.P(x, y, hash(x, y + 1) > .5 ? K.dirtSpeck : '#b9a273');   // 整好的地：一片片土色
    const x0 = r.x + 1, x1 = r.x + r.w - 2, y0 = r.y + 3, y1 = bottom - 2;
    const stakes = [];
    // 麻繩只拉在陸地上；每一段陸地上的繩子兩頭各插一支樁（工地的角在海上的時候，也看得出是樁＋繩，不是一條虛線）
    const rope = (ax, ay, bx, by) => { const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)); let run = null;
      for (let t = 0; t <= n + 1; t++) { const x = Math.round(ax + (bx - ax) * Math.min(t, n) / n), y = Math.round(ay + (by - ay) * Math.min(t, n) / n), on = t <= n && landAt(x, y + 3);
        if (on) { if (t % 4 !== 3) B.P(x, y, K.rope); if (!run) run = { a: [x, y + 3], n: 0 }; run.b = [x, y + 3]; run.n++; }
        else if (run) { if (run.n > 6) stakes.push(run.a, run.b); run = null; } } };
    rope(x0, y0 - 3, x1, y0 - 3); rope(x0, y1 - 3, x1, y1 - 3); rope(x0, y0 - 3, x0, y1 - 3); rope(x1, y0 - 3, x1, y1 - 3);
    const done = new Set(); stakes.forEach(([a, b]) => { const key = a + ',' + b; if (done.has(key)) return; done.add(key);
      B.R(a + 2, b - 2, 2, 4, K.shadow); B.R(a, b - 4, 2, 5, K.stake); B.R(a, b - 4, 1, 5, K.stakeHi); B.R(a, b, 2, 1, K.stakeLo); B.R(a + 1, b - 4, 2, 1, K.cloth); B.P(a + 2, b - 3, '#8f2c23'); });
    // 中間一塊「預定地」小木牌（立在陸地上離中心最近的地方）：板子 7×5、兩條字線、一根柱子、影子
    let best = null, bd = 1e9; for (let y = r.y + 6; y < bottom - 6; y += 2) for (let x = r.x + 6; x < r.x + r.w - 6; x += 2) if (landAt(x, y) && landAt(x + 11, y + 6)) { const dd = Math.hypot(x - (r.x + r.w / 2), y - (r.y + (bottom - r.y) / 2)); if (dd < bd) { bd = dd; best = [x, y]; } }
    if (best) { const [a, b] = best; B.R(a + 3, b + 3, 10, 6, K.shadow); B.R(a + 4, b + 6, 2, 5, K.stakeLo); B.R(a + 4, b + 6, 1, 5, K.stake);   // 第三輪：大一點（10×6）、淺木色板子配深色字，手機上一眼看得到
      B.R(a, b, 10, 6, K.stakeLo); B.R(a + 1, b + 1, 8, 4, '#d9b98a'); B.R(a + 1, b + 1, 8, 1, '#ecd5ae'); B.R(a + 2, b + 2, 5, 1, '#5e3c22'); B.R(a + 2, b + 4, 3, 1, '#5e3c22'); B.R(a + 7, b + 3, 1, 2, K.cloth); }
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
    built.forEach(k => { const r = X.rect(k, X.level(s, k)); sites[k] = r; fill(r.x - 8 - (k === 'house' && X.level(s, k) === 3 ? 14 : 0), r.y - 8,   // 平房左邊留給曬衣繩
       r.x + r.w + 8, (r.shore != null ? r.shore : r.y + r.h) + 8); });
    const tier = X.tierOf(s);
    // 還沒蓋、島的等級已經可以蓋的工地：先整平、不長樹（空地）
    X.FAC_KEYS.forEach(k => { if (X.level(s, k) || !(X.TIERS[tier].cap[k] >= 1)) return; const r = X.rect(k, 1); fill(r.x - 4, r.y - 4, r.x + r.w + 4, (r.shore != null ? r.shore : r.y + r.h) + 4); });
    const road = paths(s, land).map(p => ({ k: p.k, segs: p.segs, dots: roadDots(p) })), rr = tier >= 2 ? 3.5 : 2.4, brs = bridgesOf(s);
    brs.forEach(b => lineDots([b.x1, b.y1], [b.x2, b.y2]).forEach(([a, c]) => fill(a - 5, c - 5, a + 6, c + 6)));
    road.forEach(p => p.dots.forEach(([a, b]) => fill(a - rr - 3, b - rr - 3, a + rr + 4, b + rr + 4)));
    // 橋頭接路（第二輪審稿）：大島那頭的橋頭，用小路接到最近的路或設施門口（BFS 只走自己的陸地、繞開設施）
    const links = [];
    { const GW = X.GW, GH = X.GH, blockC = new Uint8Array(GW * GH), tgt = new Uint8Array(GW * GH), cAt = (a, b) => Math.max(0, Math.min(GH - 1, Math.floor(b / C))) * GW + Math.max(0, Math.min(GW - 1, Math.floor(a / C)));
      built.forEach(k => { const r = sites[k]; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const cx = (x + .5) * C, cy = (y + .5) * C; if (cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h) blockC[y * GW + x] = 1; } });
      road.forEach(p => p.dots.forEach(([a, b]) => { const c = cAt(a, b); if (land[c]) tgt[c] = 1; })); built.forEach(k => { const d = doorOf(k, X.level(s, k)); tgt[cAt(d[0], d[1])] = 2; });
      brs.forEach(br => [[br.x1, br.y1, br.a], [br.x2, br.y2, br.b]].forEach(([ex, ey, pl]) => { if (pl === Wd.islet) return; const c0 = cAt(ex, ey); if (tgt[c0]) return;
        const prev = new Int32Array(GW * GH).fill(-2), q = [c0]; prev[c0] = -1; let hit = -1;
        while (q.length && hit < 0) { const c = q.shift(), x = c % GW, y = (c - x) / GW; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X2 = x + dx, Y2 = y + dy; if (X2 < 0 || Y2 < 0 || X2 >= GW || Y2 >= GH) continue; const d = Y2 * GW + X2; if (prev[d] !== -2 || !land[d]) continue; if (tgt[d]) { prev[d] = c; hit = d; break; } if (blockC[d]) continue; prev[d] = c; q.push(d); } }
        if (hit < 0) return; const pts = []; for (let c = hit; c >= 0; c = prev[c]) pts.unshift([(c % GW + .5) * C, (Math.floor(c / GW) + .5) * C]); pts[0] = [ex, ey];
        if (tgt[hit] === 2) { const k = built.find(k => { const d = doorOf(k, X.level(s, k)); return cAt(d[0], d[1]) === hit; }); if (k) pts[pts.length - 1] = doorOf(k, X.level(s, k)); }
        links.push(pts); smooth(pts).forEach(([a, b]) => fill(a - rr - 3, b - rr - 3, a + rr + 4, b + rr + 4)); })); }
    const T = terrain(B, land, occ, seed);
    // 地塊記號另外一層（out.marks，透明底；2026-11-26 島本身審稿）：夜裡疊在夜景上面、不會被夜色染成暗紅褐。
    // 自己的地之間不畫分界（買了就是自己的）；能買的地裡面淡淡一層淺灘色（「買下來島會長到這裡」）＋虛線；鎖放在這次會買的那幾格裡
    const buyable = []; for (let p = 0; p < Wd.P; p++) if (X.plotInfo(s, p).ok) buyable.push(p);
    const isBuy = new Set(buyable), M = new Buf(WW, HH);
    // 淺灘色離島越近越濃、越往外越淡（第二輪審稿：整片平塗像泡在方方的魚塭裡）
    buyable.forEach(p => Wd.cells[p].forEach(c => { const cx = (c % GW) * C, cy = Math.floor(c / GW) * C; for (let v = 0; v < C; v++) for (let u = 0; u < C; u++) { const k = (cy + v) * WW + cx + u, a = Math.max(0, Math.min(1, (T.F[k] - .08) / .3)) * .2; if (a > .01) { M.d[k * 4] = 226; M.d[k * 4 + 1] = 250; M.d[k * 4 + 2] = 244; M.d[k * 4 + 3] = Math.round(a * 255); } } }));
    // 工地那一大塊（X.lotOf）裡面不畫邊、只放一個鎖；還沒買的那幾塊外面一圈照樣畫
    const same = (a, b) => a >= 0 && b >= 0 && Wd.lots.of[a] && Wd.lots.of[a] === Wd.lots.of[b];
    plotEdges(M, Wd.id, (a, b) => isBuy.has(a) && isBuy.has(b) && !same(a, b), 'rgba(215,208,196,.35)', 6);
    plotEdges(M, Wd.id, (a, b) => (isBuy.has(a) && !isBuy.has(b) && !own.has(b)) || (isBuy.has(b) && !isBuy.has(a) && !own.has(a)), 'rgba(215,208,196,.75)', 6);
    if (opt.locks !== false) { const done = new Set(); buyable.forEach(p => { const g = Wd.lots.of[p]; if (g) { if (done.has(g)) return; done.add(g); } const [cx, cy] = lockAt(s, p); lockIcon(M, Math.round(cx), Math.round(cy)); }); }
    const trees = forest(B, T, occ, seed);
    // 工地記號：還沒蓋、可以蓋（或只差地）的設施——跟畫面上原本的白框同一個條件
    X.FAC_KEYS.forEach(k => { if (X.level(s, k)) return; const i = X.facInfo(s, k); if (i.needTier != null && i.why && !i.miss && !i.ok) return; siteMarks(B, T, X.rect(k, 1)); });
    // 陸上的路照舊畫（橋那段也畫，只畫在陸地上，路才接得到橋頭）；再畫橋、圓環
    road.forEach(p => trail(B, p.dots.filter(([a, b]) => T.F[Math.round(b) * WW + Math.round(a)] >= .5), rr, tier >= 2 ? 'stone' : 'dirt'));
    brs.forEach(b => trail(B, lineDots([b.x1, b.y1], [b.x2, b.y2]).filter(([a, c]) => T.F[Math.round(c) * WW + Math.round(a)] >= .5), rr, tier >= 2 ? 'stone' : 'dirt'));
    // 中間小島：從每座橋頭走到小島中間（到伍是圓環，路接到圓環上）
    const ic = X.ISLET ? [X.ISLET[0], X.ISLET[1] + 1] : null;
    if (ic) brs.forEach(b => { const e = b.a === Wd.islet ? [b.x1, b.y1] : b.b === Wd.islet ? [b.x2, b.y2] : null; if (e) trail(B, lineDots(e, ic).filter(([u, v]) => T.F[Math.round(v) * WW + Math.round(u)] >= .5), rr, tier >= 2 ? 'stone' : 'dirt'); });
    links.forEach(pts => trail(B, smooth(pts).filter(([u, v]) => T.F[Math.round(v) * WW + Math.round(u)] >= .5), rr, tier >= 2 ? 'stone' : 'dirt'));
    const bridgeLamps = []; brs.forEach(b => { const e = bridge(B, T.F, [b.x1, b.y1], [b.x2, b.y2], tier >= 2 ? 'stone' : 'wood'); if (e) e.forEach(q => bridgeLamps.push(q)); });
    if (tier >= 4 && own.has(Wd.islet) && ic) roundabout(B, ic[0], ic[1]);
    // 路燈：每個設施門口一盞、小路每隔一段一盞（白天就看得到燈柱）
    const lamps = []; built.forEach(k => lamps.push(doorOf(k, X.level(s, k))));
    road.forEach(p => { for (let i = 14; i < p.dots.length - 10; i += 48) { const [a, b] = p.dots[i], [a2, b2] = p.dots[Math.min(p.dots.length - 1, i + 2)], l = Math.hypot(a2 - a, b2 - b) || 1; const la = [a - (b2 - b) / l * (rr + 4), b + (a2 - a) / l * (rr + 4)]; if (T.F[Math.round(la[1]) * WW + Math.round(la[0])] >= .55 && T.F[Math.round(b) * WW + Math.round(a)] >= .55) lamps.push(la); } });   // 橋上、海上不放
    bridgeLamps.forEach(q => { if (T.F[Math.round(q[1]) * WW + Math.round(q[0])] >= .55) lamps.push(q); });   // 橋頭兩邊各一盞（在陸地上才放）
    lamps.forEach(([a, b]) => lampPost(B, a, b));
    const cv = (opt.canvas || document.createElement('canvas')); cv.width = WW; cv.height = HH;
    const x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    x.putImageData(new ImageData(B.d, WW, HH), 0, 0);
    const mk = opt.marks || document.createElement('canvas'); mk.width = WW; mk.height = HH; mk.getContext('2d').putImageData(new ImageData(M.d, WW, HH), 0, 0);
    built.slice().sort((a, b) => (sites[a].y + sites[a].h) - (sites[b].y + sites[b].h)).forEach(k => {
      const im = IMG[k + X.level(s, k)], r = sites[k]; if (im) x.drawImage(im, r.x, r.y);
      // 平房的曬衣繩：晾你有的衣服（最多四件；設計圖原本那四塊的位置和大小）。
      // 2026-11-26：沒有衣服就連桿子和繩子都不畫（只剩一條線像斷掉的電線），有衣服才在這裡畫。
      // 座標是設計圖 house-stages.html 的，圖從設計圖的 (30, 18) 開始裁（tools/xiaodao/sprites.json 的 house3 ox／oy）
      if (k === 'house' && X.level(s, k) === 3 && X.CLOTH) {
        const mine = s.items.filter(i => X.CLOTH[i.key] && i.qty > 0).sort((a, b) => (a.key + a.c).localeCompare(b.key + b.c)).slice(0, 4);
        const OX = 30, OY = 18;
        if (mine.length) {
          [18, 46].forEach(u => { x.fillStyle = 'rgba(30,40,30,.24)'; x.fillRect(r.x + u - OX + 1, r.y + 24 - OY + 1, 2, 2); x.fillStyle = '#5e3c22'; x.fillRect(r.x + u - OX, r.y + 24 - OY, 2, 2); });
          x.fillStyle = '#ddd6c8'; for (let u = 20; u < 46; u++) x.fillRect(r.x + u - OX, r.y + 25 + Math.round(Math.sin((u - 20) / 26 * Math.PI) * 2) - OY, 1, 1);
        }
        [[22, 5, 6], [29, 4, 7], [35, 5, 5], [41, 3, 4]].forEach(([u, ww, hh], j) => { const it = mine[j]; if (!it) return; const v = 26 + Math.round(Math.sin((u - 20) / 26 * Math.PI) * 2), col = X.CLOTH[it.key].colors[it.c].sw, a = r.x + u - OX, b = r.y + v - OY;
          x.fillStyle = 'rgba(30,40,30,.24)'; x.fillRect(a + 2, b + 2, ww, hh); x.fillStyle = col; x.fillRect(a, b, ww, hh); x.fillStyle = 'rgba(255,255,255,.33)'; x.fillRect(a, b, ww, 1); });
      }
      // 停著的車、船：放在位子正中間（圖本身含右下的影子）
      if (!opt.noVeh && X.slotsOf) X.slotsOf(s, k).forEach(sl => { const v = sl.v && IMG['v/' + sl.v], V = sl.v && X.VEH[sl.v]; if (!v) return;
        if (V.ax != null) x.drawImage(v, Math.round(sl.x + sl.w / 2 - V.ax), Math.round(sl.y + sl.h - V.ay));   // 火箭：地面點對齊位子的底部中間
        else x.drawImage(v, Math.round(sl.x + (sl.w - v.width) / 2 + 1), Math.round(sl.y + (sl.h - v.height) / 2 + 1)); });
    });
    return { canvas: cv, marks: mk, lamps, trees, buyable, sites, paths: road, bridges: brs, W: WW, H: HH, F: T.F };
  }
  // 島上看得到的範圍（自己的地＋能買的地，外面留一點海）
  function bounds(s, pad = 30) {
    const Wd = X.world(), own = new Set(X.island(s).plots); let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let p = 0; p < Wd.P; p++) { if (!own.has(p) && !X.plotInfo(s, p).ok) continue; Wd.cells[p].forEach(k => { const x = k % X.GW, y = Math.floor(k / X.GW); x0 = Math.min(x0, x * C); y0 = Math.min(y0, y * C); x1 = Math.max(x1, (x + 1) * C); y1 = Math.max(y1, (y + 1) * C); }); }
    X.FAC_KEYS.forEach(k => { const lv = X.level(s, k); if (!lv) return; const r = X.rect(k, lv); x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); });
    return { x: Math.max(0, x0 - pad), y: Math.max(0, y0 - pad), w: Math.min(WW, x1 + pad) - Math.max(0, x0 - pad), h: Math.min(HH, y1 + pad) - Math.max(0, y0 - pad) };
  }
  root.XiaodaoDraw = { load, render, bounds, paths, doorOf, lockAt, IMG, W: WW, H: HH, lockIcon, K };
})(window);
