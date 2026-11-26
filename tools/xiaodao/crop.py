# 把 dump_empty.js 匯出的透明底圖（<名>-stages_<i>_x.png）裁到剛好，存成 assets/xiaodao/<設施><級>.png
# 2026-11-26 改：不再用色票挖透明（影子會被烤成不透明、草裡的雜點會被挖成洞），設計圖直接畫在透明底上。
# 海岸線（碼頭、別墅用來對齊）從一般的那張（<名>-stages_<i>.png）找：第一列「大部分是海」的列。
from PIL import Image; import json, sys, os
IN = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '../../assets/xiaodao')
hx = lambda s: tuple(int(s[i:i+2], 16) for i in (1, 3, 5))
SEA = {hx(c) for c in ['#6b97a6', '#7ea9b5', '#9cc5c8', '#e3efed', '#4f7d8f']}
SHEET = {'house': 5, 'garage': 5, 'dock': 5, 'airfield': 5, 'launchpad': 3}
# 車位／泊位／機位（dump_empty.js 記的）也要在圖的範圍裡：虛線框不畫了，空位上可能什麼都沒有，但點設施要點得到、車船要停在圖裡
REC = json.load(open(os.path.join(os.path.dirname(__file__), 'slots.json')))
out = {}
for n, cnt in SHEET.items():
    for i in range(cnt):
        full = Image.open(os.path.join(IN, f'{n}-stages_{i}.png')).convert('RGB'); fp = full.load(); W, H = full.size
        shore = None
        if n == 'dock' or (n == 'house' and i == 4):
            for j in range(H):
                if sum(1 for x in range(W) if fp[x, j] in SEA) > W * .6: shore = j; break
        im = Image.open(os.path.join(IN, f'{n}-stages_{i}_x.png')).convert('RGBA')
        a = im.split()[3].point(lambda v: 255 if v > 8 else 0)   # 幾乎看不到的（反鋸齒殘渣）不算
        bb = list(a.getbbox())
        for r in REC.get(f'{n}-stages', []):
            if not r.get('box') or not r['cv'].endswith(str(i + 1)): continue
            bx, by, bw, bh = r['box']; bb = [min(bb[0], max(0, bx)), min(bb[1], max(0, by)), max(bb[2], min(W, bx + bw)), max(bb[3], min(H, by + bh))]
        # 影子統一（2026-11-26 第二輪審稿）：同一張圖裡兩個影子疊到會變深（.42、.51），改成只有一層；
        # 海上的影子（碼頭、別墅的海岸線以下）統一成偏藍的 rgba(20,40,50,.28)，陸上 rgba(30,40,30,.24)
        px = im.load()
        for j in range(H):
            sea = shore is not None and j >= shore
            for x in range(W):
                r, g, b_, al = px[x, j]
                if 0 < al < 250 and r < 90 and g < 90 and b_ < 90:
                    px[x, j] = (20, 40, 50, 71) if sea else (30, 40, 30, 61)
        bb = tuple(bb); c = im.crop(bb)
        name = f'{n}{i+1}'
        c.save(os.path.join(OUT, f'{name}.png'), optimize=True)
        out[name] = {'w': c.width, 'h': c.height, 'ox': bb[0], 'oy': bb[1], 'shore': (shore - bb[1]) if shore is not None else None}
        print(name, bb, c.size, 'shore', out[name]['shore'])
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'sprites.json'), 'w'), indent=1)
