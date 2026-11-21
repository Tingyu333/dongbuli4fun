// 家具圖鑑（docs/plans/jiayuan/furniture.html）的每一款、每一個顏色各畫一張（不轉、不畫影子；燈類多畫一張晚上亮燈的），
// 拼成一張 assets/xiaodao/furn.png，位置和名字存 tools/xiaodao/furniture.json。轉方向、加影子在網頁上做（照設計圖的 place()）。
// 用法（在專案根目錄）：node tools/xiaodao/dump_furniture.js
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '../../docs/plans/jiayuan/furniture.html')); await p.waitForTimeout(500);
  const out = await p.evaluate(() => {
    const CODE = { '床': 'bed', '燈': 'lamp', '收納': 'store', '桌椅': 'table', '沙發': 'sofa', '電視': 'tv', '地毯': 'rug', '盆栽': 'plant', '廚房': 'kitchen', '掛畫': 'pic' };
    const items = [], tiles = [];
    const shot = (draw, w, h, c) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; const keep = SH; SH = 'rgba(0,0,0,0)'; draw(x, 0, 0, c); SH = keep; return cv; };
    const same = (a, b2) => { const d1 = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, d2 = b2.getContext('2d').getImageData(0, 0, b2.width, b2.height).data; for (let i = 0; i < d1.length; i++) if (d1[i] !== d2[i]) return false; return true; };
    CATS.forEach(([cat, list]) => list.forEach(([name, tier, w, h, kind, draw, colors], i) => {
      const key = CODE[cat] + (i + 1), W = w * T, H = kind === 'pic' ? 16 : h * T;
      const it = { key, cat, name, tier, w, h: kind === 'pic' ? 0 : h, kind, colors: [] };
      colors.forEach(([wd, f], ci) => {
        const c = { wd: wd || WD.light, f: f || FB.beige }, day = shot(draw, W, H, c), night = shot(draw, W, H, Object.assign({}, c, { night: true }));
        const nm = [wd && wd.n, f && f[4]].filter(Boolean).join('・') || '原色';
        const col = { name: nm, sw: (f && f[0]) || (wd && wd.sw) || '#9a6a40', day: tiles.push(day) - 1 };
        if (!same(day, night)) col.night = tiles.push(night) - 1;
        it.colors.push(col);
      });
      items.push(it);
    }));
    // 拼圖：一排一排放，寬 512
    const MAXW = 512; let x = 0, y = 0, rowH = 0; const rects = tiles.map(t => { if (x + t.width > MAXW) { x = 0; y += rowH + 1; rowH = 0; } const r = [x, y, t.width, t.height]; x += t.width + 1; rowH = Math.max(rowH, t.height); return r; });
    const atlas = document.createElement('canvas'); atlas.width = MAXW; atlas.height = y + rowH; const ax = atlas.getContext('2d');
    tiles.forEach((t, i) => ax.drawImage(t, rects[i][0], rects[i][1]));
    items.forEach(it => it.colors.forEach(c => { c.day = rects[c.day]; if (c.night != null) c.night = rects[c.night]; }));
    return { items, url: atlas.toDataURL(), size: [atlas.width, atlas.height] };
  });
  fs.writeFileSync(path.join(__dirname, '../../assets/xiaodao/furn.png'), Buffer.from(out.url.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(__dirname, 'furniture.json'), JSON.stringify(out.items, null, 1));
  console.log(out.items.length, 'items', out.items.reduce((t, i) => t + i.colors.length, 0), 'colors', out.size, errs.join(' | ') || 'no errors'); await b.close();
})();
