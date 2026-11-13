// LINE 登入（LIFF）：網站各頁共用。
// 網頁跟 LINE 拿 ID token → 送到後端 → 後端自己去問 LINE 是不是真的、是誰 → 發一張網站的通行證（session）。
// 網頁從頭到尾不知道 LINE 的使用者代號，也不跟 LINE 要 Email。
// 用法：Line.loggedIn、Line.profile（{ name, picture }）、Line.login()、Line.logout()、Line.on(fn)、Line.call(body)
(function () {
    const LIFF_ID = '2012419790-otENqBBj';
    const API_URL = "https://script.google.com/macros/s/AKfycbz6TWDms090u7iS_Xk0lmbbz6mlpfbCoK2mffmpRootu2Hv2lYiASpDbb7n8COwnr_K/exec";
    const SDK = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    const K = { session: 'dongbuli-session', profile: 'dongbuli-profile', off: 'dongbuli-line-off' };
    const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { } };
    const listeners = [];
    let available = false;

    function emit(type, data) {
        listeners.forEach(fn => { try { fn(type, data); } catch (e) { console.error(e); } });
        if (window.renderMemberFab) window.renderMemberFab();  // 右下角的大頭貼跟著換
    }

    function loadSdk() {
        return new Promise((resolve, reject) => {
            if (window.liff) return resolve();
            const s = document.createElement('script');
            s.src = SDK;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    async function post(body, keepalive) {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(body), keepalive: !!keepalive });
        return res.json();
    }

    // 拿 LINE 的 ID token 換網站的通行證
    let exchanging = null;
    function exchange() {
        if (exchanging) return exchanging;
        exchanging = (async () => {
            const idToken = liff.getIDToken();
            if (!idToken) return false;
            const extra = Line.beforeLogin ? Line.beforeLogin() : {};
            const r = await post({ type: 'lineLogin', idToken, ...extra });
            if (r.result !== 'success') {
                if (window.showToast) showToast(r.error === '不認得的請求' ? 'LINE 登入還沒開放，跟主人說一聲' : (r.error || 'LINE 登入失敗'));
                return false;
            }
            set(K.session, r.session);
            set(K.profile, JSON.stringify({ name: r.player.name, picture: r.player.picture }));
            emit('login', r);
            return true;
        })().catch(e => { console.warn(e); if (window.showToast) showToast('LINE 登入失敗，等一下再試'); return false; })
            .finally(() => { exchanging = null; });
        return exchanging;
    }

    function forget() {
        set(K.session, null);
        set(K.profile, null);
    }

    const Line = {
        LIFF_ID,
        API_URL,
        get loggedIn() { return !!get(K.session); },
        get profile() { try { return JSON.parse(get(K.profile)) || null; } catch (e) { return null; } },
        get available() { return available; },
        ready: null,
        beforeLogin: null,  // 送登入時要多帶的東西（錢包用：第一次登入用這支手機的錢開帳號）
        on(fn) { listeners.push(fn); },

        // 從 LINE 打開這一頁的網址（在 LINE 裡點了會自動登入）
        liffUrl: path => `https://liff.line.me/${LIFF_ID}/${String(path || '').replace(/^\//, '')}`,

        async login() {
            set(K.off, null);
            await Line.ready;
            if (!available) {
                if (window.showToast) showToast('LINE 登入現在用不了，等一下再試');
                return false;
            }
            if (liff.isLoggedIn()) return exchange();
            liff.login({ redirectUri: location.href });  // 去 LINE 登入，回來時 ready 會接著換通行證
            return false;
        },

        async logout() {
            const session = get(K.session);
            forget();
            set(K.off, '1');  // 在 LINE 裡打開也不要自動再登入
            if (session) post({ type: 'lineLogout', session }).catch(() => { });
            try { if (available && liff.isLoggedIn() && !liff.isInClient()) liff.logout(); } catch (e) { }
            emit('logout', {});
        },

        // 帶通行證呼叫後端；通行證失效就當作登出
        async call(body, keepalive) {
            const session = get(K.session);
            if (!session) return { result: 'unauthorized' };
            const r = await post({ ...body, session }, keepalive);
            if (r.result === 'unauthorized' && get(K.session) === session) {
                forget();
                emit('logout', { expired: true });
            }
            return r;
        },
    };

    Line.ready = (async () => {
        try {
            await loadSdk();
            await liff.init({ liffId: LIFF_ID });
            available = true;
            // 從 LINE 點進來，或剛從 LINE 登入頁跳回來：自動登入（自己按過登出的不會）
            if (liff.isLoggedIn() && !get(K.session) && !get(K.off)) await exchange();
        } catch (e) {
            console.warn('LIFF 用不了', e);
        }
    })();

    window.Line = Line;
})();
