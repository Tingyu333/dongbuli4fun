// 讀 raw/<幣>/*.csv（Binance 15 分鐘 K 線），analyze 印出每一段 3 年的漲跌；build 產出 assets/coin/。
import fs from 'fs';
const mode = process.argv[2] || 'analyze';
const SYMS = ['BTCUSDT', 'ETHUSDT', 'DOGEUSDT', 'SOLUSDT', 'PEPEUSDT'];
const Q = 15 * 60 * 1000, DAY = 96, YEAR = 35040;

function load(sym) {
  const dir = 'raw/' + sym, rows = [];
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
    if (out.length) { const last = out[out.length - 1]; if (r.t <= last.t) continue; for (let t = last.t + Q; t < r.t; t += Q) out.push({ t, h: last.c, l: last.c, c: last.c, gap: 1 }); }
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
