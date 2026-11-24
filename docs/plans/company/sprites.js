// 開公司樣張共用：八種一般員工（npc）、角色加深色輪廓（outlined）。2026-11-24。
// 半顆的格子、原點在腳底中間，跟 assets/xiaodao-door.js 的 guest() 一樣。
  // 一般員工：八種小動物，半顆的格子、原點在腳底中間（跟 guest() 一樣的畫法）
const NPC = {
    pigeon: { name: '鴿子', cols: [['#a7adb8', '#8b919c', '#5f9e7d', '#8a6aa8'], ['#d9d4ce', '#b9b3ab', '#6aa7a0', '#9a7ab0'], ['#7d8390', '#636975', '#4f8f6a', '#7a5a98']] },
    sparrow: { name: '麻雀', cols: [['#a8764a', '#e8d9bf', '#7d5434'], ['#b58a5a', '#efe2c8', '#8a6440']] },
    squirrel: { name: '松鼠', cols: [['#c8743a', '#f0d6b0', '#a45a28'], ['#8e7a6a', '#e6dccf', '#6f5e50']] },
    hamster: { name: '倉鼠', cols: [['#f0b860', '#fbf1de', '#d89a40'], ['#d9d2c8', '#fbf6ee', '#b9b0a4'], ['#e09a70', '#fbeee2', '#c27a52']] },
    rabbit: { name: '兔子', cols: [['#f6f3ee', '#dcd6cc', '#f3b2b8'], ['#b9a48e', '#97826c', '#f3b2b8'], ['#8e8a86', '#706c68', '#f3b2b8']] },
    hedgehog: { name: '刺蝟', cols: [['#7d6450', '#5e4a3a', '#efdcc0'], ['#9a8470', '#7a6450', '#f3e4cc']] },
    frog: { name: '青蛙', cols: [['#6fae48', '#4f8f3a', '#e8f0c8'], ['#9ac24a', '#78a032', '#f0f4cc']] },
    turtle: { name: '烏龜', cols: [['#8cb86a', '#6f9a50', '#9a6a3a', '#7a522a'], ['#a8c47a', '#86a45c', '#b07a44', '#8a5e30']] },
  };
