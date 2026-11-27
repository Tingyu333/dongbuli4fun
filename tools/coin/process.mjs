// 讀 raw/<幣>/*.csv（Binance 15 分鐘 K 線），analyze 印出每一段 3 年的漲跌；build 產出 assets/coin/。
import fs from 'fs';
const mode = process.argv[2] || 'analyze';
const SYMS = ['BTCUSDT', 'ETHUSDT', 'DOGEUSDT', 'SOLUSDT', 'PEPEUSDT'];
const Q = 15 * 60 * 1000, DAY = 96, YEAR = 35040;

function load(sym, base = 'raw', step = Q) {
  const dir = base + '/' + sym, rows = [];
  if (!fs.existsSync(dir)) return rows;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.csv')).sort()) {
    for (const line of fs.readFileSync(dir + '/' + f, 'utf8').split('\n')) {
      const c = line.split(',');
      if (c.length < 5 || !/^\d/.test(c[0])) continue;
      let t = Number(c[0]); if (t > 1e14) t = Math.floor(t / 1000);   // 2025 起是微秒
      rows.push({ t, h: +c[2], l: +c[3], c: +c[4] });
    }
  }
  rows.sort((a, b) => a.t - b.t);
  // 補洞：缺的 15 分鐘用前一根收盤
  const out = [];
  for (const r of rows) {
    if (out.length) { const last = out[out.length - 1]; if (r.t <= last.t) continue; for (let t = last.t + step; t < r.t; t += step) out.push({ t, h: last.c, l: last.c, c: last.c, gap: 1 }); }
    out.push(r);
  }
  return out;
}
const iso = t => new Date(t).toISOString().slice(0, 10);

if (mode === 'analyze') {
  for (const sym of SYMS) {
    const d = load(sym);
    if (!d.length) { console.log(sym, '沒有資料'); continue; }
    console.log(`\n=== ${sym} ${iso(d[0].t)} ～ ${iso(d[d.length - 1].t)}（${d.length} 根，缺 ${d.filter(x => x.gap).length}）`);
    const len = Math.min(3 * YEAR, d.length - DAY * 30);
    console.log('起點 | 3年後倍數 | 期間最高 | 期間最低 | 最大回檔 | 半年後 | 一年後 | 單日±10%天數');
    for (let s = 0; s + len <= d.length; s += DAY * 30) {
      const w = d.slice(s, s + len), p0 = w[0].c;
      let hi = 0, lo = Infinity, peak = 0, dd = 0, big = 0;
      for (let i = 0; i < w.length; i++) {
        hi = Math.max(hi, w[i].h); lo = Math.min(lo, w[i].l); peak = Math.max(peak, w[i].c); dd = Math.max(dd, 1 - w[i].c / peak);
        if (i % DAY === 0 && i >= DAY && Math.abs(w[i].c / w[i - DAY].c - 1) > 0.10) big++;
      }
      const at = k => w[Math.min(w.length - 1, k)].c / p0;
      console.log(`${iso(w[0].t)} | ${(w[w.length - 1].c / p0).toFixed(2)} | ${(hi / p0).toFixed(2)} | ${(lo / p0).toFixed(2)} | ${(dd * 100).toFixed(0)}% | ${at(YEAR / 2).toFixed(2)} | ${at(YEAR).toFixed(2)} | ${big}`);
    }
  }
}

