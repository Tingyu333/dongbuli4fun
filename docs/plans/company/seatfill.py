# 把角色貼到 office5 每個坐墊上看擠不擠：先跑 office-canvases.js（會順便存 oc/seats.json）、ui-sprites.js 切好角色，再 python3 seatfill.py → /home/claude/work/seat_s1～s5.png
# 把角色貼到 office5 每個坐墊上，看擠不擠：python3 seatfill.py → seat_s2.png …
from PIL import Image
import json
A=json.load(open('/home/claude/work/sp/atlas.json')); S=json.load(open('/home/claude/work/oc/seats.json'))
mix=['julie_awake','pigeon','raccoon','frog','cat','hamster','xiaowu','squirrel','nugget','rabbit','dog','turtle','apple','sparrow','mole','hedgehog','captain','pigeon','frog','squirrel']
for sid,seats in S.items():
    bg=Image.open(f'/home/claude/work/oc/{sid}.png').convert('RGBA')
    for k,(cx,y) in enumerate(sorted(seats,key=lambda t:t[1])):
        n=mix[k%len(mix)]; sp=Image.open(f'/home/claude/work/sp/{n}.png'); bg.alpha_composite(sp,(round(cx)-A[n]['ax'],round(y)+1-sp.height))
    bg.resize((bg.width*2,bg.height*2),Image.NEAREST).save(f'/home/claude/work/seat_{sid}.png')
