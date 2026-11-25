# 開公司的經濟模擬・第二版（2026-11-24）：python3 docs/plans/company/sim.py
# 一分鐘一分鐘跑 90 天。三種玩家：
#   A 上班族：一天看四次（8:00、12:30、19:00、22:30），每次 5 分鐘
#   B 認真玩：A 再加 21:00 一段 30 分鐘
#   C 有錢人：照 A 的時間玩，但每天執行長增資到上限、設備一出就用錢包買
# 規則（使用者 2026-11-24 定）：錢全部乘 3；最短案子 3 分鐘；做砸了客戶只付一成、薪水扣一半；
# 升級只能用公司帳戶付＋做完幾件；薪水＝毛收入三成；執行長增資每天上限＝當階一天的量。
import random, math
random.seed(11)

STAGES = ['車庫創業', '小辦公室', '整層樓', '二十七樓整層', '自己的大樓']
STAFF = [3, 5, 8, 12, 20]
SLOTS = [3, 4, 6, 8, 12]
SCALE = 3
UPCOST = [20_000, 350_000, 1_300_000, 3_300_000]      # 目標：上班族兩週左右到大樓（使用者 2026-11-25：約兩週，快一點；原本 90k／700k／2.6M／6.6M、30 天）
UPJOBS = [10, 40, 125, 300]                           # 搬家還要做完幾件（累計）：跟價錢一起砍一半
BASE = [round(x * SCALE * k, 1) for x, k in zip([6.7, 11.7, 18.8, 25.0, 25.0], [.71, .62, .60, .58, .57])]
# 每人每分鐘淨賺（4 小時案、扣完薪水）。第一版模擬有錯（上線最後一分鐘短案子佔著位子，出門前的長案子派不出去），
# 修好以後乘 3 倍太好賺（大樓一天 $157 萬），照「車庫一天約 $3 萬、大樓一天約 $90 萬」校正回來
MULT = {3: 3.5, 12: 2.0, 60: 1.3, 240: 1.0, 480: .9, 720: .85}
MAXDUR = [240, 480, 480, 720, 720]                    # 跨夜大案：小辦公室起 8 小時、二十七樓起 12 小時
WAGE = .30
P_SPECIAL, P_SUPER = .20, .05
P_OK = .88                                            # 開工前看得到成功率、條件不夠會擋，平均高一點
EQUIP = .25                                           # 有錢人：每階設備買滿，多賺 25%
DAILY = [None] * 5                                    # 每階一天大約賺多少（給增資上限用，先跑一次 A 算出來）

def job(stage, d, ppl, boost):
    net = BASE[stage] * MULT[d] * d * ppl * boost
    r = random.random(); k = 3 if r < P_SUPER else 1.5 if r < P_SUPER + P_SPECIAL else 1
    gross = net * k / (1 - WAGE)
    if random.random() < P_OK: return gross * (1 - WAGE), True
    return gross * .1 - gross * WAGE * .5, False      # 做砸了：一成、薪水扣一半

def sim(profile, days=90):
    stage, acct, staff, done_jobs = 0, 0.0, 3, 0
    jobs, log, earned = [], {}, {s: [0, 0.0] for s in range(5)}
    checks = [8 * 60, 12 * 60 + 30, 19 * 60, 22 * 60 + 30]
    active = [(c, 5) for c in checks] + ([(21 * 60, 30)] if profile == 'B' else [])
    boost = 1 + (EQUIP if profile == 'C' else 0)
    for t in range(days * 1440):
        m = t % 1440
        on = any(c <= m < c + L for c, L in active)
        leaving = any(m == c + L - 1 for c, L in active)
        left = min([c + L - 1 - m for c, L in active if c <= m < c + L] or [0])   # 這次上線還剩幾分鐘（短案子做不完就不接，留位子給出門前的長案子）
        if profile == 'C' and m == 8 * 60 and DAILY[stage]: acct += DAILY[stage]          # 執行長增資
        if on:
            for j in [j for j in jobs if j[0] <= t]:
                acct += j[1]; earned[stage][1] += j[1]; done_jobs += 1
            jobs = [j for j in jobs if j[0] > t]
            busy = sum(j[2] for j in jobs)
            while len(jobs) < SLOTS[stage] and busy < staff and (leaving or left >= 3):
                if leaving:
                    gap = min(((c - m) % 1440 for c, L in active if (c - m) % 1440 > 5), default=240)
                    d = max([x for x in MULT if x <= max(gap, 12) and x <= MAXDUR[stage]])
                else: d = 3
                ppl = min(staff - busy, random.choice([1, 1, 2, 2, 3]))
                net, ok = job(stage, d, ppl, boost)
                jobs.append([t + d, net, ppl]); busy += ppl
            if stage < 4 and acct >= UPCOST[stage] and done_jobs >= UPJOBS[stage]:
                acct -= UPCOST[stage]; log[stage + 1] = t / 1440; stage += 1
            staff = STAFF[stage]   # 請人的簽約金用錢包付，不影響公司帳戶
        earned[stage][0] += 1
    return log, earned, done_jobs / days

def run(prof, n=6):
    rs = [sim(prof) for _ in range(n)]
    days = {s: [r[0][s] for r in rs if s in r[0]] for s in range(1, 5)}
    daily = {}
    for s in range(5):
        mins = sum(r[1][s][0] for r in rs); got = sum(r[1][s][1] for r in rs)
        if mins: daily[s] = got / mins * 1440
    return days, daily, sum(r[2] for r in rs) / n

a_days, a_daily, a_jobs = run('A')
for s in range(5): DAILY[s] = a_daily.get(s)
for prof, name in (('A', '上班族（一天看四次、每次 5 分鐘）'), ('B', '認真玩（再多 30 分鐘）'), ('C', '有錢人（照上班族玩＋每天增資到上限＋設備買滿）')):
    days, daily, jobs = (a_days, a_daily, a_jobs) if prof == 'A' else run(prof)
    print(f'\n## {name}')
    for s in range(1, 5):
        d = days[s]; print(f'- 搬到{STAGES[s]}：' + (f'第 {sum(d)/len(d):.1f} 天' if d else '90 天內到不了') + (f'（{len(d)}/6 次）' if 0 < len(d) < 6 else ''))
    if jobs: print(f'  - 一天平均做完 {jobs:.0f} 件')
    print('  - 一天平均淨賺：' + '、'.join(f'{STAGES[s]} ${daily[s]:,.0f}' for s in daily))

print('\n## 每小時（全部員工都在做事）')
for s in range(5):
    idle = BASE[s] * 60 * STAFF[s] * 1.2 * .97
    act = BASE[s] * MULT[3] * 60 * STAFF[s] * 1.2 * .9
    print(f'- {STAGES[s]}：放著做長案子 ${idle:,.0f}／在線上一直接 3 分鐘案子 ${act:,.0f}')