function npc(x, key, ci, a, b) {
    const U = .5, K = '#2e2a27', WH = '#fff', col = NPC[key].cols[ci % NPC[key].cols.length];
    const c = (i, j, w, h, cl) => { x.fillStyle = cl; x.fillRect(a + i * U, b + j * U, w * U, h * U); };
    const el = (cx, cy, rx, ry, cl) => { x.fillStyle = cl; for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++) for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++) { const u = (i + .5 - cx) / rx, v = (j + .5 - cy) / ry; if (u * u + v * v <= 1) x.fillRect(a + i * U, b + j * U, U, U); } };
    const eyes = (y, dx = 3) => { c(-dx - 1, y, 2, 2, K); c(dx - 1, y, 2, 2, K); c(-dx - 1, y, 1, 1, WH); c(dx - 1, y, 1, 1, WH); };
    el(0, 0, 9, 2.2, 'rgba(40,28,18,.22)');
    ({
      pigeon() { const [B, S, G, P] = col; c(-4, -1, 3, 1, '#d77a7a'); c(1, -1, 3, 1, '#d77a7a'); el(.6, -7, 8, 7, S); el(0, -7, 7.6, 6.8, B); el(-6, -7, 2.4, 4.5, S); el(6, -7, 2.4, 4.5, S);
        el(0, -12, 6, 2, G); c(-5, -12, 4, 1, P); c(1, -11, 4, 1, P); el(-.6, -18, 6, 5.6, S); el(-1, -18, 5.6, 5.4, B); c(-4, -20, 2, 2, '#e08a3a'); c(1, -20, 2, 2, '#e08a3a'); c(-4, -20, 1, 1, K); c(1, -20, 1, 1, K); c(4, -18, 3, 1, '#4a4a4a'); c(6, -17, 1, 1, '#4a4a4a'); c(3, -19, 2, 1, '#f3efe6'); },   // 嘴往右凸出來
      sparrow() { const [B, W, D] = col; c(-3, -1, 2, 1, '#c98a5a'); c(1, -1, 2, 1, '#c98a5a'); el(.5, -7, 7.6, 7, D); el(0, -7, 7.2, 6.8, B); el(0, -6, 4.6, 5, W); for (let k = -6; k <= 4; k += 3) c(k, -9, 2, 1, D);
        el(.3, -18, 6.6, 5.8, D); el(0, -18, 6.4, 5.6, W); el(0, -21, 6, 3, B); eyes(-19, 2.5); c(-1, -16, 2, 2, '#3a3a3a'); c(-2, -14, 4, 2, K); c(-1, -12, 2, 1, K);   // 黑下巴
        el(0, -22.5, 4.4, 1.8, '#8a5a34'); c(6, -9, 3, 2, D); c(8, -11, 2, 2, D); c(9, -13, 2, 2, D); c(10, -14, 1, 1, D); },   // 栗色帽頂、翹起來的尾巴
      squirrel() { const [B, W, D] = col; el(8, -14, 4.5, 9, D); el(7.6, -14.4, 4, 8.5, B); el(8, -22, 3.4, 3, B);
        el(.4, -7, 6.6, 7, D); el(0, -7, 6.2, 6.8, B); el(0, -6, 3.6, 4.6, W); c(-4, -1, 3, 1, D); c(1, -1, 3, 1, D); c(-6, -25, 3, 4, B); c(3, -25, 3, 4, B); c(-6, -26, 1, 1, D); c(5, -26, 1, 1, D);
        el(.3, -18, 6.4, 5.6, D); el(0, -18, 6, 5.4, B); el(0, -15.5, 3.4, 2.2, W); eyes(-19, 2.5); c(-1, -17, 2, 1, '#5a3a2a'); },
      hamster() { const [B, W, D] = col; el(0, -10, 9, 9.6, D); el(-.3, -10.3, 8.6, 9.2, B); el(0, -8, 6, 6.4, W); el(-5, -11, 3, 2.4, W); el(5, -11, 3, 2.4, W);
        el(-6, -19, 2, 2, D); el(6, -19, 2, 2, D); el(-6, -19, 1.2, 1.2, '#f3b2b8'); el(6, -19, 1.2, 1.2, '#f3b2b8'); eyes(-14, 3); c(-1, -12, 2, 1, '#e58a8a'); c(-3, -3, 2, 2, '#f3b2b8'); c(1, -3, 2, 2, '#f3b2b8'); },
      rabbit() { const [B, S, P] = col; el(-3, -27, 2, 6, S); el(3, -27, 2, 6, S); el(-3, -27, 1.6, 5.6, B); el(3, -27, 1.6, 5.6, B); c(-3, -30, 1, 6, P); c(3, -30, 1, 6, P);
        el(.4, -7, 7, 7, S); el(0, -7, 6.6, 6.8, B); c(-4, -1, 3, 1, S); c(1, -1, 3, 1, S); el(.3, -17, 6.6, 5.6, S); el(0, -17, 6.2, 5.4, B); eyes(-18, 3); c(-1, -15, 2, 1, P); c(-4, -15, 2, 1, '#f3c8cc'); c(2, -15, 2, 1, '#f3c8cc'); },
      hedgehog() { const [B, D, F] = col; el(0, -10, 10, 9, D);
        for (let a = Math.PI * 1.02; a <= Math.PI * 1.98; a += Math.PI / 11) { const x0 = Math.cos(a) * 10, y0 = -10 + Math.sin(a) * 9; c(Math.round(x0 * 1.18), Math.round(y0 * 1.12 + 1.2), 1, 2, D); c(Math.round(x0 * 1.3), Math.round(y0 * 1.2 + 2), 1, 1, D); }   // 外緣一圈鋸齒刺
        for (let k = -9; k <= 9; k += 2) for (let j = -18; j <= -4; j += 3) if ((k + j) % 4 === 0) c(k, j, 1, 2, '#3e2e22');
        el(0, -9, 6.4, 7, F); c(-1, -20, 2, 1, B); c(-9, -16, 1, 2, B); c(8, -16, 1, 2, B); eyes(-11, 2.6); el(0, -7.5, 2.2, 1.8, F); c(-1, -6, 2, 1, K); c(-4, -1, 3, 1, F); c(1, -1, 3, 1, F); },   // 尖鼻子往前
      frog() { const [B, D, W] = col; el(0, -7, 9, 7, D); el(-.3, -7.3, 8.6, 6.6, B); el(0, -6, 5.6, 4.6, W); c(-9, -2, 4, 2, D); c(5, -2, 4, 2, D);
        el(0, -15, 8, 4.6, D); el(-.3, -15.3, 7.6, 4.2, B); el(-4.5, -19, 3, 3, D); el(4.5, -19, 3, 3, D); el(-4.5, -19.4, 2.4, 2.4, W); el(4.5, -19.4, 2.4, 2.4, W); c(-5, -20, 2, 2, K); c(4, -20, 2, 2, K);
        c(-5, -13, 10, 1, '#2e4a22'); c(-6, -14, 1, 1, '#2e4a22'); c(5, -14, 1, 1, '#2e4a22'); c(-7, -15, 2, 1, '#f3a6a0'); c(5, -15, 2, 1, '#f3a6a0'); },
      turtle() { const [B, D, S, s2] = col; el(0, -8, 10, 7.6, s2); el(-.3, -8.3, 9.4, 7, S); [[-4, -10], [3, -10], [0, -5], [-6, -5], [6, -5], [0, -13]].forEach(([i, j]) => { el(i, j, 2, 1.6, s2); });
        c(-9, -2, 3, 2, D); c(6, -2, 3, 2, D); el(.3, -18, 5.4, 5, D); el(0, -18, 5, 4.8, B); eyes(-19, 2.4); c(-2, -15, 4, 1, '#2e4a22'); },
    })[key]();
  }

// 角色加一圈深色輪廓（美術審稿：小吳鴨在深色地板上分不出來）：先畫到一張暫存畫布，取實心的部分（不含半透明影子）往四個方向各推半格，塗深色，再把角色疊上去。
function outlined(ctx, draw, col = 'rgba(46,38,30,.85)') {
  const W = ctx.canvas.width, H = ctx.canvas.height, t = ctx.getTransform(), d = Math.max(1, Math.round(t.a / 2));
  const off = document.createElement('canvas'); off.width = W; off.height = H; const o = off.getContext('2d'); o.setTransform(t); o.imageSmoothingEnabled = false; draw(o);
  const sil = document.createElement('canvas'); sil.width = W; sil.height = H; const s = sil.getContext('2d'), img = o.getImageData(0, 0, W, H), out = s.createImageData(W, H);
  const [r, g, b] = col.match(/\d+/g).map(Number);
  for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3] > 150) { out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 220; }
  s.putImageData(out, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); [[d, 0], [-d, 0], [0, d], [0, -d]].forEach(([x, y]) => ctx.drawImage(sil, x, y)); ctx.drawImage(off, 0, 0); ctx.restore();
}
