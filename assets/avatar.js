// 指定頭像：只能從網站的角色挑（後端 Code.gs 的 AVATAR_KEYS 要跟 LIST 一樣）
// 用法：Avatar.LIST（[{ key, name }]）、Avatar.url(key)（畫好的圖片網址，可以直接放進 <img src>）、Avatar.draw(ctx, key, cx, cy, r)
// 角色都是實物，顏色固定、不跟晝夜切換。
(function () {
    const TAU = Math.PI * 2;
    const LIST = [
        { key: 'julie', name: '茱莉鴨' },
        { key: 'appleduck', name: '蘋果鴨' },
        { key: 'raccoon', name: '浣熊大王' },
        { key: 'captain', name: '青江菜船長' },
        { key: 'cat', name: '店貓' },
        { key: 'dog', name: '坐洗部的狗' },
        { key: 'mole', name: '鼴鼠' },
        { key: 'nugget', name: '雞塊' },
    ];
    const BG = { julie: '#dbe8f5', appleduck: '#eef2fb', raccoon: '#ece4d6', captain: '#e3f0dc', cat: '#f6e6cf', dog: '#f3ead9', mole: '#e8ddcd', nugget: '#fbefd2' };

    const ellipse = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); };
    const dot = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };

    // 每個角色畫在半徑 48 的圓裡（中心 0,0）
    const DRAW = {
        julie(c) {
            c.fillStyle = '#ffffff'; ellipse(c, 0, 44, 40, 26); c.fill();
            c.fillStyle = '#fbfbf8'; c.strokeStyle = '#d8d3c8'; c.lineWidth = 1.5; ellipse(c, 0, 2, 30, 29); c.fill(); c.stroke();
            c.fillStyle = '#f0a03a'; ellipse(c, 8, 12, 15, 6.5); c.fill(); c.fillStyle = '#d9862a'; ellipse(c, 8, 14, 13, 2.5); c.fill();
            // 半睜的死魚眼：上面一半蓋眼皮
            [-11, 14].forEach(x => {
                c.fillStyle = '#fff'; ellipse(c, x, -6, 6, 5); c.fill();
                c.fillStyle = '#2c2c2c'; dot(c, x + 2, -4, 2.6);
                c.fillStyle = '#ece9e1'; c.fillRect(x - 7, -12, 14, 6);
                c.strokeStyle = '#2c2c2c'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 6, -6); c.lineTo(x + 6, -6); c.stroke();
            });
            c.fillStyle = '#3d6fb6'; c.beginPath(); c.moveTo(-14, 40); c.lineTo(0, 34); c.lineTo(-14, 28); c.closePath(); c.fill();
            c.beginPath(); c.moveTo(14, 40); c.lineTo(0, 34); c.lineTo(14, 28); c.closePath(); c.fill(); dot(c, 0, 34, 4);
        },
        appleduck(c) {
            const B = '#2f4db0';
            c.save(); c.translate(2, 8); c.scale(0.78, 0.78);
            c.lineWidth = 3.4; c.strokeStyle = B; c.fillStyle = '#ffffff'; c.lineJoin = 'round'; c.lineCap = 'round';
            c.beginPath(); c.moveTo(-24, -4); c.bezierCurveTo(-54, 4, -56, 44, -22, 46); c.lineTo(24, 46);
            c.bezierCurveTo(46, 46, 54, 28, 48, 6); c.lineTo(42, -10); c.lineTo(34, 6); c.bezierCurveTo(26, 12, 12, 10, 6, -2); c.closePath(); c.fill(); c.stroke();
            c.beginPath(); c.arc(-8, -22, 20, 0, TAU); c.fill(); c.stroke();
            c.beginPath(); c.moveTo(-22, -17); c.quadraticCurveTo(-38, -20, -33, -11); c.quadraticCurveTo(-27, -5, -19, -10); c.closePath(); c.fill(); c.stroke();
            c.beginPath(); c.moveTo(-34, -14); c.lineTo(-22, -13.5); c.stroke();
            c.fillStyle = B; dot(c, -15, -27, 2.2); dot(c, -1, -27, 2.2);
            c.beginPath(); c.arc(16, 22, 9, 0.25 * Math.PI, 0.8 * Math.PI); c.stroke();
            c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-8, -46);
            c.bezierCurveTo(-11, -51, -18, -49, -18, -42); c.bezierCurveTo(-18, -36, -12, -33, -8, -35); c.bezierCurveTo(-4, -33, 2, -36, 2, -42); c.bezierCurveTo(2, -49, -5, -51, -8, -46); c.fill(); c.stroke();
            c.beginPath(); c.moveTo(-8, -47); c.lineTo(-6, -54); c.stroke();
            ellipse(c, -2, -54, 4, 2, -0.5); c.stroke();
            c.restore();
        },
        raccoon(c) {
            c.fillStyle = '#7d7d84'; dot(c, -24, -22, 11); dot(c, 24, -22, 11);
            c.fillStyle = '#3a3a40'; dot(c, -24, -22, 6); dot(c, 24, -22, 6);
            c.fillStyle = '#9a9aa2'; ellipse(c, 0, 4, 32, 29); c.fill();
            c.fillStyle = '#ffffff'; ellipse(c, 0, -6, 24, 9); c.fill();
            c.fillStyle = '#34343a'; ellipse(c, -12, 2, 11, 8, -0.2); c.fill(); ellipse(c, 12, 2, 11, 8, 0.2); c.fill();
            c.fillStyle = '#ffffff'; dot(c, -11, 1, 3.6); dot(c, 11, 1, 3.6);
            c.fillStyle = '#1e1e22'; dot(c, -11, 1.5, 2); dot(c, 11, 1.5, 2);
            c.fillStyle = '#f2efe8'; ellipse(c, 0, 18, 14, 10); c.fill();
            c.fillStyle = '#26262a'; ellipse(c, 0, 12, 5, 3.5); c.fill();
            c.strokeStyle = '#26262a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-5, 20); c.quadraticCurveTo(0, 24, 5, 20); c.stroke();
            // 大王的皇冠
            c.fillStyle = '#e2b13c'; c.strokeStyle = '#b5852a'; c.lineWidth = 1.2;
            c.beginPath(); c.moveTo(-14, -26); c.lineTo(-14, -38); c.lineTo(-7, -31); c.lineTo(0, -42); c.lineTo(7, -31); c.lineTo(14, -38); c.lineTo(14, -26); c.closePath(); c.fill(); c.stroke();
            c.fillStyle = '#b33a2f'; dot(c, 0, -31, 2.4);
        },
        captain(c) {
            c.fillStyle = '#4f9a3f';
            [[-20, -6, 16, 28, -0.4], [20, -6, 16, 28, 0.4], [0, -10, 18, 30, 0]].forEach(([x, y, rx, ry, a]) => { ellipse(c, x, y, rx, ry, a); c.fill(); });
            c.strokeStyle = '#3d7d30'; c.lineWidth = 1.2; [[-20, -6], [20, -6], [0, -10]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x, y + 16); c.lineTo(x, y - 18); c.stroke(); });
            c.fillStyle = '#f2f4e8'; c.beginPath(); c.moveTo(-22, 10); c.quadraticCurveTo(-24, 46, 0, 50); c.quadraticCurveTo(24, 46, 22, 10); c.closePath(); c.fill();
            c.strokeStyle = '#d5dcc4'; c.lineWidth = 1.2; [-8, 8].forEach(x => { c.beginPath(); c.moveTo(x, 14); c.lineTo(x * 1.1, 44); c.stroke(); });
            // 生氣的臉
            c.strokeStyle = '#2c2c2c'; c.lineWidth = 2.2; c.lineCap = 'round';
            c.beginPath(); c.moveTo(-14, 18); c.lineTo(-5, 22); c.moveTo(14, 18); c.lineTo(5, 22); c.stroke();
            c.fillStyle = '#2c2c2c'; dot(c, -9, 26, 2.4); dot(c, 9, 26, 2.4);
            c.beginPath(); c.moveTo(-6, 37); c.quadraticCurveTo(0, 33, 6, 37); c.stroke();
            // 船長帽
            c.fillStyle = '#1f2f52'; c.beginPath(); c.moveTo(-26, -24); c.quadraticCurveTo(0, -46, 26, -24); c.closePath(); c.fill();
            c.fillStyle = '#ffffff'; c.fillRect(-26, -26, 52, 7);
            c.fillStyle = '#16233f'; ellipse(c, 0, -17, 28, 5); c.fill();
            c.fillStyle = '#e2b13c'; dot(c, 0, -33, 4);
        },
        cat(c) {
            c.fillStyle = '#e8a35a';
            c.beginPath(); c.moveTo(-30, -6); c.lineTo(-24, -38); c.lineTo(-6, -24); c.closePath(); c.fill();
            c.beginPath(); c.moveTo(30, -6); c.lineTo(24, -38); c.lineTo(6, -24); c.closePath(); c.fill();
            c.fillStyle = '#f2c9a0'; c.beginPath(); c.moveTo(-24, -12); c.lineTo(-22, -30); c.lineTo(-12, -22); c.closePath(); c.fill();
            c.beginPath(); c.moveTo(24, -12); c.lineTo(22, -30); c.lineTo(12, -22); c.closePath(); c.fill();
            c.fillStyle = '#e8a35a'; ellipse(c, 0, 6, 33, 28); c.fill();
            c.fillStyle = '#c97f38'; [[-6, -18, 3, 8], [6, -18, 3, 8], [0, -20, 3, 9]].forEach(([x, y, w, h]) => { ellipse(c, x, y, w, h); c.fill(); });
            c.fillStyle = '#fbe6cf'; ellipse(c, 0, 18, 15, 10); c.fill();
            // 愛睏的眼睛
            c.strokeStyle = '#3a2a20'; c.lineWidth = 2.2; c.lineCap = 'round';
            c.beginPath(); c.arc(-12, 2, 6, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
            c.beginPath(); c.arc(12, 2, 6, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
            c.fillStyle = '#e57a8a'; c.beginPath(); c.moveTo(-4, 12); c.lineTo(4, 12); c.lineTo(0, 16); c.closePath(); c.fill();
            c.strokeStyle = '#3a2a20'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, 16); c.quadraticCurveTo(-4, 21, -8, 19); c.moveTo(0, 16); c.quadraticCurveTo(4, 21, 8, 19); c.stroke();
            c.strokeStyle = 'rgba(80,60,40,.6)'; c.lineWidth = 1;
            [[-14, 14, -36, 10], [-14, 18, -36, 20], [14, 14, 36, 10], [14, 18, 36, 20]].forEach(([a, b, x, y]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(x, y); c.stroke(); });
        },
        dog(c) {
            c.fillStyle = '#c9a46a'; ellipse(c, -27, 6, 11, 22, 0.25); c.fill(); ellipse(c, 27, 6, 11, 22, -0.25); c.fill();
            c.fillStyle = '#ecd8b0'; ellipse(c, 0, 2, 28, 30); c.fill();
            c.fillStyle = '#f8ecd6'; ellipse(c, 0, 18, 15, 12); c.fill();
            c.fillStyle = '#2c2c2c'; dot(c, -11, -4, 3.4); dot(c, 11, -4, 3.4);
            c.fillStyle = '#fff'; dot(c, -10, -5, 1.1); dot(c, 12, -5, 1.1);
            c.fillStyle = '#2c2c2c'; ellipse(c, 0, 10, 6, 4.5); c.fill();
            c.strokeStyle = '#2c2c2c'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 14); c.lineTo(0, 18); c.moveTo(-6, 20); c.quadraticCurveTo(0, 24, 6, 20); c.stroke();
            c.fillStyle = '#e46a7a'; ellipse(c, 1, 27, 5, 6.5); c.fill(); c.strokeStyle = '#c94f62'; c.lineWidth = 1; c.beginPath(); c.moveTo(1, 23); c.lineTo(1, 31); c.stroke();
        },
        mole(c) {
            c.fillStyle = '#6e5040'; ellipse(c, 0, 10, 34, 34); c.fill();
            c.fillStyle = '#86624f'; ellipse(c, 0, 18, 22, 20); c.fill();
            c.fillStyle = '#1e1714'; dot(c, -11, -6, 2.4); dot(c, 11, -6, 2.4);
            c.fillStyle = '#ee8fa0'; ellipse(c, 0, 6, 10, 7.5); c.fill();
            c.fillStyle = '#c96a7c'; dot(c, -3, 6, 1.4); dot(c, 3, 6, 1.4);
            c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1;
            [[-8, 8, -26, 4], [-8, 10, -26, 12], [8, 8, 26, 4], [8, 10, 26, 12]].forEach(([a, b, x, y]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(x, y); c.stroke(); });
            // 兩隻粉紅爪子
            c.fillStyle = '#ee8fa0';
            [[-20, 34], [20, 34]].forEach(([x, y]) => { ellipse(c, x, y, 9, 6); c.fill(); });
            c.strokeStyle = '#c96a7c'; c.lineWidth = 1;
            [[-20, 34], [20, 34]].forEach(([x, y]) => { [-4, 0, 4].forEach(d => { c.beginPath(); c.moveTo(x + d, y - 4); c.lineTo(x + d, y - 8); c.stroke(); }); });
        },
        nugget(c) {
            c.fillStyle = '#e2a33f';
            c.beginPath(); c.moveTo(-30, 0); c.bezierCurveTo(-34, -26, -10, -34, 4, -28); c.bezierCurveTo(26, -34, 38, -12, 32, 6);
            c.bezierCurveTo(38, 26, 18, 38, 0, 34); c.bezierCurveTo(-20, 38, -36, 22, -30, 0); c.closePath(); c.fill();
            c.fillStyle = '#c6852a'; [[-16, -16, 3], [14, -18, 2.5], [22, 14, 3], [-20, 18, 2.5], [4, 26, 2], [-4, -24, 2]].forEach(([x, y, r]) => dot(c, x, y, r));
            c.fillStyle = '#f0c063'; ellipse(c, -6, -10, 12, 6, -0.3); c.fill();
            c.fillStyle = '#3a2410'; dot(c, -10, 2, 3); dot(c, 10, 2, 3);
            c.strokeStyle = '#3a2410'; c.lineWidth = 2; c.lineCap = 'round'; c.beginPath(); c.arc(0, 8, 8, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
            c.fillStyle = 'rgba(230,110,90,.45)'; ellipse(c, -18, 10, 5, 3); c.fill(); ellipse(c, 18, 10, 5, 3); c.fill();
        },
    };

    function draw(c, key, cx, cy, r) {
        if (!DRAW[key]) return;
        c.save(); c.translate(cx, cy);
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.closePath();
        c.fillStyle = BG[key] || '#eee'; c.fill(); c.clip();
        c.scale(r / 48, r / 48);
        DRAW[key](c);
        c.restore();
    }

    const cache = {};
    function url(key, px = 128) {
        if (!DRAW[key]) return '';
        const k = key + ':' + px;
        if (cache[k]) return cache[k];
        try {
            const cv = document.createElement('canvas'); cv.width = px; cv.height = px;
            draw(cv.getContext('2d'), key, px / 2, px / 2, px / 2);
            cache[k] = cv.toDataURL('image/png');
        } catch (e) { cache[k] = ''; }
        return cache[k];
    }
    const name = key => (LIST.find(a => a.key === key) || {}).name || '';
    window.Avatar = { LIST, draw, url, name, has: key => !!DRAW[key] };
})();
