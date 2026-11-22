// 衣服（clothes.html）、藏品（collectibles.html）、扭蛋機：每一件畫一張拼成一張圖
//   assets/xiaodao/clothes.png（每款每色一件，掛在衣架上 24×28）、assets/xiaodao/collect.png（每件 24×24）、assets/xiaodao/gacha.png（扭蛋機 40×48）
//   位置和名字存 tools/xiaodao/clothes.json、collect.json
// 用法（在專案根目錄）：node tools/xiaodao/dump_items.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '../../docs/plans/jiayuan/'), OUT = path.join(__dirname, '../../assets/xiaodao/');
const pack = `function pack(tiles) { const MAXW = 512; let x = 0, y = 0, rowH = 0; const rects = tiles.map(t => { if (x + t.width > MAXW) { x = 0; y += rowH + 1; rowH = 0; } const r = [x, y, t.width, t.height]; x += t.width + 1; rowH = Math.max(rowH, t.height); return r; });
  const a = document.createElement('canvas'); a.width = MAXW; a.height = y + rowH; const ax = a.getContext('2d'); tiles.forEach((t, i) => ax.drawImage(t, rects[i][0], rects[i][1])); return { rects, url: a.toDataURL() }; }`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + DIR + 'clothes.html'); await p.waitForTimeout(400);
  const cl = await p.evaluate(pack => { eval(pack);
    const CODE = { '上衣': 'top', '外套': 'coat', '下身': 'bottom', '連身・和風': 'dress', '特別款': 'special' }, items = [], tiles = [];
    CLOTHES.forEach(([cat, list]) => list.forEach(([name, tier, shape, det, cols], i) => {
      const it = { key: CODE[cat] + (i + 1), cat, name, tier, colors: [] };
      cols.forEach(([cn, col, sub]) => { it.colors.push({ n: cn, sw: col, d: tiles.push(garment(shape, det, col, sub)) - 1 }); });
      items.push(it);
    }));
    const P = pack(tiles); items.forEach(it => it.colors.forEach(c => { c.d = P.rects[c.d]; }));
    return { items, url: P.url };
  }, pack);
  await p.goto('file://' + DIR + 'collectibles.html'); await p.waitForTimeout(400);
  const co = await p.evaluate(pack => { eval(pack);
    const items = [], tiles = [];
    GROUPS.forEach(([g, how, list]) => list.forEach(([name, key, r]) => { items.push({ key, g, name, r, d: tiles.push(icon(key)) - 1 }); }));
    const P = pack(tiles); items.forEach(it => { it.d = P.rects[it.d]; });
    return { items, url: P.url, gacha: document.getElementById('gacha').toDataURL() };
  }, pack);
  fs.writeFileSync(OUT + 'clothes.png', Buffer.from(cl.url.split(',')[1], 'base64'));
  fs.writeFileSync(OUT + 'collect.png', Buffer.from(co.url.split(',')[1], 'base64'));
  fs.writeFileSync(OUT + 'gacha.png', Buffer.from(co.gacha.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(__dirname, 'clothes.json'), JSON.stringify(cl.items, null, 1));
  fs.writeFileSync(path.join(__dirname, 'collect.json'), JSON.stringify(co.items, null, 1));
  console.log('clothes', cl.items.length, cl.items.reduce((t, i) => t + i.colors.length, 0), 'collect', co.items.length, errs.join(' | ') || 'no errors'); await b.close();
})();
