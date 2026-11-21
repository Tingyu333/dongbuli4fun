// 把各設施設計圖畫成「空的」：樹不畫、載具換成同大小的空位虛線框，順便記下每個車位／泊位／機位的位置（第二批要用）
// 用法（在專案根目錄）：node tools/xiaodao/dump_empty.js 暫存資料夾 → 再 python3 tools/xiaodao/crop.py 暫存資料夾
const { chromium } = require('playwright'); const fs = require('fs'); const OUT = process.argv[2] || '.';
const SHEETS = {
  'house-stages': { veh: [], slot: null },
  'garage-stages': { veh: ['sedan', 'sports', 'supercar', 'classic', 'camper', 'jeep', 'scooter', 'bike'], slot: 'slot' },
  'dock-stages': { veh: ['canoe', 'raft', 'rowboat', 'motorboat', 'fishing', 'sailboat', 'yacht', 'superyacht', 'runabout', 'cargo'], slot: 'slotBoat', noop: ['wake'] },
  'airfield-stages': { veh: ['balloon', 'paraglider', 'ultralight', 'heli', 'cessna', 'seaplane', 'bizjet', 'biplane', 'jumbo'], slot: 'slotAir' },
  'launchpad-stages': { veh: ['rocketUp'], slot: null },
};
const inject = (cfg) => `
window.__rec = [];
(function () {
  const noop = ['tree', 'palm'].concat(${JSON.stringify(cfg.noop || [])});
  noop.forEach(n => { if (typeof window[n] === 'function') window[n] = function () {}; });
  ${JSON.stringify(cfg.veh)}.forEach(n => {
    const f = window[n]; if (typeof f !== 'function') return;
    window[n] = function (x, a, b, ...rest) {
      const s = document.createElement('canvas'); s.width = 400; s.height = 400; const sx = s.getContext('2d'); sx.imageSmoothingEnabled = false;
      f(sx, 150, 150, ...rest);
      const d = sx.getImageData(0, 0, 400, 400).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let j = 0; j < 400; j++) for (let i = 0; i < 400; i++) if (d[(j * 400 + i) * 4 + 3] === 255) { x0 = Math.min(x0, i); y0 = Math.min(y0, j); x1 = Math.max(x1, i); y1 = Math.max(y1, j); }
      const box = x1 < 0 ? null : [a + x0 - 150, b + y0 - 150, x1 - x0 + 1, y1 - y0 + 1];
      window.__rec.push({ cv: x.canvas.id, fn: n, a, b, box });
      ${cfg.slot ? `if (box && n !== 'balloon' && n !== 'paraglider') ${cfg.slot}(x, box[0], box[1], box[2], box[3]);` : ''}
    };
  });
})();
`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const all = {};
  for (const [n, cfg] of Object.entries(SHEETS)) {
    await p.route('**/' + n + '.html', async r => {
      let html = fs.readFileSync(require('path').join(__dirname, '../../docs/plans/jiayuan/') + n + '.html', 'utf8');
      // 注入在主要 script 的最前面（function 宣告已經提升了，在這裡換掉就會生效）
      const i = html.lastIndexOf('<script>'); html = html.slice(0, i + 8) + inject(cfg) + html.slice(i + 8);
      r.fulfill({ status: 200, contentType: 'text/html', body: html });
    });
    await p.goto('http://local.test/' + n + '.html'); await p.waitForTimeout(600);
    const urls = await p.$$eval('canvas', cs => cs.map(c => [c.id, c.width, c.height, c.toDataURL()]));
    urls.forEach(([id, w, h, u], i) => fs.writeFileSync(require('path').join(OUT, `${n}_${i}.png`), Buffer.from(u.split(',')[1], 'base64')));
    all[n] = await p.evaluate(() => window.__rec);
    console.log(n, urls.length, all[n].length);
  }
  fs.writeFileSync(require('path').join(__dirname, 'slots.json'), JSON.stringify(all, null, 1));
  console.log(errs.join(' | ') || 'no errors'); await b.close();
})();
