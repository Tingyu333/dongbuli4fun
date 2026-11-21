// 把車、船的圖鑑（vehicles.html、boats.html）裡每一台各畫一張、裁到剛好（含影子），存成 assets/xiaodao/v/<key>.png，名字和說明存 vehicles.json
// 用法（在專案根目錄）：node tools/xiaodao/dump_vehicles.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '../../docs/plans/jiayuan/'), OUT = path.join(__dirname, '../../assets/xiaodao/v/');
const GROUPS = {
  'vehicles.html': [['BIKES', 'bike'], ['SCOOTERS', 'moto'], ['SEDANS', 'sedan'], ['SPORTS', 'sport'], ['JEEPS', 'jeep'], ['CAMPERS', 'camper'], ['CLASSICS', 'classic'], ['SUPERS', 'super']],
  'boats.html': [['SMALL', 'row'], ['MOTOR', 'motor'], ['SAIL', 'sail'], ['BIG', 'yacht'], ['SHOW', 'show']],
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const meta = [];
  for (const [file, groups] of Object.entries(GROUPS)) {
    await p.goto('file://' + DIR + file); await p.waitForTimeout(500);
    const got = await p.evaluate(groups => {
      if (typeof window.wake === 'function') window.wake = function () {};   // 停著的船不要船尾浪
      const out = [];
      groups.forEach(([name, pre]) => {
        const list = eval(name);
        list.forEach(([nm, desc, draw], i) => {
          const c = document.createElement('canvas'); c.width = 240; c.height = 240; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
          draw(x, 100, 80);
          const d = x.getImageData(0, 0, 240, 240).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
          for (let j = 0; j < 240; j++) for (let k = 0; k < 240; k++) if (d[(j * 240 + k) * 4 + 3]) { x0 = Math.min(x0, k); y0 = Math.min(y0, j); x1 = Math.max(x1, k); y1 = Math.max(y1, j); }
          const w = x1 - x0 + 1, h = y1 - y0 + 1, o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
          out.push({ key: pre + (i + 1), name: nm, desc, w, h, url: o.toDataURL() });
        });
      });
      return out;
    }, groups);
    got.forEach(v => { fs.writeFileSync(OUT + v.key + '.png', Buffer.from(v.url.split(',')[1], 'base64')); delete v.url; meta.push(v); });
  }
  fs.writeFileSync(path.join(__dirname, 'vehicles.json'), JSON.stringify(meta, null, 1));
  console.log(meta.length, errs.join(' | ') || 'no errors'); await b.close();
})();
