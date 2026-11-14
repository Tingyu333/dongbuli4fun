// 共用錢包：小遊戲賺錢（洗頭發工資…）、刮刮樂花錢。
// 沒登入：只存在這支手機的 localStorage。
// 用 LINE 登入（assets/line.js）：錢跟著 LINE 帳號存在後端，換手機也在。
//   這支手機先照常加減（馬上看得到），再把「變了多少」（pending）送去後端，後端加進帳號、回傳最新的錢包。
// 用法：Wallet.money、Wallet.earn(金額, '哪個遊戲')、Wallet.spend(金額)、Wallet.stats()、Wallet.on(fn)
// 功德（gongde.html）也跟著錢包走：Wallet.gongde = { donated 累積捐了多少, oil 光明燈還剩多少燈油, lamps 點過幾盞, lit 點燈花了多少 }
//   Wallet.donate(金額)、Wallet.lightLamp(價錢, 燈油)、Wallet.useOil(金額)；登入時一樣送「變了多少」給後端
(function () {
    const KEY = 'dongbuli-wallet';
    const GUEST_KEY = 'dongbuli-wallet-guest';  // 登入時把這支手機原本的（訪客）錢包收起來，登出再拿回來
    const START = 1000;   // 第一次來，口袋裡有的錢
    let mem = null;       // localStorage 不能用時（無痕模式）先記在這
    let timer = null, inflight = false;
    const listeners = [];

    const noGongde = () => ({ donated: 0, oil: 0, lamps: 0, lit: 0 });
    const blank = () => ({ money: START, spent: 0, earned: {}, gongde: noGongde() });
    const noPending = () => ({ money: 0, spent: 0, earned: {}, gongde: noGongde() });
    const cleanGongde = g => ({ donated: Math.max(0, Number(g && g.donated) || 0), oil: Math.max(0, Number(g && g.oil) || 0), lamps: Math.max(0, Number(g && g.lamps) || 0), lit: Math.max(0, Number(g && g.lit) || 0) });
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

    const addGongde = (a, b) => { a.donated += b.donated || 0; a.oil += b.oil || 0; a.lamps += b.lamps || 0; a.lit = (a.lit || 0) + (b.lit || 0); return a; };
    const isEmpty = p => !p.money && !p.spent && !Object.keys(p.earned).length && !(p.gongde && (p.gongde.donated || p.gongde.oil || p.gongde.lamps || p.gongde.lit));

    // 後端回來的錢包 + 還沒送出去的變化 = 這支手機該顯示的
    function adopt(server) {
        const w = load(), p = w.pending, before = w.money;
        w.money = server.money + p.money;
        w.spent = server.spent + p.spent;
        w.earned = mergeEarned(JSON.parse(JSON.stringify(server.earned || {})), p.earned);
        // 後端還是舊版（沒有 gongde）就先用這支手機的
        if (server.gongde) w.gongde = cleanGongde(addGongde(cleanGongde(server.gongde), p.gongde));
        save(w);
        if (w.money !== before) emit('server', { diff: w.money - before });
    }

    function schedule() {
        if (!logged()) return;
        clearTimeout(timer);
        timer = setTimeout(() => Wallet.sync(), 1500);
    }

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
        get gongde() { return { ...load().gongde }; },
        donate(amount) {
            amount = Math.round(amount);
            if (!(amount > 0) || !Wallet.spend(amount)) return false;
            return changeGongde({ donated: amount });
        },
        // 點光明燈：花 price，燈油加 oil
        lightLamp(price, oil) {
            if (!Wallet.spend(price)) return false;
            return changeGongde({ oil, lamps: 1, lit: price });
        },
        // 刮刮樂用掉燈油（不夠就用到 0），回傳實際用掉多少
        useOil(amount) {
            const used = Math.min(load().gongde.oil, Math.max(0, Math.round(amount)));
            if (used) changeGongde({ oil: -used });
            return used;
        },

        // 把還沒送的變化送去後端（沒有變化就單純讀一次最新的）
        async sync(keepalive) {
            if (!logged() || inflight) return;
            clearTimeout(timer);
            inflight = true;
            const w = load(), sent = w.pending;
            w.pending = noPending();
            save(w);
            let ok = false;
            try {
                const r = await Line.call({ type: 'walletSync', delta: sent }, keepalive);
                if (r.result === 'success') { adopt(r.wallet); ok = true; }
            } catch (e) { }
            if (!ok && logged()) {
                // 沒送成功：把剛剛那包放回去，等下一次
                const back = load();
                back.pending.money += sent.money;
                back.pending.spent += sent.spent;
                mergeEarned(back.pending.earned, sent.earned);
                addGongde(back.pending.gongde, sent.gongde || {});
                save(back);
            }
            inflight = false;
            if (!isEmpty(load().pending)) schedule();
        },

        // { money, spent, earned: { xitou: { times, total, best }, scratch: {…} } }
        stats() { return load(); },
        on(fn) { listeners.push(fn); },
        fmt: n => '$' + Number(n).toLocaleString('en-US'),
    };

    if (window.Line) {
        // 第一次用 LINE 登入：用這支手機現在的錢開帳號
        Line.beforeLogin = () => {
            const w = load();
            return { wallet: { money: w.money, spent: w.spent, earned: w.earned, gongde: w.gongde } };
        };
        Line.on((type, data) => {
            if (type === 'login') {
                const local = load();
                // 訪客錢包收起來（新帳號的話錢已經搬進帳號了，訪客重新開始）
                if (!read(GUEST_KEY)) write(GUEST_KEY, data.player.isNew ? blank() : { money: local.money, spent: local.spent, earned: local.earned, gongde: local.gongde });
                // 後端還是舊版（沒有 gongde）：功德先留在這支手機
                save({ money: data.player.money, spent: data.player.spent, earned: data.player.earned || {}, gongde: cleanGongde(data.player.gongde || (data.player.isNew ? local.gongde : null)), pending: noPending() });
                emit('login', { isNew: data.player.isNew, name: data.player.name, left: local.money });
            }
            if (type === 'logout') {
                if (data && data.expired) { emit('logout', data); return; }  // 通行證過期：錢包先留著，重新登入會拿回帳號的
                const guest = read(GUEST_KEY) || blank();
                try { localStorage.removeItem(GUEST_KEY); } catch (e) { }
                save({ money: guest.money, spent: guest.spent || 0, earned: guest.earned || {}, gongde: cleanGongde(guest.gongde), pending: noPending() });
                emit('logout', data);
            }
        });
        // 打開頁面時拿一次帳號最新的錢（可能在別支手機玩過）
        Line.ready.then(() => { if (Line.loggedIn) Wallet.sync(); });
        // 離開頁面前把沒送的送出去
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && !isEmpty(load().pending)) Wallet.sync(true);
        });
    }

    window.Wallet = Wallet;
})();
