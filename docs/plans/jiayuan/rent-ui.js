// 小島收租的畫面樣張（2026-11-24）：在真的 xiaodao.html?preview 上蓋一層假的收租畫面、拍四張 → rent-ui.png。用法：專案根目錄 python3 -m http.server 8765，再 node docs/plans/jiayuan/rent-ui.js（圖存在 /home/claude/work/rent1～4.png，再拼起來）
const { chromium, devices } = require('playwright');
const OUT = '/home/claude/work/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/xiaodao.html?preview'); await p.waitForTimeout(500);
  const info = await p.evaluate(() => { const R = XiaodaoRules, W = R.world(); let s = R.fresh(); const log = [];
    const buy = a => { const r = R.apply(s, a, 1e12); if (r.ok) s = r.state; else log.push(a.k || a.p, r.err); };
    const near = tgt => { let q = null, best = 1e9; for (let k = 0; k < W.P; k++) if (R.plotInfo(s, k).ok) { const d = Math.hypot(W.center[k][0] - tgt[0], W.center[k][1] - tgt[1]); if (d < best) { best = d; q = k; } } return q; };
    const ensure = k => { for (let g = 0; g < 60; g++) { const fi = R.facInfo(s, k); if (!fi.miss) break; let q = fi.miss.find(q => R.plotInfo(s, q).ok); if (q == null) q = near(W.center[fi.miss[0]]); if (q == null) break; buy({ t: 'plot', p: q }); } };
    [['house', 2], ['garage', 2], ['dock', 2]].forEach(([k, l]) => { while (R.level(s, k) < l) { ensure(k); const r = R.apply(s, { t: 'build', k }, 1e12); if (!r.ok) { log.push(k, r.err); break; } s = r.state; } });
    const ar = R.rect('airfield', 1); while (R.island(s).plots.length < 16) { const q = near([ar.x + ar.w / 2, ar.y + ar.h / 2]); if (q == null) break; buy({ t: 'plot', p: q }); }
    ensure('airfield'); buy({ t: 'build', k: 'airfield' }); ensure('house');
    ['sedan1', 'moto2', 'motor1', 'row3', 'fly1'].forEach(k => buy({ t: 'buyv', k }));
    localStorage.setItem('dongbuli-xiaodao-preview', JSON.stringify({ s, money: 184300 }));
    return { lv: R.FAC_KEYS.map(k => k + R.level(s, k)), plots: R.island(s).plots.length, log }; });
  console.log(JSON.stringify(info));
  await p.reload(); await p.waitForTimeout(2500);
  await p.addStyleTag({ content: `
    #trial { display: none !important; }
    .rtag { position: absolute; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; pointer-events: none; animation: rb 2.2s ease-in-out infinite; z-index: 5; }
    .rtag .str { width: 1px; height: 10px; background: rgba(60,50,40,.7); order: 2; }
    .rtag .pp { order: 1; display: flex; align-items: center; gap: 6px; background: #fcfaf8; color: #2c2c2c; padding: 5px 9px 5px 6px; border-radius: 3px; box-shadow: 0 3px 8px rgba(0,0,0,.3); font-family: 'Noto Sans TC', sans-serif; font-size: 12px; letter-spacing: .04em; }
    .rtag .sl { width: 20px; height: 20px; border: 1.5px solid #b33a2f; color: #b33a2f; display: flex; align-items: center; justify-content: center; font-family: 'Noto Serif TC', serif; font-size: 12px; transform: rotate(-6deg); border-radius: 2px; }
    .rtag.full .pp { background: #b33a2f; color: #fff6ea; } .rtag.full .sl { border-color: #fff6ea; color: #fff6ea; }
    .rtag.full::after { content: ''; position: absolute; left: 50%; top: 14px; width: 120%; height: 70%; transform: translate(-50%, -50%); border-radius: 50%; box-shadow: 0 0 16px 6px rgba(255,220,150,.75); z-index: -1; }
    @keyframes rb { 50% { margin-top: -4px; } }
    .rsub { color: rgb(var(--wabi-accent)); }
    .rsub b { color: rgb(var(--wabi-shu)); font-weight: 500; }
    .coin { position: absolute; width: 7px; height: 7px; border-radius: 50%; background: #e9c13f; box-shadow: inset -1px -1px 0 #b8902a, 0 0 4px rgba(255,220,120,.9); z-index: 6; }
    .plus { position: absolute; transform: translate(-50%, -100%); color: #b33a2f; font-family: 'Noto Sans TC', sans-serif; font-size: 13px; font-weight: 500; z-index: 9; }
    .rnote { position: absolute; left: 22px; right: 22px; top: 50%; transform: translateY(-50%) rotate(-1deg); background: #fbf6ea; padding: 18px 18px 14px; box-shadow: 0 10px 30px rgba(0,0,0,.35); z-index: 8; font-family: 'Noto Sans TC', sans-serif; color: #4a4a4a; border-radius: 2px; }
    .rnote h3 { margin: 0; font-family: 'Noto Serif TC', serif; font-weight: 400; letter-spacing: .3em; font-size: 16px; color: #2c2c2c; }
    .rnote .amt { font-size: 24px; color: #b33a2f; margin: 6px 0 8px; letter-spacing: .02em; }
    .rnote table { width: 100%; font-size: 11.5px; border-collapse: collapse; letter-spacing: .05em; }
    .rnote td { padding: 3px 0; border-bottom: 1px dotted #d9d1c3; } .rnote td:last-child { text-align: right; }
    .rnote .msg { margin: 12px 0 0; padding: 10px 12px; background: #fff; border-left: 2px solid #b33a2f; font-family: 'Noto Serif TC', serif; font-size: 13px; line-height: 1.8; letter-spacing: .06em; color: #4a4a4a; }
    .rnote .who { text-align: right; font-size: 11px; color: #8e8070; margin-top: 4px; letter-spacing: .1em; }
    .rnote .ok { margin-top: 12px; text-align: center; background: #2c2c2c; color: #fcfaf8; padding: 10px 0; font-size: 13px; letter-spacing: .3em; border-radius: 3px; }
    .rnote .stamp { position: absolute; right: 14px; top: 14px; width: 46px; height: 46px; border: 2px solid #b33a2f; border-radius: 50%; color: #b33a2f; font-family: 'Noto Serif TC', serif; font-size: 11px; display: flex; align-items: center; justify-content: center; text-align: center; line-height: 1.15; transform: rotate(12deg); opacity: .85; }
    .dim { position: absolute; inset: 0; background: rgba(20,24,30,.35); z-index: 7; }
    .rline { font-size: 12.5px; color: rgb(var(--wabi-text)); margin: 8px 0 0; letter-spacing: .05em; }
    .rline b { color: rgb(var(--wabi-shu)); font-weight: 500; }
  ` });
  const place = async (amt, full) => p.evaluate(([amt, full]) => {
    document.querySelectorAll('.rtag').forEach(e => e.remove());
    const R = XiaodaoRules, S = JSON.parse(localStorage.getItem('dongbuli-xiaodao-preview')).s, r = R.rect('house', R.level(S, 'house')), c = __xiaodao.cam;
    const t = document.createElement('div'); t.className = 'rtag' + (full ? ' full' : ''); t.innerHTML = `<span class="pp"><span class="sl">租</span>${amt}</span><span class="str"></span>`;
    t.style.left = ((r.x + r.w / 2 - c.x) * c.s) + 'px'; t.style.top = ((r.y + 6 - c.y) * c.s) + 'px'; document.getElementById('view').appendChild(t);
    let sub = document.getElementById('rsub'); if (!sub) { sub = document.createElement('span'); sub.id = 'rsub'; sub.className = 'rsub'; document.getElementById('nextTier').replaceWith(sub); }
    sub.innerHTML = full ? '金庫<b>滿了</b>・快來收' : '每小時 <b>$2,235</b>';
  }, [amt, full]);
  const shot = async n => { await p.waitForTimeout(250); await p.screenshot({ path: OUT + 'rent' + n + '.png' }); };
  // 1 累積中
  await place('$11,920', false); await shot(1);
  // 2 滿了
  await place('滿了 $26,820', true); await shot(2);
  // 3 收租：錢飛進錢包＋旅客紙條
  await p.evaluate(() => {
    document.querySelectorAll('.rtag').forEach(e => e.remove());
    const app = document.getElementById('app'), ab = app.getBoundingClientRect(), t = document.getElementById('view').getBoundingClientRect(), mb = document.getElementById('money').getBoundingClientRect();
    const R = XiaodaoRules, S = JSON.parse(localStorage.getItem('dongbuli-xiaodao-preview')).s, r = R.rect('house', R.level(S, 'house')), c = __xiaodao.cam;
    const x0 = t.left - ab.left + (r.x + r.w / 2 - c.x) * c.s, y0 = t.top - ab.top + (r.y - c.y) * c.s, x1 = mb.right - ab.left - 20, y1 = mb.top - ab.top + 8;
    for (let i = 0; i < 14; i++) { const u = i / 13, cx = x0 + (x1 - x0) * u, cy = y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * 70; const d = document.createElement('i'); d.className = 'coin'; d.style.left = cx + 'px'; d.style.top = cy + 'px'; d.style.opacity = .35 + u * .65; app.appendChild(d); }
    const pl = document.createElement('div'); pl.className = 'plus'; pl.textContent = '+$26,820'; pl.style.left = x0 + 'px'; pl.style.top = (y0 - 4) + 'px'; pl.style.textShadow = '0 0 3px #fff, 0 0 6px #fff'; /* 被紙條蓋住，不放 */ void pl; document.getElementById('rsub').innerHTML = '每小時 <b>$2,235</b>・金庫 $0';
    document.getElementById('money').textContent = '$211,120';
    const dim = document.createElement('div'); dim.className = 'dim'; document.getElementById('view').appendChild(dim);
    const n = document.createElement('div'); n.className = 'rnote'; n.innerHTML = `<span class="stamp">已收<br>十二<br>小時</span><h3>收租</h3><div class="amt">$26,820</div>
      <table><tr><td>木屋・民宿房租</td><td>$7,200</td></tr><tr><td>車棚・代客停車</td><td>$4,320</td></tr><tr><td>木棧橋・遊艇出租</td><td>$4,320</td></tr><tr><td>草地起降場・觀光飛行</td><td>$10,800</td></tr><tr><td>停著的車和船</td><td>$180</td></tr></table>
      <div class="msg">早上被浪聲叫醒，<br>門口那隻貓一直盯著我的早餐。<br>下次還要住木屋。</div><div class="who">—— 住了兩晚的旅人</div><div class="ok">收下</div>`;
    document.getElementById('view').appendChild(n);
  });
  await shot(3);
  // 4 設施卡片：租金、升級多賺、回本
  await p.reload(); await p.waitForTimeout(2200);
  await p.addStyleTag({ content: '#trial{display:none!important} .rline{font-size:12.5px;margin:8px 0 0;letter-spacing:.05em} .rline b{color:rgb(var(--wabi-shu));font-weight:500} .rline small{color:rgb(var(--wabi-accent));font-size:11px}' });
  await p.evaluate(() => { const R = XiaodaoRules, S = JSON.parse(localStorage.getItem('dongbuli-xiaodao-preview')).s, r = R.rect('house', R.level(S, 'house')); __xiaodao.tap(r.x + r.w / 2, r.y + r.h / 2); });
  await p.waitForTimeout(700);
  await p.evaluate(() => { const card = document.getElementById('card'), line = card.querySelector('.line');
    const a = document.createElement('p'); a.className = 'rline'; a.innerHTML = '民宿房租・每小時 <b>$600</b> <small>（金庫最多存 12 小時）</small>'; line.after(a);
    const b = document.createElement('p'); b.className = 'rline'; b.innerHTML = '升到紅瓦平房：每小時多賺 <b>$750</b>・回本約 3 天'; const btns = card.querySelector('.btns'); btns.before(b);
    const sub = document.getElementById('nextTier'); sub.innerHTML = '每小時 <b style="color:rgb(var(--wabi-shu));font-weight:500">$2,235</b>'; });
  await shot(4);
  console.log(errs);
  await b.close();
})();
