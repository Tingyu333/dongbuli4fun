// 全站共用（首頁、留言、關於）：Tailwind 設定、夜間模式、提示紙條
// 要放在 Tailwind CDN 之後、<head> 裡同步載入，夜間模式才不會先閃一下白天

tailwind.config = {
    theme: {
        extend: {
            // 顏色讀 assets/theme.css 的 CSS 變數，夜間模式換變數就會跟著變
            colors: {
                'wabi-bg': 'rgb(var(--wabi-bg) / <alpha-value>)',         // 米白紙張色
                'wabi-text': 'rgb(var(--wabi-text) / <alpha-value>)',     // 墨色
                'wabi-accent': 'rgb(var(--wabi-accent) / <alpha-value>)', // 枯茶色
                'wabi-sub': 'rgb(var(--wabi-sub) / <alpha-value>)',       // 淺灰
                'wabi-dark': 'rgb(var(--wabi-dark) / <alpha-value>)',     // 深岩灰
                'wabi-shu': 'rgb(var(--wabi-shu) / <alpha-value>)',       // 朱色
            },
            fontFamily: {
                serif: ['"Noto Serif TC"', 'serif'],
                sans: ['"Noto Sans TC"', 'sans-serif'],
            },
            letterSpacing: {
                'widest-xl': '.25em',
            }
        }
    }
};

// 夜間模式：晚上 10 點到早上 6 點、或手機設成深色時自動切換。
// 手動切過的話，這個分頁關掉前都照你選的。
(function () {
    const root = document.documentElement;
    let picked = null;
    try { picked = sessionStorage.getItem('theme'); } catch (e) { }
    const hour = new Date().getHours();
    const autoNight = hour >= 22 || hour < 6 || window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('night', picked ? picked === 'night' : autoNight);

    // 有 data-night-src 的圖片（例如首頁大圖）晚上換成夜景
    function swapImages() {
        const night = root.classList.contains('night');
        document.querySelectorAll('img[data-night-src]').forEach(img => {
            if (!img.dataset.daySrc) img.dataset.daySrc = img.getAttribute('src');
            img.src = night ? img.dataset.nightSrc : img.dataset.daySrc;
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        swapImages();

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'theme-toggle';
        const updateLabel = () => {
            const night = root.classList.contains('night');
            toggle.textContent = night ? '晝' : '夜'; // 顯示點下去會切到哪一個
            toggle.setAttribute('aria-label', night ? '切換成白天' : '切換成夜晚');
        };
        updateLabel();
        toggle.addEventListener('click', () => {
            const night = root.classList.toggle('night');
            try { sessionStorage.setItem('theme', night ? 'night' : 'day'); } catch (e) { }
            updateLabel();
            swapImages();
        });
        document.body.appendChild(toggle);
    });
})();

// 讀 CSS 變數給 canvas 用，例如 themeColor('--wabi-shu') → 'rgb(179 58 47)'
function themeColor(name) {
    return `rgb(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`;
}

// 提示紙條：彩蛋、酒醒之類的一句話
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; }, 2500);
    setTimeout(() => toast.remove(), 3000);
}