// build：照 tools/coin/windows.json 產出 assets/coin/<key>/<第幾段>.json 和 assets/coin/meta.json。
// 檔案裡沒有真實日期、幣名、價格：價格換成「起點＝base」的整數（乘 10^digits），收盤用差分，高低用跟收盤的差。
// 每一段 chunk 根（2976 根＝31 天）。第 0 根是 launch 前 pre 天；遊戲時間 t 的格子 g＝floor((t−launch)/15 分)，那時看得到的是第 pre×96＋g−1 根收完的價格。
if (mode === 'build') {
  const cfg = JSON.parse(fs.readFileSync('tools/coin/windows.json', 'utf8'));
  const meta = { launch: Date.parse(cfg.launch), q: Q, chunk: cfg.chunk, q1: 60000, chunk1: cfg.chunk1 || 2880, coins: [] };
  cfg.chunk1 = meta.chunk1;
  fs.rmSync('assets/coin', { recursive: true, force: true });
  for (const c of cfg.coins) {
    const d = load(c.sym);
    const t0 = Date.parse(c.start + 'T00:00:00Z') - c.pre * DAY * Q;
    let i0 = d.findIndex(x => x.t >= t0);
    if (i0 < 0) throw new Error(c.sym + ' 找不到起點');
    const n = (c.pre + Math.round(c.years * 365.25)) * DAY;
    const w = d.slice(i0, i0 + n);
    if (w.length < n) console.log(`${c.sym} 只有 ${w.length} 根（要 ${n}）`);
    const p0 = w[c.pre * DAY] ? w[c.pre * DAY].c : w[0].c, k = 10 ** c.digits;
    const iv = p => Math.max(1, Math.round(p / p0 * c.base * k));
    fs.mkdirSync('assets/coin/' + c.key, { recursive: true });
    let files = 0;
    for (let s = 0; s < w.length; s += cfg.chunk) {
      const part = w.slice(s, s + cfg.chunk), cs = part.map(x => iv(x.c));
      const out = {
        c: cs.map((v, i) => i ? v - cs[i - 1] : v),
        h: part.map((x, i) => Math.max(0, iv(x.h) - cs[i])),
        l: part.map((x, i) => Math.max(0, cs[i] - iv(x.l)))
      };
      fs.writeFileSync(`assets/coin/${c.key}/${files}.json`, JSON.stringify(out));
      files++;
    }
    // 每分鐘（2026-11-27 使用者要每分鐘跳一次）：跟 15 分鐘同一個縮放（同一個 p0），從 15 分鐘第一根的時間開始對齊，15 根 1 分鐘＝1 根 15 分鐘。
    // 檔名 m<k>.json，每 chunk1 根（2880＝2 天）一個檔
    let files1 = 0, n1 = 0;
    const d1 = load(c.sym, 'raw1m', 60000);
    if (d1.length) {
      const j0 = d1.findIndex(x => x.t >= w[0].t);
      if (j0 < 0 || d1[j0].t !== w[0].t) throw new Error(c.sym + ' 1 分鐘對不上 15 分鐘的起點');
      const w1 = d1.slice(j0, j0 + w.length * 15);
      n1 = w1.length;
      if (n1 < w.length * 15) console.log(`${c.sym} 1 分鐘只有 ${n1} 根（要 ${w.length * 15}）`);
      // 檢查：每 15 根的最後一根收盤＝15 分鐘那根的收盤（抽查）
      let bad = 0; for (let i = 0; i < w.length && i * 15 + 14 < n1; i += 97) if (Math.abs(w1[i * 15 + 14].c - w[i].c) > 1e-12) bad++;
      if (bad) console.log(`${c.sym} 抽查有 ${bad} 根收盤對不上`);
      for (let s = 0; s < n1; s += cfg.chunk1) {
        const part = w1.slice(s, s + cfg.chunk1), cs = part.map(x => iv(x.c));
        const out = { c: cs.map((v, i) => i ? v - cs[i - 1] : v), h: part.map((x, i) => Math.max(0, iv(x.h) - cs[i])), l: part.map((x, i) => Math.max(0, cs[i] - iv(x.l))) };
        fs.writeFileSync(`assets/coin/${c.key}/m${files1}.json`, JSON.stringify(out));
        files1++;
      }
    }
    const cl = w.map(x => x.c / p0);
    meta.coins.push({ key: c.key, base: c.base, digits: c.digits, pre: c.pre * DAY, n: w.length, files, pre1: c.pre * DAY * 15, n1, files1 });
    console.log(`${c.key} ← ${c.sym}：${w.length} 根、${files} 個檔、1 分鐘 ${n1} 根 ${files1} 個檔；起點後 3 年 ${cl[cl.length - 1].toFixed(2)} 倍，最低 ${Math.min(...cl).toFixed(2)}、最高 ${Math.max(...cl).toFixed(2)}`);
  }
  fs.writeFileSync('assets/coin/meta.json', JSON.stringify(meta, null, 1));
  console.log('總大小', Number(require_size('assets/coin') / 1024).toFixed(0), 'KB');
}
function require_size(dir) { let s = 0; for (const f of fs.readdirSync(dir, { withFileTypes: true })) s += f.isDirectory() ? require_size(dir + '/' + f.name) : fs.statSync(dir + '/' + f.name).size; return s; }
