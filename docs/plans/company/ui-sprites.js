// 介面樣張用的角色圖：專案根目錄 python3 -m http.server 8765，再 node docs/plans/company/ui-sprites.js，拍出 cast／staffcast／artstyle 的 ?bare（只有角色、透明底），再照 README 切成 ui/*.png
const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch(); const p = await b.newPage();
  const get = async (url, js) => { await p.goto('http://localhost:8765/docs/plans/company/' + url); await p.waitForTimeout(800); const d = await p.evaluate(js); fs.writeFileSync('/home/claude/work/bare_' + url.split('.')[0] + '.png', Buffer.from(d.split(',')[1], 'base64')); };
  await get('cast.html?bare', () => document.getElementById('b').toDataURL());
  await get('staffcast.html?bare', () => document.getElementById('b').toDataURL());
  await get('artstyle.html?bare', () => window.E_IMG);
  await p.goto('http://localhost:8765/docs/plans/company/artstyle.html?bare&julie=awake'); await p.waitForTimeout(800); fs.writeFileSync('/home/claude/work/bare_ja.png', Buffer.from((await p.evaluate(() => window.E_IMG)).split(',')[1], 'base64'));   // 醒著的茱莉鴨
  await b.close(); })();
