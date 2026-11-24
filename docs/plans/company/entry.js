// 會員中心入口的兩種放法（2026-11-24）：甲＝打工那一區多一格、乙＝我的小島下面多一區「我的公司」。專案根目錄 python3 -m http.server 8765，再 node docs/plans/company/entry.js
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8765/docs/plans/company/mockup.html'); await p.waitForTimeout(1200);
  const office = await p.evaluate(() => document.getElementById('office').toDataURL());
  for (const opt of ['a', 'b']) {
    await p.goto('http://localhost:8765/member.html'); await p.waitForTimeout(1500);
    const y = await p.evaluate(([opt, office]) => {
      if (opt === 'a') {
        const grid = document.querySelector('.game-group .game-grid'); const a = document.createElement('a'); a.className = 'game'; a.href = '#';
        a.innerHTML = '<span class="game-top"><span class="game-mark">社</span><span class="game-name">公司・開</span></span><span class="game-desc">接案子、請員工，從車庫做起</span>';
        a.style.boxShadow = '0 0 0 2px rgb(var(--wabi-shu))'; grid.prepend(a); return grid.closest('.game-group').getBoundingClientRect().top + scrollY - 70;
      }
      const isl = [...document.querySelectorAll('section h2')].find(h => h.textContent === '我的小島').closest('section');
      const sec = document.createElement('section'); sec.className = isl.className;
      sec.innerHTML = `<div class="flex items-baseline justify-between"><h2 class="text-sm tracking-[0.3em] text-wabi-dark">我的公司</h2><span class="text-[11px] font-sans tracking-widest text-stone-400">丼步喱設計社</span></div>
        <a href="#" class="block mt-4" style="position:relative;border-radius:3px;overflow:hidden;background:#d9d2c4"><img src="${office}" style="display:block;width:100%;height:180px;object-fit:cover;object-position:50% 70%;image-rendering:pixelated">
        <span style="position:absolute;left:10px;top:10px;display:inline-flex;font-family:'Noto Serif TC',serif;font-size:12px;letter-spacing:.28em;padding:3px 9px 3px 11px;background:#f6f1e6;color:#6b6052;border:1px solid #cfc6b6">車庫創業</span>
        <span style="position:absolute;right:10px;top:10px;font-family:'Noto Sans TC',sans-serif;font-size:11px;letter-spacing:.12em;padding:3px 9px;background:#b33a2f;color:#fff6ea;border-radius:999px">1 件可以收款</span></a>
        <p class="mt-2 text-[11px] font-sans tracking-widest text-stone-400">進行中 2 件・員工 3 人・委託板 2:41 後換新</p>`;
      isl.after(sec); return isl.getBoundingClientRect().top + scrollY - 70; }, [opt, office]);
    await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(500);
    await p.screenshot({ path: `/home/claude/work/entry_${opt}.png` });
  }
  console.log(errs); await b.close();
})();
