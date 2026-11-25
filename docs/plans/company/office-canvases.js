// 把 office5.html 五張畫布原尺寸存成 PNG（逐一檢查物件用）：node docs/plans/company/office-canvases.js → /home/claude/work/oc/s1～s5.png
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1800, height: 1200 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/docs/plans/company/office5.html'); await p.waitForTimeout(900);
  for (const id of ['s1', 's2', 's3', 's4', 's5']) { const d = await p.evaluate(i => document.getElementById(i).toDataURL('image/png'), id); fs.writeFileSync(`/home/claude/work/oc/${id}.png`, Buffer.from(d.split(',')[1], 'base64')); }
  fs.writeFileSync('/home/claude/work/oc/seats.json', JSON.stringify(await p.evaluate(() => window.SEATS)));
  console.log(errs); await b.close(); })();
