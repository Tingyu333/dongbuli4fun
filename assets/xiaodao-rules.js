// 我的小島：規則（純計算，不碰畫面）。網頁和後端用同一份，後端 Code.gs 之後貼一份一模一樣的進去。
// - 世界是固定的：一格 20 顆像素，44 × 38 格；地塊是不規則的一片（在格子上撒點，每一格歸最近的點），大家的地塊切法都一樣。
// - 設施的位置固定（每種設施一個「工地」），等級越高越大；蓋某一級要先擁有那一級占到的地塊。
// - 南邊一片海永遠是海（家蓋到海景別墅要靠海、碼頭要伸進海裡），那裡的格子不屬於任何地塊。
// - 存檔是一份清單（之後屋內、家具、車都是同一種寫法，見 docs/plans/jiayuan/README.md「擴充性」）。
(function (root) {
  'use strict';
  const C = 20, GW = 44, GH = 38, SEED = 37, COAST = 480;
  const SEA = [[200, 480, 520, 140]];                     // 永遠是海的範圍（像素）：[x, y, w, h]

  // 設施：mode 是每一級的圖怎麼對齊工地（br 右下、bl 左下、bc 下面置中、shore 海岸線置中）
  // sprites：每一級的圖 [寬, 高, 海岸線在圖裡第幾列]（從設計圖裁出來的，assets/xiaodao/<key><級>.png）
  const FAC = {
    house: {
      name: '家', mode: 'br', ax: 420, ay: COAST, door: 'r',
      levels: ['帳篷', '木屋', '紅瓦平房', '兩層洋房', '海景別墅'],
      prices: [0, 8000, 45000, 300000, 1200000],
      sprites: [[139, 87], [128, 92], [154, 96], [182, 106], [141, 87, 93]],
    },
    garage: {
      name: '車庫', mode: 'bl', ax: 480, ay: 440, door: 'b',
      levels: ['腳踏車棚', '車棚', '單車庫', '雙車庫＋工作坊', '展示車廊'],
      prices: [2000, 20000, 75000, 400000, 1200000],
      sprites: [[78, 81], [102, 102], [91, 110], [146, 114], [174, 112]],
    },
    dock: {
      name: '碼頭', mode: 'shore', ax: 560, ay: COAST, door: 't',
      levels: ['小木台', '木棧橋', '漁港碼頭', '遊艇碼頭', '私人港灣'],
      prices: [2000, 20000, 90000, 500000, 1600000],
      sprites: [[57, 43, 10], [54, 83, 9], [117, 87, 9], [166, 79, 8], [198, 98, 21]],
    },
    airfield: {
      name: '停機坪', mode: 'bc', ax: 330, ay: 340, door: 'b',
      levels: ['草地起降場', '直升機坪', '小機場', '私人機場', '航空站'],
      prices: [45000, 150000, 600000, 2000000, 6000000],
      sprites: [[180, 75], [150, 80], [200, 98], [200, 114], [200, 118]],
    },
    launchpad: {
      name: '發射台', mode: 'bc', ax: 590, ay: 300, door: 'b', needs: { airfield: 4 },
      levels: ['小發射架', '發射塔', '太空港'],
      prices: [2000000, 6000000, 16000000],
      sprites: [[120, 89], [170, 113], [194, 130]],
    },
  };
  const FAC_KEYS = ['house', 'garage', 'dock', 'airfield', 'launchpad'];
  const START = { house: 1 };                             // 一開始送帳篷

  // 島的等級：地塊（含一開始送的，送 12 塊）幾塊升一階；全部設施蓋到最高剛好要 40 塊，cap 是每種設施最高到幾級（0＝還不能蓋）
  const TIERS = [
    { name: '壹', n: 0,  cap: { house: 2, garage: 2, dock: 2, airfield: 0, launchpad: 0 } },
    { name: '貳', n: 16, cap: { house: 3, garage: 3, dock: 3, airfield: 2, launchpad: 0 } },
    { name: '參', n: 22, cap: { house: 4, garage: 4, dock: 4, airfield: 3, launchpad: 0 } },
    { name: '肆', n: 30, cap: { house: 5, garage: 5, dock: 5, airfield: 4, launchpad: 0 } },
    { name: '伍', n: 40, cap: { house: 5, garage: 5, dock: 5, airfield: 5, launchpad: 3 } },
  ];
  // 第 n 塊買的地（不算送的）：$1,500 × 1.2ⁿ，取到百位（第 1 塊 $1,800、第 10 塊約 $9,300、第 20 塊約 $5.7 萬、第 28 塊（到伍）約 $35.6 萬，買到伍加起來約 128 萬）
  const plotPrice = n => Math.round(1500 * Math.pow(1.2, n) / 100) * 100;

  // ---------- 世界：地塊怎麼切 ----------
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  function vnoise(a, b, g, seed) {
    const i = Math.floor(a / g), j = Math.floor(b / g), u = a / g - i, v = b / g - j, s = t => t * t * (3 - 2 * t);
    const h = (x, y) => hash(x + seed * 101, y - seed * 37);
    return (h(i, j) * (1 - s(u)) + h(i + 1, j) * s(u)) * (1 - s(v)) + (h(i, j + 1) * (1 - s(u)) + h(i + 1, j + 1) * s(u)) * s(v);
  }
  const inSea = (px, py) => SEA.some(([x, y, w, h]) => px >= x && px < x + w && py >= y && py < y + h);

  let WORLD = null;
  function world() {
    if (WORLD) return WORLD;
    const N = GW * GH, raw = new Int32Array(N), seeds = [];
    for (let j = -1; j <= GH / 3 + 1; j++) for (let i = -1; i <= GW / 3 + 1; i++)
      seeds.push([i * 3 + 1.5 + (hash(i * 7 + SEED, j) - .5) * 2.4 + (j % 2) * 1.5, j * 3 + 1.5 + (hash(j * 5, i + SEED) - .5) * 2.4]);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const k = y * GW + x;
      if (inSea((x + .5) * C, (y + .5) * C)) { raw[k] = -1; continue; }
      let best = 1e9, bi = 0; const jit = (vnoise(x * C, y * C, 50, SEED) - .5) * 2.4;
      seeds.forEach(([a, b], s) => { const d = Math.hypot(x + .5 - a, y + .5 - b) + jit * (hash(s, SEED) - .5); if (d < best) { best = d; bi = s; } });
      raw[k] = bi;
    }
    // 同一個點被海切成兩半的，分成兩塊（連通的才算同一塊）
    const id = new Int32Array(N).fill(-1); let n = 0;
    for (let k = 0; k < N; k++) {
      if (raw[k] < 0 || id[k] >= 0) continue;
      const q = [k]; id[k] = n;
      while (q.length) { const c = q.pop(), x = c % GW, y = (c - x) / GW;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= GW || Y >= GH) return; const d = Y * GW + X; if (id[d] < 0 && raw[d] === raw[k]) { id[d] = n; q.push(d); } }); }
      n++;
    }
    // 太小的（被海切剩一兩格）併到旁邊最大的那塊
    const sizes = () => { const s = new Array(n).fill(0); for (let k = 0; k < N; k++) if (id[k] >= 0) s[id[k]]++; return s; };
    let size = sizes();
    for (let k = 0; k < N; k++) {
      const p = id[k]; if (p < 0 || size[p] >= 4) continue;
      const x = k % GW, y = (k - x) / GW; let best = -1;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= GW || Y >= GH) return; const q = id[Y * GW + X]; if (q >= 0 && q !== p && (best < 0 || size[q] > size[best])) best = q; });
      if (best >= 0) { for (let c = 0; c < N; c++) if (id[c] === p) id[c] = best; size = sizes(); }
    }
    // 重新編號 0..P-1
    const remap = new Map(); for (let k = 0; k < N; k++) if (id[k] >= 0 && !remap.has(id[k])) remap.set(id[k], remap.size);
    for (let k = 0; k < N; k++) if (id[k] >= 0) id[k] = remap.get(id[k]);
    const P = remap.size, cells = Array.from({ length: P }, () => []), nb = Array.from({ length: P }, () => new Set()), border = new Array(P).fill(false);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const k = y * GW + x, p = id[k]; if (p < 0) continue;
      cells[p].push(k);
      if (x <= 1 || y <= 1 || x >= GW - 2 || y >= GH - 2) border[p] = true;   // 世界邊邊那圈留給海
      if (x + 1 < GW) { const q = id[k + 1]; if (q >= 0 && q !== p) { nb[p].add(q); nb[q].add(p); } }
      if (y + 1 < GH) { const q = id[k + GW]; if (q >= 0 && q !== p) { nb[p].add(q); nb[q].add(p); } }
    }
    const center = cells.map(cs => { let sx = 0, sy = 0; cs.forEach(k => { sx += k % GW; sy += Math.floor(k / GW); }); return [(sx / cs.length + .5) * C, (sy / cs.length + .5) * C]; });
    WORLD = { id, P, cells, nb: nb.map(s => [...s].sort((a, b) => a - b)), border, center };
    WORLD.start = startPlots();
    return WORLD;
  }

  // ---------- 設施的位置 ----------
  // 某一級的圖放在哪（像素）：{ x, y, w, h, shore }（shore：碼頭、別墅的海岸線在第幾列，世界座標）
  function rect(key, lv) {
    const f = FAC[key], [w, h, sh] = f.sprites[lv - 1];
    if (f.mode === 'br') { const gap = sh != null ? sh - h : 2; return { x: f.ax - w, y: f.ay - gap - h, w, h }; }
    if (f.mode === 'bl') return { x: f.ax, y: f.ay - h, w, h };
    if (f.mode === 'bc') return { x: Math.round(f.ax - w / 2), y: f.ay - h, w, h };
    return { x: Math.round(f.ax - w / 2), y: f.ay - sh, w, h, shore: f.ay };   // shore：海岸線對齊
  }
  // 這一級要先有哪幾塊地（格子中心在圖裡的那幾格；碼頭只算岸上那段）
  function needPlots(key, lv) {
    const W = world(), r = rect(key, lv), out = new Set(), bad = [];
    const y1 = r.shore != null ? r.shore : r.y + r.h, y0 = r.shore != null ? Math.min(r.y, r.shore - C) : r.y + 3;   // 碼頭：岸邊那一排格子一定要是陸地
    for (let y = Math.floor(y0 / C); y < Math.ceil(y1 / C); y++) for (let x = Math.floor(r.x / C); x < Math.ceil((r.x + r.w) / C); x++) {
      const cx = (x + .5) * C, cy = (y + .5) * C;
      if (cx < r.x + 3 || cx > r.x + r.w - 3 || cy < y0 || cy > y1 - 1) continue;
      const p = W.id[y * GW + x]; if (p >= 0) out.add(p); else bad.push([x, y]);
    }
    return { plots: [...out].sort((a, b) => a - b), bad };
  }
  // 一開始送的地：帳篷、腳踏車棚、小木台底下那幾塊＋把它們連起來
  function startPlots() {
    const W = WORLD, own = new Set();
    [['house', 1], ['garage', 1], ['dock', 1]].forEach(([k, l]) => needPlots(k, l).plots.forEach(p => own.add(p)));
    // 用最短的地塊路徑把幾群連起來（BFS）
    const groups = () => { const g = new Map(); let n = 0; own.forEach(p => { if (g.has(p)) return; const q = [p]; g.set(p, n); while (q.length) { const c = q.pop(); W.nb[c].forEach(d => { if (own.has(d) && !g.has(d)) { g.set(d, n); q.push(d); } }); } n++; }); return { g, n }; };
    for (let guard = 0; guard < 10; guard++) {
      const { g, n } = groups(); if (n <= 1) break;
      const from = [...own].filter(p => g.get(p) === 0), prev = new Map(from.map(p => [p, -1])), q = from.slice(); let hit = -1;
      while (q.length && hit < 0) { const c = q.shift(); for (const d of W.nb[c]) { if (prev.has(d)) continue; prev.set(d, c); if (own.has(d) && g.get(d) !== 0) { hit = d; break; } q.push(d); } }
      if (hit < 0) break;
      for (let c = prev.get(hit); c >= 0 && !own.has(c); c = prev.get(c)) own.add(c);
    }
    return [...own].sort((a, b) => a - b);
  }

  // ---------- 存檔 ----------
  // { v: 1, items: [ { id: 'i1', key: 'island', plots: [擁有的地塊（含送的）], bought: 買過幾塊 },
  //                  { id: 'f-house', key: 'house', lv: 1, in: 'i1', at: 'house' }, … ] }
  // 設施的 at 先是工地的名字（位置固定）；之後開放移動，改成格子座標就好。
  function fresh() {
    const W = world();
    const items = [{ id: 'i1', key: 'island', plots: W.start.slice(), bought: 0 }];
    Object.keys(START).forEach(k => items.push({ id: 'f-' + k, key: k, lv: START[k], in: 'i1', at: k }));
    return { v: 1, items };
  }
  function clean(s) {   // 讀進來的存檔整理一下（壞掉的就重新開始）
    if (!s || s.v !== 1 || !Array.isArray(s.items)) return fresh();
    const W = world(), isl = s.items.find(i => i && i.key === 'island');
    if (!isl || !Array.isArray(isl.plots)) return fresh();
    const plots = [...new Set(W.start.concat(isl.plots.filter(p => Number.isInteger(p) && p >= 0 && p < W.P)))].sort((a, b) => a - b);
    const items = [{ id: 'i1', key: 'island', plots, bought: Math.max(0, Math.floor(Number(isl.bought) || 0)) }];
    FAC_KEYS.forEach(k => { const it = s.items.find(i => i && i.key === k), max = FAC[k].levels.length; const lv = it ? Math.max(0, Math.min(max, Math.floor(Number(it.lv) || 0))) : (START[k] || 0); if (lv) items.push({ id: 'f-' + k, key: k, lv, in: 'i1', at: k }); });
    s.items.forEach(i => { if (i && i.key !== 'island' && !FAC[i.key]) items.push(i); });   // 之後的東西（車、家具…）原樣留著
    return { v: 1, items };
  }
  const island = s => s.items.find(i => i.key === 'island');
  const level = (s, k) => { const it = s.items.find(i => i.key === k); return it ? it.lv : 0; };
  function tierOf(s) { const n = island(s).plots.length; let t = 0; TIERS.forEach((x, i) => { if (n >= x.n) t = i; }); return t; }
  const nextTier = s => TIERS[tierOf(s) + 1] || null;

  // 這塊地能不能買
  function plotInfo(s, p) {
    const W = world(), own = new Set(island(s).plots);
    if (!(p >= 0 && p < W.P)) return { ok: false, why: '沒有這塊地' };
    if (own.has(p)) return { ok: false, why: '已經是你的了', owned: true };
    if (W.border[p]) return { ok: false, why: '太外海了，船開不到' };
    const price = plotPrice(island(s).bought + 1), size = W.cells[p].length;
    if (!W.nb[p].some(q => own.has(q))) return { ok: false, why: '要跟你的地連著才能買', price, size };
    return { ok: true, price, size };
  }
  // 某種設施的下一級：能不能蓋、差什麼
  function facInfo(s, k) {
    const f = FAC[k]; if (!f) return { ok: false, why: '沒有這種設施' };
    const lv = level(s, k), max = f.levels.length;
    if (lv >= max) return { ok: false, lv, max: true, why: '已經是最高級了' };
    const nl = lv + 1, t = tierOf(s), cap = TIERS[t].cap[k] || 0, price = f.prices[nl - 1];
    const out = { lv, next: nl, name: f.levels[nl - 1], price };
    if (nl > cap) {
      const ti = TIERS.findIndex(x => (x.cap[k] || 0) >= nl);
      return Object.assign(out, { ok: false, needTier: ti, why: `島升到「${TIERS[ti].name}」才能蓋` });
    }
    if (f.needs) for (const q of Object.keys(f.needs)) if (level(s, q) < f.needs[q]) return Object.assign(out, { ok: false, why: `${FAC[q].name}要先蓋到「${FAC[q].levels[f.needs[q] - 1]}」` });
    const own = new Set(island(s).plots), miss = needPlots(k, nl).plots.filter(p => !own.has(p));
    if (miss.length) return Object.assign(out, { ok: false, miss, why: `工地還差 ${miss.length} 塊地` });
    return Object.assign(out, { ok: true });
  }

  // 做一件事：{ t: 'plot', p } 買地、{ t: 'build', k } 蓋或升一級。money 是錢包有多少。
  // 回 { ok: true, cost, state, msg } 或 { ok: false, err }；不改原本的 state。
  function apply(s0, act, money) {
    const s = clean(JSON.parse(JSON.stringify(s0)));
    if (!act || typeof act !== 'object') return { ok: false, err: '看不懂要做什麼' };
    if (act.t === 'plot') {
      const p = Math.floor(Number(act.p)), info = plotInfo(s, p);
      if (!info.ok) return { ok: false, err: info.why };
      if (!(money >= info.price)) return { ok: false, err: '錢包不夠' };
      const before = tierOf(s), isl = island(s);
      isl.plots.push(p); isl.plots.sort((a, b) => a - b); isl.bought++;
      const after = tierOf(s);
      return { ok: true, cost: info.price, state: s, tierUp: after > before ? after : 0 };
    }
    if (act.t === 'build') {
      const k = String(act.k || ''), info = facInfo(s, k);
      if (!info.ok) return { ok: false, err: info.why };
      if (!(money >= info.price)) return { ok: false, err: '錢包不夠' };
      const it = s.items.find(i => i.key === k);
      if (it) it.lv = info.next; else s.items.push({ id: 'f-' + k, key: k, lv: info.next, in: 'i1', at: k });
      return { ok: true, cost: info.price, state: s, built: k, lv: info.next };
    }
    return { ok: false, err: '看不懂要做什麼' };
  }
  // 小島值多少（身價・榜之後用；送的不算）
  function worth(s) {
    let t = 0; const isl = island(s);
    for (let n = 1; n <= isl.bought; n++) t += plotPrice(n);
    FAC_KEYS.forEach(k => { const lv = level(s, k); for (let l = 1; l <= lv; l++) t += FAC[k].prices[l - 1]; });
    return t;
  }

  const R = { C, GW, GH, COAST, SEA, FAC, FAC_KEYS, TIERS, START, hash, vnoise, inSea, world, rect, needPlots, plotPrice, fresh, clean, island, level, tierOf, nextTier, plotInfo, facInfo, apply, worth };
  root.XiaodaoRules = R;
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof window !== 'undefined' ? window : this);
