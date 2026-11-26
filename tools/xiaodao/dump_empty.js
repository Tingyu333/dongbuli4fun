// 把各設施設計圖畫成島上用的圖（2026-11-26 改：直接畫在透明底上，影子才是真的半透明）
// 用法（在專案根目錄）：NODE_PATH=… node tools/xiaodao/dump_empty.js 暫存資料夾 → 再 python3 tools/xiaodao/crop.py 暫存資料夾
// 每張設計圖拍兩次：
//   一般（<名>_<i>.png）：跟設計圖一樣（草地、海、樹、載具），拿來找海岸線
//   匯出（<名>_<i>_x.png）：window.__EXPORT = true —— 草地、海岸、海這些底不畫（島自己畫），樹不畫（除非 keep），
//   載具不畫、空位虛線框也不畫（2026-11-26 使用者定：虛線框只在點設施、換車的時候由網頁畫），但位子照樣記下來；
//   設計圖有 slotMark() 的話，每個位子改畫地面標線（車庫：四角 L 形）
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const OUT = process.argv[2] || '.', DIR = path.join(__dirname, '../../docs/plans/jiayuan/');
const SHEETS = {
  'house-stages': { veh: [], slot: null },
  'garage-stages': { veh: ['sedan', 'sports', 'supercar', 'classic', 'camper', 'jeep', 'scooter', 'bike'], slot: 'slot' },
  'dock-stages': { veh: ['canoe', 'raft', 'rowboat', 'motorboat', 'fishing', 'sailboat', 'yacht', 'superyacht', 'runabout', 'cargo'], slot: 'slotBoat', noop: ['wake'] },
  'airfield-stages': { veh: ['balloon', 'paraglider', 'ultralight', 'heli', 'cessna', 'seaplane', 'bizjet', 'biplane', 'jumbo'], slot: 'slotAir' },
  'launchpad-stages': { veh: ['rocketUp'], slot: null, keepVeh: 'booster' },
};
const inject = (cfg, exp) => `
window.__EXPORT = ${exp}; window.__rec = [];
(function () {
  if (window.__EXPORT) {
    // 樹不畫（島自己長樹）；最後一個參數 keep 是 true 的樹算設施的一部分（例如別墅的椰子樹）
    ['tree', 'palm'].forEach(n => { const f = window[n]; if (typeof f !== 'function') return; window[n] = function () { if (arguments[arguments.length - 1] === true) return f.apply(this, arguments); }; });
    ${JSON.stringify(cfg.noop || [])}.forEach(n => { if (typeof window[n] === 'function') window[n] = function () {}; });
    ['lawn', 'coast'].forEach(n => { if (typeof window[n] === 'function') window[n] = function () {}; });
  }
  // 原本就畫好的空位也記下來（label：s 小車位、m 車位）；匯出時不畫
  let mine = false;
  ${JSON.stringify(cfg.slot ? [cfg.slot] : [])}.forEach(n => { const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function (x, a, b, w, h, label) { if (!mine) window.__rec.push({ cv: x.canvas.id, fn: 'empty', box: [a, b, w, h], label: label || '' }); if (window.__EXPORT) { if (typeof window.slotMark === 'function') window.slotMark(x, a, b, w, h); return; } return f.apply(this, arguments); }; });
  ${JSON.stringify(cfg.veh)}.forEach(n => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function (x, a, b, ...rest) {
      // 場景的一部分（例如太空港降落台上的推進器）用 keepVeh 標起來，照畫、不算位子
      if (${JSON.stringify(cfg.keepVeh || '')} && rest.includes(${JSON.stringify(cfg.keepVeh || '')})) return f.apply(this, arguments);
      const s = document.createElement('canvas'); s.width = 400; s.height = 400; const sx = s.getContext('2d'); sx.imageSmoothingEnabled = false;
      f(sx, 150, 150, ...rest);
      const d = sx.getImageData(0, 0, 400, 400).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let j = 0; j < 400; j++) for (let i = 0; i < 400; i++) if (d[(j * 400 + i) * 4 + 3] === 255) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); }
      const box = x1 < 0 ? null : [a + x0 - 150, b + y0 - 150, x1 - x0 + 1, y1 - y0 + 1];
      window.__rec.push({ cv: x.canvas.id, fn: n, a, b, box });
      if (window.__EXPORT) { if (box && typeof window.slotMark === 'function' && n !== 'balloon' && n !== 'paraglider') window.slotMark(x, box[0], box[1], box[2], box[3]); return; }
      ${cfg.slot ? `if (box && n !== 'balloon' && n !== 'paraglider') { mine = true; ${cfg.slot}(x, box[0], box[1], box[2], box[3]); mine = false; }` : ''}
    };
  });
})();
`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route(/^https?:\/\/(?!local\.test\/)/, r => r.abort());
  const all = {};
  for (const [n, cfg] of Object.entries(SHEETS)) for (const exp of [false, true]) {
    await p.unroute('**/' + n + '.html').catch(() => {});
    await p.route('**/' + n + '.html', async r => {
      let html = fs.readFileSync(DIR + n + '.html', 'utf8');
      // 注入在主要 script 的最前面（function 宣告已經提升了，在這裡換掉就會生效）
      const i = html.lastIndexOf('<script>'); html = html.slice(0, i + 8) + inject(cfg, exp) + html.slice(i + 8);
      r.fulfill({ status: 200, contentType: 'text/html', body: html });
    });
    await p.goto('http://local.test/' + n + '.html'); await p.waitForTimeout(600);
    const urls = await p.$$eval('canvas', cs => cs.map(c => [c.id, c.width, c.height, c.toDataURL()]));
    urls.forEach(([id, w, h, u], i) => fs.writeFileSync(path.join(OUT, `${n}_${i}${exp ? '_x' : ''}.png`), Buffer.from(u.split(',')[1], 'base64')));
    if (exp) all[n] = await p.evaluate(() => window.__rec);
    console.log(n, exp ? 'export' : 'normal', urls.length);
  }
  fs.writeFileSync(path.join(__dirname, 'slots.json'), JSON.stringify(all, null, 1));
  console.log(errs.join(' | ') || 'no errors'); await b.close();
})();
