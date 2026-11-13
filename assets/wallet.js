// 共用錢包：小遊戲賺錢（洗頭發工資…）、刮刮樂花錢。只存在這支手機的 localStorage。
// 用法：Wallet.money、Wallet.earn(金額, '哪個遊戲')、Wallet.spend(金額)、Wallet.stats()
(function () {
    const KEY = 'dongbuli-wallet';
    const START = 1000;   // 第一次來，口袋裡有的錢
    let mem = null;       // localStorage 不能用時（無痕模式）先記在這

    function load() {
        let w = null;
        try { w = JSON.parse(localStorage.getItem(KEY)); } catch (e) { w = mem; }
        if (!w || typeof w.money !== 'number') {
            w = mem || { money: START, spent: 0, earned: {} };
            if (!mem) {
                // 舊版刮刮樂把錢存在自己的存檔裡，搬過來
                try {
                    const old = JSON.parse(localStorage.getItem('dongbuli-scratch-tw'));
                    if (old && typeof old.money === 'number') w.money = old.money;
                } catch (e) { }
            }
            save(w);
        }
        w.earned = w.earned || {};
        w.spent = w.spent || 0;
        return w;
    }

    function save(w) {
        mem = w;
        try { localStorage.setItem(KEY, JSON.stringify(w)); } catch (e) { }
    }

    window.Wallet = {
        get money() { return load().money; },

        // 賺錢。source 是哪個遊戲（'xitou'、'scratch'…），每個遊戲各自記次數、總額、最大一筆，之後做排行榜用
        earn(amount, source) {
            const w = load();
            amount = Math.max(0, Math.round(amount));
            w.money += amount;
            const e = w.earned[source] || (w.earned[source] = { times: 0, total: 0, best: 0 });
            e.times++;
            e.total += amount;
            e.best = Math.max(e.best, amount);
            save(w);
            return w.money;
        },

        // 花錢。錢不夠回 false，什麼都不扣
        spend(amount) {
            const w = load();
            if (w.money < amount) return false;
            w.money -= amount;
            w.spent += amount;
            save(w);
            return true;
        },

        // { money, spent, earned: { xitou: { times, total, best }, scratch: {…} } }
        stats() { return load(); },

        fmt: n => '$' + Number(n).toLocaleString('en-US'),
    };
})();
