// 指定頭像：只能從網站的角色挑（後端 Code.gs 的 AVATAR_KEYS 要跟 LIST 一樣）
// 用法：Avatar.LIST（[{ key, name }]）、Avatar.url(key)（畫好的圖片網址，可以直接放進 <img src>）、Avatar.draw(ctx, key, cx, cy, r, { noBg })
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
        { key: 'xiaowu', name: '小吳鴨' },
    ];
    const BG = { julie: '#dbe8f5', appleduck: '#eef2fb', raccoon: '#ece4d6', captain: '#e3f0dc', cat: '#f6e6cf', dog: '#f3ead9', mole: '#e8ddcd', nugget: '#fbefd2', xiaowu: '#e4e7ef' };

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
        appleduck(c) { appleDuck(c, 3, 10, 0.74); },
        xiaowu(c) { crow(c, 12, 22, 0.9, { face: 'normal' }); },
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


    // 蘋果鴨（蘋果鴨甜點店的商標）：使用者給的概念「頭上頂一顆蘋果的鴨子」，正式版是圓滾滾的小黃鴨＋紅蘋果，
    // 甜點店要精緻：頭和身體是一整個輪廓、脖子綁藍色緞帶（商標原本是藍線）、蘋果有光澤和葉脈、旁邊兩顆金色閃光。
    // 中心大約在 (0,0)，蘋果頂端 -66、肚子底 +48，寬約 105。甜點店的招牌、泡泡鴨、日報、頭像都叫這支。
    function appleDuck(c, x, y, s) {
        const LINE = '#7a5236';
        c.save(); c.translate(x, y); c.scale(s, s);
        c.lineJoin = 'round'; c.lineCap = 'round';
        const body = () => {
            c.beginPath(); c.moveTo(-22, 2);
            c.bezierCurveTo(-48, 10, -46, 48, -4, 48); c.lineTo(24, 48);
            c.bezierCurveTo(46, 48, 53, 34, 48, 20);
            c.bezierCurveTo(54, 13, 58, 2, 56, -9);
            c.bezierCurveTo(48, -3, 41, 1, 34, 3);
            c.bezierCurveTo(22, 7, 6, 6, -2, 0); c.closePath();
        };
        const head = () => { c.beginPath(); c.arc(-6, -20, 24, 0, TAU); };
        // 地上的影子
        const sh = c.createRadialGradient(8, 50, 2, 8, 50, 44); sh.addColorStop(0, 'rgba(110,70,40,.22)'); sh.addColorStop(1, 'rgba(110,70,40,0)');
        c.fillStyle = sh; ellipse(c, 8, 50, 46, 6); c.fill();
        // 外輪廓：先用兩倍粗的線描頭和身體，再把兩塊填起來，接縫就不見了
        c.strokeStyle = LINE; c.lineWidth = 4.4; body(); c.stroke(); head(); c.stroke();
        const gb = c.createLinearGradient(0, -2, 0, 48); gb.addColorStop(0, '#fff7da'); gb.addColorStop(0.55, '#ffe58e'); gb.addColorStop(1, '#ffcf55');
        c.fillStyle = gb; body(); c.fill();
        c.save(); body(); c.clip();
        const gl = c.createRadialGradient(-22, 14, 2, -22, 14, 30); gl.addColorStop(0, 'rgba(255,255,255,.7)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gl; c.fillRect(-50, -10, 110, 60);
        const gd = c.createLinearGradient(0, 30, 0, 50); gd.addColorStop(0, 'rgba(230,150,40,0)'); gd.addColorStop(1, 'rgba(230,150,40,.28)');
        c.fillStyle = gd; c.fillRect(-50, 28, 110, 24);
        c.restore();
        // 尾巴的兩道羽毛
        c.strokeStyle = 'rgba(122,82,54,.45)'; c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(44, 8); c.quadraticCurveTo(49, 4, 51, -3); c.moveTo(40, 12); c.quadraticCurveTo(46, 10, 48, 4); c.stroke();
        // 頭
        const gh = c.createRadialGradient(-16, -32, 3, -8, -20, 27); gh.addColorStop(0, '#fffbe8'); gh.addColorStop(0.6, '#ffeba6'); gh.addColorStop(1, '#ffd66a');
        c.fillStyle = gh; head(); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.beginPath(); c.arc(-6, -20, 19.5, Math.PI * 1.08, Math.PI * 1.42); c.stroke();
        // 蘋果壓在頭上的影子
        c.fillStyle = 'rgba(200,120,40,.18)'; ellipse(c, -5, -40, 13, 3.4); c.fill();
        // 翅膀（三片羽毛尖）
        const gw = c.createLinearGradient(10, 8, 30, 32); gw.addColorStop(0, '#ffe68a'); gw.addColorStop(1, '#ffc43c');
        c.fillStyle = gw; c.strokeStyle = LINE; c.lineWidth = 2;
        c.beginPath(); c.moveTo(4, 17); c.bezierCurveTo(12, 6, 32, 7, 39, 17);
        c.quadraticCurveTo(39, 23, 34, 23); c.quadraticCurveTo(35, 28, 29, 28); c.quadraticCurveTo(28, 33, 21, 31);
        c.bezierCurveTo(13, 30, 7, 25, 4, 17); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(122,82,54,.4)'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(13, 19); c.quadraticCurveTo(22, 16, 31, 20); c.moveTo(12, 23); c.quadraticCurveTo(19, 22, 25, 26); c.stroke();
        // 脖子上的藍緞帶
        c.fillStyle = '#4a6fd0'; c.strokeStyle = '#2f4db0'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(-26, 0); c.quadraticCurveTo(-8, 7, 12, 1); c.lineTo(12, 5.5); c.quadraticCurveTo(-8, 11.5, -26, 4.5); c.closePath(); c.fill(); c.stroke();
        const bx = -14, by = 5;
        c.beginPath(); c.moveTo(bx, by); c.bezierCurveTo(bx - 6, by - 9, bx - 15, by - 6, bx - 13, by + 1); c.bezierCurveTo(bx - 12, by + 5, bx - 5, by + 4, bx, by); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(bx, by); c.bezierCurveTo(bx + 6, by - 9, bx + 15, by - 6, bx + 13, by + 1); c.bezierCurveTo(bx + 12, by + 5, bx + 5, by + 4, bx, by); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(bx - 2, by + 2); c.lineTo(bx - 7, by + 13); c.lineTo(bx - 3.5, by + 11); c.lineTo(bx - 2, by + 14); c.lineTo(bx + 1, by + 3); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(bx + 2, by + 2); c.lineTo(bx + 8, by + 12); c.lineTo(bx + 4.5, by + 11); c.lineTo(bx + 3, by + 14); c.lineTo(bx - 1, by + 3); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#3c5cc0'; ellipse(c, bx, by + 0.5, 3.2, 3.6); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(bx - 4, by - 3); c.quadraticCurveTo(bx - 9, by - 6, bx - 11, by - 2); c.moveTo(bx + 4, by - 3); c.quadraticCurveTo(bx + 9, by - 6, bx + 11, by - 2); c.stroke();
        // 嘴（上下兩片、往左）
        const gk = c.createLinearGradient(-46, -18, -26, -6); gk.addColorStop(0, '#ffb24d'); gk.addColorStop(1, '#f2892b');
        c.fillStyle = gk; c.strokeStyle = LINE; c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(-27, -18); c.bezierCurveTo(-36, -21, -46, -18, -46, -13); c.quadraticCurveTo(-38, -10.5, -27, -11); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#e57b22';
        c.beginPath(); c.moveTo(-28, -11); c.quadraticCurveTo(-38, -10, -42, -8.5); c.quadraticCurveTo(-36, -4, -27, -6.5); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-31, -17.5); c.quadraticCurveTo(-37, -18.5, -41, -16.5); c.stroke();
        c.fillStyle = 'rgba(122,82,54,.6)'; dot(c, -38, -15.5, 0.8);
        // 眼睛（兩個反光）、腮紅
        [[-17, -24], [1, -23.5]].forEach(([ex, ey]) => {
            c.fillStyle = '#2e1d12'; ellipse(c, ex, ey, 3.4, 4.4); c.fill();
            c.fillStyle = '#ffffff'; dot(c, ex + 1.1, ey - 1.6, 1.4); dot(c, ex - 1.2, ey + 1.7, 0.6);
        });
        [[-22, -13], [7, -13]].forEach(([cx, cy]) => {
            const gc = c.createRadialGradient(cx, cy, 0.5, cx, cy, 6); gc.addColorStop(0, 'rgba(244,128,120,.55)'); gc.addColorStop(1, 'rgba(244,128,120,0)');
            c.fillStyle = gc; ellipse(c, cx, cy, 6.5, 4.2); c.fill();
        });
        // 頭上的蘋果
        const apple = () => {
            c.beginPath(); c.moveTo(-6, -57);
            c.bezierCurveTo(-11, -63, -25, -61, -24, -49.5);
            c.bezierCurveTo(-23, -39, -15, -35, -10, -37.5); c.quadraticCurveTo(-6, -36, -2, -37.5);
            c.bezierCurveTo(3, -35, 11, -39, 12, -49.5);
            c.bezierCurveTo(13, -61, -1, -63, -6, -57); c.closePath();
        };
        const ga = c.createRadialGradient(-13, -53, 1.5, -7, -48, 19); ga.addColorStop(0, '#ff8a78'); ga.addColorStop(0.45, '#e8392f'); ga.addColorStop(1, '#a41c1e');
        c.fillStyle = ga; c.strokeStyle = '#6e2418'; c.lineWidth = 1.8; apple(); c.fill();
        c.save(); apple(); c.clip();
        const gy = c.createRadialGradient(9, -44, 1, 9, -44, 9); gy.addColorStop(0, 'rgba(255,200,90,.45)'); gy.addColorStop(1, 'rgba(255,200,90,0)');
        c.fillStyle = gy; c.fillRect(-2, -56, 16, 20);
        c.strokeStyle = 'rgba(255,220,200,.25)'; c.lineWidth = 0.8;
        [-1, 4].forEach(d => { c.beginPath(); c.moveTo(d - 6, -56); c.quadraticCurveTo(d - 2, -47, d - 5, -38); c.stroke(); });
        c.restore();
        c.strokeStyle = '#6e2418'; c.lineWidth = 1.8; apple(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.85)'; ellipse(c, -16, -51, 2.4, 4.6, 0.45); c.fill(); dot(c, -12.5, -57, 1.1);
        // 梗、葉子（有葉脈）
        c.strokeStyle = '#6b4a2f'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-6, -56); c.quadraticCurveTo(-6.5, -62, -3.5, -66); c.stroke();
        const gf = c.createLinearGradient(-4, -66, 12, -60); gf.addColorStop(0, '#7cc95f'); gf.addColorStop(1, '#3f8f35');
        c.fillStyle = gf; c.strokeStyle = '#2f6b28'; c.lineWidth = 1.3;
        c.beginPath(); c.moveTo(-4.5, -62); c.bezierCurveTo(-1, -71, 9, -71, 13, -64); c.bezierCurveTo(7, -58, 0, -58, -4.5, -62); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(220,255,200,.75)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-3, -62.5); c.quadraticCurveTo(4, -65, 11, -64); c.stroke();
        // 金色閃光
        const spark = (sx, sy, r) => {
            c.beginPath(); c.moveTo(sx, sy - r); c.quadraticCurveTo(sx, sy, sx + r, sy); c.quadraticCurveTo(sx, sy, sx, sy + r);
            c.quadraticCurveTo(sx, sy, sx - r, sy); c.quadraticCurveTo(sx, sy, sx, sy - r); c.closePath(); c.fill();
        };
        c.fillStyle = '#f2b938'; spark(22, -54, 6); c.fillStyle = '#f7d16a'; spark(-30, -46, 3.6); spark(29, -42, 2.6);
        c.restore();
    }

    // 小吳鴨（疊・巢的主角）：烏鴉，鴉鴨同音所以堅持自己是鴨。金框圓眼鏡、呆毛、粗嘴＋剛毛、藍掛繩識別證（照片是一隻鴨）、藍紫光澤。
    // 面向左、3/4 側臉，跟蘋果鴨同一個座標習慣：中心約 (0,0)，頭頂 -48、腳底 +50。
    // o: { pose: 'stand'|'fly', face: 'normal'|'smug'|'panic'|'caw', badge, glasses, rim }
    const ell = ellipse;
    const LINE = '#0d0d12';
    function wingFly(c, back) {
        // 張開的翅膀：烏鴉的初級飛羽像手指一樣分開
        c.save();
        if (back) { c.translate(14, -2); c.rotate(0.35); c.scale(0.9, 0.9); } else { c.translate(4, 0); c.rotate(-0.15); }
        const g = c.createLinearGradient(0, -60, 0, 10);
        g.addColorStop(0, back ? '#1a1b22' : '#2c2e3e'); g.addColorStop(1, back ? '#111217' : '#181920');
        c.fillStyle = g; c.strokeStyle = LINE; c.lineWidth = 2.4;
        c.beginPath(); c.moveTo(-6, 6);
        c.bezierCurveTo(-14, -14, -10, -40, 4, -58);
        c.lineTo(10, -50); c.lineTo(14, -62); c.lineTo(20, -50); c.lineTo(26, -60); c.lineTo(30, -46); c.lineTo(38, -54); c.lineTo(40, -38);
        c.bezierCurveTo(44, -20, 34, 0, 18, 10); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(150,165,230,.35)'; c.lineWidth = 1.2;
        [[2, -40, 8, -10], [12, -44, 14, -10], [22, -42, 22, -8], [32, -36, 28, -4]].forEach(([a, b, x, y]) => { c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo((a + x) / 2 + 2, (b + y) / 2, x, y); c.stroke(); });
        c.restore();
    }

    function crow(c, x, y, s, o = {}) {
        const pose = o.pose || 'stand', face = o.face || 'normal';
        const glasses = o.glasses !== false, badge = o.badge !== false;
        c.save(); c.translate(x, y); c.scale(s, s); c.lineJoin = 'round'; c.lineCap = 'round';

        if (pose === 'stand') {
            const sh = c.createRadialGradient(6, 51, 2, 6, 51, 42); sh.addColorStop(0, 'rgba(40,30,20,.22)'); sh.addColorStop(1, 'rgba(40,30,20,0)');
            c.fillStyle = sh; ell(c, 6, 51, 44, 6); c.fill();
        }
        if (pose === 'fly') wingFly(c, true);

        // 尾巴：三根羽毛扇開
        c.fillStyle = '#16171d'; c.strokeStyle = LINE; c.lineWidth = 2.2;
        const tail = pose === 'fly' ? [[30, 18, 62, 22], [30, 22, 64, 32], [28, 26, 58, 40]] : [[30, 16, 64, 26], [30, 20, 66, 36], [28, 24, 58, 44]];
        tail.forEach(([a, b, tx, ty]) => { c.beginPath(); c.moveTo(a, b - 5); c.quadraticCurveTo(tx - 6, ty - 8, tx, ty); c.quadraticCurveTo(tx - 10, ty + 5, a - 2, b + 7); c.closePath(); c.fill(); c.stroke(); });

        // 腳
        if (pose === 'stand') {
            c.strokeStyle = '#3b3c44'; c.lineWidth = 3.4;
            [[-2, 36, -4, 50], [14, 36, 14, 50]].forEach(([a, b, fx, fy]) => {
                c.beginPath(); c.moveTo(a, b); c.lineTo(fx, fy); c.stroke();
                c.lineWidth = 2.6; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx - 9, fy + 1); c.moveTo(fx, fy); c.lineTo(fx - 6, fy + 4); c.moveTo(fx, fy); c.lineTo(fx + 5, fy + 1); c.stroke(); c.lineWidth = 3.4;
            });
        } else {
            // 飛的時候腳往下抓（抓著要疊的那塊）
            c.strokeStyle = '#3b3c44'; c.lineWidth = 3;
            [[-4, 34, -6, 48], [10, 34, 10, 48]].forEach(([a, b, fx, fy]) => {
                c.beginPath(); c.moveTo(a, b); c.lineTo(fx, fy); c.stroke();
                c.lineWidth = 2.2; c.beginPath(); c.moveTo(fx, fy); c.quadraticCurveTo(fx - 6, fy + 1, fx - 7, fy + 6); c.moveTo(fx, fy); c.quadraticCurveTo(fx + 5, fy + 1, fx + 6, fy + 6); c.stroke(); c.lineWidth = 3;
            });
        }

        // 身體＋頭：先描粗外框再填，接縫就不見了
        const body = () => {
            c.beginPath(); c.moveTo(-26, -6);
            c.bezierCurveTo(-46, 10, -36, 42, -4, 42); c.lineTo(16, 40);
            c.bezierCurveTo(38, 36, 46, 22, 38, 8);
            c.bezierCurveTo(30, -4, 8, -6, -8, -8); c.closePath();
        };
        const head = () => { c.beginPath(); c.arc(-12, -22, 23, 0, TAU); };
        c.strokeStyle = LINE; c.lineWidth = 4.6; body(); c.stroke(); head(); c.stroke();
        if (o.rim) { c.strokeStyle = 'rgba(255,236,170,.55)'; c.lineWidth = 7.5; body(); c.stroke(); head(); c.stroke(); c.strokeStyle = LINE; c.lineWidth = 4.6; body(); c.stroke(); head(); c.stroke(); }
        const gb = c.createLinearGradient(0, -8, 0, 42); gb.addColorStop(0, '#30324a'); gb.addColorStop(1, '#14151b');
        c.fillStyle = gb; body(); c.fill();
        const gh = c.createRadialGradient(-22, -36, 2, -12, -22, 26); gh.addColorStop(0, '#4a4e6e'); gh.addColorStop(0.5, '#262838'); gh.addColorStop(1, '#14151b');
        c.fillStyle = gh; head(); c.fill();
        // 藍紫色光澤
        c.strokeStyle = 'rgba(150,170,245,.5)'; c.lineWidth = 2.2; c.beginPath(); c.arc(-12, -22, 18, Math.PI * 1.05, Math.PI * 1.45); c.stroke();
        c.strokeStyle = 'rgba(150,170,245,.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(-30, 14); c.quadraticCurveTo(-30, 30, -14, 36); c.stroke();
        // 呆毛：兩根翹起來的羽毛
        c.fillStyle = '#1c1d26'; c.strokeStyle = LINE; c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(-14, -44); c.quadraticCurveTo(-12, -58, -2, -62); c.quadraticCurveTo(-8, -54, -7, -44); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(-8, -44); c.quadraticCurveTo(0, -54, 8, -54); c.quadraticCurveTo(0, -50, -2, -43); c.closePath(); c.fill(); c.stroke();
        if (face === 'panic') { // 嚇到羽毛都豎起來
            c.beginPath(); c.moveTo(-26, -40); c.lineTo(-32, -52); c.lineTo(-22, -43); c.moveTo(4, -40); c.lineTo(12, -50); c.lineTo(6, -38); c.fill(); c.stroke();
        }

        // 收起來的翅膀
        if (pose === 'stand') {
            const gw = c.createLinearGradient(0, 0, 30, 34); gw.addColorStop(0, '#2a2c3c'); gw.addColorStop(1, '#121318');
            c.fillStyle = gw; c.strokeStyle = LINE; c.lineWidth = 2.2;
            c.beginPath(); c.moveTo(-2, 6); c.bezierCurveTo(10, -2, 34, 2, 42, 18);
            c.quadraticCurveTo(44, 26, 38, 26); c.quadraticCurveTo(38, 32, 31, 31); c.quadraticCurveTo(29, 37, 21, 34);
            c.bezierCurveTo(10, 31, 2, 22, -2, 6); c.closePath(); c.fill(); c.stroke();
            c.strokeStyle = 'rgba(150,165,230,.35)'; c.lineWidth = 1.3;
            c.beginPath(); c.moveTo(8, 12); c.quadraticCurveTo(20, 10, 33, 18); c.moveTo(8, 18); c.quadraticCurveTo(18, 18, 27, 25); c.stroke();
        } else wingFly(c, false);

        // 識別證：藍色掛繩、白卡、照片是一隻鴨
        if (badge) {
            c.strokeStyle = '#3d6fb6'; c.lineWidth = 2.2;
            c.beginPath(); c.moveTo(-28, -4); c.quadraticCurveTo(-20, 6, -12, 12); c.moveTo(0, -6); c.quadraticCurveTo(-4, 4, -10, 12); c.stroke();
            c.save(); c.translate(-12, 12); c.rotate(-0.08);
            c.fillStyle = '#9aa0a8'; c.fillRect(-2.5, -1, 5, 4);
            c.fillStyle = '#ffffff'; c.strokeStyle = '#c9c2b4'; c.lineWidth = 1;
            c.beginPath(); c.roundRect(-10, 2, 20, 25, 2); c.fill(); c.stroke();
            c.fillStyle = '#fbe7a0'; c.fillRect(-7, 5, 14, 11);
            c.fillStyle = '#f2c23c'; dot(c, -1, 11.5, 3.6); dot(c, 2.5, 8.5, 2.4); c.fillStyle = '#f08a2a'; c.beginPath(); c.moveTo(-0.5, 8.5); c.lineTo(-3.5, 9.2); c.lineTo(-0.5, 10); c.fill();
            c.fillStyle = '#b8b0a2'; c.fillRect(-7, 19, 14, 1.6); c.fillRect(-7, 22.5, 9, 1.6);
            c.restore();
        }

        // 嘴：粗厚、往左，鼻孔上方一撮剛毛
        const open = face === 'caw' ? 0.5 : face === 'panic' ? 0.3 : 0;
        const gk = c.createLinearGradient(-58, -24, -30, -12); gk.addColorStop(0, '#2a2a31'); gk.addColorStop(1, '#4c4d58');
        c.fillStyle = gk; c.strokeStyle = LINE; c.lineWidth = 1.8;
        c.save(); c.translate(-31, -14); c.rotate(open);
        c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-14, 2, -21, 0); c.quadraticCurveTo(-12, 6, 0, 5); c.closePath(); c.fill(); c.stroke();
        c.restore();
        if (open) { c.fillStyle = '#8c3a3a'; c.beginPath(); c.moveTo(-31, -14); c.lineTo(-50, -15); c.lineTo(-48, -14 + open * 22); c.closePath(); c.fill(); }
        c.fillStyle = gk; c.beginPath(); c.moveTo(-30, -27); c.bezierCurveTo(-40, -29, -54, -24, -60, -15); c.quadraticCurveTo(-46, -12, -31, -13); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-34, -24.5); c.quadraticCurveTo(-44, -24, -52, -19); c.stroke();
        c.strokeStyle = 'rgba(60,62,80,.9)'; c.lineWidth = 1.1;
        [[-30, -27, -38, -25], [-29, -25, -37, -22], [-30, -29, -36, -28.5]].forEach(([a, b, x2, y2]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(x2, y2); c.stroke(); });

        // 眼睛：黑鳥要看得到臉，眼睛外面一圈淺灰
        const eyes = [[-21, -27], [-2, -26]];
        eyes.forEach(([ex, ey]) => {
            if (face === 'smug') {
                c.strokeStyle = '#e6e6ee'; c.lineWidth = 2; c.beginPath(); c.arc(ex, ey + 2, 4.2, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
            } else if (face === 'caw') {
                c.strokeStyle = '#e6e6ee'; c.lineWidth = 2;
                c.beginPath(); c.moveTo(ex - 4, ey - 3); c.lineTo(ex + 1, ey); c.lineTo(ex - 4, ey + 3); c.stroke();
            } else if (face === 'panic') {
                c.fillStyle = '#ffffff'; dot(c, ex, ey, 5.2); c.fillStyle = '#111'; dot(c, ex - 1, ey, 1.6);
            } else {
                c.fillStyle = '#5a5e78'; ell(c, ex, ey, 5.4, 6.2); c.fill();
                c.fillStyle = '#08080b'; ell(c, ex, ey, 3.8, 4.8); c.fill();
                c.fillStyle = '#ffffff'; dot(c, ex + 1.2, ey - 1.8, 1.6); dot(c, ex - 1.3, ey + 1.8, 0.7);
            }
        });
        // 腮紅（淡淡的）
        [[-28, -15], [6, -15]].forEach(([cx, cy]) => {
            const g = c.createRadialGradient(cx, cy, 0.5, cx, cy, 6); g.addColorStop(0, 'rgba(240,120,110,.4)'); g.addColorStop(1, 'rgba(240,120,110,0)');
            c.fillStyle = g; ell(c, cx, cy, 6, 4); c.fill();
        });
        // 圓框眼鏡（金色鏡框）
        if (glasses) {
            c.strokeStyle = '#d6ad5a'; c.lineWidth = 1.9;
            eyes.forEach(([ex, ey]) => { c.beginPath(); c.arc(ex, ey, 8.4, 0, TAU); c.stroke(); });
            c.beginPath(); c.moveTo(-12.8, -27.5); c.quadraticCurveTo(-11.5, -30, -10.2, -27.2); c.moveTo(6.3, -27); c.lineTo(10, -28.5); c.stroke();
            c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.4;
            eyes.forEach(([ex, ey]) => { c.beginPath(); c.moveTo(ex + 3, ey - 6); c.lineTo(ex + 5.6, ey - 3.2); c.stroke(); });
            if (face === 'smug') { c.fillStyle = '#fff6d0'; [[-25, -36], [6, -35]].forEach(([sx, sy]) => { c.beginPath(); c.moveTo(sx, sy - 4); c.quadraticCurveTo(sx, sy, sx + 4, sy); c.quadraticCurveTo(sx, sy, sx, sy + 4); c.quadraticCurveTo(sx, sy, sx - 4, sy); c.quadraticCurveTo(sx, sy, sx, sy - 4); c.fill(); }); }
        }
        // 慌張的汗
        if (face === 'panic') {
            c.fillStyle = '#9cc7ea'; c.strokeStyle = '#5f97c8'; c.lineWidth = 1;
            [[12, -42, 1], [18, -32, 0.75]].forEach(([sx, sy, k]) => { c.beginPath(); c.moveTo(sx, sy - 7 * k); c.quadraticCurveTo(sx + 5 * k, sy, sx, sy + 3 * k); c.quadraticCurveTo(sx - 5 * k, sy, sx, sy - 7 * k); c.fill(); c.stroke(); });
        }
        c.restore();
    }

    // o.noBg：不塗底色（礦坑・挖把頭像當礦工的頭，2026-11-20）
    function draw(c, key, cx, cy, r, o = {}) {
        if (!DRAW[key]) return;
        c.save(); c.translate(cx, cy);
        c.beginPath(); c.arc(0, 0, r, 0, TAU); c.closePath();
        if (!o.noBg) { c.fillStyle = BG[key] || '#eee'; c.fill(); }
        c.clip();
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
    window.Avatar = { LIST, draw, url, name, appleDuck, crow, has: key => !!DRAW[key] };
})();
