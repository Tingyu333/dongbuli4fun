// 二十七樓紀念幣的幣面（2026-11-26）：canvas 畫成金屬圓幣，邊緣有齒紋，圖案是浮雕（暗邊＋亮邊＋本色）。
// 用法：CoinFace.draw(ctx, 'c1', x, y, r, { crack: false, shine: 0 })
//   crack：爆倉的時候畫裂痕；shine：0～1，一道反光掃過（跳價動畫用）。
// 幣是實物，顏色固定，不跟晝夜換。
(function () {
    // 五種金屬：本色、亮、暗、浮雕的字和圖用的深色
    const METAL = {
        c1: { name: '丼幣', tk: 'DON', base: '#dcae45', hi: '#fff3c4', lo: '#8a6416', ink: '#6e4c0c' },     // 金
        c2: { name: '茱莉鴨幣', tk: 'DUCK', base: '#c3c7cd', hi: '#ffffff', lo: '#666d76', ink: '#4a5058' },  // 銀
        c3: { name: '浣熊幣', tk: 'RACC', base: '#c07a47', hi: '#f6cba2', lo: '#6a3716', ink: '#4a230b' },     // 銅
        c4: { name: '蘿蔔幣', tk: 'RDSH', base: '#7eac98', hi: '#d8f1e5', lo: '#3a6454', ink: '#2c4d40' },   // 綠銅
        c5: { name: '雞塊幣', tk: 'NUGT', base: '#e6a03c', hi: '#ffe2a4', lo: '#94560f', ink: '#7a440a' },   // 炸物金
    };

    // 兩個色混在一起（t 是第二個色佔多少）
    function mix(a, b, t) {
        const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), A = p(a), B = p(b);
        return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
    }
    // 金屬面的漸層：光從左上來。flip 是凹下去的內圈：左上稍暗、右下稍亮，對比小一點
    function metal(x, cx, cy, r, m, flip) {
        if (flip) {
            const g = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
            g.addColorStop(0, mix(m.base, m.lo, 0.22)); g.addColorStop(0.5, m.base); g.addColorStop(1, mix(m.base, m.hi, 0.4));
            return g;
        }
        const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r * 1.05);
        g.addColorStop(0, m.hi); g.addColorStop(0.45, m.base); g.addColorStop(1, m.lo);
        return g;
    }

    // 浮雕的上色：本色和深色都用斜的金屬漸層（座標是圖案的單位座標，-1～1），draw() 每次畫之前換掉
    let G = null;
    function relief(x, m) {
        const g1 = x.createLinearGradient(-0.7, -0.8, 0.6, 0.8);
        g1.addColorStop(0, mix(m.base, m.hi, 0.75)); g1.addColorStop(0.35, mix(m.base, m.hi, 0.25)); g1.addColorStop(0.62, m.base); g1.addColorStop(0.8, mix(m.base, m.hi, 0.35)); g1.addColorStop(1, mix(m.base, m.lo, 0.45));
        const g2 = x.createLinearGradient(-0.6, -0.7, 0.6, 0.7);
        g2.addColorStop(0, mix(m.ink, m.base, 0.45)); g2.addColorStop(0.5, m.ink); g2.addColorStop(1, mix(m.ink, '#000000', 0.25));
        G = { base: g1, ink: g2 };
    }
    const paint = (m, c) => G && c === m.base ? G.base : G && c === m.ink ? G.ink : c;
    // 浮雕：同一個形狀畫三次（右下暗、左上亮、中間本色）
    function emboss(x, m, d, path, fill) {
        x.save(); x.translate(d, d); x.fillStyle = mix(m.lo, '#000000', 0.15); path(); x.fill(); x.restore();
        x.save(); x.translate(-d * 0.7, -d * 0.7); x.fillStyle = '#ffffff'; x.globalAlpha = 0.85; path(); x.fill(); x.restore();
        x.fillStyle = paint(m, fill); path(); x.fill();
    }
    function embossStroke(x, m, d, path, w, col) {
        x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = w;
        x.save(); x.translate(d, d); x.strokeStyle = m.lo; path(); x.stroke(); x.restore();
        x.save(); x.translate(-d * 0.7, -d * 0.7); x.strokeStyle = m.hi; path(); x.stroke(); x.restore();
        x.strokeStyle = paint(m, col); path(); x.stroke();
    }

    // 沿著圓弧寫字（top：上半圈順時針；否則下半圈）
    function arcText(x, text, cx, cy, rr, size, col, top) {
        x.save(); x.font = `600 ${size}px "Noto Sans TC", sans-serif`; x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
        const chars = [...text], step = (size * 1.05) / rr, span = step * (chars.length - 1);
        chars.forEach((ch, i) => {
            const a = top ? -Math.PI / 2 - span / 2 + i * step : Math.PI / 2 + span / 2 - i * step;
            x.save(); x.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); x.rotate(top ? a + Math.PI / 2 : a - Math.PI / 2); x.fillText(ch, 0, 0); x.restore();
        });
        x.restore();
    }

    // ---- 五種圖案（以半徑 1 的座標畫，外面 scale） ----
    const ART = {
        // 丼：一個大字，下面一個碗
        c1(x, m, d) {
            x.save(); x.font = '700 0.95px "Noto Serif TC", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
            x.fillStyle = m.lo; x.fillText('丼', d, -0.06 + d);
            x.fillStyle = '#ffffff'; x.fillText('丼', -d * 0.7, -0.06 - d * 0.7);
            x.fillStyle = paint(m, m.ink); x.fillText('丼', 0, -0.06);
            x.restore();
        },
        // 茱莉鴨（跟網站的頭像一樣）：正面圓頭、寬扁嘴、半睜的死魚眼（上半蓋眼皮），脖子上一個領結，頭頂一撮毛
        c2(x, m, d) {
            const body = () => { x.beginPath(); x.ellipse(0, 0.66, 0.52, 0.3, 0, Math.PI, Math.PI * 2); x.closePath(); };
            const head = () => { x.beginPath(); x.arc(0, -0.06, 0.42, 0, Math.PI * 2); };
            const bill = () => { x.beginPath(); x.ellipse(0.04, 0.12, 0.25, 0.1, 0, 0, Math.PI * 2); };
            const bow = () => { x.beginPath(); x.moveTo(-0.03, 0.46); x.lineTo(-0.26, 0.36); x.quadraticCurveTo(-0.3, 0.46, -0.26, 0.56); x.closePath(); x.moveTo(0.03, 0.46); x.lineTo(0.26, 0.36); x.quadraticCurveTo(0.3, 0.46, 0.26, 0.56); x.closePath(); x.moveTo(0.065, 0.46); x.arc(0, 0.46, 0.065, 0, Math.PI * 2); };
            emboss(x, m, d, body, m.base);
            emboss(x, m, d, head, m.base);
            embossStroke(x, m, d * 0.5, () => { x.beginPath(); x.moveTo(-0.02, -0.46); x.quadraticCurveTo(-0.06, -0.6, 0.06, -0.62); x.moveTo(0.04, -0.47); x.quadraticCurveTo(0.08, -0.58, 0.16, -0.56); }, 0.04, m.base);   // 頭頂一撮毛
            // 死魚眼：白色的眼、眼珠在下面，上半蓋一片眼皮，眼皮邊一條平平的線
            [[-0.15, -0.12], [0.2, -0.12]].forEach(([ex, ey]) => {
                const eye = () => { x.beginPath(); x.ellipse(ex, ey, 0.095, 0.08, 0, 0, Math.PI * 2); };
                emboss(x, m, d * 0.5, eye, mix(m.hi, '#ffffff', 0.4));
                x.fillStyle = paint(m, m.ink); x.beginPath(); x.arc(ex + 0.025, ey + 0.025, 0.04, 0, Math.PI * 2); x.fill();
                x.save(); eye(); x.clip(); x.fillStyle = paint(m, m.base); x.fillRect(ex - 0.1, ey - 0.09, 0.2, 0.085); x.restore();
                x.strokeStyle = paint(m, m.ink); x.lineWidth = 0.028; x.lineCap = 'round';
                x.beginPath(); x.moveTo(ex - 0.095, ey - 0.005); x.lineTo(ex + 0.095, ey - 0.005); x.stroke();
            });
            emboss(x, m, d, bill, m.ink);
            x.strokeStyle = mix(m.ink, '#000000', 0.3); x.lineWidth = 0.02; x.beginPath(); x.moveTo(-0.17, 0.14); x.quadraticCurveTo(0.04, 0.17, 0.25, 0.14); x.stroke();   // 嘴縫
            emboss(x, m, d, bow, m.ink);
        },
        // 浣熊大王：正臉、圓耳、橫過眼睛的黑眼罩、白眉、白嘴鼻、黑鼻子，頭上一頂三顆寶石的皇冠
        c3(x, m, d) {
            const ears = () => { x.beginPath(); x.ellipse(-0.34, -0.3, 0.15, 0.17, -0.4, 0, Math.PI * 2); x.moveTo(0.49, -0.3); x.ellipse(0.34, -0.3, 0.15, 0.17, 0.4, 0, Math.PI * 2); };
            const earIn = () => { x.beginPath(); x.ellipse(-0.33, -0.29, 0.07, 0.09, -0.4, 0, Math.PI * 2); x.moveTo(0.4, -0.29); x.ellipse(0.33, -0.29, 0.07, 0.09, 0.4, 0, Math.PI * 2); };
            // 臉：兩頰有蓬毛的尖角
            const face = () => { x.beginPath(); x.moveTo(0, -0.32); x.bezierCurveTo(0.3, -0.32, 0.44, -0.18, 0.46, 0.02); x.lineTo(0.56, 0.12); x.lineTo(0.42, 0.16); x.bezierCurveTo(0.34, 0.36, 0.16, 0.44, 0, 0.44); x.bezierCurveTo(-0.16, 0.44, -0.34, 0.36, -0.42, 0.16); x.lineTo(-0.56, 0.12); x.lineTo(-0.46, 0.02); x.bezierCurveTo(-0.44, -0.18, -0.3, -0.32, 0, -0.32); x.closePath(); };
            // 眼罩：一條橫過去，兩邊垂下來
            const mask = () => { x.beginPath(); x.moveTo(-0.44, 0.02); x.quadraticCurveTo(-0.3, -0.14, -0.08, -0.06); x.quadraticCurveTo(0, -0.02, 0.08, -0.06); x.quadraticCurveTo(0.3, -0.14, 0.44, 0.02); x.quadraticCurveTo(0.36, 0.16, 0.2, 0.12); x.quadraticCurveTo(0.08, 0.08, 0, 0.12); x.quadraticCurveTo(-0.08, 0.08, -0.2, 0.12); x.quadraticCurveTo(-0.36, 0.16, -0.44, 0.02); x.closePath(); };
            const muzzle = () => { x.beginPath(); x.ellipse(0, 0.27, 0.17, 0.13, 0, 0, Math.PI * 2); };
            const crown = () => { x.beginPath(); x.moveTo(-0.17, -0.36); x.lineTo(-0.2, -0.58); x.lineTo(-0.09, -0.47); x.lineTo(0, -0.64); x.lineTo(0.09, -0.47); x.lineTo(0.2, -0.58); x.lineTo(0.17, -0.36); x.closePath(); };
            emboss(x, m, d, ears, m.base);
            x.fillStyle = paint(m, m.ink); earIn(); x.fill();
            emboss(x, m, d, face, m.base);
            emboss(x, m, d * 0.7, mask, m.ink);
            embossStroke(x, m, d * 0.4, () => { x.beginPath(); x.moveTo(-0.3, -0.13); x.quadraticCurveTo(-0.18, -0.22, -0.06, -0.14); x.moveTo(0.06, -0.14); x.quadraticCurveTo(0.18, -0.22, 0.3, -0.13); }, 0.045, m.base);   // 白眉
            emboss(x, m, d * 0.6, muzzle, m.base);
            emboss(x, m, d, crown, m.base);
            x.fillStyle = paint(m, m.ink);
            [[-0.19, -0.55], [0, -0.6], [0.19, -0.55]].forEach(([gx, gy]) => { x.beginPath(); x.arc(gx, gy, 0.035, 0, Math.PI * 2); x.fill(); });
            // 眼睛（在眼罩裡發亮）、鼻子、壞笑
            x.fillStyle = mix(m.hi, '#ffffff', 0.5);
            x.beginPath(); x.arc(-0.17, 0.02, 0.045, 0, Math.PI * 2); x.arc(0.17, 0.02, 0.045, 0, Math.PI * 2); x.fill();
            x.fillStyle = paint(m, m.ink);
            x.beginPath(); x.ellipse(0, 0.21, 0.06, 0.045, 0, 0, Math.PI * 2); x.fill();
            x.strokeStyle = paint(m, m.ink); x.lineWidth = 0.03; x.lineCap = 'round';
            x.beginPath(); x.moveTo(0, 0.25); x.lineTo(0, 0.3); x.quadraticCurveTo(-0.05, 0.34, -0.09, 0.31); x.moveTo(0, 0.3); x.quadraticCurveTo(0.07, 0.35, 0.12, 0.28); x.stroke();
        },
        // 蘿蔔：胖蘿蔔＋三片葉子，身上幾條橫紋
        c4(x, m, d) {
            const leaves = () => { x.beginPath();
                [[-0.2, -0.75, -0.06], [0.02, -0.82, 0], [0.22, -0.72, 0.06]].forEach(([lx, ly]) => { x.moveTo(0, -0.28); x.quadraticCurveTo(lx - 0.16, (ly - 0.28) / 2, lx, ly); x.quadraticCurveTo(lx + 0.16, (ly - 0.28) / 2 + 0.05, 0, -0.28); }); };
            const body = () => { x.beginPath(); x.moveTo(-0.3, -0.24); x.quadraticCurveTo(-0.4, 0.1, -0.06, 0.68); x.quadraticCurveTo(0, 0.74, 0.06, 0.68); x.quadraticCurveTo(0.4, 0.1, 0.3, -0.24); x.quadraticCurveTo(0, -0.36, -0.3, -0.24); x.closePath(); };
            emboss(x, m, d, leaves, m.ink);
            emboss(x, m, d, body, m.base);
            embossStroke(x, m, d * 0.5, () => { x.beginPath(); x.moveTo(-0.22, 0.02); x.quadraticCurveTo(-0.1, 0.06, -0.02, 0.02); x.moveTo(0.06, 0.22); x.quadraticCurveTo(0.14, 0.26, 0.2, 0.2); x.moveTo(-0.12, 0.4); x.quadraticCurveTo(-0.04, 0.44, 0.04, 0.4); }, 0.035, m.lo);
        },
        // 雞塊：不規則的一塊，麵衣顆粒、兩顆眼睛、得意的嘴
        c5(x, m, d) {
            const pts = [[-0.48, -0.08], [-0.36, -0.36], [-0.06, -0.44], [0.24, -0.4], [0.48, -0.18], [0.5, 0.14], [0.34, 0.38], [0.02, 0.46], [-0.3, 0.38], [-0.5, 0.18]];
            const blob = () => { x.beginPath(); pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; i ? x.quadraticCurveTo(p[0], p[1], mx, my) : x.moveTo(mx, my); }); const p = pts[0], q = pts[1]; x.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); x.closePath(); };
            emboss(x, m, d, blob, m.base);
            // 麵衣顆粒（避開臉）
            const crumbs = [[-0.36, -0.2], [-0.2, -0.32], [0.18, -0.3], [0.36, -0.14], [0.4, 0.12], [0.26, 0.32], [-0.36, 0.22], [-0.42, 0.02], [-0.18, 0.36], [0.06, -0.36]];
            crumbs.forEach(([cx, cy]) => { emboss(x, m, d * 0.4, () => { x.beginPath(); x.arc(cx, cy, 0.035, 0, Math.PI * 2); }, m.hi); });
            x.fillStyle = m.ink;
            x.beginPath(); x.arc(-0.12, -0.04, 0.05, 0, Math.PI * 2); x.arc(0.14, -0.04, 0.05, 0, Math.PI * 2); x.fill();
            x.strokeStyle = m.ink; x.lineWidth = 0.035; x.lineCap = 'round';
            x.beginPath(); x.moveTo(-0.1, 0.12); x.quadraticCurveTo(0.02, 0.24, 0.14, 0.1); x.stroke();
        },
    };

    function draw(x, key, cx, cy, r, opts) {
        const m = METAL[key]; if (!m) return;
        opts = opts || {};
        x.save();
        // 影子
        x.beginPath(); x.ellipse(cx + r * 0.06, cy + r * 0.1, r, r * 0.98, 0, 0, Math.PI * 2); x.fillStyle = 'rgba(40, 30, 20, .25)'; x.fill();
        // 外圈：環狀的亮暗條紋（像金屬繞一圈反光）；舊瀏覽器沒有 createConicGradient 就用一般漸層
        x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
        if (x.createConicGradient) {
            const g = x.createConicGradient(-Math.PI * 0.75, cx, cy);
            [[0, m.hi], [0.07, mix(m.base, m.hi, 0.5)], [0.16, m.base], [0.27, mix(m.base, m.lo, 0.5)], [0.38, m.base], [0.47, mix(m.base, m.hi, 0.6)], [0.55, m.base],
             [0.66, m.lo], [0.76, mix(m.base, m.lo, 0.4)], [0.86, mix(m.base, m.hi, 0.35)], [0.94, mix(m.base, m.hi, 0.7)], [1, m.hi]].forEach(([t, c]) => g.addColorStop(t, c));
            x.fillStyle = g;
        } else x.fillStyle = metal(x, cx, cy, r, m);
        x.fill();
        // 邊緣：最外一圈深色、裡面一圈細亮線（厚度感）
        x.lineWidth = Math.max(1, r * 0.025); x.strokeStyle = mix(m.lo, '#000000', 0.25); x.beginPath(); x.arc(cx, cy, r - x.lineWidth / 2, 0, Math.PI * 2); x.stroke();
        x.lineWidth = Math.max(0.6, r * 0.012); x.strokeStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(cx, cy, r * 0.965, Math.PI * 0.95, Math.PI * 1.75); x.stroke();
        if (r >= 14) {
            const n = Math.round(r * 2.4); x.strokeStyle = m.lo; x.globalAlpha = 0.55; x.lineWidth = Math.max(0.6, r * 0.012);
            x.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; x.moveTo(cx + Math.cos(a) * r * 0.955, cy + Math.sin(a) * r * 0.955); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.stroke(); x.globalAlpha = 1;
        }
        // 內圈（凹下去：漸層反過來）
        const ri = r * (r >= 30 ? 0.78 : 0.86);
        x.beginPath(); x.arc(cx, cy, r * 0.93, 0, Math.PI * 2); x.strokeStyle = m.lo; x.lineWidth = Math.max(0.8, r * 0.02); x.stroke();
        x.beginPath(); x.arc(cx, cy, ri, 0, Math.PI * 2); x.fillStyle = metal(x, cx, cy, ri, m, true); x.fill();
        // 內圈的車床紋：一圈一圈很細的亮暗線
        if (r >= 20) {
            x.save(); x.beginPath(); x.arc(cx, cy, ri, 0, Math.PI * 2); x.clip();
            const n = Math.round(ri / 1.6);
            for (let i = 1; i < n; i++) { x.beginPath(); x.arc(cx, cy, ri * i / n, 0, Math.PI * 2); x.lineWidth = 0.6; x.strokeStyle = i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)'; x.stroke(); }
            // 斜斜的一道柔光（金屬面的反射）
            const sg = x.createLinearGradient(cx - ri, cy - ri, cx + ri, cy + ri);
            sg.addColorStop(0, 'rgba(255,255,255,.05)'); sg.addColorStop(0.32, 'rgba(255,255,255,.32)'); sg.addColorStop(0.45, 'rgba(255,255,255,.04)'); sg.addColorStop(0.7, 'rgba(0,0,0,0)'); sg.addColorStop(0.86, 'rgba(255,255,255,.18)'); sg.addColorStop(1, 'rgba(0,0,0,.08)');
            x.fillStyle = sg; x.fillRect(cx - ri, cy - ri, ri * 2, ri * 2);
            x.restore();
        }
        // 內圈的斜面：左上暗（凹下去的影子）、右下亮
        x.lineWidth = Math.max(0.8, r * 0.02);
        x.strokeStyle = mix(m.lo, '#000000', 0.1); x.beginPath(); x.arc(cx, cy, ri, Math.PI * 0.95, Math.PI * 1.85); x.stroke();
        x.strokeStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.arc(cx, cy, ri, Math.PI * -0.05, Math.PI * 0.85); x.stroke();
        // 外圈的字（夠大才寫）
        if (r >= 30) {
            arcText(x, '二十七樓紀念幣', cx, cy, r * 0.86, r * 0.085, m.ink, true);
            arcText(x, m.tk + '・2026', cx, cy, r * 0.86, r * 0.08, m.ink, false);
        }
        // 圖案
        x.save(); x.beginPath(); x.arc(cx, cy, ri, 0, Math.PI * 2); x.clip();
        x.translate(cx, cy + (r >= 30 ? 0 : r * 0.03)); const s = ri * (r >= 30 ? 0.82 : 0.92); x.scale(s, s);
        relief(x, m);
        ART[key](x, m, Math.max(0.012, 1.2 / s));
        G = null;
        x.restore();
        // 整枚左上一塊柔和的高光
        const hg = x.createRadialGradient(cx - r * 0.42, cy - r * 0.48, 0, cx - r * 0.42, cy - r * 0.48, r * 0.7);
        hg.addColorStop(0, 'rgba(255,255,255,.38)'); hg.addColorStop(0.5, 'rgba(255,255,255,.1)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = hg; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
        // 反光
        if (opts.shine) {
            x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
            const p = -1.4 + opts.shine * 2.8, g = x.createLinearGradient(cx + (p - 0.3) * r, cy - r, cx + (p + 0.3) * r, cy + r);
            g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.restore();
        }
        // 裂痕（爆倉）
        if (opts.crack) {
            const zz = [[-0.95, -0.25], [-0.5, -0.05], [-0.35, -0.3], [0.05, 0.05], [0.2, -0.15], [0.55, 0.2], [0.98, 0.1]];
            const line = (w, col, dy) => { x.beginPath(); zz.forEach(([a, b], i) => { const px = cx + a * r, py = cy + b * r + dy; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.lineWidth = w; x.strokeStyle = col; x.stroke(); };
            x.lineJoin = 'miter';
            line(Math.max(2, r * 0.07), 'rgba(30,20,10,.85)', 0);
            line(Math.max(1, r * 0.02), m.hi, -Math.max(1.5, r * 0.04));
            x.beginPath(); x.moveTo(cx + 0.05 * r, cy + 0.05 * r); x.lineTo(cx + 0.12 * r, cy + 0.5 * r); x.lineTo(cx - 0.05 * r, cy + 0.75 * r);
            x.lineWidth = Math.max(1.5, r * 0.04); x.strokeStyle = 'rgba(30,20,10,.8)'; x.stroke();
        }
        x.restore();
    }

    // 方便用：拿一張 data URL（快取）
    const cache = {};
    function url(key, size, opts) {
        const id = key + ':' + size + ':' + JSON.stringify(opts || {});
        if (cache[id]) return cache[id];
        const d = 2, cv = document.createElement('canvas'); cv.width = cv.height = size * d;
        const x = cv.getContext('2d'); x.scale(d, d); draw(x, key, size / 2, size / 2, size / 2 - size * 0.06, opts);
        return (cache[id] = cv.toDataURL());
    }

    window.CoinFace = { draw, url, METAL };
})();
