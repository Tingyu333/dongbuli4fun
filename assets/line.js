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


    // 驗證中的畫面：後端要去問 LINE、開帳號，Apps Script 剛睡醒時要好幾秒，讓人知道還在跑
    const STEPS = [[0, '跟 LINE 確認你是你'], [1800, 'LINE 說是本人沒錯'], [3600, '幫你把錢包搬上去'], [6500, '後端剛睡醒，再等一下'], [12000, '還在等，Google 今天有點慢']];
    let busyEl = null, busyTimers = [], busyMax = null;
    function busyStyle() {
        if (document.getElementById('line-busy-css')) return;
        const st = document.createElement('style');
        st.id = 'line-busy-css';
        st.textContent = `
#line-busy{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;
  background:rgb(var(--wabi-bg,252 250 248)/.94);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;transition:opacity .3s;
  font-family:'Noto Sans TC',sans-serif;color:rgb(var(--wabi-text,74 74 74));-webkit-user-select:none;user-select:none;touch-action:none}
#line-busy.on{opacity:1}
#line-busy .lb-seal{position:relative;width:96px;height:96px}
#line-busy .lb-ring{position:absolute;inset:0;border-radius:50%;border:1.5px dashed rgb(var(--wabi-accent,142 128 112)/.7);animation:lb-spin 7s linear infinite}
#line-busy .lb-stamp{position:absolute;inset:22px;display:flex;align-items:center;justify-content:center;border:2.5px solid rgb(var(--wabi-shu,179 58 47));border-radius:6px;
  color:rgb(var(--wabi-shu,179 58 47));font-family:'Noto Serif TC',serif;font-weight:700;font-size:30px;line-height:1;transform:rotate(-8deg);animation:lb-press 1.9s cubic-bezier(.3,1.4,.5,1) infinite}
#line-busy.done .lb-stamp{animation:lb-land .45s cubic-bezier(.3,1.6,.5,1) both}
#line-busy.done .lb-ring{animation:none;border-style:solid;border-color:rgb(var(--wabi-shu,179 58 47)/.35)}
#line-busy .lb-text{font-size:13px;letter-spacing:.2em;min-height:1.5em;text-align:center;padding:0 24px}
#line-busy .lb-dots i{display:inline-block;width:4px;height:4px;margin:0 3px;border-radius:50%;background:rgb(var(--wabi-accent,142 128 112));animation:lb-dot 1.2s ease-in-out infinite}
#line-busy .lb-dots i:nth-child(2){animation-delay:.15s}#line-busy .lb-dots i:nth-child(3){animation-delay:.3s}
#line-busy .lb-dots{margin-top:-14px}#line-busy.done .lb-dots{visibility:hidden}
@keyframes lb-spin{to{transform:rotate(360deg)}}
@keyframes lb-press{0%{transform:rotate(-8deg) scale(1.7);opacity:0}22%{transform:rotate(-8deg) scale(.92);opacity:1}30%{transform:rotate(-8deg) scale(1)}78%{opacity:1}100%{transform:rotate(-8deg) scale(1);opacity:0}}
@keyframes lb-land{0%{transform:rotate(-8deg) scale(1.7);opacity:0}100%{transform:rotate(-8deg) scale(1);opacity:1}}
@keyframes lb-dot{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
@media (prefers-reduced-motion:reduce){#line-busy .lb-ring,#line-busy .lb-stamp,#line-busy .lb-dots i{animation:none!important}}`;
        document.head.appendChild(st);
    }
    function busyText(t) { if (busyEl) busyEl.querySelector('.lb-text').textContent = t; }
    function showBusy(steps) {
        if (!document.body) { document.addEventListener('DOMContentLoaded', () => showBusy(steps), { once: true }); return; }
        busyStyle();
        busyTimers.forEach(clearTimeout); busyTimers = [];
        if (!busyEl) {
            busyEl = document.createElement('div');
            busyEl.id = 'line-busy';
            busyEl.setAttribute('role', 'status');
            busyEl.setAttribute('aria-live', 'polite');
            busyEl.innerHTML = '<div class="lb-seal"><div class="lb-ring"></div><div class="lb-stamp">絆</div></div><div class="lb-text"></div><div class="lb-dots"><i></i><i></i><i></i></div>';
            busyEl.addEventListener('contextmenu', e => e.preventDefault());
            document.body.appendChild(busyEl);
            requestAnimationFrame(() => busyEl && busyEl.classList.add('on'));
        }
        busyEl.classList.remove('done');
        (typeof steps === 'string' ? [[0, steps]] : steps).forEach(([ms, t]) => busyTimers.push(setTimeout(() => busyText(t), ms)));
        clearTimeout(busyMax);
        busyMax = setTimeout(() => hideBusy(), 25000);  // 怎樣都不要卡住畫面
    }
    function hideBusy(welcome) {
        busyTimers.forEach(clearTimeout); busyTimers = [];
        clearTimeout(busyMax);
        if (!busyEl) return;
        const el = busyEl;
        const out = () => { el.classList.remove('on'); setTimeout(() => el.remove(), 320); if (busyEl === el) busyEl = null; };
        if (welcome) { el.classList.add('done'); busyText(welcome); setTimeout(out, 1000); }
        else out();
    }
    // 剛從 LINE 登入頁（或 LINE 的轉頁）回來：SDK 還沒載完就先蓋上去
    // 從 LINE 登入頁按上一頁回來（bfcache）：把「前往 LINE」拿掉
    window.addEventListener('pageshow', e => { if (e.persisted && !exchanging) hideBusy(); });
    const q = location.search;
    if (/[?&](liffClientId|liff\.state)=/.test(q) || (/[?&]code=/.test(q) && /[?&]state=/.test(q))) showBusy(STEPS);

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
            if (!idToken) { hideBusy(); return false; }
            showBusy(STEPS);
            const extra = Line.beforeLogin ? Line.beforeLogin() : {};
            const r = await post({ type: 'lineLogin', idToken, ...extra });
            if (r.result !== 'success') {
                hideBusy();
                if (window.showToast) showToast(r.error === '不認得的請求' ? 'LINE 登入還沒開放，跟主人說一聲' : (r.error || 'LINE 登入失敗'));
                return false;
            }
            set(K.session, r.session);
            set(K.profile, JSON.stringify({ name: r.player.name, picture: r.player.picture }));
            emit('login', r);
            hideBusy(r.player.name ? `歡迎，${r.player.name}` : '登入好了');
            return true;
        })().catch(e => { console.warn(e); hideBusy(); if (window.showToast) showToast('LINE 登入失敗，等一下再試'); return false; })
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
            showBusy('前往 LINE');
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
            else if (!exchanging) hideBusy();
        } catch (e) {
            console.warn('LIFF 用不了', e);
            hideBusy();
        }
    })();

    window.Line = Line;
})();
