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
        { key: 'xiaowu', name: '小吳鴨' },
    ];
    const BG = { julie: '#dbe8f5', appleduck: '#eef2fb', raccoon: '#ece4d6', captain: '#e3f0dc', cat: '#f6e6cf', dog: '#f3ead9', mole: '#e8ddcd', nugget: '#fbefd2', xiaowu: '#e4e7ef' };

    const ellipse = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); };
    const dot = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
    // 放射漸層（精緻化的頭像用：光從左上來）
    const rad = (c, x0, y0, r0, x1, y1, r1, a, b) => { const g = c.createRadialGradient(x0, y0, r0, x1, y1, r1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };

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
        // 浣熊大王（2026-11-20 精緻化）：灰色漸層頭、兩頰毛、黑眼罩、亮晶晶的眼睛、得意的嘴角、金皇冠（三顆寶石）、紅披風白毛領
        raccoon(c) {
            c.lineJoin = 'round'; c.lineCap = 'round';
            c.fillStyle = '#9e2f2c'; c.beginPath(); c.moveTo(-46, 50); c.quadraticCurveTo(-36, 26, -12, 27); c.lineTo(12, 27); c.quadraticCurveTo(36, 26, 46, 50); c.closePath(); c.fill();
            c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(-30, 50); c.quadraticCurveTo(-26, 36, -16, 32); c.lineTo(-12, 34); c.quadraticCurveTo(-20, 40, -22, 50); c.fill();
            c.fillStyle = '#f7f3ea'; ellipse(c, 0, 31, 27, 7.5); c.fill();
            c.fillStyle = '#2c2a30'; [-17, -7, 3, 13].forEach(x => { c.beginPath(); c.moveTo(x, 30); c.lineTo(x + 1.6, 35); c.lineTo(x - 1.6, 35); c.closePath(); c.fill(); });
            [-1, 1].forEach(k => {
                c.fillStyle = rad(c, k * 22, -26, 2, k * 24, -22, 13, '#9c99a3', '#5f5c67'); ellipse(c, k * 24, -22, 12.5, 12.5); c.fill();
                c.fillStyle = '#3a3840'; ellipse(c, k * 24, -21, 7.5, 7.5); c.fill();
                c.fillStyle = '#c9a8ad'; ellipse(c, k * 24, -19.5, 3.6, 4.4); c.fill();
            });
            c.fillStyle = rad(c, -8, -12, 4, 0, 2, 38, '#c9c6ce', '#827f8a');
            c.beginPath(); c.moveTo(-29, -8); c.quadraticCurveTo(-27, -31, 0, -32); c.quadraticCurveTo(27, -31, 29, -8);
            c.lineTo(37, 2); c.lineTo(30, 7); c.lineTo(36, 15); c.lineTo(26, 18); c.quadraticCurveTo(16, 30, 0, 30); c.quadraticCurveTo(-16, 30, -26, 18);
            c.lineTo(-36, 15); c.lineTo(-30, 7); c.lineTo(-37, 2); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(60,58,66,.35)'; c.lineWidth = 1.2; c.stroke();
            c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; [[-6, -28, -3, -22], [0, -29, 0, -23], [6, -28, 3, -22]].forEach(([a, b, x, y]) => { c.beginPath(); c.moveTo(a, b); c.lineTo(x, y); c.stroke(); });
            c.fillStyle = '#f6f4f0'; ellipse(c, 0, -10, 23, 6.5); c.fill();
            [-1, 1].forEach(k => { c.fillStyle = '#2f2d35'; ellipse(c, k * 12, 1, 12.5, 8.5, k * 0.25); c.fill(); });
            [-1, 1].forEach(k => {
                c.fillStyle = '#fff'; dot(c, k * 11, 0.5, 4.4);
                c.fillStyle = '#4a3a2c'; dot(c, k * 11 + 0.4, 1, 3); c.fillStyle = '#16151a'; dot(c, k * 11 + 0.5, 1.2, 1.9);
                c.fillStyle = '#fff'; dot(c, k * 11 + 1.6, -0.6, 1.1); dot(c, k * 11 - 0.8, 2.4, 0.5);
            });
            c.fillStyle = rad(c, -2, 12, 1, 0, 15, 14, '#ffffff', '#e2ddd3'); ellipse(c, 0, 16, 13.5, 10.5); c.fill();
            c.fillStyle = '#232127'; c.beginPath(); c.moveTo(-5.5, 9.5); c.quadraticCurveTo(0, 6.5, 5.5, 9.5); c.quadraticCurveTo(0, 15.5, -5.5, 9.5); c.fill();
            c.fillStyle = 'rgba(255,255,255,.65)'; ellipse(c, -1.8, 8.8, 1.9, 0.9); c.fill();
            c.strokeStyle = '#26252a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 13.5); c.lineTo(0, 17); c.moveTo(-6, 18.5); c.quadraticCurveTo(-2.5, 21, 0, 17); c.quadraticCurveTo(3.5, 21.5, 8, 16.5); c.stroke();
            c.fillStyle = 'rgba(232,140,150,.38)'; ellipse(c, -21, 12, 5, 3); c.fill(); ellipse(c, 21, 12, 5, 3); c.fill();
            const cg = c.createLinearGradient(0, -47, 0, -25); cg.addColorStop(0, '#f8dc7c'); cg.addColorStop(1, '#c48d2b');
            c.fillStyle = cg; c.strokeStyle = '#94691c'; c.lineWidth = 1.3;
            c.beginPath(); c.moveTo(-15, -27); c.lineTo(-17.5, -41); c.lineTo(-8, -33.5); c.lineTo(0, -46); c.lineTo(8, -33.5); c.lineTo(17.5, -41); c.lineTo(15, -27); c.quadraticCurveTo(0, -23.5, -15, -27); c.closePath(); c.fill(); c.stroke();
            c.strokeStyle = 'rgba(148,105,28,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-15, -30); c.quadraticCurveTo(0, -27, 15, -30); c.stroke();
            c.fillStyle = '#fff3d0'; [[-17.5, -41], [0, -46], [17.5, -41]].forEach(([x, y]) => dot(c, x, y, 1.9));
            c.fillStyle = '#b33a2f'; dot(c, 0, -32, 2.8); c.fillStyle = '#3f6fb3'; dot(c, -9, -30.5, 1.9); dot(c, 9, -30.5, 1.9);
            c.fillStyle = 'rgba(255,255,255,.75)'; dot(c, -0.9, -33, 0.9); c.fillRect(-12, -38, 1.3, 7);
        },
        // 青江菜船長（2026-11-20 精緻化，跟貨運・航裡的船長同一套畫法）：深綠寬葉、白綠菜梗、叉腰、生氣的粗眉、白頂黑簷的船長帽＋金徽章
        captain(c) {
            c.save(); c.translate(0, 6); c.scale(0.5, 0.5); c.lineJoin = 'round'; c.lineCap = 'round';
            const leaf = (ax, ay, rot, len, wid, col, vein) => {
                c.save(); c.translate(ax, ay); c.rotate(rot);
                c.fillStyle = col; c.beginPath(); c.moveTo(0, 0);
                c.bezierCurveTo(-wid * 0.3, -len * 0.35, -wid, -len * 0.55, -wid * 0.85, -len * 0.82);
                c.quadraticCurveTo(-wid * 0.5, -len * 1.08, 0, -len); c.quadraticCurveTo(wid * 0.5, -len * 1.08, wid * 0.85, -len * 0.82);
                c.bezierCurveTo(wid, -len * 0.55, wid * 0.3, -len * 0.35, 0, 0); c.fill();
                c.strokeStyle = vein; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -4); c.lineTo(0, -len * 0.88); c.stroke();
                c.lineWidth = 2; [0.4, 0.6].forEach(f => { c.beginPath(); c.moveTo(0, -len * f); c.lineTo(-wid * 0.5, -len * (f + 0.17)); c.moveTo(0, -len * f); c.lineTo(wid * 0.5, -len * (f + 0.17)); c.stroke(); });
                c.restore();
            };
            leaf(-16, -38, -1.15, 70, 34, '#256b31', '#5d9e4c');
            leaf(16, -38, 1.15, 70, 34, '#256b31', '#5d9e4c');
            leaf(-8, -40, -0.6, 76, 36, '#2f7d3a', '#7cbf5a');
            leaf(8, -40, 0.6, 76, 36, '#2f7d3a', '#7cbf5a');
            leaf(0, -42, 0, 66, 38, '#3a9142', '#9bd16a');
            const g = c.createLinearGradient(0, -50, 0, 100);
            g.addColorStop(0, '#b9e07a'); g.addColorStop(0.45, '#e6f5c4'); g.addColorStop(1, '#c4e39a');
            c.fillStyle = g;
            c.beginPath(); c.moveTo(-20, -48); c.quadraticCurveTo(-24, -10, -42, 30); c.quadraticCurveTo(-52, 68, -30, 94); c.quadraticCurveTo(0, 106, 30, 94);
            c.quadraticCurveTo(52, 68, 42, 30); c.quadraticCurveTo(24, -10, 20, -48); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(120,170,70,0.5)'; c.lineWidth = 2;
            [-22, -8, 8, 22].forEach(dx => { c.beginPath(); c.moveTo(dx * 0.5, -44); c.quadraticCurveTo(dx * 1.1, 20, dx * 1.2, 70); c.stroke(); });
            c.fillStyle = '#7cbf5a';
            [-14, -5, 5, 14].forEach((dx, i) => { c.beginPath(); c.moveTo(dx - 6, -46); c.lineTo(dx, -26 - (i % 2) * 6); c.lineTo(dx + 6, -46); c.fill(); });
            [-1, 1].forEach(k => {
                c.fillStyle = '#a8d672';
                c.beginPath(); c.moveTo(k * 40, 18); c.quadraticCurveTo(k * 68, 22, k * 62, 46); c.quadraticCurveTo(k * 54, 60, k * 42, 56); c.quadraticCurveTo(k * 50, 44, k * 46, 34); c.closePath(); c.fill();
                c.strokeStyle = 'rgba(100,150,60,0.6)'; c.lineWidth = 1.5; c.stroke();
            });
            const ey = 30;
            c.fillStyle = 'rgba(230,120,120,.25)'; ellipse(c, -27, ey + 16, 8, 5); c.fill(); ellipse(c, 27, ey + 16, 8, 5); c.fill();
            c.strokeStyle = '#1e1a18'; c.lineWidth = 6;
            c.beginPath(); c.moveTo(-28, ey - 14); c.lineTo(-8, ey - 6); c.moveTo(28, ey - 14); c.lineTo(8, ey - 6); c.stroke();
            c.fillStyle = '#1e1a18'; c.beginPath(); c.ellipse(-15, ey + 4, 5.5, 7, 0, 0, TAU); c.ellipse(15, ey + 4, 5.5, 7, 0, 0, TAU); c.fill();
            c.fillStyle = '#fff'; c.beginPath(); c.arc(-13, ey + 1, 1.9, 0, TAU); c.arc(17, ey + 1, 1.9, 0, TAU); c.fill();
            c.strokeStyle = '#1e1a18'; c.lineWidth = 3; c.beginPath(); c.arc(0, ey + 30, 9, 1.2 * Math.PI, 1.8 * Math.PI); c.stroke();
            c.save(); c.translate(0, -56); c.rotate(-0.1);
            c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(0, -8, 36, 13, 0, 0, TAU); c.fill();
            c.fillRect(-26, -8, 52, 14);
            c.strokeStyle = '#d8d2c8'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, -8, 36, 13, 0, Math.PI, TAU); c.stroke();
            c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(-26, 0, 52, 6);
            c.fillStyle = '#1f2a33'; c.fillRect(-27, 4, 54, 7);
            c.beginPath(); c.ellipse(0, 12, 30, 6, 0, 0, Math.PI); c.fill();
            c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(-8, 12.5, 14, 1.8, 0, 0, Math.PI); c.fill();
            c.fillStyle = '#e0b03a'; c.beginPath(); c.arc(0, -2, 6, 0, TAU); c.fill();
            c.strokeStyle = '#8a6a1e'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -6); c.lineTo(0, 2); c.moveTo(-3, -3); c.lineTo(3, -3); c.arc(0, 0, 3, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke();
            c.restore();
            c.restore();
        },
        // 店貓（2026-11-20 精緻化）：橘色虎斑、額頭的 M 字紋、兩頰蓬毛、愛睏的眼睛和睫毛、粉紅鼻子、ω 嘴、白鬍鬚、白胸口
        cat(c) {
            c.lineJoin = 'round'; c.lineCap = 'round';
            c.fillStyle = '#f7ead8'; ellipse(c, 0, 46, 27, 16); c.fill();
            [-1, 1].forEach(k => {
                c.fillStyle = rad(c, k * 22, -24, 2, k * 22, -22, 22, '#eeac63', '#d58a42');
                c.beginPath(); c.moveTo(k * 31, -4); c.quadraticCurveTo(k * 28, -26, k * 24, -40); c.quadraticCurveTo(k * 14, -32, k * 5, -25); c.closePath(); c.fill();
                c.strokeStyle = 'rgba(150,90,40,.3)'; c.lineWidth = 1.2; c.stroke();
                c.fillStyle = '#f2b4ad'; c.beginPath(); c.moveTo(k * 25, -12); c.quadraticCurveTo(k * 24.5, -26, k * 23, -32); c.quadraticCurveTo(k * 16, -27, k * 12, -23); c.closePath(); c.fill();
                c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1; [[0, 0], [2.5, 3], [-2, 4]].forEach(([a, b]) => { c.beginPath(); c.moveTo(k * (21 + a), -14 + b); c.lineTo(k * (19 + a), -24 + b); c.stroke(); });
            });
            c.fillStyle = rad(c, -8, -6, 4, 0, 6, 36, '#f4bb76', '#d68a3f');
            c.beginPath(); c.moveTo(-30, -6); c.quadraticCurveTo(-24, -26, 0, -26); c.quadraticCurveTo(24, -26, 30, -6);
            c.quadraticCurveTo(34, 6, 36, 12); c.lineTo(30, 13); c.lineTo(35, 20); c.lineTo(26, 21); c.quadraticCurveTo(16, 34, 0, 34); c.quadraticCurveTo(-16, 34, -26, 21);
            c.lineTo(-35, 20); c.lineTo(-30, 13); c.lineTo(-36, 12); c.quadraticCurveTo(-34, 6, -30, -6); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(150,90,40,.3)'; c.lineWidth = 1.2; c.stroke();
            c.strokeStyle = '#bf7232'; c.lineWidth = 2.6;
            c.beginPath(); c.moveTo(-9, -23); c.quadraticCurveTo(-7, -16, -4, -12); c.moveTo(0, -25); c.lineTo(0, -13); c.moveTo(9, -23); c.quadraticCurveTo(7, -16, 4, -12); c.stroke();
            c.lineWidth = 2.2; [-1, 1].forEach(k => { c.beginPath(); c.moveTo(k * 33, 4); c.lineTo(k * 24, 6); c.moveTo(k * 33, 10); c.lineTo(k * 25, 11); c.stroke(); });
            c.fillStyle = '#fbefe0'; ellipse(c, -6.5, 16, 9.5, 7.5); c.fill(); ellipse(c, 6.5, 16, 9.5, 7.5); c.fill(); ellipse(c, 0, 22, 7, 5); c.fill();
            c.strokeStyle = '#3a2a20'; c.lineWidth = 2.2;
            [-1, 1].forEach(k => {
                c.beginPath(); c.arc(k * 12, 1, 6.5, 0.12 * Math.PI, 0.88 * Math.PI); c.stroke();
                c.lineWidth = 1.3; c.beginPath(); c.moveTo(k * 18, 3); c.lineTo(k * 20.5, 1); c.moveTo(k * 16, 5.5); c.lineTo(k * 18, 5); c.stroke(); c.lineWidth = 2.2;
            });
            c.fillStyle = '#e8788a'; c.beginPath(); c.moveTo(-4.5, 11); c.quadraticCurveTo(0, 9.5, 4.5, 11); c.quadraticCurveTo(0.5, 16.5, 0, 16); c.quadraticCurveTo(-0.5, 16.5, -4.5, 11); c.fill();
            c.fillStyle = 'rgba(255,255,255,.7)'; ellipse(c, -1.4, 11.3, 1.5, 0.8); c.fill();
            c.strokeStyle = '#3a2a20'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, 16); c.quadraticCurveTo(-3.5, 20.5, -7.5, 18.5); c.moveTo(0, 16); c.quadraticCurveTo(3.5, 20.5, 7.5, 18.5); c.stroke();
            c.fillStyle = 'rgba(232,120,130,.35)'; ellipse(c, -19, 14, 5, 3); c.fill(); ellipse(c, 19, 14, 5, 3); c.fill();
            c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1;
            [[-13, 15, -38, 11], [-13, 18, -38, 20], [13, 15, 38, 11], [13, 18, 38, 20]].forEach(([a, b, x, y]) => { c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo((a + x) / 2, (b + y) / 2 - 2, x, y); c.stroke(); });
        },
        // 坐洗部的狗（2026-11-20 精緻化）：奶油色、垂耳、頭上頂著洗頭的泡泡、亮亮的眼睛、ω 嘴、舌頭收不回去
        dog(c) {
            c.lineJoin = 'round'; c.lineCap = 'round';
            [-1, 1].forEach(k => {
                c.fillStyle = rad(c, k * 26, -2, 2, k * 27, 6, 26, '#d9b47a', '#b48a52'); ellipse(c, k * 27, 7, 11.5, 23, -k * 0.25); c.fill();
                c.fillStyle = 'rgba(120,80,40,.18)'; ellipse(c, k * 25, 12, 6, 15, -k * 0.25); c.fill();
            });
            c.fillStyle = rad(c, -8, -10, 4, 0, 4, 34, '#fdf0d6', '#e6c992'); ellipse(c, 0, 3, 28.5, 30); c.fill();
            c.strokeStyle = 'rgba(170,130,70,.35)'; c.lineWidth = 1.2; c.stroke();
            // 洗頭的泡泡
            c.strokeStyle = 'rgba(150,185,215,.75)'; c.lineWidth = 1.1;
            [[-12, -27, 8], [-2, -31, 9.5], [10, -28, 8], [18, -23, 5.5], [-20, -21, 5], [4, -38, 5]].forEach(([x, y, r]) => { c.fillStyle = '#ffffff'; dot(c, x, y, r); c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); });
            c.fillStyle = 'rgba(190,220,240,.6)'; [[-2, -33, 3], [10, -30, 2.2]].forEach(([x, y, r]) => dot(c, x, y, r));
            [[26, -34, 3.2], [32, -26, 2], [-28, -32, 2.4]].forEach(([x, y, r]) => { c.fillStyle = 'rgba(255,255,255,.85)'; dot(c, x, y, r); c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); c.fillStyle = '#fff'; dot(c, x - r * .35, y - r * .35, r * .3); });
            c.fillStyle = 'rgba(190,150,90,.55)'; ellipse(c, -11, -11, 4, 2.2, -0.2); c.fill(); ellipse(c, 11, -11, 4, 2.2, 0.2); c.fill();
            [-1, 1].forEach(k => { c.fillStyle = '#2a1f1a'; dot(c, k * 11, -3, 4); c.fillStyle = '#fff'; dot(c, k * 11 + 1.4, -4.4, 1.4); dot(c, k * 11 - 1.2, -1.4, 0.6); });
            c.fillStyle = rad(c, 0, 14, 2, 0, 17, 15, '#fffaf0', '#f1dfbf'); ellipse(c, 0, 17, 15.5, 11.5); c.fill();
            c.fillStyle = '#2c2420'; c.beginPath(); c.moveTo(-6, 8.5); c.quadraticCurveTo(0, 6, 6, 8.5); c.quadraticCurveTo(4, 14.5, 0, 14.5); c.quadraticCurveTo(-4, 14.5, -6, 8.5); c.fill();
            c.fillStyle = 'rgba(255,255,255,.6)'; ellipse(c, -2, 8.8, 2, 1); c.fill();
            c.fillStyle = '#ef8291'; c.beginPath(); c.moveTo(-4.5, 21); c.quadraticCurveTo(-5.5, 31, 0.5, 31.5); c.quadraticCurveTo(6.5, 31, 5.5, 21); c.closePath(); c.fill();
            c.strokeStyle = '#d4606f'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(0.5, 22); c.lineTo(0.5, 28.5); c.stroke();
            c.fillStyle = 'rgba(255,255,255,.4)'; ellipse(c, -2, 25, 1.2, 2.4); c.fill();
            c.strokeStyle = '#2c2420'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 14.5); c.lineTo(0, 18); c.moveTo(-7, 19.5); c.quadraticCurveTo(-3.5, 23, 0, 18); c.quadraticCurveTo(3.5, 23, 7, 19.5); c.stroke();
            c.fillStyle = 'rgba(240,130,140,.35)'; ellipse(c, -19, 9, 5, 3); c.fill(); ellipse(c, 19, 9, 5, 3); c.fill();
        },
        // 鼴鼠（2026-11-20 精緻化，礦坑・挖的礦工）：天鵝絨的棕色漸層、短毛、小眼睛、粉紅大鼻子、粉紅爪子（指甲）、歪歪的工地帽
        mole(c) {
            c.lineJoin = 'round'; c.lineCap = 'round';
            c.fillStyle = rad(c, -10, -6, 4, 0, 8, 40, '#8f6a56', '#553b2f'); ellipse(c, 0, 10, 34, 34); c.fill();
            c.fillStyle = 'rgba(190,150,120,.28)'; ellipse(c, 0, 22, 22, 20); c.fill();
            c.strokeStyle = 'rgba(255,240,220,.12)'; c.lineWidth = 1;
            for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 14 + (i * 7) % 18, x = Math.cos(a) * r, y = 10 + Math.sin(a) * r; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 1.5, y - 3); c.stroke(); }
            c.fillStyle = '#1a1310'; dot(c, -11, -5, 2.6); dot(c, 11, -5, 2.6);
            c.fillStyle = 'rgba(255,255,255,.85)'; dot(c, -10.2, -5.8, 0.9); dot(c, 11.8, -5.8, 0.9);
            c.fillStyle = 'rgba(240,140,150,.3)'; ellipse(c, -17, 6, 5, 3); c.fill(); ellipse(c, 17, 6, 5, 3); c.fill();
            c.fillStyle = rad(c, -2, 3, 1, 0, 6, 11, '#f8b2bf', '#e27c90'); ellipse(c, 0, 6, 10.5, 8); c.fill();
            c.strokeStyle = 'rgba(184,90,110,.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 9); c.lineTo(0, 13); c.stroke();
            c.fillStyle = 'rgba(255,255,255,.7)'; ellipse(c, -3, 3, 3, 1.4, -0.2); c.fill();
            c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1;
            [[-9, 7, -28, 2], [-9, 9.5, -28, 11], [9, 7, 28, 2], [9, 9.5, 28, 11]].forEach(([a, b, x, y]) => { c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo((a + x) / 2, (b + y) / 2 - 1.5, x, y); c.stroke(); });
            c.strokeStyle = '#3a2620'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-4, 16); c.quadraticCurveTo(0, 19, 4, 16); c.stroke();
            [-1, 1].forEach(k => {
                c.fillStyle = rad(c, k * 20, 31, 1, k * 20, 34, 11, '#fbb6c2', '#e58a9c'); ellipse(c, k * 20, 34, 10, 7); c.fill();
                c.fillStyle = '#fff1f3'; [-5, -1.5, 2, 5.5].forEach(d => { ellipse(c, k * 20 + d, 28.5, 1.4, 2.6); c.fill(); });
                c.strokeStyle = 'rgba(190,90,110,.6)'; c.lineWidth = 1; [-3, 0.5, 4].forEach(d => { c.beginPath(); c.moveTo(k * 20 + d, 30.5); c.lineTo(k * 20 + d, 35); c.stroke(); });
            });
            c.fillStyle = 'rgba(120,80,50,.35)'; [[-22, 14, 1.2], [24, 18, 1], [-26, 22, 0.9]].forEach(([x, y, r]) => dot(c, x, y, r));
            c.save(); c.translate(2, -24); c.rotate(0.12);
            const hg = c.createLinearGradient(0, -18, 0, 2); hg.addColorStop(0, '#f8d468'); hg.addColorStop(1, '#d9a632');
            c.fillStyle = hg; c.beginPath(); c.arc(0, 0, 17, Math.PI, TAU); c.fill();
            c.fillStyle = '#c9952a'; c.beginPath(); c.roundRect(-22, -1.5, 44, 5, 2.5); c.fill();
            c.fillStyle = '#e0ad3a'; c.fillRect(-2, -17, 4, 16);
            c.fillStyle = '#fff6d8'; dot(c, 0, -9, 3.6); c.fillStyle = 'rgba(255,255,255,.6)'; ellipse(c, -8, -10, 4, 2, -0.6); c.fill();
            c.restore();
        },
        // 雞塊（2026-11-20 精緻化）：金黃漸層、酥脆的麵衣顆粒、亮面反光、亮晶晶的眼睛、腮紅
        nugget(c) {
            c.lineJoin = 'round'; c.lineCap = 'round';
            const shape = () => { c.beginPath(); c.moveTo(-30, 0); c.bezierCurveTo(-34, -26, -10, -34, 4, -28); c.bezierCurveTo(26, -34, 38, -12, 32, 6);
                c.bezierCurveTo(38, 26, 18, 38, 0, 34); c.bezierCurveTo(-20, 38, -36, 22, -30, 0); c.closePath(); };
            c.fillStyle = 'rgba(120,70,20,.18)'; c.save(); c.translate(1.5, 3); shape(); c.fill(); c.restore();
            c.fillStyle = rad(c, -10, -14, 4, 0, 2, 40, '#f8cd70', '#cf8a2e'); shape(); c.fill();
            c.strokeStyle = '#b8762a'; c.lineWidth = 1.6; shape(); c.stroke();
            c.save(); shape(); c.clip();
            // 麵衣顆粒：使用者說太多（2026-11-20），從 70 顆減到 24 顆、淡一點，避開臉
            for (let i = 0; i < 24; i++) {
                const a = i * 2.39996, r = 8 + Math.sqrt(i / 24) * 26, x = Math.cos(a) * r, y = Math.sin(a) * r * 0.95 + 2;
                if (Math.abs(x) < 16 && y > -6 && y < 16) continue;
                c.fillStyle = i % 3 ? 'rgba(180,105,30,.4)' : 'rgba(255,225,150,.6)';
                c.beginPath(); c.ellipse(x, y, 1.1 + (i % 3) * 0.3, 0.8 + (i % 2) * 0.3, a, 0, TAU); c.fill();
            }
            c.restore();
            c.fillStyle = 'rgba(255,255,255,.38)'; ellipse(c, -10, -14, 11, 5, -0.4); c.fill();
            c.fillStyle = 'rgba(255,255,255,.6)'; ellipse(c, -14, -16, 3.5, 1.6, -0.4); c.fill();
            c.fillStyle = '#3a2410'; dot(c, -10, 2, 3.4); dot(c, 10, 2, 3.4);
            c.fillStyle = '#fff'; dot(c, -8.8, 0.8, 1.2); dot(c, 11.2, 0.8, 1.2); dot(c, -10.8, 3.6, 0.5); dot(c, 9.2, 3.6, 0.5);
            c.strokeStyle = '#3a2410'; c.lineWidth = 2; c.beginPath(); c.arc(0, 8, 8, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
            c.fillStyle = '#c4495a'; c.beginPath(); c.arc(0, 12.5, 3, 0, Math.PI); c.fill();
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
    window.Avatar = { LIST, draw, url, name, appleDuck, crow, has: key => !!DRAW[key] };
})();
