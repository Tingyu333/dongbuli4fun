# 一般員工的四種毛色（使用者 2026-11-25 要補）：從本色的角色圖算出淺色、花色、深色
# 專案根目錄跑：python3 docs/plans/company/colors.py → assets/company/<種>-c1.png（淺）、-c2.png（花）、-c3.png（深）
# 只換身體的顏色：眼睛、腮紅、白色亮點、坐墊、手上的東西都不動
import random
from PIL import Image

def h(s): return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
def mix(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

# fill：身體的顏色（第一個是最大塊的）；line：外框；tint：淺色往哪裡調；dark：深色往哪裡調；spot：花色的斑點
SP = {
    'pigeon':   dict(fill=['#adb6c4', '#8e99ab'], line=['#4e5768'], tint='#f6f7f9', dark='#2b3038', spot='#f4f6f8'),   # 灰鴿 → 白鴿、灰白花、黑鴿
    'sparrow':  dict(fill=['#9c6b44', '#c9a878'], line=['#7d6340'], tint='#e9dcc4', dark='#3d2a1c', spot='#f0e4cc'),
    'squirrel': dict(fill=['#b48a66', '#94704f'], line=['#523a26'], tint='#e2d2bd', dark='#3a2a20', spot='#efe2cf'),
    'hamster':  dict(fill=['#f2c98c', '#dcaa66'], line=['#8f6532'], tint='#fff4e0', dark='#6e5a4a', spot='#ffffff'),
    'rabbit':   dict(fill=['#f4f1ec', '#dcd6cd'], line=['#8e877d'], tint='#ecd9bd', dark='#7a6a5c', spot='#a77a52'),   # 白兔 → 奶茶、白底咖啡斑、咖啡
    'hedgehog': dict(fill=['#6c5040', '#8a6a52'], line=['#3c2b20'], tint='#d8c8b4', dark='#2a2420', spot='#e8d8c0'),
    'frog':     dict(fill=['#93b886', '#779d69'], line=['#2f6a2a'], tint='#d6ecc8', dark='#3d5c34', spot='#5d8a4c'),
    'turtle':   dict(fill=['#647f42', '#86a35e', '#bed392', '#5f7a3a'], line=['#33461e'], tint='#d0e0b8', dark='#2c3a1e', spot='#3f5527'),
}

def variant(k, kind):
    d = SP[k]; im = Image.open(f'assets/company/{k}.png').convert('RGBA'); p = im.load(); W, H = im.size
    fill = [h(c) for c in d['fill']]; line = [h(c) for c in d['line']]
    rnd = random.Random(k + str(kind))
    xs = [x for y in range(H) for x in range(W) if p[x, y][3] and p[x, y][:3] in fill]
    ys = [y for y in range(H) for x in range(W) if p[x, y][3] and p[x, y][:3] in fill]
    blobs = [(rnd.randint(min(xs), max(xs)), rnd.randint(min(ys), max(ys)), rnd.uniform(2.6, 4.6)) for _ in range(max(3, len(xs) // 70))]
    for y in range(H):
        for x in range(W):
            c = p[x, y]
            if not c[3]: continue
            rgb = c[:3]
            if kind == 1:   # 淺色
                if rgb in fill: rgb = mix(rgb, h(d['tint']), .62)
                elif rgb in line: rgb = mix(rgb, h(d['tint']), .3)
            elif kind == 3:   # 深色
                if rgb in fill: rgb = mix(rgb, h(d['dark']), .55)
                elif rgb in line: rgb = mix(rgb, h(d['dark']), .45)
            elif kind == 2 and rgb in fill[:2]:   # 花色：身體上幾塊斑
                if any((x - bx) ** 2 + (y - by) ** 2 <= r * r for bx, by, r in blobs): rgb = mix(h(d['spot']), rgb, .12 if rgb == fill[0] else .3)
            p[x, y] = rgb + (c[3],)
    im.save(f'assets/company/{k}-c{kind}.png')

for k in SP:
    for kind in (1, 2, 3): variant(k, kind)
print('ok')
