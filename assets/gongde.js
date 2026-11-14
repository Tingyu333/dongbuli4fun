// 功德・添（gongde.html）的規則，彩券行（scratch.html）、會員中心也會讀。要放在 wallet.js 後面。
// 捐的錢、光明燈的燈油存在共用錢包（Wallet.gongde），登入 LINE 就跟著帳號走。
//
// 加持怎麼算（彩券行買票的那一刻）：
//   這張本來沒中（張張有獎的是抽到最小獎），有 q 的機會「神明再抽一次」，只重抽一次。
//   q = 位階的永久加持（每種刮刮樂各自設上限，加持後回收率最多 98%，不會越捐越賺）
//     + 光明燈（燈油夠這張的票價就 +50%；燈油只給一般刮刮樂用，張張有獎和挖金礦不點燈）
//   挖金礦靠自己挖，神明不管。
// 換算：捐 $1 大約換回 $0.6～0.7 的期望值，捐錢本來就該有點虧，這樣才叫功德。
(function () {
    const API_URL = (window.Line && Line.API_URL) || "https://script.google.com/macros/s/AKfycbz6TWDms090u7iS_Xk0lmbbz6mlpfbCoK2mffmpRootu2Hv2lYiASpDbb7n8COwnr_K/exec";
    const LOG_KEY = 'dongbuli-gongde-log';

    // 位階：累積捐到多少。q 是永久加持（沒中的票重抽一次的機會）
    const TIERS = [
        { min: 0, name: '路人', q: 0, line: '還沒捐過。神明不認識你，但神明人很好。' },
        { min: 10000, name: '善信', q: 0.1, line: '神明開始記得你的名字了。' },
        { min: 50000, name: '功德主', q: 0.2, line: '廟口的阿伯會跟你點頭。' },
        { min: 200000, name: '大護法', q: 0.3, line: '香爐的煙會往你這邊飄。' },
        { min: 1000000, name: '活菩薩', q: 0.4, line: '神明看到你會站起來。' },
    ];
    // 光明燈：燈油是「可以照多少錢的刮刮樂」，買票時照票價扣
    const LAMPS = [
        { key: 's', name: '小燈', price: 1000, oil: 2000, line: '照兩千塊的刮刮樂' },
        { key: 'm', name: '中燈', price: 5000, oil: 10000, line: '照一萬塊的刮刮樂' },
        { key: 'l', name: '光明燈王', price: 20000, oil: 40000, line: '照四萬塊的刮刮樂' },
    ];
    const LAMP_Q = 0.5, CAP = 0.98, MAX_Q = 0.9;

    function tierOf(donated) {
        let i = 0;
        TIERS.forEach((t, k) => { if (donated >= t.min) i = k; });
        return { ...TIERS[i], index: i, next: TIERS[i + 1] || null };
    }

    // 某一種刮刮樂現在的加持。o 是彩券行 odds() 算出來的 { win, ret, rows }，price 是票價
    // 回傳 { q 重抽機會, tierQ, lampQ, win, ret（加持後）, allWin, oilUse（這張會用掉多少燈油） }
    function blessing(o, price, g) {
        g = g || (window.Wallet ? Wallet.gongde : { donated: 0, oil: 0 });
        const t = tierOf(g.donated);
        if (!o || o.manual) return { q: 0, tierQ: 0, lampQ: 0, win: o && o.win, ret: o && o.ret, manual: true, oilUse: 0 };
        const allWin = o.win > 0.9999;
        const minV = Math.min(...o.rows.map(r => r.v));
        const pMin = o.rows.filter(r => r.v === minV).reduce((s, r) => s + r.p, 0);
        // 每一點 q 讓回收率多多少
        const per = allWin ? pMin * Math.max(0, o.ret - minV / price) : o.ret * (1 - o.win);
        const tierCap = per > 0 ? Math.max(0, (CAP - o.ret) / per) : 0;
        const tierQ = Math.min(t.q, tierCap);
        const lampQ = allWin ? 0 : LAMP_Q * Math.min(1, (g.oil || 0) / price);
        const q = Math.min(MAX_Q, tierQ + lampQ);
        return {
            q, tierQ, lampQ, allWin,
            win: allWin ? 1 : o.win + (1 - o.win) * q * o.win,
            ret: o.ret + per * q,
            oilUse: allWin || !(g.oil > 0) ? 0 : Math.min(g.oil, price),
        };
    }

    // ---- 紀錄：每一筆捐獻、點燈都送到後端（Gongde 分頁），沒送成功的下次再送 ----
    const read = () => { try { return JSON.parse(localStorage.getItem(LOG_KEY)) || {}; } catch (e) { return {}; } };
    const write = v => { try { localStorage.setItem(LOG_KEY, JSON.stringify(v)); } catch (e) { } };
    function deviceId() {
        let id = '';
        try { id = localStorage.getItem('dongbuli-device') || ''; } catch (e) { }
        if (!id) {
            id = window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
            try { localStorage.setItem('dongbuli-device', id); } catch (e) { }
        }
        return id;
    }
    let uploading = false;
    async function upload() {
        const d = read(), queue = d.queue || [];
        if (uploading || !queue.length) return { ok: true, saved: 0 };
        uploading = true;
        const batch = queue.slice(0, 20);
        let session = null;
        try { session = localStorage.getItem('dongbuli-session'); } catch (e) { }
        try {
            const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ type: 'gongdeLog', device: deviceId(), session: session || undefined, recs: batch }) });
            const r = await res.json();
            if (r.result !== 'success') throw new Error(r.error || '後端沒收');
            const now = read();
            now.queue = (now.queue || []).filter(x => !batch.some(b => b.at === x.at));
            write(now);
            uploading = false;
            if (now.queue.length) return upload();
            return { ok: true, saved: r.saved };
        } catch (e) {
            uploading = false;
            return { ok: false, error: e.message };
        }
    }
    function log(rec) {
        const d = read();
        rec = { at: new Date().toISOString(), ...rec };
        d.queue = (d.queue || []).concat([rec]).slice(-200);
        d.recent = [rec].concat(d.recent || []).slice(0, 30);
        write(d);
        return upload();
    }

    window.Gongde = { TIERS, LAMPS, LAMP_Q, CAP, tierOf, blessing, log, upload, recent: () => read().recent || [] };
    // 打開頁面時補送上次沒送成功的
    setTimeout(upload, 3000);
})();
