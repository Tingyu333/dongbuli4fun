// 二十七樓紀念幣的幣面（2026-11-26）：canvas 畫成金屬圓幣，邊緣有齒紋，圖案是浮雕（暗邊＋亮邊＋本色）。
// 用法：CoinFace.draw(ctx, 'c1', x, y, r, { crack: false, shine: 0 })
//   crack：爆倉的時候畫裂痕；shine：0～1，一道反光掃過（跳價動畫用）。
// 幣是實物，顏色固定，不跟晝夜換。
(function () {
    // 五種金屬：本色、亮、暗、浮雕的字和圖用的深色
    const METAL = {
        c1: { name: '丼幣', tk: 'DON', base: '#dcae45', hi: '#fff3c4', lo: '#8a6416', ink: '#6e4c0c' },     // 金
        c2: { name: '茱莉鴨幣', tk: 'DUCK', base: '#c3c7cd', hi: '#ffffff', lo: '#666d76', ink: '#4a5058' },  // 銀
        c3: { name: '坐洗狗狗幣', tk: 'WOOF', base: '#c07a47', hi: '#f6cba2', lo: '#6a3716', ink: '#5a2c10' }, // 銅
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

    // 浮雕：同一個形狀畫三次（右下暗、左上亮、中間本色）
    function emboss(x, m, d, path, fill) {
        x.save(); x.translate(d, d); x.fillStyle = m.lo; path(); x.fill(); x.restore();
        x.save(); x.translate(-d * 0.7, -d * 0.7); x.fillStyle = m.hi; path(); x.fill(); x.restore();
        x.fillStyle = fill; path(); x.fill();
    }
    function embossStroke(x, m, d, path, w, col) {
        x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = w;
        x.save(); x.translate(d, d); x.strokeStyle = m.lo; path(); x.stroke(); x.restore();
        x.save(); x.translate(-d * 0.7, -d * 0.7); x.strokeStyle = m.hi; path(); x.stroke(); x.restore();
        x.strokeStyle = col; path(); x.stroke();
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
            x.fillStyle = m.hi; x.fillText('丼', -d * 0.7, -0.06 - d * 0.7);
            x.fillStyle = m.ink; x.fillText('丼', 0, -0.06);
            x.restore();
        },
        // 茱莉鴨：側臉、扁嘴、眼睛、領結
        c2(x, m, d) {
            const head = () => { x.beginPath(); x.ellipse(-0.08, -0.12, 0.38, 0.36, 0, 0, Math.PI * 2); };
            const bill = () => { x.beginPath(); x.moveTo(0.22, -0.12); x.quadraticCurveTo(0.62, -0.16, 0.6, -0.02); x.quadraticCurveTo(0.42, 0.06, 0.2, 0.02); x.closePath(); };
            const neck = () => { x.beginPath(); x.moveTo(-0.32, 0.12); x.quadraticCurveTo(-0.3, 0.42, -0.1, 0.5); x.lineTo(0.12, 0.5); x.quadraticCurveTo(0.12, 0.3, 0.12, 0.14); x.closePath(); };
            const bow = () => { x.beginPath(); x.moveTo(-0.02, 0.5); x.lineTo(-0.24, 0.4); x.lineTo(-0.24, 0.62); x.closePath(); x.moveTo(0.02, 0.5); x.lineTo(0.24, 0.4); x.lineTo(0.24, 0.62); x.closePath(); x.moveTo(0.06, 0.5); x.arc(0, 0.5, 0.06, 0, Math.PI * 2); };
            emboss(x, m, d, neck, m.base);
            emboss(x, m, d, head, m.base);
            emboss(x, m, d, bill, m.ink);
            emboss(x, m, d, bow, m.ink);
            x.fillStyle = m.ink; x.beginPath(); x.arc(0.06, -0.2, 0.055, 0, Math.PI * 2); x.fill();
            x.fillStyle = m.hi; x.beginPath(); x.arc(0.04, -0.22, 0.018, 0, Math.PI * 2); x.fill();
            embossStroke(x, m, d * 0.6, () => { x.beginPath(); x.moveTo(-0.3, -0.42); x.quadraticCurveTo(-0.22, -0.6, -0.08, -0.5); }, 0.05, m.ink);   // 一撮毛
        },
        // 坐洗部的狗：正臉、垂耳、鼻子，頭上頂三顆泡泡
        c3(x, m, d) {
            const face = () => { x.beginPath(); x.ellipse(0, 0.1, 0.4, 0.36, 0, 0, Math.PI * 2); };
            const earL = () => { x.beginPath(); x.ellipse(-0.42, 0.12, 0.13, 0.27, 0.35, 0, Math.PI * 2); };
            const earR = () => { x.beginPath(); x.ellipse(0.42, 0.12, 0.13, 0.27, -0.35, 0, Math.PI * 2); };
            const snout = () => { x.beginPath(); x.ellipse(0, 0.27, 0.18, 0.13, 0, 0, Math.PI * 2); };
            const bubbles = () => { x.beginPath(); [[-0.16, -0.36, 0.13], [0.1, -0.44, 0.16], [0.3, -0.3, 0.1], [-0.02, -0.6, 0.08]].forEach(([bx, by, br]) => { x.moveTo(bx + br, by); x.arc(bx, by, br, 0, Math.PI * 2); }); };
            emboss(x, m, d, earL, m.ink); emboss(x, m, d, earR, m.ink);
            emboss(x, m, d, face, m.base);
            emboss(x, m, d, bubbles, m.base);
            x.strokeStyle = m.lo; x.lineWidth = 0.025; bubbles(); x.stroke();
            emboss(x, m, d * 0.6, snout, m.base);
            x.fillStyle = m.ink;
            x.beginPath(); x.ellipse(0, 0.2, 0.07, 0.05, 0, 0, Math.PI * 2); x.fill();
            x.beginPath(); x.arc(-0.15, 0.02, 0.045, 0, Math.PI * 2); x.arc(0.15, 0.02, 0.045, 0, Math.PI * 2); x.fill();
            x.strokeStyle = m.ink; x.lineWidth = 0.03; x.lineCap = 'round';
            x.beginPath(); x.moveTo(0, 0.25); x.lineTo(0, 0.31); x.quadraticCurveTo(-0.06, 0.36, -0.1, 0.32); x.moveTo(0, 0.31); x.quadraticCurveTo(0.06, 0.36, 0.1, 0.32); x.stroke();
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
        // 外圈＋齒紋
        x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = metal(x, cx, cy, r, m); x.fill();
        if (r >= 14) {
            const n = Math.round(r * 2.4); x.strokeStyle = m.lo; x.globalAlpha = 0.55; x.lineWidth = Math.max(0.6, r * 0.012);
            x.beginPath(); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; x.moveTo(cx + Math.cos(a) * r * 0.955, cy + Math.sin(a) * r * 0.955); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.stroke(); x.globalAlpha = 1;
        }
        // 內圈（凹下去：漸層反過來）
        const ri = r * (r >= 30 ? 0.78 : 0.86);
        x.beginPath(); x.arc(cx, cy, r * 0.93, 0, Math.PI * 2); x.strokeStyle = m.lo; x.lineWidth = Math.max(0.8, r * 0.02); x.stroke();
        x.beginPath(); x.arc(cx, cy, ri, 0, Math.PI * 2); x.fillStyle = metal(x, cx, cy, ri, m, true); x.fill();
        x.strokeStyle = m.hi; x.lineWidth = Math.max(0.6, r * 0.012); x.beginPath(); x.arc(cx, cy, ri, Math.PI * 0.15, Math.PI * 1.05); x.stroke();
        x.strokeStyle = m.lo; x.beginPath(); x.arc(cx, cy, ri, Math.PI * 1.15, Math.PI * 2.05); x.stroke();
        // 外圈的字（夠大才寫）
        if (r >= 30) {
            arcText(x, '二十七樓紀念幣', cx, cy, r * 0.86, r * 0.085, m.ink, true);
            arcText(x, m.tk + '・2026', cx, cy, r * 0.86, r * 0.08, m.ink, false);
        }
        // 圖案
        x.save(); x.beginPath(); x.arc(cx, cy, ri, 0, Math.PI * 2); x.clip();
        x.translate(cx, cy + (r >= 30 ? 0 : r * 0.03)); const s = ri * (r >= 30 ? 0.82 : 0.92); x.scale(s, s);
        ART[key](x, m, Math.max(0.012, 1.2 / s));
        x.restore();
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
