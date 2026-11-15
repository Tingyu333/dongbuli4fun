// 存圖片（收成單、洗頭證明、房務檢查表、蹭網日報、入住通知書）
// 1. 手機能分享檔案就叫出分享選單
// 2. 在 LINE、IG、FB 這種 App 裡的瀏覽器（安卓特別常見），下載連結按了沒反應：
//    改成全螢幕放大圖片，請使用者長按存起來
// 3. 其他（多半是電腦）直接下載
// 用法：SaveImg.save(file, { title, text })
(function () {
    const UA = navigator.userAgent || '';
    const inApp = /\bLine\/|FBAN|FBAV|Instagram|MicroMessenger|; wv\)/i.test(UA);
    const isLine = /\bLine\//i.test(UA);

    function css() {
        if (document.getElementById('saveimg-css')) return;
        const s = document.createElement('style');
        s.id = 'saveimg-css';
        s.textContent = `
#saveimg{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(20,18,16,.88);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}
#saveimg .si-box{width:100%;max-width:420px;max-height:100%;display:flex;flex-direction:column;align-items:center;gap:12px;overflow-y:auto}
#saveimg .si-h{color:#fff;font-family:'Noto Sans TC',sans-serif;font-size:14px;letter-spacing:.12em;text-align:center;line-height:1.7}
#saveimg .si-h b{font-weight:500;color:#f3c9a4}
#saveimg img{display:block;width:100%;height:auto;max-height:62vh;object-fit:contain;background:#fcfaf8;box-shadow:0 20px 50px -20px rgba(0,0,0,.7);-webkit-touch-callout:default;-webkit-user-select:auto;user-select:auto}
#saveimg .si-sub{color:rgba(255,255,255,.62);font-family:'Noto Sans TC',sans-serif;font-size:11px;letter-spacing:.08em;text-align:center;line-height:1.8}
#saveimg .si-row{display:flex;gap:8px;width:100%}
#saveimg .si-btn{flex:1;min-height:46px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.5);color:#fff;font-family:'Noto Sans TC',sans-serif;font-size:12px;letter-spacing:.2em;text-decoration:none;background:transparent}
#saveimg .si-btn.main{background:#fcfaf8;color:#2c2c2c;border-color:#fcfaf8}`;
        document.head.appendChild(s);
    }

    const toDataUrl = file => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = rej;
        r.readAsDataURL(file);
    });

    // 全螢幕放大圖片，長按存
    async function showBig(file) {
        css();
        let src;
        try { src = await toDataUrl(file); } catch (e) { src = URL.createObjectURL(file); }
        const old = document.getElementById('saveimg');
        if (old) old.remove();
        const el = document.createElement('div');
        el.id = 'saveimg';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-label', '存圖片');
        el.innerHTML = `<div class="si-box">
            <p class="si-h"><b>長按圖片</b>，選「下載圖片」或「儲存圖片」</p>
            <img alt="">
            <p class="si-sub">${isLine ? 'LINE 裡長按沒有存的選項的話，直接截圖也可以' : '長按沒有存的選項的話，直接截圖也可以'}</p>
            <div class="si-row">
                <a class="si-btn" data-dl>試試直接下載</a>
                <button type="button" class="si-btn main" data-close>好了</button>
            </div>
        </div>`;
        const img = el.querySelector('img');
        img.src = src;
        img.alt = file.name;
        const dl = el.querySelector('[data-dl]');
        dl.href = src;
        dl.download = file.name;
        el.addEventListener('click', e => {
            if (e.target.closest('[data-close]') || e.target === el) el.remove();
        });
        document.body.appendChild(el);
        const close = el.querySelector('[data-close]');
        try { close.focus({ preventScroll: true }); } catch (e) { }
    }

    function download(file) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    }

    async function save(file, opt = {}) {
        if (!file) return 'none';
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: opt.title, text: opt.text });
                return 'shared';
            } catch (e) {
                if (e && e.name === 'AbortError') return 'cancel';  // 使用者自己關掉分享選單
                // 分享失敗（App 裡的瀏覽器常常這樣）：改成放大給他存
            }
            await showBig(file);
            return 'big';
        }
        if (inApp) { await showBig(file); return 'big'; }
        download(file);
        return 'download';
    }

    // 按鈕上要寫「分享」還是「存」
    const canShare = file => !!(file && navigator.canShare && navigator.canShare({ files: [file] }));

    window.SaveImg = { save, canShare, inApp, showBig };
})();
