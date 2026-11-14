// 把全站用到的 Tailwind class 先打包成 assets/tailwind.css（Tailwind CDN 被擋或太慢時，排版不會跑掉）。
// 顏色、字體要跟 assets/theme.js 的 tailwind.config 一樣。
// 改了頁面裡的 class 之後重新產生（Tailwind v3）：
//   npx tailwindcss@3 -c tools/tailwind.config.js -i tools/tailwind.in.css -o assets/tailwind.css --minify
// 然後把所有頁面 assets/tailwind.css 後面的 ?v= 換新。
module.exports = {
    content: ['./*.html', './assets/*.js'],
    theme: {
        extend: {
            colors: {
                'wabi-bg': 'rgb(var(--wabi-bg) / <alpha-value>)',
                'wabi-text': 'rgb(var(--wabi-text) / <alpha-value>)',
                'wabi-accent': 'rgb(var(--wabi-accent) / <alpha-value>)',
                'wabi-sub': 'rgb(var(--wabi-sub) / <alpha-value>)',
                'wabi-dark': 'rgb(var(--wabi-dark) / <alpha-value>)',
                'wabi-shu': 'rgb(var(--wabi-shu) / <alpha-value>)',
            },
            fontFamily: {
                serif: ['"Noto Serif TC"', 'serif'],
                sans: ['"Noto Sans TC"', 'sans-serif'],
            },
            letterSpacing: {
                'widest-xl': '.25em',
            },
        },
    },
};
