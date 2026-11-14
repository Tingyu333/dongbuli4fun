// 功德・添（gongde.html）的規則，彩券行（scratch.html）、會員中心也會讀。要放在 wallet.js 後面。
// 捐的錢、光明燈的燈油存在共用錢包（Wallet.gongde），登入 LINE 就跟著帳號走。
//
// 加持怎麼算（彩券行買票的那一刻）：
//   這張本來沒中（張張有獎的是抽到最小獎），有 q 的機會「神明再抽一次」，只重抽一次。
//   q = 位階的永久加持（每種刮刮樂各自設上限，加持後回收率最多 98%，不會越捐越賺）
//     + 光明燈（燈油夠這張的票價就 +50%；燈油只給一般刮刮樂用，張張有獎和挖金礦不點燈）
//   挖金礦靠自己挖，神明不管。
// 其他燈（LAMPS，各自有燈油，存在 Wallet.gongde.oils）：
//   財神燈：刮刮樂中獎多兩成（財神加碼，兌獎時另外給），燈油照票價扣，張張有獎也算
//   太歲燈：挖金礦挖到炸彈擋一次（變啞彈），一張挖金礦用一次
//   文昌燈：坐洗部工資多兩成，一顆頭用一次
//   月老燈：坐洗部有緣人（稀有客人）來的機會兩倍（跟招牌合起來最多 2.5 倍），來了多給 $200 紅包，一顆頭用一次
// 換算：捐 $1、點 $1 的燈，大約換回 $0.6～0.7 的期望值，捐錢本來就該有點虧，這樣才叫功德。
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
    // 點燈：一盞 price 換 amount 的燈油；unit 是燈油的單位（money：照多少錢的刮刮樂；次、顆）
    // packs：一次點幾盞（點越多盞不會比較便宜，只是方便）
    const LAMPS = [
        { key: 'guangming', name: '光明燈', word: '光明', price: 1000, amount: 2000, unit: 'money', where: '彩券行', color: '#f7b733',
          fx: '沒中的刮刮樂，一半機會神明再抽一次', left: n => `燈油 ${fmtMoney(n)}，照得到 ${fmtMoney(n)} 的刮刮樂` },
        { key: 'caishen', name: '財神燈', word: '財神', price: 1000, amount: 3000, unit: 'money', where: '彩券行', color: '#e0a526',
          fx: '刮刮樂中獎多兩成（財神加碼），張張有獎的也算', left: n => `燈油 ${fmtMoney(n)}，照得到 ${fmtMoney(n)} 的刮刮樂` },
        { key: 'taisui', name: '太歲燈', word: '太歲', price: 600, amount: 1, unit: '次', where: '挖金礦', color: '#c0392b',
          fx: '挖金礦挖到炸彈，太歲幫你擋一次（變啞彈）', left: n => `還能擋 ${n} 次` },
        { key: 'wenchang', name: '文昌燈', word: '文昌', price: 300, amount: 1, unit: '顆頭', where: '坐洗部', color: '#5b8a72',
          fx: '坐洗部手藝加持，工資多兩成', left: n => `還有 ${n} 顆頭` },
        { key: 'yuelao', name: '月老燈', word: '月老', price: 200, amount: 1, unit: '顆頭', where: '坐洗部', color: '#d9667a',
          fx: '有緣人（貓、狗、阿伯、墨鏡）來的機會兩倍，來了多給 $200 紅包', left: n => `還有 ${n} 顆頭` },
    ];
    const PACKS = [1, 5, 20];
    const LAMP_Q = 0.5, CAI = 0.2, CAP = 0.98, MAX_Q = 0.9;
    const fmtMoney = n => '$' + Number(n).toLocaleString('en-US');
    const oilOf = (g, key) => key === 'guangming' ? (g.oil || 0) : ((g.oils || {})[key] || 0);

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
        if (!o || o.manual) return { q: 0, tierQ: 0, lampQ: 0, win: o && o.win, ret: o && o.ret, manual: true, oilUse: 0, caiUse: 0, cai: 0, shield: oilOf(g, 'taisui') > 0 };
        const allWin = o.win > 0.9999;
        const minV = Math.min(...o.rows.map(r => r.v));
        const pMin = o.rows.filter(r => r.v === minV).reduce((s, r) => s + r.p, 0);
        // 每一點 q 讓回收率多多少
        const per = allWin ? pMin * Math.max(0, o.ret - minV / price) : o.ret * (1 - o.win);
        const tierCap = per > 0 ? Math.max(0, (CAP - o.ret) / per) : 0;
        const tierQ = Math.min(t.q, tierCap);
        const lampQ = allWin ? 0 : LAMP_Q * Math.min(1, (g.oil || 0) / price);
        const q = Math.min(MAX_Q, tierQ + lampQ);
        // 財神燈：中獎多兩成（燈油不夠一張票價就照比例）
        const caiOil = oilOf(g, 'caishen'), cai = CAI * Math.min(1, caiOil / price);
        const retBless = o.ret + per * q;
        return {
            q, tierQ, lampQ, allWin, cai,
            win: allWin ? 1 : o.win + (1 - o.win) * q * o.win,
            retBless,
            ret: retBless * (1 + cai),
            oilUse: allWin || !(g.oil > 0) ? 0 : Math.min(g.oil, price),
            caiUse: caiOil > 0 ? Math.min(caiOil, price) : 0,
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

    // 現在亮著的燈：[{ ...燈, left: 剩多少 }]
    function lit(g) {
        g = g || (window.Wallet ? Wallet.gongde : {});
        return LAMPS.map(l => ({ ...l, oilLeft: oilOf(g, l.key) })).filter(l => l.oilLeft > 0);
    }

    window.Gongde = { TIERS, LAMPS, PACKS, LAMP_Q, CAI, CAP, tierOf, blessing, lit, oilOf, log, upload, recent: () => read().recent || [] };
    // 打開頁面時補送上次沒送成功的
    setTimeout(upload, 3000);
})();
