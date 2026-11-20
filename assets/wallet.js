// 共用錢包：小遊戲賺錢（洗頭發工資…）、刮刮樂花錢。
// 沒登入：只存在這支手機的 localStorage。
// 用 LINE 登入（assets/line.js）：錢跟著 LINE 帳號存在後端，換手機也在。
//   這支手機先照常加減（馬上看得到），再把「變了多少」（pending）送去後端，後端加進帳號、回傳最新的錢包。
// 用法：Wallet.money、Wallet.earn(金額, '哪個遊戲')、Wallet.spend(金額)、Wallet.stats()、Wallet.on(fn)
// 功德（gongde.html）也跟著錢包走：Wallet.gongde = { donated 累積捐了多少, oil 光明燈還剩多少燈油, oils 其他燈還剩多少 { caishen, taisui, wenchang, yuelao }, lamps 點過幾盞, lit 點燈花了多少 }
//   Wallet.donate(金額)、Wallet.lightLamp(價錢, 燈油, 哪種燈)、Wallet.useOil(多少, 哪種燈)；登入時一樣送「變了多少」給後端
// 坐洗部的店面升級也在這裡：Wallet.shop = { lv: { shampoo: 2, … }, spent }、Wallet.setShop(shop)。
//   等級只會升不會降，同步時送整份，後端每一項取比較高的（兩支手機各買各的也不會蓋掉）
// 專屬道具（主人在 admin 後台發的，2026-11-20）：後端只送給本人（錢包回傳裡的 perks: [{ perk, expires }]），存在錢包裡。
//   Wallet.perk('shop60') 有沒有、Wallet.perks('shop60') 是哪幾個（名字是主人在道具庫取的，2026-11-20c）；七家打工店的升級價錢一律過 Wallet.shopPrice(原價)，按鈕用 Wallet.priceTag(原價)、清單最上面放 Wallet.saleBanner()。
//   不公開：排行榜、別人的畫面都看不到；花錢照實際付的記（shop.spent、spent 都是六折後的）。
(function () {
    const KEY = 'dongbuli-wallet';
    const GUEST_KEY = 'dongbuli-wallet-guest';  // 登入時把這支手機原本的（訪客）錢包收起來，登出再拿回來
    const START = 1000;   // 第一次來，口袋裡有的錢
    let mem = null;       // localStorage 不能用時（無痕模式）先記在這
    let timer = null, inflight = false;
    const listeners = [];

    const noGongde = () => ({ donated: 0, oil: 0, lamps: 0, lit: 0, oils: {} });
    const pos = v => Math.max(0, Number(v) || 0);
    const noShop = () => ({ lv: {}, spent: 0 });
    const cleanShop = s => {
        const lv = {};
        Object.keys((s && s.lv) || {}).forEach(k => { const n = Math.floor(Number(s.lv[k]) || 0); if (/^[a-z]{1,16}$/.test(k) && n > 0) lv[k] = Math.min(10, n); });
        return { lv, spent: pos(s && s.spent) };
    };
    // 兩份店面合起來：每一項取比較高的等級
    const mergeShop = (a, b) => {
        const out = cleanShop(a), o = cleanShop(b);
        Object.keys(o.lv).forEach(k => { out.lv[k] = Math.max(out.lv[k] || 0, o.lv[k]); });
        out.spent = Math.max(out.spent, o.spent);
        return out;
    };
    const sameShop = (a, b) => JSON.stringify(cleanShop(a)) === JSON.stringify(cleanShop(b));
    const cleanOils = (o, keepNeg) => {
        const out = {};
        Object.keys(o || {}).forEach(k => { if (/^[a-z]{1,16}$/.test(k)) { const v = Number(o[k]) || 0; if (v) out[k] = keepNeg ? v : Math.max(0, v); } });
        return out;
    };
    const blank = () => ({ money: START, spent: 0, earned: {}, gongde: noGongde(), shop: noShop(), perks: [] });
    const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
    const cleanPerks = a => Array.isArray(a) ? a.filter(x => x && /^[a-z0-9]{1,16}$/.test(x.perk)).map(x => ({ perk: x.perk, name: txt(x.name, 12), line: txt(x.line, 30), expires: Math.max(0, Number(x.expires) || 0) })).slice(0, 20) : [];
    const escH = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const SHOP_OFF = 0.6;   // 專屬道具「全店六折」
    const noPending = () => ({ money: 0, spent: 0, earned: {}, gongde: noGongde() });
    const cleanGongde = g => ({ donated: pos(g && g.donated), oil: pos(g && g.oil), lamps: pos(g && g.lamps), lit: pos(g && g.lit), oils: cleanOils(g && g.oils) });
    const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
    const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
    const logged = () => !!(window.Line && Line.loggedIn);

    function load() {
        let w = read(KEY) || mem;
        if (!w || typeof w.money !== 'number') {
            w = blank();
            // 舊版刮刮樂把錢存在自己的存檔裡，搬過來
            const old = read('dongbuli-scratch-tw');
            if (old && typeof old.money === 'number') w.money = old.money;
            save(w);
        }
        w.earned = w.earned || {};
        w.spent = w.spent || 0;
        w.gongde = cleanGongde(w.gongde);
        w.pending = w.pending || noPending();
        w.pending.gongde = w.pending.gongde || noGongde();
        w.pending.gongde.oils = w.pending.gongde.oils || {};
        if (!w.shop) {
            // 以前店面升級只存在坐洗部自己的存檔，搬進錢包（之後跟著 LINE 帳號走）
            w.shop = cleanShop(read('dongbuli-xitou-shop'));
            if (Object.keys(w.shop.lv).length && logged()) w.pending.shop = true;
            save(w);
        }
        w.shop = cleanShop(w.shop);
        return w;
    }

    function save(w) {
        mem = w;
        write(KEY, w);
    }

    function emit(type, data) {
        listeners.forEach(fn => { try { fn(type, data); } catch (e) { console.error(e); } });
    }

    function addEarned(earned, source, amount) {
        const e = earned[source] || (earned[source] = { times: 0, total: 0, best: 0 });
        e.times++;
        e.total += amount;
        e.best = Math.max(e.best, amount);
    }

    function mergeEarned(base, more) {
        Object.keys(more || {}).forEach(k => {
            const b = base[k] || (base[k] = { times: 0, total: 0, best: 0 });
            b.times += more[k].times;
            b.total += more[k].total;
            b.best = Math.max(b.best, more[k].best);
        });
        return base;
    }

    const addGongde = (a, b) => {
        a.donated += b.donated || 0; a.oil += b.oil || 0; a.lamps += b.lamps || 0; a.lit = (a.lit || 0) + (b.lit || 0);
        a.oils = a.oils || {};
        Object.keys(b.oils || {}).forEach(k => { a.oils[k] = (a.oils[k] || 0) + b.oils[k]; });
        return a;
    };
    const isEmpty = p => !p.money && !p.spent && !Object.keys(p.earned).length && !p.shop &&
        !(p.gongde && (p.gongde.donated || p.gongde.oil || p.gongde.lamps || p.gongde.lit || Object.keys(cleanOils(p.gongde.oils, true)).length));

    // 後端回來的錢包 + 還沒送出去的變化 = 這支手機該顯示的
    // 送出去還沒收到回覆的那包（outbox）也還沒算進後端，一起加上去
    function adopt(server) {
        const w = load(), p = w.pending, o = w.outbox ? w.outbox.pending : noPending(), before = w.money;
        w.money = server.money + p.money + o.money;
        w.spent = server.spent + p.spent + o.spent;
        w.earned = mergeEarned(mergeEarned(JSON.parse(JSON.stringify(server.earned || {})), p.earned), o.earned);
        // 後端還是舊版（沒有 gongde）就先用這支手機的
        if (server.gongde) w.gongde = cleanGongde(addGongde(addGongde(cleanGongde(server.gongde), p.gongde), o.gongde || {}));
        let shopChanged = false;
        if (server.shop) {
            const merged = mergeShop(server.shop, w.shop);
            shopChanged = !sameShop(merged, w.shop);
            if (!sameShop(merged, server.shop)) p.shop = true;  // 這支手機有後端還沒有的，下次再送
            w.shop = merged;
            writeShopMirror(merged);
        }
        let perksChanged = false;
        if (Array.isArray(server.perks)) {   // 舊版後端沒有 perks：不動
            const np = cleanPerks(server.perks);
            perksChanged = JSON.stringify(np) !== JSON.stringify(cleanPerks(w.perks));
            w.perks = np;
        }
        save(w);
        if (w.money !== before) emit('server', { diff: w.money - before });
        if (shopChanged) emit('shop');
        if (perksChanged) emit('perks');
    }

    function schedule(ms = 1500) {
        if (!logged()) return;
        clearTimeout(timer);
        timer = setTimeout(() => Wallet.sync(), ms);
    }
    const newSid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'w-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).slice(0, 40);

    // 坐洗部、會員中心以前讀的存檔，照樣寫一份
    function writeShopMirror(shop) { write('dongbuli-xitou-shop', cleanShop(shop)); }

    function changeGongde(d) {
        const w = load();
        addGongde(w.gongde, d);
        w.gongde = cleanGongde(w.gongde);
        if (logged()) addGongde(w.pending.gongde, d);
        save(w);
        schedule();
        return { ...w.gongde };
    }

    const Wallet = {
        get money() { return load().money; },

        // 賺錢。source 是哪個遊戲（'xitou'、'scratch'、'bonus'…），每個遊戲各自記次數、總額、最大一筆
        earn(amount, source) {
            const w = load();
            amount = Math.max(0, Math.round(amount));
            w.money += amount;
            addEarned(w.earned, source, amount);
            if (logged()) {
                w.pending.money += amount;
                addEarned(w.pending.earned, source, amount);
            }
            save(w);
            schedule();
            return w.money;
        },

        // 花錢。錢不夠回 false，什麼都不扣
        spend(amount) {
            const w = load();
            if (w.money < amount) return false;
            w.money -= amount;
            w.spent += amount;
            if (logged()) {
                w.pending.money -= amount;
                w.pending.spent += amount;
            }
            save(w);
            schedule();
            return true;
        },

        // 功德：捐錢（錢從錢包扣，算在 spent 裡），錢不夠回 false
        get gongde() { const g = load().gongde; return { ...g, oils: { ...g.oils } }; },
        donate(amount) {
            amount = Math.round(amount);
            if (!(amount > 0) || !Wallet.spend(amount)) return false;
            return changeGongde({ donated: amount });
        },
        // 點燈：花 price，那種燈的燈油加 oil（光明燈是 oil，其他燈在 oils 裡）
        lightLamp(price, oil, kind) {
            if (!Wallet.spend(price)) return false;
            return changeGongde(!kind || kind === 'guangming' ? { oil, lamps: 1, lit: price } : { oils: { [kind]: oil }, lamps: 1, lit: price });
        },
        // 坐洗部店面升級
        get shop() { return cleanShop(load().shop); },
        setShop(shop) {
            const w = load();
            w.shop = mergeShop(w.shop, shop);
            if (logged()) w.pending.shop = true;
            save(w);
            writeShopMirror(w.shop);
            schedule();
            return cleanShop(w.shop);
        },
        // 專屬道具：有沒有（要登入、還沒過期）
        perk(key) { return Wallet.perks(key).length > 0; },
        // 身上還有效的道具（可以只看某種效果）：[{ perk（效果）, name（主人在道具庫取的名字）, line, expires }]
        perks(key) {
            if (!logged()) return [];
            const now = Date.now();
            return cleanPerks(load().perks).filter(x => (!key || x.perk === key) && (!x.expires || x.expires > now));
        },
        // 七家打工店的升級價錢：有「全店六折」就打六折（十位數以下四捨五入）
        shopPrice(base) { base = Number(base) || 0; return Wallet.perk('shop60') ? Math.round(base * SHOP_OFF / 10) * 10 : base; },
        // 按鈕上的價錢：打折時原價劃掉、下一行寫六折價
        priceTag(base) {
            const p = Wallet.shopPrice(base);
            return p === base ? Wallet.fmt(base) : `<s style="opacity:.55;font-size:.86em">${Wallet.fmt(base)}</s><br>${Wallet.fmt(p)}`;
        },
        // 商店清單最上面的朱印說明（沒有道具就是空字串）
        saleBanner() {
            const own = Wallet.perks('shop60');
            if (!own.length) return '';
            const names = own.map(x => '「' + escH(x.name || '全店六折') + '」').join('');
            const lines = own.filter(x => x.line).map(x => `<span style="display:block;margin-top:.15rem;color:rgb(var(--wabi-accent))">${escH(x.line)}</span>`).join('');
            return '<div style="display:flex;align-items:center;gap:.6rem;margin:.6rem 0 .2rem;padding:.55rem .7rem;border:1px solid rgb(var(--wabi-shu) / .45);border-radius:4px;background:rgb(var(--wabi-shu) / .05)">'
                + '<span style="flex-shrink:0;width:2.6rem;height:2.6rem;display:flex;align-items:center;justify-content:center;border:1.5px solid rgb(var(--wabi-shu));border-radius:4px;color:rgb(var(--wabi-shu));font-size:.72rem;line-height:1.15;text-align:center;transform:rotate(-6deg);font-weight:600">專屬<br>六折</span>'
                + '<span style="font-family:\'Noto Sans TC\',sans-serif;font-size:11px;letter-spacing:.06em;line-height:1.6;color:rgb(var(--wabi-text))">你有專屬道具' + names + '：七家打工店的升級都打六折。' + lines + '</span></div>';
        },
        oilOf(kind) { const g = load().gongde; return !kind || kind === 'guangming' ? g.oil : (g.oils[kind] || 0); },
        // 用掉燈油（不夠就用到 0），回傳實際用掉多少
        useOil(amount, kind) {
            const used = Math.min(Wallet.oilOf(kind), Math.max(0, Math.round(amount)));
            if (used) changeGongde(!kind || kind === 'guangming' ? { oil: -used } : { oils: { [kind]: -used } });
            return used;
        },

        // 把還沒送的變化送去後端（沒有變化就單純讀一次最新的）
        // 每一包變化有自己的編號（sid）。送出去沒收到回覆（iPhone 很常見：後端其實加好了，回覆在轉址時掉了），
        // 這包留在 outbox 用同一個編號再送，新版後端看過這個編號就不會再加一次。
        // 以前是把那包放回 pending 跟新的變化混在一起重送，同一筆錢會被扣兩三次。
        async sync() {
            if (!logged() || inflight) return;
            clearTimeout(timer);
            inflight = true;
            let w = load();
            if (!w.outbox && !isEmpty(w.pending)) {
                w.outbox = { sid: newSid(), pending: w.pending };
                w.pending = noPending();
                save(w);
            }
            const box = w.outbox, sent = box ? box.pending : noPending();
            let ok = false;
            const delta = { money: sent.money, spent: sent.spent, earned: sent.earned, gongde: sent.gongde };
            if (sent.shop) delta.shop = cleanShop(w.shop);
            try {
                const r = await Line.call(box ? { type: 'walletSync', sid: box.sid, delta } : { type: 'walletSync', delta });
                if (r.result === 'success') {
                    const now = load();
                    if (box && now.outbox && now.outbox.sid === box.sid) { now.outbox = null; save(now); }
                    adopt(r.wallet);
                    ok = true;
                } else if (box && r.result === 'error' && r.error === '錢包的數字不對') {
                    // 後端說這包本身不合格，再送幾次都一樣：丟掉，照後端的錢包
                    const now = load(); now.outbox = null; save(now);
                }
            } catch (e) { }
            inflight = false;
            const after = load();
            if (after.outbox || !isEmpty(after.pending)) schedule(ok ? 1500 : 5000);
        },

        // 要直接改帳號的動作（保險・存的投保、領錢、解約）之前先叫這個：
        // 等正在送的那包送完、再把還沒送的送出去，後端的帳才是最新的
        async settle() {
            if (!logged()) return;
            for (let i = 0; i < 100 && inflight; i++) await new Promise(r => setTimeout(r, 100));
            for (let i = 0; i < 2; i++) {
                const w = load();
                if (!w.outbox && isEmpty(w.pending)) break;
                await Wallet.sync();
            }
        },
        // 後端直接改過帳號（例如投保扣錢）：用後端回來的錢包 + 還沒送的
        adopt(server) { if (server && logged()) adopt(server); },

        // { money, spent, earned: { xitou: { times, total, best }, scratch: {…} } }
        stats() { return load(); },
        on(fn) { listeners.push(fn); },
        fmt: n => '$' + Number(n).toLocaleString('en-US'),
    };

    if (window.Line) {
        // 第一次用 LINE 登入：用這支手機現在的錢開帳號
        Line.beforeLogin = () => {
            const w = load();
            return { wallet: { money: w.money, spent: w.spent, earned: w.earned, gongde: w.gongde, shop: w.shop } };
        };
        Line.on((type, data) => {
            if (type === 'login') {
                const local = load();
                // 訪客錢包收起來（新帳號的話錢已經搬進帳號了，訪客重新開始）
                if (!read(GUEST_KEY)) write(GUEST_KEY, data.player.isNew ? blank() : { money: local.money, spent: local.spent, earned: local.earned, gongde: local.gongde, shop: local.shop });
                // 後端還是舊版（沒有 gongde、shop）：先留這支手機的。店面升級：這支手機買過的併進帳號（後端登入時也會併）
                const shop = data.player.shop ? mergeShop(data.player.shop, local.shop) : local.shop;
                const pending = noPending();
                if (data.player.shop && !sameShop(shop, data.player.shop)) pending.shop = true;
                save({ money: data.player.money, spent: data.player.spent, earned: data.player.earned || {}, gongde: cleanGongde(data.player.gongde || (data.player.isNew ? local.gongde : null)), shop, pending, perks: cleanPerks(data.player.perks) });
                writeShopMirror(shop);
                if (pending.shop) schedule();
                emit('login', { isNew: data.player.isNew, name: data.player.name, left: local.money });
            }
            if (type === 'logout') {
                if (data && data.expired) { emit('logout', data); return; }  // 通行證過期：錢包先留著，重新登入會拿回帳號的
                const guest = read(GUEST_KEY) || blank();
                try { localStorage.removeItem(GUEST_KEY); } catch (e) { }
                save({ money: guest.money, spent: guest.spent || 0, earned: guest.earned || {}, gongde: cleanGongde(guest.gongde), shop: cleanShop(guest.shop), pending: noPending(), perks: [] });
                writeShopMirror(guest.shop);
                emit('logout', data);
            }
        });
        // 打開頁面時拿一次帳號最新的錢（可能在別支手機玩過）
        Line.ready.then(() => { if (Line.loggedIn) Wallet.sync(); });
        // 離開頁面前把沒送的送出去（不用 keepalive：Apps Script 會轉址，iPhone 的 keepalive 遇到轉址一定失敗）
        document.addEventListener('visibilitychange', () => {
            const w = load();
            if (document.hidden && (w.outbox || !isEmpty(w.pending))) Wallet.sync();
        });
    }

    window.Wallet = Wallet;
})();
