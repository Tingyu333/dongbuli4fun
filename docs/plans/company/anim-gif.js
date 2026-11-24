// 角色小動畫拍成 GIF 的一張張畫面：專案根目錄 python3 -m http.server 8765，再 node docs/plans/company/anim-gif.js，畫面存在 /home/claude/work/frames/
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: 800 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/docs/plans/company/anim.html?still'); await p.waitForTimeout(800);
  fs.mkdirSync('/home/claude/work/frames', { recursive: true });
  for (let i = 0; i < 96; i++) { const data = await p.evaluate(t => { renderAt(t); return document.getElementById('cv').toDataURL('image/png'); }, i / 12);
    fs.writeFileSync(`/home/claude/work/frames/f${String(i).padStart(3, '0')}.png`, Buffer.from(data.split(',')[1], 'base64')); }
  console.log(errs); await b.close(); })();
