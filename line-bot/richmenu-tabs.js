// 產生三張分頁圖文選單的圖（richmenu-27/sky/life.png）。要 Node 和 Playwright：node line-bot/richmenu-tabs.js line-bot
// 格子內容在 richmenu-tabs.json，改了要跟 Code.gs 的 RICH_MENUS 一起改，再把 RICH_MENU_VERSION 加一、執行 setupRichMenus()。
const { chromium } = require('playwright'); const fs = require('fs');
const menus = JSON.parse(fs.readFileSync(__dirname + '/richmenu-tabs.json', 'utf8'));
const OUT = process.argv[2] || __dirname;
const W = 2500, H = 1686, TAB = 250, COLW = [833, 833, 834], ROWH = (H - TAB) / 2;
const css = `
@font-face{font-family:S;font-weight:400;src:local('Noto Serif CJK TC')}
@font-face{font-family:S;font-weight:700;src:local('Noto Serif CJK TC Bold')}
@font-face{font-family:N;font-weight:300;src:local('Noto Sans CJK TC Light')}
@font-face{font-family:N;font-weight:400;src:local('Noto Sans CJK TC')}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;background:#fcfaf8;font-family:S;color:#2c2c2c;overflow:hidden;position:relative}
.tabs{position:absolute;left:0;top:0;width:${W}px;height:${TAB}px;display:flex}
.tab{position:relative;height:${TAB}px;display:flex;align-items:center;justify-content:center;background:#f1ede7;color:#b3aa9e;font-size:74px;letter-spacing:.32em;padding-left:.32em;border-bottom:3px solid #dcd5cb}
.tab+.tab{border-left:3px solid #e4ded5}
.tab.on{background:#fcfaf8;color:#2c2c2c;font-weight:700;border-bottom-color:transparent}
.tab.on::after{content:'';position:absolute;left:50%;bottom:44px;width:110px;height:8px;margin-left:-55px;background:#b33a2f;border-radius:4px}
.tab .n{font-family:N;font-weight:400;font-size:34px;letter-spacing:.1em;margin-right:28px;color:inherit;opacity:.7}
.grid{position:absolute;left:0;top:${TAB}px;width:${W}px;height:${H - TAB}px;display:grid;grid-template-columns:${COLW.join('px ')}px;grid-template-rows:${ROWH}px ${ROWH}px}
.cell{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center}
.cell:nth-child(3n+2),.cell:nth-child(3n+3){border-left:3px solid #e6e2dc}
.cell:nth-child(n+4){border-top:3px solid #e6e2dc}
.cell:nth-child(1),.cell:nth-child(2),.cell:nth-child(3){border-top:0}
.ttl{font-size:124px;line-height:1;white-space:nowrap;letter-spacing:.06em}
.ttl .dot{display:inline-block;width:22px;height:22px;border-radius:50%;background:#8e8070;margin:0 .42em;vertical-align:.32em}
.ttl .k{color:#8e8070}
.rule{width:100px;height:3px;background:#8e8070;margin:50px 0 44px}
.sub{font-family:N;font-weight:300;font-size:50px;letter-spacing:.3em;padding-left:.3em;color:#7d7468;white-space:nowrap}
.stamp{position:absolute;right:120px;top:88px;width:104px;height:104px;border:7px solid #b33a2f;border-radius:12px;color:#b33a2f;font-weight:700;font-size:66px;display:flex;align-items:center;justify-content:center;transform:rotate(-8deg);opacity:.92}
`;
const html = (m, ti) => `<!doctype html><meta charset=utf-8><style>${css}</style>
<div class=tabs>${menus.map((x, i) => `<div class="tab${i === ti ? ' on' : ''}" style="width:${COLW[i]}px"><span class=n>${'壹貳參'[i]}</span>${x.tab}</div>`).join('')}</div>
<div class=grid>${m.items.map(it => `<div class=cell>${it.stamp ? `<div class=stamp>${it.stamp}</div>` : ''}<div class=ttl>${it.t}<span class=dot></span><span class=k>${it.k}</span></div><div class=rule></div><div class=sub>${it.s}</div></div>`).join('')}</div>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  for (let i = 0; i < menus.length; i++) {
    await p.setContent(html(menus[i], i)); await p.evaluate(() => document.fonts.ready);
    // 字不能超出格子
    const over = await p.evaluate(() => [...document.querySelectorAll('.cell')].map(c => { const r = c.getBoundingClientRect(); return [...c.querySelectorAll('.ttl,.sub')].some(e => { const q = e.getBoundingClientRect(); return q.left < r.left + 40 || q.right > r.right - 40; }); }));
    if (over.some(Boolean)) throw new Error('overflow in ' + menus[i].alias + ' ' + over);
    const f = `${OUT}/richmenu-${menus[i].alias.replace('dbl-', '')}.png`;
    await p.screenshot({ path: f, type: 'png' }); console.log(f, fs.statSync(f).size);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
