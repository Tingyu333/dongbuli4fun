# 開公司的經濟模擬（2026-11-24）：python3 docs/plans/company/sim.py
# 一分鐘一分鐘跑 60 天，兩種玩家：上班族（一天看四次，每次玩 5 分鐘）、認真玩（再多一段 30 分鐘）。
import random, math
random.seed(7)

STAGES = ['車庫創業', '小辦公室', '整層樓', '二十七樓整層', '自己的大樓']
STAFF = [3, 5, 8, 12, 20]                 # 員工上限
SLOTS = [3, 4, 6, 8, 12]                  # 同時做幾件
UPCOST = [30_000, 250_000, 1_500_000, 6_000_000]   # 升到下一階（第一版 12 萬／80 萬／500 萬／3,000 萬太慢：上班族要 10 天才到小辦公室）
# 每個員工每分鐘的「淨賺」（4 小時的長案子、扣完薪水）
BASE = [6.7, 11.7, 18.8, 25.0, 25.0]
# 短案子每分鐘比較好賺（要你一直在線上點）
DUR = [0.5, 1, 3, 12, 60, 240]
MULT = {0.5: 5.0, 1: 4.5, 3: 3.5, 12: 2.0, 60: 1.3, 240: 1.0}
WAGE_SHARE = .30        # 薪水佔毛收入三成
P_SPECIAL, P_SUPER = .20, .05   # 特殊案子 20%（急件、大案，×1.5）、特好賺 5%（×3）
P_OK = .85              # 平均做得好的機率（派對人會更高）
HIRE = [3_000, 6_000, 12_000, 25_000, 50_000]   # 一般員工簽約金（跟著階段）

def job_net(stage, d, people):
    """一件案子做完的淨收入（期望值：特殊案子、做砸了都算進去）"""
    net = BASE[stage] * MULT[d] * d * people
    r = random.random()
    k = 3 if r < P_SUPER else 1.5 if r < P_SUPER + P_SPECIAL else 1
    gross = net * k / (1 - WAGE_SHARE); wage = gross * WAGE_SHARE
    if random.random() < P_OK: return gross - wage, gross, wage
    return gross * .3 - wage * .5, gross * .3, wage * .5      # 做砸了：只付三成、薪水扣一半

def sim(profile, days=90):
    stage, money, staff = 0, 0.0, 3
    jobs = []        # [結束的分鐘, 淨收入, 人數]
    log = {}; earned = {s: [0, 0] for s in range(5)}   # 每一階：花了幾分鐘、賺多少
    checks = [8 * 60, 12 * 60 + 30, 19 * 60, 22 * 60 + 30]
    active = [(c, 5) for c in checks] + ([(21 * 60, 30)] if profile == 'B' else [])
    for t in range(days * 1440):
        m = t % 1440
        on = any(c <= m < c + L for c, L in active)
        leaving = any(m == c + L - 1 for c, L in active)
        # 在線上：收做完的、派短案子；要離開了：派長案子
        if on:
            done = [j for j in jobs if j[0] <= t]; jobs = [j for j in jobs if j[0] > t]
            for j in done: money += j[1]; earned[stage][1] += j[1]
            busy = sum(j[2] for j in jobs)
            while len(jobs) < SLOTS[stage] and busy < staff:
                d = 240 if leaving else random.choice([0.5, 1, 3])
                if leaving:
                    nxt = min(((c - m) % 1440 for c, L in active if (c - m) % 1440 > 0), default=240)
                    d = max([x for x in DUR if x <= max(nxt, 12)] or [12])
                    d = min(d, 240)
                ppl = min(staff - busy, random.choice([1, 1, 2, 2, 3]))
                net, g, w = job_net(stage, d, ppl)
                jobs.append([t + max(1, math.ceil(d)), net, ppl]); busy += ppl
            # 升級、請人
            if stage < 4 and money >= UPCOST[stage]:
                money -= UPCOST[stage]; log[stage + 1] = t / 1440; stage += 1
            while staff < STAFF[stage] and money >= HIRE[stage] * 3:
                money -= HIRE[stage]; staff += 1
        earned[stage][0] += 1
    return log, earned

for prof, name in (('A', '上班族（一天看四次，每次 5 分鐘）'), ('B', '認真玩（再多一段 30 分鐘）')):
    runs = [sim(prof) for _ in range(5)]
    print(f'\n## {name}')
    for s in range(1, 5):
        ds = [r[0].get(s) for r in runs]
        ok = [d for d in ds if d is not None]
        print(f'- 升到{STAGES[s]}：' + (f'平均第 {sum(ok)/len(ok):.1f} 天' if ok else '90 天內到不了') + (f'（{len(ok)}/5 次到得了）' if 0 < len(ok) < 5 else ''))
    for s in range(5):
        mins = sum(r[1][s][0] for r in runs); got = sum(r[1][s][1] for r in runs)
        if mins: print(f'  - {STAGES[s]}：一天平均淨賺 ${got / mins * 1440:,.0f}')

print('\n## 每小時（所有員工都在做事）')
for s in range(5):
    idle = BASE[s] * 60 * STAFF[s] * 1.2 * (P_OK + (1 - P_OK) * .3) * .97
    act = BASE[s] * 60 * STAFF[s] * 4.3 * 1.2 * .9
    print(f'- {STAGES[s]}：放著做長案子 ${idle:,.0f}／在線上一直接短案子 ${act:,.0f}')
