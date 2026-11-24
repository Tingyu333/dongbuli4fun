// 開公司樣張拍照：專案根目錄 python3 -m http.server 8765，再 node docs/plans/company/render.js offices.html offices.png（或 mockup.html／staff.html／onboarding.html），圖存在 /home/claude/work/
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1300, height: 1200 }, deviceScaleFactor: 2 }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/docs/plans/company/' + (process.argv[2] || 'offices.html')); await p.waitForTimeout(1500);
  await (await p.$('.wrap')).screenshot({ path: '/home/claude/work/' + (process.argv[3] || 'offices.png') }); console.log(errs); await b.close(); })();
