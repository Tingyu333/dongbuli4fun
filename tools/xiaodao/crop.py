# 把 dump_empty.js 畫出來的各階段圖：草地（碼頭、別墅連沙灘和海）變透明，裁到剛好，存成 assets/xiaodao/<設施><級>.png
from PIL import Image; import json, sys, os
IN = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(os.path.dirname(__file__), '../../assets/xiaodao')
hx = lambda s: tuple(int(s[i:i+2], 16) for i in (1, 3, 5))
LAWN = {hx(c) for c in ['#97ad6f', '#86a061', '#a6bb7c', '#738d51']}
SAND = {hx(c) for c in ['#e6d3a3', '#d8c18b', '#efe0b8']}
SEA = {hx(c) for c in ['#6b97a6', '#7ea9b5', '#9cc5c8', '#e3efed', '#4f7d8f']}
SHEET = {'house': 5, 'garage': 5, 'dock': 5, 'airfield': 5, 'launchpad': 3}
out = {}
for n, cnt in SHEET.items():
    for i in range(cnt):
        im = Image.open(os.path.join(IN, f'{n}-stages_{i}.png')).convert('RGBA'); px = im.load(); W, H = im.size
        key = LAWN | ((SAND | SEA) if (n == 'dock' or (n == 'house' and i == 4)) else set())
        # 海岸線：第一列「大部分是海」的列（碼頭、別墅用來對齊）
        shore = None
        for j in range(H):
            if sum(1 for x in range(W) if px[x, j][:3] in SEA) > W * .6: shore = j; break
        for j in range(H):
            for x in range(W):
                if px[x, j][:3] in key: px[x, j] = (0, 0, 0, 0)
        bb = im.getbbox()
        c = im.crop(bb)
        name = f'{n}{i+1}'
        c.save(os.path.join(OUT, f'{name}.png'), optimize=True)
        out[name] = {'w': c.width, 'h': c.height, 'ox': bb[0], 'oy': bb[1], 'shore': (shore - bb[1]) if shore is not None else None}
        print(name, bb, c.size, 'shore', out[name]['shore'])
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'sprites.json'), 'w'), indent=1)
