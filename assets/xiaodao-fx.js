// 我的小島：第六批「夜景、會動的東西」。島本身（地形、設施）還是 xiaodao-draw.js 畫成一張大圖，這裡只畫上面會變的：
// 浪（海岸一波一波打上來、海上零星閃光）、停著的車船飛機（每一張都要畫，才能讓其中一台開走）、開走的那台、夜裡的燈。
// 用法：const fx = XiaodaoFX.make(state, out)（out 是 XiaodaoDraw.render 回來的，要帶 noVeh: true 畫）→ fx.paint(ctx, now, night)；
//       fx.trip('garage'|'dock'|'airfield'|'launchpad') 叫一台出去；fx.busy() 有沒有東西在動
(function (root) {
  'use strict';
  const X = root.XiaodaoRules, D = root.XiaodaoDraw, hash = X.hash, TAU = Math.PI * 2;
  // 夜景（2026-11-26 島本身審稿）：原本整片蓋一層 rgba(14,20,52,.58)，所有東西剩四成、顏色變灰（草變灰橄欖、像停電）。
  // 改成先 multiply 一層藍、再薄薄一層深藍：整體亮度差不多，但海和陸地、屋頂的明暗分得開；車船飛機用同一個函式，才不會跟島暗得不一樣
  function nightify(x, w, h, clip) {
    x.globalCompositeOperation = 'multiply'; x.fillStyle = '#5a6a9a'; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'source-over'; x.fillStyle = 'rgba(14,20,52,.18)'; x.fillRect(0, 0, w, h);
    if (clip) { x.globalCompositeOperation = 'destination-in'; x.drawImage(clip, 0, 0); x.globalCompositeOperation = 'source-over'; }
  }
  // 跑道在圖的第幾列（停機坪各階的圖量出來的；貳是直升機坪，沒有跑道）
  const RUNWAY = { 1: 65, 3: 85, 4: 99, 5: 106 };   // 跑道在停機坪圖裡的高度（2026-11-26 壹的圖往上多 2 顆，62 → 64）

  // ---------- 小工具 ----------
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
  const ease = { lin: u => u, in: u => u * u, out: u => 1 - (1 - u) * (1 - u), inout: u => u < .5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u) };
  const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  // 車船飛機的圖：本體（不含原本畫好的影子）、影子剪影、夜裡的本體（調暗）
  const vcache = new Map();
  function vparts(img) {
    let v = vcache.get(img); if (v) return v;
    const w = img.width, h = img.height, b = cv(w, h), bx = b.getContext('2d'); bx.drawImage(img, 0, 0);
    const d = bx.getImageData(0, 0, w, h); for (let k = 3; k < d.data.length; k += 4) if (d.data[k] < 150) d.data[k] = 0; bx.putImageData(d, 0, 0);
    const sh = cv(w, h), sx = sh.getContext('2d'); sx.drawImage(b, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#1e281e'; sx.fillRect(0, 0, w, h);
    const nb = cv(w, h), nx = nb.getContext('2d'); nx.drawImage(b, 0, 0); nightify(nx, w, h, b);
    const ni = cv(w, h), ix = ni.getContext('2d'); ix.drawImage(img, 0, 0); nightify(ix, w, h, img);
    v = { body: b, shadow: sh, nbody: nb, nimg: ni, w, h }; vcache.set(img, v); return v;
  }
  // 圖的朝向：車、船、直升機頭朝下，飛機頭朝上
  // 圖裡車頭／船頭／機頭朝哪：全部都朝下（+y）。2026-11-24 以前飛機和演出船當成朝上，結果倒著飛、倒著開（使用者發現的）
  const baseAng = () => Math.PI / 2;
  const isHeli = key => /^heli/.test(key);
  const isRocket = key => X.VEH[key] && X.VEH[key].ax != null;

  // ---------- 浪 ----------
  // 海岸外面那一圈（離岸 F 在 .28～.45）每一顆照「浪頭」亮或不亮，先做好 8 張，輪流貼
  function waveFrames(out, bounds) {
    const F = out.F, W = out.W, N = 8; if (!F) return null;
    const x0 = Math.max(0, bounds.x | 0), y0 = Math.max(0, bounds.y | 0), x1 = Math.min(W, (bounds.x + bounds.w) | 0), y1 = Math.min(out.H, (bounds.y + bounds.h) | 0), w = x1 - x0, h = y1 - y0;
    if (w <= 0 || h <= 0) return null;
    const jit = new Float32Array(w * h), band = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const f = F[(y0 + j) * W + x0 + i]; if (f > .26 && f < .46) { const k = j * w + i; jit[k] = (X.vnoise(x0 + i, y0 + j, 11, 5) - .5) * .06; band.push(k); } }
    const frames = [];
    for (let n = 0; n < N; n++) {
      const front = .27 + .18 * (n / N), c = cv(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), d = img.data;
      band.forEach(k => { const f = F[(y0 + Math.floor(k / w)) * W + x0 + k % w] + jit[k], gap = front - f; if (gap < 0 || gap > .02) return;
        const a = (gap < .008 ? 200 : 110) * (.55 + .45 * (n / N)), p = k * 4; d[p] = 244; d[p + 1] = 252; d[p + 2] = 250; d[p + 3] = a; });
      x.putImageData(img, 0, 0); frames.push(c);
    }
    // 海上零星的閃光
    const spark = []; for (let t = 0; t < 4000 && spark.length < 60; t++) { const i = Math.floor(hash(t, 3) * w), j = Math.floor(hash(7, t) * h), f = F[(y0 + j) * W + x0 + i]; if (f < .22) spark.push([x0 + i, y0 + j, hash(t, t) * TAU, 2 + hash(t, 9) * 3]); }
    return { frames, x0, y0, spark };
  }

  // ---------- 夜景 ----------
  // 整張島調暗；設施圖裡的窗（淺藍玻璃、本來就是黃色的窗燈）亮起來；小路每隔一段一盞路燈、每個設施門口一盞
  const lightCache = new Map();
  function lightsOf(img, glassOnly) {
    const ck = glassOnly ? 'g' : 'a'; let C2 = lightCache.get(img); if (!C2) lightCache.set(img, C2 = {}); let L = C2[ck]; if (L) return L;
    const w = img.width, h = img.height, c = cv(w, h), x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, w, h).data, kind = new Uint8Array(w * h);   // 1 黃燈、2 玻璃
    for (let k = 0; k < w * h; k++) { const r = d[k * 4], g = d[k * 4 + 1], b = d[k * 4 + 2], a = d[k * 4 + 3]; if (a < 200) continue;
      if (r > 215 && g > 165 && b < 150 && r - b > 85) kind[k] = 1; else if (b > r + 25 && g > r + 8 && r + g + b > 430) kind[k] = 2; }
    // 玻璃分成一塊一塊：小塊是窗（亮暖黃）、大塊是泳池、玻璃屋頂（照原本的顏色亮一點）
    const seen = new Int32Array(w * h).fill(-1), comps = [];
    for (let k = 0; k < w * h; k++) { if (!kind[k] || seen[k] >= 0) continue; const q = [k], list = []; seen[k] = comps.length;
      while (q.length) { const c2 = q.pop(); list.push(c2); const i = c2 % w, j = (c2 - i) / w; (kind[c2] === 1 ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]]).forEach(([u, v]) => { const i2 = i + u, j2 = j + v; if (i2 < 0 || j2 < 0 || i2 >= w || j2 >= h) return; const k2 = j2 * w + i2; if (kind[k2] && seen[k2] < 0) { seen[k2] = comps.length; q.push(k2); } }); }
      comps.push(list); }
    // 2026-11-26：用顏色猜的會猜錯——黃色起重機、黃黑警戒線、金邊（細長條）、花圃的黃花（四周都是草）、太大塊的黃色都不是燈
    const green = q => { const p = q * 4; return d[p + 3] > 200 && d[p + 1] > d[p] + 6 && d[p + 1] > d[p + 2]; };
    for (let ci = comps.length - 1; ci >= 0; ci--) { const list = comps[ci], t = kind[list[0]]; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, nb = 0, ng = 0;
      list.forEach(q => { const i = q % w, j = (q - i) / w; x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([u, v]) => { const i2 = i + u, j2 = j + v; if (i2 < 0 || j2 < 0 || i2 >= w || j2 >= h) return; const q2 = j2 * w + i2; if (seen[q2] === ci) return; nb++; if (green(q2)) ng++; }); });
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, n = list.length, aspect = Math.max(bw, bh) / Math.min(bw, bh), fill = n / (bw * bh);
      // 黃燈至少 2×2（窗都至少 2×2，花是 1 顆）；黃色找連在一起時看八個方向（第二輪審稿：斜的起重機臂、一顆顆的花原本被拆成小塊躲過）
      const notLight = t === 1 ? (n < 4 || Math.min(bw, bh) < 2 || n > 16 || fill < .6 || (aspect > 3 && n > 3) || (nb && ng / nb > .5)) : (n <= 70 && aspect > 3 && n > 4);
      if (notLight) comps.splice(ci, 1); else list.box = [x0, y0, bw, bh];
    }
    // 同一列（或同一行）有 3 塊以上一樣大、間隔一樣的黃色＝警戒線、金邊，全部不亮
    { const ys = comps.filter(l => kind[l[0]] === 1 && l.box), bad = new Set();
      ys.forEach(a => { const same = ys.filter(b => b.box[2] === a.box[2] && b.box[3] === a.box[3] && (b.box[1] === a.box[1] || b.box[0] === a.box[0])); if (same.length >= 3) same.forEach(b => bad.add(b)); });
      for (let ci = comps.length - 1; ci >= 0; ci--) if (bad.has(comps[ci])) comps.splice(ci, 1); }
    const m = cv(w, h), mx = m.getContext('2d'), md = mx.createImageData(w, h), o = md.data, glows = [];
    // 一張圖裡小塊玻璃很多（超過 12 塊）＝格子玻璃屋頂（機庫），整片當大塊玻璃，不要一格一格亮黃燈
    const panes = comps.filter(l => kind[l[0]] === 2 && l.length <= 70).length > 12;
    if (glassOnly) for (let ci = comps.length - 1; ci >= 0; ci--) { const l = comps[ci]; if (kind[l[0]] !== 2 || !(l.length > 70 || panes)) comps.splice(ci, 1); }   // 2026-11-26：有燈名單（FAC.lights）的設施，黃燈照名單，這裡只留大塊玻璃
    comps.forEach(list => { const big = list.length > 70 || (panes && kind[list[0]] === 2); let sx = 0, sy = 0;
      list.forEach(k => { const p = k * 4, warm = kind[k] === 1 || !big; if (warm) { o[p] = 255; o[p + 1] = 214 + (k % 3) * 8; o[p + 2] = 130; } else { o[p] = Math.min(255, d[p] + 40); o[p + 1] = Math.min(255, d[p + 1] + 40); o[p + 2] = Math.min(255, d[p + 2] + 30); } o[p + 3] = big && kind[k] === 2 ? 200 : 255; sx += k % w; sy += Math.floor(k / w); });
      if (!big || kind[list[0]] === 1) glows.push([sx / list.length, sy / list.length, Math.min(14, 5 + Math.sqrt(list.length) * 1.6), big ? 'c' : 'w']); else { if (!panes || list.length > 6) glows.push([sx / list.length, sy / list.length, Math.min(40, Math.sqrt(list.length) * 1.2), 'c']); } });
    mx.putImageData(md, 0, 0); L = { mask: m, glows }; C2[ck] = L; return L;
  }
  function glow(x, a, b, r, col, al) { const g = x.createRadialGradient(a, b, 0, a, b, r); g.addColorStop(0, col.replace('A', al)); g.addColorStop(1, col.replace('A', 0)); x.fillStyle = g; x.fillRect(a - r, b - r, r * 2, r * 2); }
  // 光暈兩層：外圈淡淡一圈＋亮的核心（燈在暗底上才跳得出來）
  function glow2(x, a, b, r, col, al) { glow(x, a, b, r, col, al * .55); glow(x, a, b, r * .35, col, Math.min(1, al * 1.6)); }
  const WARM = 'rgba(255,204,120,A)', COOL = 'rgba(150,215,235,A)';
  function nightWorld(s, out, world) {
    const c = cv(out.W, out.H), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(world, 0, 0); nightify(x, out.W, out.H);
    // 海上一片碎碎的月光（第二輪審稿：原本一條直條像拉鍊、虛線）：寬一點、零零星星、長短不一、上下淡出，不畫在能買的地和近岸
    const b = D.bounds(s, 60), mx = b.x + b.w * .8, F = out.F, Wd = X.world(), buyCell = new Set(); (out.buyable || []).forEach(p => Wd.cells[p].forEach(c => buyCell.add(c)));
    if (F) for (let y = Math.max(2, b.y | 0); y < Math.min(out.H - 2, b.y + b.h); y += 2) { const n = hash(y, 71); if (n < .82) continue;
      const u = (y - b.y) / b.h, len = 2 + Math.floor(hash(y, 3) * 6), xx = Math.round(mx + (hash(71, y) - .5) * 120 * (.4 + u)), cell = Math.floor(y / X.C) * X.GW + Math.floor(xx / X.C);
      if (xx < 0 || xx + len >= out.W || F[y * out.W + xx] > .12 || buyCell.has(cell)) continue;
      const fade = Math.min(1, u * 4, (1 - u) * 4); x.fillStyle = `rgba(214,224,255,${(.05 + (n - .82) * .4) * fade})`; x.fillRect(xx, y, len, 1); }
    // 樹冠左上一點偏藍的月光亮邊
    x.fillStyle = 'rgba(170,190,235,.38)';
    (out.trees || []).forEach(([a, b2, r]) => { for (let t = 0; t < 4; t++) { const g = Math.PI * 1.1 + t * .22; x.fillRect(Math.round(a + Math.cos(g) * (r - 1)), Math.round(b2 + Math.sin(g) * (r - 1)), 1, 1); } });
    // 燈的名單（2026-11-26 第二批審稿：停機坪、發射台的燈不用猜顏色，照設計圖記的位置亮）：e 跑道邊燈、g 綠、r 紅、b 會閃的紅燈（這裡只畫淡淡一圈，閃在 paint）、w 暖燈、F 探照燈照的地方
    const LCOL = { e: ['rgba(255,243,207,A)', '#fff3cf', 6, .34, 2, 1], g: ['rgba(90,255,138,A)', '#a8ffbe', 6, .3, 2, 2], r: ['rgba(255,96,80,A)', '#ff9a8a', 6, .3, 2, 2], w: [WARM, '#ffe6a6', 10, .36, 2, 2], b: ['rgba(255,80,64,A)', null, 6, .14, 0, 0] };
    Object.keys(out.sites).forEach(k => { const lv = X.level(s, k), LL = X.FAC[k].lights && X.FAC[k].lights[lv - 1], r = out.sites[k]; if (!LL) return;
      x.globalCompositeOperation = 'lighter'; LL.forEach(([a, b2, t]) => { if (t === 'F') glow(x, r.x + a, r.y + b2, 30, WARM, .18); else { const c = LCOL[t]; if (c) glow2(x, r.x + a + 1, r.y + b2 + 1, c[2], c[0], c[3]); } });
      x.globalCompositeOperation = 'source-over'; LL.forEach(([a, b2, t]) => { const c = LCOL[t]; if (c && c[1]) { x.fillStyle = c[1]; x.fillRect(r.x + a, r.y + b2, c[4], c[5]); } }); });
    Object.keys(out.sites).forEach(k => { const im = D.IMG[k + X.level(s, k)], r = out.sites[k]; if (!im) return; const L = lightsOf(im, !!(X.FAC[k].lights && X.FAC[k].lights[X.level(s, k) - 1]));
      x.globalCompositeOperation = 'lighter'; L.glows.forEach(([a, b2, rr, t]) => glow2(x, r.x + a, r.y + b2, rr, t === 'c' ? COOL : WARM, t === 'c' ? .2 : .36));
      x.globalCompositeOperation = 'source-over'; x.drawImage(L.mask, r.x, r.y); });
    // 路燈（燈柱白天就畫在圖裡了，xiaodao-draw.js 的 lampPost）：燈頭點亮＋光暈；家門口那盞多一塊暖暖的地面光（原本是屋頂中間一團光）
    const lamps = out.lamps || [], home = out.sites.house ? D.doorOf('house', X.level(s, 'house')) : null;
    x.globalCompositeOperation = 'lighter'; lamps.forEach(([a, b2]) => glow2(x, a + 1, b2 - 4, 12, WARM, .34)); if (home) glow(x, home[0] - 4, home[1] + 2, 16, WARM, .22);
    x.globalCompositeOperation = 'source-over'; lamps.forEach(([a, b2]) => { x.fillStyle = '#fff3cf'; x.fillRect(Math.round(a), Math.round(b2) - 5, 2, 2); });
    return c;
  }

  // ---------- 停著的車船飛機 ----------
  function parked(s) {
    const list = [];
    X.FAC_KEYS.forEach(f => { if (!X.level(s, f) || !X.FAC[f].slots) return; X.slotsOf(s, f).forEach(sl => { const img = sl.v && D.IMG['v/' + sl.v], V = sl.v && X.VEH[sl.v]; if (!img) return;
      const pos = V.ax != null ? [Math.round(sl.x + sl.w / 2 - V.ax), Math.round(sl.y + sl.h - V.ay)] : [Math.round(sl.x + (sl.w - img.width) / 2 + 1), Math.round(sl.y + (sl.h - img.height) / 2 + 1)];
      list.push({ id: f + ':' + sl.i, f, key: sl.v, img, x: pos[0], y: pos[1], sl }); }); });
    return list;
  }

  // ---------- 會動的 ----------
  // 一段路：pts 折線、dur 秒、back 倒車（車頭朝反方向）、alt [起, 終] 離地多高（0 地上、1 天上）、ease、face 固定朝哪（直升機升降）
  // 2026-11-24 使用者說車船飛機動起來卡卡的：原本每一段各自 ease，接起來速度會突然跳（跑道盡頭 71→104）、船繞完一圈沒停就直接倒車。
  // 改成「一段路 leg」：轉角先磨圓（Chaikin），照真的加速度起步、巡航、煞車（梯形速度），段跟段之間速度接得起來；要倒車一定先停。
  function chaikin(pts, n = 2) {
    for (let k = 0; k < n; k++) { if (pts.length < 3) break; const o = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; if (i > 0) o.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25]); if (i < pts.length - 2) o.push([a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]); }
      o.push(pts[pts.length - 1]); pts = o; }
    return pts;
  }
  // 梯形速度：v0 起速、v1 末速、vm 巡航、acc 加速度（顆／秒²）→ { dur, d(t) 走了多遠 }
  function trap(len, v0, v1, vm, acc) {
    let da = (vm * vm - v0 * v0) / (2 * acc), dd = (vm * vm - v1 * v1) / (2 * acc);
    if (da + dd > len) { vm = Math.sqrt(Math.max(v0 * v0, v1 * v1, (2 * acc * len + v0 * v0 + v1 * v1) / 2)); da = Math.max(0, (vm * vm - v0 * v0) / (2 * acc)); dd = Math.max(0, len - da); }
    const ta = (vm - v0) / acc, tc = Math.max(0, (len - da - dd) / vm), td = dd > 0 ? 2 * dd / (vm + v1) : 0, dec = td > 0 ? (vm - v1) / td : 0;
    return { dur: Math.max(.001, ta + tc + td), d: t => t < ta ? v0 * t + acc * t * t / 2 : t < ta + tc ? da + vm * (t - ta) : Math.min(len, da + vm * tc + vm * (t - ta - tc) - dec * Math.pow(t - ta - tc, 2) / 2) };
  }
  function leg(pts, o = {}) {
    const P = o.round === false ? pts : chaikin(pts), g = seg(P, 1, o), T = trap(g.len, o.v0 || 0, o.v1 || 0, o.vm || 28, o.acc || 16);
    g.dur = T.dur; g.dist = T.d; return g;
  }
  function seg(pts, dur, o = {}) {
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return Object.assign({ pts, L, len: L[L.length - 1], dur, ease: 'inout', alt: [0, 0], back: false }, o);
  }
  function at(sg, u) {
    if (sg.pts.length === 1) return [sg.pts[0][0], sg.pts[0][1], sg.alt[0]];
    const d = sg.dist ? sg.dist(u * sg.dur) : ease[sg.ease](u) * sg.len; let i = 1; while (i < sg.pts.length - 1 && sg.L[i] < d) i++;
    const a = sg.pts[i - 1], b = sg.pts[i], l = sg.L[i] - sg.L[i - 1] || 1, t = Math.max(0, Math.min(1, (d - sg.L[i - 1]) / l));
    const alt = sg.altD ? sg.altD(d) : typeof sg.alt === 'function' ? sg.alt(u) : sg.alt[0] + (sg.alt[1] - sg.alt[0]) * u;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, alt];
  }
  // 照時間排好的一串路，可以倒著放（飛機降落＝起飛倒過來）
  function track(segs) { let T = 0; segs.forEach(g => { g.t0 = T; T += g.dur; }); return { segs, T }; }
  function sample(tr, t) { const g = tr.segs.find(q => t < q.t0 + q.dur) || tr.segs[tr.segs.length - 1]; const u = Math.max(0, Math.min(1, (t - g.t0) / g.dur)); return { g, p: at(g, u), u }; }

  function make(s, out, opt = {}) {
    const fxs = { s, out, actors: [], hide: new Set(), parked: parked(s), smoke: [] };
    const b = D.bounds(s, 60); fxs.waves = opt.waves === false ? null : waveFrames(out, b);
    let nightC = null;
    fxs.night = world => nightC || (nightC = nightWorld(s, out, world));
    const sea = (a, b2) => { const F = out.F; if (!F) return true; const i = Math.round(a), j = Math.round(b2); if (i < 0 || j < 0 || i >= out.W || j >= out.H) return true; return F[j * out.W + i] < .44; };

    // 車：從車位往前開出來 → 小路開到家門口 → 停一下 → 開回來倒車入庫
    function carTrip(v) {
      const road = (out.paths || []).find(p => p.k === v.f); if (!road || road.dots.length < 10) return null;
      const V = vparts(v.img), c = [v.x + V.w / 2, v.y + V.h / 2], front = [c[0], c[1] + v.sl.h * .8 + 6], door = road.dots[road.dots.length - 1], home = road.dots[0];
      const dots = road.dots.filter((q, i) => i % 3 === 0), back = dots.slice().reverse();
      // 開出車位接上小路一路開到家（起步、轉彎、到了慢慢停）→ 停一下 → 開回車位前面停好 → 慢慢倒車入庫
      return track([leg([c, front].concat(back), { vm: 30, acc: 22 }), seg([home], 2.4), leg(dots.concat([front]), { vm: 30, acc: 22 }), leg([front, c], { vm: 9, acc: 12, back: true, round: false })]);
    }
    // 船：往海上開、繞一大圈、倒退回碼頭
    function boatTrip(v) {
      const V = vparts(v.img), c = [v.x + V.w / 2, v.y + V.h / 2];
      // 碼頭外面的海可能是島中間的內海（不大）：從大圈試到小圈，整圈都在海上才開
      for (const [out2, r] of [[70, 38], [56, 30], [44, 24], [34, 18]]) for (const dir of [1, -1]) {
        const P = [c[0], c[1] + out2 + V.h / 2], cx = P[0] + r * dir, pts = []; for (let k = 0; k <= 40; k++) { const th = dir > 0 ? Math.PI - k / 40 * TAU : k / 40 * TAU; pts.push([cx + Math.cos(th) * r, P[1] + Math.sin(th) * r]); }
        if (!pts.every(q => sea(q[0], q[1]) && sea(q[0] + 6, q[1]) && sea(q[0] - 6, q[1])) || !sea(P[0], P[1])) continue;
        // 出港、繞一圈回到港口外面慢慢停下 → 停穩了再倒退進碼頭
        return track([leg([c].concat(pts), { vm: 26, acc: 9 }), seg([P], .6), leg([P, c], { vm: 11, acc: 7, back: true, round: false })]);
      }
      return null;
    }
    // 飛機：滑到跑道、往右加速、離地、飛走；回來是倒著放
    function planeTrip(v) {
      const lv = X.level(s, 'airfield'), r = X.rect('airfield', lv), V = vparts(v.img), c = [v.x + V.w / 2, v.y + V.h / 2];
      if (isHeli(v.key)) {
        const up = c.slice(), far = [c[0] + 260, c[1] - 160];
        return track([seg([c, up], 3, { ease: 'inout', alt: [0, .9], face: baseAng(v.key) }), seg([up, far], 4.5, { ease: 'in', alt: [.9, 1.6] })]);
      }
      const ry = RUNWAY[lv];
      if (ry == null) { const p1 = [c[0], c[1] - 50], p2 = [c[0] + 80, c[1] - 420]; return track([seg([c, p1], 3, { ease: 'in', alt: u => Math.max(0, (u - .5) / .5) * .5 }), seg([p1, p2], 4, { ease: 'lin', alt: [.5, 1.6] })]); }
      const y = r.y + ry, a = [c[0], y], end = [r.x + r.w + 20, y], away = [r.x + r.w + 420, y - 110];
      // 滑行到跑道頭停一下 → 一路加速、跑道後段離地、爬升飛走（速度接得起來）；降落是整段倒著放（慢慢減速）
      const run = end[0] - a[0], fly = Math.hypot(away[0] - end[0], away[1] - end[1]), lift = run * .62;
      const alt = d => d < lift ? 0 : d < run ? Math.pow((d - lift) / (run - lift), 1.5) * .5 : .5 + (d - run) / fly * 1.1;
      return track([leg([c, a], { vm: 12, acc: 8, round: false }), seg([a], .5), leg([a, end, away], { vm: 110, v1: 110, acc: 16, round: false, altD: alt })]);
    }
    function start(v, tr, kind) {
      const V = vparts(v.img), a = { v, V, tr, kind, t: 0, dir: 1, ang: baseAng(v.key), wake: [], last: null };
      if (kind === 'plane') { a.plan = [[1, tr.T], [0, 4 + Math.random() * 5], [-1, tr.T]]; } else a.plan = [[1, tr.T]];
      a.step = 0; a.left = a.plan[0][1]; a.dir = a.plan[0][0];
      fxs.actors.push(a); fxs.hide.add(v.id); return true;
    }
    function rocketLaunch(v) {
      const V = vparts(v.img), XV = X.VEH[v.key], g = [v.x + XV.ax, v.y + XV.ay];
      fxs.actors.push({ v, V, kind: 'rocket', t: 0, g, T: 14 }); fxs.hide.add(v.id); return true;
    }
    fxs.trip = (f, pick) => {
      const free = fxs.parked.filter(v => v.f === f && !fxs.hide.has(v.id) && (!pick || v.id === pick));
      if (!free.length) return false; const v = free[Math.floor(Math.random() * free.length)];
      if (f === 'launchpad') return isRocket(v.key) ? rocketLaunch(v) : false;
      const tr = f === 'garage' ? carTrip(v) : f === 'dock' ? boatTrip(v) : f === 'airfield' ? planeTrip(v) : null;
      return tr ? start(v, tr, f === 'airfield' ? 'plane' : f) : false;
    };
    fxs.can = f => fxs.parked.some(v => v.f === f && !fxs.hide.has(v.id) && (f !== 'launchpad' || isRocket(v.key)));
    fxs.busy = () => fxs.actors.length > 0 || fxs.smoke.length > 0;

    // 每一張：浪 → 停著的 → 會動的 → 夜裡會閃的燈
    let lastNow = 0;
    fxs.paint = (x, now, night, still) => {
      const dt = lastNow ? Math.min(.05, (now - lastNow) / 1000) : 0; lastNow = now;
      const W = fxs.waves;
      if (W && !still) {
        const n = W.frames.length, k = Math.floor(now / 3400 * n) % n; x.globalAlpha = night ? .42 : 1; x.drawImage(W.frames[k], W.x0, W.y0); x.globalAlpha = 1;
        W.spark.forEach(([a, b2, ph, sp]) => { const v = Math.pow(Math.max(0, Math.sin(now / 1000 * sp * .5 + ph)), 14); if (v < .05) return; x.fillStyle = night ? `rgba(200,215,255,${v * .7})` : `rgba(255,255,255,${v})`; x.fillRect(a, b2, 2, 1); });
      }
      fxs.parked.forEach(v => { if (fxs.hide.has(v.id)) return; const V = vparts(v.img); x.drawImage(night ? V.nimg : v.img, v.x, v.y); });
      // 會動的
      for (let i = fxs.actors.length - 1; i >= 0; i--) { const a = fxs.actors[i]; if (a.kind === 'rocket' ? drawRocket(x, a, dt, night) : drawActor(x, a, dt, night)) { fxs.actors.splice(i, 1); fxs.hide.delete(a.v.id); } }
      // 煙
      for (let i = fxs.smoke.length - 1; i >= 0; i--) { const p = fxs.smoke[i]; p.life -= dt; if (p.life <= 0) { fxs.smoke.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .97; p.vy *= .97; p.r += dt * 4;
        const al = Math.min(1, p.life / p.max * 1.4) * .55; x.fillStyle = night ? `rgba(120,125,145,${al})` : `rgba(236,232,224,${al})`; x.beginPath(); x.arc(p.x, p.y, p.r, 0, TAU); x.fill(); }
      // 夜裡：私人港灣的燈塔一道慢慢轉的光（燈室在碼頭伍的圖裡 (150, 62)）
      if (night && X.level(s, 'dock') === 5 && out.sites.dock) { const r = out.sites.dock, lx = r.x + 150, ly = r.y + 62, th = now / 1000 * .9;
        x.save(); x.globalCompositeOperation = 'lighter'; const g = x.createRadialGradient(lx, ly, 0, lx, ly, 70); g.addColorStop(0, 'rgba(255,236,170,.32)'); g.addColorStop(1, 'rgba(255,236,170,0)'); x.fillStyle = g;
        x.beginPath(); x.moveTo(lx, ly); x.arc(lx, ly, 70, th - .16, th + .16); x.closePath(); x.fill(); x.restore(); }
      // 夜裡：塔台、鐵塔、避雷針頂上的紅燈（燈名單裡的 b）一閃一閃（2026-11-26 第二批審稿）
      if (night) ['airfield', 'launchpad'].forEach(k => { const lv = X.level(s, k), LL = lv && X.FAC[k].lights && X.FAC[k].lights[lv - 1], r = out.sites[k]; if (!LL || !r) return;
        LL.forEach(([a, b2, t], i) => { if (t !== 'b' || Math.floor(now / 900 + i * .37) % 2) return; const u = r.x + a + 1, v = r.y + b2 + 1;
          x.save(); x.globalCompositeOperation = 'lighter'; const g = x.createRadialGradient(u, v, 0, u, v, 7); g.addColorStop(0, 'rgba(255,90,70,.55)'); g.addColorStop(1, 'rgba(255,90,70,0)'); x.fillStyle = g; x.fillRect(u - 7, v - 7, 14, 14); x.restore();
          x.fillStyle = '#ff7a66'; x.fillRect(r.x + a, r.y + b2, 2, 2); }); });
      // 夜裡：飛機翼尖、火箭頂端的紅燈一閃一閃
      if (night) { const on = Math.floor(now / 700) % 2 === 0; if (on) fxs.parked.forEach(v => { if (fxs.hide.has(v.id)) return; if (isRocket(v.key)) { x.fillStyle = '#ff5a4a'; x.fillRect(v.x + X.VEH[v.key].ax, v.y + 1, 1, 1); } else if (v.f === 'airfield' && !isHeli(v.key)) { x.fillStyle = '#ff5a4a'; x.fillRect(v.x + 1, v.y + v.img.height * .3, 1, 1); x.fillStyle = '#5aff8a'; x.fillRect(v.x + v.img.width - 3, v.y + v.img.height * .3, 1, 1); } }); }
    };
    function drawActor(x, a, dt, night) {
      a.left -= dt; a.t += dt * a.dir;
      if (a.left <= 0) { a.step++; if (a.step >= a.plan.length) return true; a.dir = a.plan[a.step][0]; a.left = a.plan[a.step][1]; a.t = a.dir < 0 ? a.tr.T : a.dir === 0 ? a.t : 0; if (a.dir < 0) { a.ang += Math.PI; a.last = null; } }
      if (a.dir === 0) return false;   // 飛出去了，等一下再回來
      const { g, p } = sample(a.tr, Math.max(0, Math.min(a.tr.T - 1e-6, a.t))), [px, py, alt] = p;
      if (a.last) { const dx = px - a.last[0], dy = py - a.last[1]; if (g.face != null) a.ang += angDiff(a.ang, g.face) * Math.min(1, dt * 3); else if (Math.hypot(dx, dy) > .02) { const tgt = Math.atan2(dy, dx) + (g.back ? Math.PI : 0); a.ang += angDiff(a.ang, tgt) * Math.min(1, dt * 7); } }
      a.last = [px, py];
      const V = a.V, sc = 1 + alt * .9, rot = a.ang - baseAng(a.v.key), fade = alt > 1.1 ? Math.max(0, 1 - (alt - 1.1) / .5) : 1;
      // 船尾的浪花
      if (a.kind === 'dock') { a.wake.push([px, py, 1]); a.wake.forEach(w => { w[2] -= dt * .5; }); a.wake = a.wake.filter(w => w[2] > 0).slice(-90); a.wake.forEach(([wx, wy, l], i) => { if (i % 2) return; x.fillStyle = `rgba(227,239,237,${l * .7})`; x.fillRect(Math.round(wx - Math.sin(a.ang) * 0), Math.round(wy), 2, 1); }); }
      // 影子（越高離越遠、越淡）
      // 在動的車船飛機開平滑：位置不在整數顆、又會轉，不開的話邊緣一直閃、看起來一格一格
      x.save(); x.imageSmoothingEnabled = true; x.globalAlpha = .24 * (1 - Math.min(1, alt) * .55) * fade; x.translate(px + 2 + alt * 16, py + 2 + alt * 12); x.rotate(rot); x.drawImage(V.shadow, -V.w / 2, -V.h / 2); x.restore();
      x.save(); x.imageSmoothingEnabled = true; x.globalAlpha = fade; x.translate(px, py); x.rotate(rot); x.scale(sc, sc); x.drawImage(night ? V.nbody : V.body, -V.w / 2, -V.h / 2); x.restore();
      // 夜裡車頭燈
      if (night && a.kind === 'garage') { const fx = px + Math.cos(a.ang) * V.h * .5, fy = py + Math.sin(a.ang) * V.h * .5; x.globalCompositeOperation = 'lighter'; glow(x, fx + Math.cos(a.ang) * 8, fy + Math.sin(a.ang) * 8, 11, WARM, .45); x.globalCompositeOperation = 'source-over'; }
      if (night && a.kind === 'plane' && alt > 0) { const on = Math.floor(performance.now() / 500) % 2; if (on) { x.fillStyle = '#ff5a4a'; x.fillRect(px, py, 1.5, 1.5); } }
      return false;
    }
    // 火箭：點火冒煙 → 往上飛（俯瞰：越飛越大、越淡）→ 不見 → 回來（重複使用的火箭，倒著降落）→ 落地冒煙
    function puff(g, n, spd) { for (let i = 0; i < n; i++) { const th = Math.random() * TAU, v = spd * (.4 + Math.random() * .6); fxs.smoke.push({ x: g[0] + (Math.random() - .5) * 4, y: g[1] + (Math.random() - .5) * 3, vx: Math.cos(th) * v, vy: Math.sin(th) * v * .6, r: 2 + Math.random() * 3, life: 2.5 + Math.random() * 2, max: 4.5 }); } }
    function drawRocket(x, a, dt, night) {
      a.t += dt; const t = a.t, V = a.V, g = a.g, XV = X.VEH[a.v.key];
      // 0～1.6 點火、1.6～5.4 上升、5.4～8.6 不見、8.6～12.4 下降、12.4～14 落地
      let lift = 0, flame = 0;
      if (t < 1.6) { flame = t / 1.6; if (Math.random() < dt * 30) puff(g, 2, 26); }
      else if (t < 5.4) { const u = (t - 1.6) / 3.8; lift = u * u; flame = 1; if (u < .5 && Math.random() < dt * 25) puff(g, 2, 32); }
      else if (t < 8.6) lift = 1.2;
      else if (t < 12.4) { const u = 1 - (t - 8.6) / 3.8; lift = u * u; flame = 1; if (u < .3 && Math.random() < dt * 25) puff(g, 2, 28); }
      else if (t < 14) { flame = Math.max(0, 1 - (t - 12.4) / .6); if (t - dt < 12.45) puff(g, 14, 30); }
      else return true;
      if (lift >= 1.15) return false;
      const sc = 1 + lift * 2.2, al = lift > .55 ? Math.max(0, 1 - (lift - .55) / .45) : 1, shake = flame && lift < .1 ? (Math.random() - .5) * .8 : 0, up = lift * 70;
      // 地上的影子（火箭離地就慢慢淡掉）
      x.save(); x.globalAlpha = .24 * Math.max(0, 1 - lift * 2); x.drawImage(V.shadow, a.v.x + 2, a.v.y + 2); x.restore();
      // 火焰（在火箭底下，俯瞰看到的是一圈亮光）
      if (flame) { x.globalCompositeOperation = 'lighter'; glow(x, g[0] + shake, g[1] - up * .3, 9 * flame * (1 + lift), 'rgba(255,170,80,A)', .8); glow(x, g[0] + shake, g[1] - up * .3, 4 * flame * (1 + lift), 'rgba(255,245,210,A)', .9); x.globalCompositeOperation = 'source-over'; }
      x.save(); x.imageSmoothingEnabled = lift > 0; x.globalAlpha = al; x.translate(g[0] + shake, g[1] - up); x.scale(sc, sc); x.drawImage(night ? V.nbody : V.body, -XV.ax, -XV.ay); x.restore();
      return false;
    }
    return fxs;
  }
  root.XiaodaoFX = { make, vparts, nightify, RUNWAY };
})(window);
