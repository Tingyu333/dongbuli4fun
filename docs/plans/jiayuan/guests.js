// 來島上玩的角色樣張（2026-11-24）：專案根目錄 python3 -m http.server 8765，再 node docs/plans/jiayuan/guests.js（存到 /home/claude/work/guests.png）
const { chromium } = require('playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 }); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/xiaodao.html?preview'); await p.waitForTimeout(800);
  await p.evaluate(() => {
    const D = XiaodaoDoor, pick = { 1: ['cat', 'julie', 'nugget'], 2: ['mole', 'appleduck', 'dog'], 3: ['cat', 'xiaowu', 'captain'], 4: ['raccoon', 'julie', 'dog'], 5: ['appleduck', 'xiaowu', 'captain'] };
    const sprite = k => { const Z = 9, c = document.createElement('canvas'); c.width = 26 * Z; c.height = 22 * Z; const x = c.getContext('2d'); x.fillStyle = '#a9c68a'; x.fillRect(0, 0, c.width, c.height); x.setTransform(Z, 0, 0, Z, 0, 0); D.guest(x, k, 13, 19.5); return c.toDataURL(); };
    const names = pick; const houseNames = ['帳篷', '小木屋', '紅瓦平房', '兩層洋房', '海景別墅'];
    document.body.innerHTML = `<div id="g" style="width:1180px;background:#fcfaf8;padding:16px 10px;font-family:'Noto Serif TC',serif;color:#2c2c2c">
      <div style="text-align:center;font-size:22px;letter-spacing:.3em">來島上玩的角色</div>
      <div style="text-align:center;font-size:12px;color:#8e8070;letter-spacing:.12em;margin:4px 0 12px;font-family:'Noto Sans TC',sans-serif">白天隨機來兩三個，坐在家門口；晚上回家</div>
      <div style="display:flex;justify-content:space-between">${D.GUEST_KEYS.map(k => `<div style="text-align:center;font-size:13px;letter-spacing:.1em"><img src="${sprite(k)}" style="width:118px;image-rendering:pixelated;border-radius:6px;display:block"><div style="margin-top:6px">${D.GUEST_NAME[k]}</div></div>`).join('')}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px">${[1, 2, 3, 4, 5].map(lv => { const o = D.render(lv, { z: 4, guests: pick[lv], clothes: [{ t: 'top', c: '#c94f3d' }, { t: 'bottom', c: '#4f7393' }, { t: 'dress', c: '#e9c13f' }] });
        return `<div style="text-align:center;font-size:13px;letter-spacing:.1em"><img src="${o.canvas.toDataURL()}" style="width:100%;display:block;border-radius:6px"><div style="margin-top:4px">${houseNames[lv - 1]}・${pick[lv].map(k => D.GUEST_NAME[k]).join('、')}</div></div>`; }).join('')}</div></div>`;
  });
  await p.waitForTimeout(800); await (await p.$('#g')).screenshot({ path: '/home/claude/work/guests.png' }); console.log(errs); await b.close(); })();
