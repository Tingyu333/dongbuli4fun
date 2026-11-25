// 公司・開的規則（數字照 docs/plans/company/economy.md 第三版、內容照 midterm.md）。
// 只放「算」的東西，不碰畫面和存檔；之後接後端時照搬到 apps-script/Code.gs。
// 網站不放 emoji。
window.CompanyRules = (() => {
  // ---------- 公司階段 ----------
  const STAGES = [
    { key: 'garage', name: '車庫創業', seats: 3, conc: 3, base: 14.3, cost: 0, jobs: 0, inject: 33000, fee: 9000, sfee: 90000, refresh: 1500, train: 6000, equip: 30000, ad: 300, maxDur: 240 },
    { key: 'small', name: '小辦公室', seats: 5, conc: 4, base: 21.8, cost: 20000,   /* 使用者 2026-11-25：新人試玩不增資要好幾天，調低（原本 45000） */ jobs: 10, inject: 110000, fee: 27500, sfee: 270000, refresh: 4500, train: 20000, equip: 100000, ad: 800, maxDur: 480 },
    { key: 'floor', name: '整層樓', seats: 8, conc: 6, base: 33.8, cost: 350000, jobs: 40, inject: 280000, fee: 70000, sfee: 700000, refresh: 15000, train: 50000, equip: 250000, ad: 2000, maxDur: 480 },
    { key: '27f', name: '二十七樓整層', seats: 12, conc: 8, base: 43.5, cost: 1300000, jobs: 125, inject: 560000, fee: 140000, sfee: 1400000, refresh: 45000, train: 100000, equip: 500000, ad: 3600, maxDur: 720 },
    { key: 'hq', name: '自己的大樓', seats: 20, conc: 12, base: 42.7, cost: 3300000, jobs: 300, inject: 900000, fee: 225000, sfee: 2250000, refresh: 150000, train: 160000, equip: 800000, ad: 6000, maxDur: 720 },
  ];
  // 長短：分鐘、倍數（短的每分鐘比較好賺，獎勵在線上）
  const DURS = [{ m: 3, k: 3.5 }, { m: 12, k: 2 }, { m: 60, k: 1.3 }, { m: 240, k: 1 }, { m: 480, k: .9 }, { m: 720, k: .85 }];
  const STATS = [['spd', '速度'], ['care', '細心'], ['res', '研究'], ['neg', '談判']];
  const SALARY = .3;          // 薪水＝毛收入三成，照份數分
  const FAIL_PAY = .1;        // 做砸了客人只付一成、薪水扣一半
  const BOARD_EVERY = 3;      // 幾分鐘貼一張新的
  const BOARD_MAX = 4;        // 委託板最多幾張（打廣告多一張）
  const SUPER_LIFE = 10;      // 特好賺 10 分鐘沒接就撤
  const FREE_REFRESH = 180;   // 應徵每 3 小時免費換一批

  // ---------- 角色 ----------
  // 九位特殊角色：能力固定（加起來 14～15、有一項 5），一個專屬本事
  const SPECIALS = {
    julie: { name: '茱莉鴨', st: [3, 5, 4, 3], skill: '細心', skillText: '有她在，成功機率 +15%；但偶爾睡著，那件慢一點', say: ['「這裡少一個句點。」', '「我沒有睡，我在閉眼檢查。」', '「下午兩點到四點不要吵我。」'] },
    xiaowu: { name: '小吳鴨', st: [3, 4, 5, 2], skill: '研究控', skillText: '要求研究的案子快 20%', say: ['「這本書第 214 頁有寫。」', '「我把參考資料疊好了，請不要碰。」'] },
    nugget: { name: '雞塊', st: [5, 3, 2, 4], skill: '不要沾醬', skillText: '早餐店系列的案子多拿兩成', say: ['「今天有人問我是不是早餐店的……我是設計師！只是剛好很香。」', '「研究我只有兩格……下次叫書很多的那位去吧。」'] },
    apple: { name: '蘋果鴨', st: [4, 3, 2, 5], skill: '甜點外交', skillText: '結案時三成機會客人多給小費', say: ['「客人吃了蛋糕就什麼都好說。」', '「頭上的蘋果不能吃。」'] },
    raccoon: { name: '浣熊大王', st: [2, 3, 4, 5], skill: '閃閃發光', skillText: '大案多拿 15%', say: ['「再閃一點。」', '「這枚金幣是借你看的。」'] },
    captain: { name: '青江菜船長', st: [5, 3, 3, 4], skill: '跨夜航行', skillText: '8 小時、12 小時的跨夜案快 15%', say: ['「全員就位，準備出航。」', '「今天風向很適合交稿。」'] },
    cat: { name: '店貓', st: [3, 4, 3, 5], skill: '招財', skillText: '結案多拿一成，但常常不在位子上', say: ['「……」（把筆推下桌）', '「喵。」（意思是：今天不加班）'] },
    dog: { name: '坐洗部的狗', st: [4, 5, 2, 3], skill: '泡泡加量', skillText: '同一組的人做砸的機率少一成', say: ['「大家做得很好，泡泡加量！」', '「洗完頭再想，想法會比較乾淨。」'] },
    mole: { name: '鼴鼠', st: [2, 4, 5, 3], skill: '挖到寶', skillText: '委託人系列做得比較快（一件算兩件）', say: ['「挖到了！是一個錯字。」', '「帽子我還在找。」'] },
  };
  // 八種一般員工：名字、個性一句話
  const SPECIES = {
    pigeon: { sp: '鴿子', names: ['阿財', '咕咕', '小灰', '飛飛'], say: ['送件很快，常常在窗邊發呆', '會把文件疊得很整齊，然後坐在上面'] },
    sparrow: { sp: '麻雀', names: ['啾啾', '小米', '阿雀'], say: ['嘴巴停不下來，客人都說很熱鬧', '動作很快，偶爾漏一兩個字'] },
    squirrel: { sp: '松鼠', names: ['栗子', '阿松', '核桃'], say: ['會把好點子藏起來，過幾天才拿出來', '抽屜裡永遠有零食'] },
    hamster: { sp: '倉鼠', names: ['小麥', '湯圓', '肉鬆'], say: ['臉頰塞滿東西還是很認真', '晚上特別有精神'] },
    rabbit: { sp: '兔子', names: ['白白', '蘿蔔', '阿兔'], say: ['耳朵很靈，客人一句抱怨都不會漏', '跑很快，但常常跑錯方向'] },
    hedgehog: { sp: '刺蝟', names: ['小刺', '栗栗', '阿蝟'], say: ['做事很仔細，不太敢跟客人講話', '被誇獎會縮成一團'] },
    frog: { sp: '青蛙', names: ['阿呱', '跳跳', '呱呱'], say: ['嗓門大，客人都記得他', '下雨天效率特別好'] },
    turtle: { sp: '烏龜', names: ['慢慢', '阿龜', '石頭'], say: ['很慢，但從來不會做錯', '已經在這行做很久了（他說的）'] },
  };
  const COLORS = ['本色', '淺色', '花色', '深色'];   // 一般員工四種顏色（圖鑑用；畫面先都畫本色）

  // ---------- 委託人和系列 ----------
  const CLIENTS = {
    dog: { who: '坐洗部的狗', series: '坐洗部系列', jobs: ['會員集點卡', '泡泡價目表', '洗頭券', '新招牌', '開幕廣告'], gift: '一瓶泡泡洗髮精', other: ['洗頭椅說明書', '泡泡不要噴到客人告示'] },
    nugget: { who: '雞塊', series: '不要沾醬系列', jobs: ['「不要沾醬」識別標誌', '菜單', '外送貼紙', '制服', '早餐店聯名'], gift: '炸得剛好的雞塊鑰匙圈', other: ['自我介紹投影片', '「我不是早餐」貼紙'], breakfast: true },
    apple: { who: '蘋果鴨', series: '甜點店系列', jobs: ['冬季菜單拍照', '轉盤海報', '蛋糕盒', '會員卡', '甜點節'], gift: '一顆不會壞的蘋果', other: ['「頭上的蘋果不能吃」告示', '蛋糕名字比賽'] },
    raccoon: { who: '浣熊大王', series: '城堡官網系列', jobs: ['城堡官網・第七次改版', '城堡官網・第八次改版', '城堡官網・第九次改版', '城堡官網・第十次改版', '「還是第一版好」'], gift: '一枚金幣（他說是借你的）', other: ['金幣收據', '王冠保養手冊'] },
    captain: { who: '青江菜船長', series: '航海系列', jobs: ['航海日誌打字', '提單格式', '船名牌', '航線圖', '首航典禮'], gift: '迷你船舵', other: ['船上點名表', '「蘿蔔不是船員」告示'], minStage: 1 },
    mole: { who: '鼴鼠', series: '礦坑系列', jobs: ['工地帽歸還道歉信', '礦坑日報', '安全標語', '結業證書', '礦坑導覽'], gift: '一頂工地帽（終於還了，結果送你）', other: ['礦坑地圖重畫', '挖到東西登記表'] },
    cat: { who: '店貓', series: '台階系列', jobs: ['台階所有權登記', '鍵盤使用規定', '紙箱租約', '午後日照時刻表', '貓咪股東會'], gift: '招財貓爪印章', other: ['「這是我的位子」標示', '罐頭兌換券'] },
    julie: { who: '茱莉鴨', series: '午睡系列', jobs: ['「下午兩點到四點勿擾」告示', '枕頭說明書', '鼻涕泡泡專利', '午睡艙設計', '全國午睡日'], gift: '睡過的枕頭套', other: ['鬧鐘退貨單', '午睡排班表'] },
    xiaowu: { who: '小吳鴨', series: '書塔系列', jobs: ['精裝書目錄', '書背標籤', '疊書安全規範', '圖書館導覽', '世界最高的書塔'], gift: '一本精裝書', other: ['借書證', '「不要碰我的書」告示'] },
  };

  // ---------- 委託卡片的小圖：看案子名字是哪一類（不用角色的照片，使用者 2026-11-25） ----------
  const KINDS = [
    ['web', '網站', /官網|網站|改版|第一版/],
    ['photo', '拍照', /拍照/],
    ['sign', '招牌', /招牌|標誌|名牌|識別/],
    ['map', '地圖', /地圖|航線圖|艙設計/],
    ['book', '書', /目錄|日誌|書背|手冊|圖書館|借書/],
    ['event', '活動', /典禮|節$|日$|股東會|導覽|聯名|開幕|投影片|比賽|書塔/],
    ['card', '卡片', /卡|券|名片|貼紙|印章|制服|盒/],
    ['poster', '海報', /海報|告示|標語|價目表|菜單|規定|規範|時刻表|排班表|標示/],
    ['doc', '文件', /./],
  ];
  const kindOf = title => KINDS.find(k => k[2].test(title))[0];

  // ---------- 突發狀況（只有開著畫面才跳，幾秒沒選就選第一個） ----------
  const INCIDENTS = [
    { t: '店貓睡在鍵盤上', d: '檔案多了一萬個「f」。店貓沒有要走的意思。', o: [['等牠自己走', '多等 2 分鐘', { delay: 2 }], ['拿逗貓棒引開', '花一點錢', { cost: .05 }], ['直接交出去', '三成機會客人說「很前衛」，多拿五成；不然做砸，客人只付一成', { bet: true }]] },
    { t: '印表機卡紙', d: '印表機發出很長的一聲「嗶——」，然後就安靜了。', o: [['慢慢把紙拉出來', '多等 3 分鐘', { delay: 3 }], ['叫人來修', '花一點錢', { cost: .06 }], ['用手寫的', '三成機會客人覺得很有溫度，多拿五成；不然做砸，客人只付一成', { bet: true }]] },
    { t: '客人臨時改需求', d: '「可以把 logo 放大，但是不要變大嗎？」', o: [['照改', '多等 4 分鐘，多拿一成', { delay: 4, bonus: .1 }], ['說服他不要改', '有談判 4 以上的人在就沒事，不然慢一點', { neg: 4, delay: 3 }], ['兩個版本都給他', '三成機會他兩個都買，多拿五成；不然做砸，客人只付一成', { bet: true }]] },
    { t: '有人在辦公室裡睡著了', d: '鼻涕泡泡一下大一下小，大家都不敢出聲。', o: [['讓他睡', '多等 3 分鐘', { delay: 3 }], ['輕輕叫醒', '成功機率少一點', { odds: -.08 }], ['大家一起睡', '三成機會醒來靈感爆發，多拿五成；不然做砸，客人只付一成', { bet: true }]] },
    { t: '咖啡灑在稿子上', d: '稿子現在是拿鐵色的。', o: [['重印一份', '花一點錢', { cost: .04 }], ['說這是故意的', '有談判 4 以上的人在就沒事，不然做砸，客人只付一成', { neg: 4, fail: true }], ['加一點奶泡', '三成機會客人說「很有質感」，多拿五成；不然做砸，客人只付一成', { bet: true }]] },
  ];

  // ---------- 設備 ----------
  const EQUIP = [
    [['strip', '延長線', '三孔、有開關，不會一插電就跳'], ['fan', '二手電風扇', '會搖頭，有一格風很大'], ['printer', '像樣的印表機', '印得出來，不會只印一半']],
    [['chair', '人體工學椅', '坐久了腰不會痛'], ['coffee', '咖啡機', '早上大家都準時了'], ['noise', '白噪音機', '鍵盤聲變好聽']],
    [['snack', '零食櫃', '下午三點不會沒力'], ['stand', '站立桌', '開會變短了'], ['screen', '會議室大螢幕', '客人看得很清楚']],
    [['holo', '全息投影', '提案像在變魔術'], ['massage', '按摩椅', '排隊排到門口'], ['garden', '空中花園', '雲就在旁邊']],
    [['canteen', '員工餐廳', '中午不用想吃什麼'], ['autodoor', '自動門', '客人進門就覺得很厲害'], ['roofsign', '頂樓招牌', '整座城都看得到']],
  ];
  const EQUIP_BOOST = .08;

  // ---------- 小工具 ----------
  const pick = (a, r = Math.random) => a[Math.floor(r() * a.length)];
  const fmt = n => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  const dur = m => m < 60 ? m + ' 分鐘' : (m % 60 ? (m / 60).toFixed(1) : m / 60) + ' 小時';
  const clock = s => { s = Math.max(0, Math.ceil(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0'); };
  const odds = p => p >= 1 ? '一定成功' : p >= .95 ? '幾乎一定' : p >= .1 ? ['', '一成', '兩成', '三成', '四成', '五成', '六成', '七成', '八成', '九成'][Math.floor(p * 10)] : '不到一成';

  // ---------- 員工 ----------
  const staffName = s => s.special ? SPECIALS[s.key].name : SPECIES[s.key].sp + '・' + s.nick;
  const shares = s => (s.special ? 1.5 : 1) + (s.lv - 1) * .1;
  const expNeed = lv => 5 + lv * 5;          // Lv2→3 要 15
  const MAX_LV = 10;
  function newStaff(key, special, r = Math.random) {
    if (special) return { id: 'p' + Date.now().toString(36) + Math.floor(r() * 1e4), key, special: true, lv: 1, exp: 0, st: SPECIALS[key].st.slice(), done: 0, failed: 0, color: 0 };
    const s = SPECIES[key], st = [1, 1, 1, 1]; let pts = 5 + Math.floor(r() * 3);   // 一般員工加起來 9～11
    while (pts > 0) { const i = Math.floor(r() * 4); if (st[i] < 5) { st[i]++; pts--; } }
    return { id: 'p' + Date.now().toString(36) + Math.floor(r() * 1e4), key, special: false, nick: pick(s.names, r), say: pick(s.say, r), lv: 1, exp: 0, st, done: 0, failed: 0, color: Math.floor(r() * 4) };
  }
  // 應徵三位：每格 5% 是還沒請過的特殊角色
  function applicants(stage, hiredSpecials, r = Math.random, noSpecial = false) {   // noSpecial：教學那一批只有一般員工，簽約金一定付得起
    const out = [], left = noSpecial ? [] : Object.keys(SPECIALS).filter(k => !hiredSpecials.includes(k));
    for (let i = 0; i < 3; i++) {
      if (left.length && r() < .05) { const k = left.splice(Math.floor(r() * left.length), 1)[0]; out.push(newStaff(k, true, r)); }
      else out.push(newStaff(pick(Object.keys(SPECIES), r), false, r));
    }
    return out;
  }
  const hireFee = (stage, s) => s.special ? STAGES[stage].sfee : STAGES[stage].fee;

  // ---------- 案子 ----------
  let seq = 0;
  function newCase(stage, opt = {}, r = Math.random) {
    const S = STAGES[stage], now = opt.now || Date.now();
    const durs = DURS.filter(d => d.m <= S.maxDur);
    let d = opt.m ? DURS.find(x => x.m === opt.m) : opt.easy ? DURS[Math.floor(r() * 2)] : (r() < .45 ? durs[Math.floor(r() * 2)] : pick(durs, r));   // easy：教學完第一批，3 或 12 分鐘
    const clients = Object.keys(CLIENTS).filter(k => (CLIENTS[k].minStage || 0) <= stage);
    let client = opt.client || pick(clients, r), title, seriesNo = 0;
    const sv = opt.series || {};
    if (opt.client === undefined && !opt.easy && r() < .3) {   // 三成是委託人的系列（做完前一件才會來下一件）
      const can = clients.filter(k => (sv[k] || 0) < 5 && !(opt.onBoard || []).includes(k));
      if (can.length) { client = pick(can, r); seriesNo = (sv[client] || 0) + 1; }
    }
    const C = CLIENTS[client];
    title = seriesNo ? C.jobs[seriesNo - 1] : (opt.title || pick(C.other, r));
    let tag = '', mult = 1;
    if (seriesNo === 5) { tag = 'big'; mult = 1.5; if (d.m < 60) d = DURS[2]; }
    else if (opt.super || (!seriesNo && !opt.easy && r() < .05 && !opt.noSuper)) { tag = 'super'; mult = 3; }
    else if (!opt.easy && r() < .2) { tag = pick(['rush', 'big', 'talk'], r); mult = 1.5; }
    const maxP = Math.min(S.seats, 4);
    let ppl = d.m <= 3 ? 1 : d.m <= 12 ? 1 + Math.floor(r() * 2) : d.m <= 60 ? 2 : d.m <= 240 ? 2 + Math.floor(r() * 2) : 3 + Math.floor(r() * 2);
    if (tag === 'big') ppl++;
    if (opt.easy) ppl = Math.min(ppl, 2);
    ppl = Math.max(1, Math.min(maxP, ppl));
    const req = [];   // 條件：某項能力 ≥ n
    if (tag === 'talk') req.push([3, 5]);
    if (d.m > 3 && !opt.easy && r() < .65) { const i = Math.floor(r() * 3); if (!req.some(q => q[0] === i)) req.push([i, 3 + Math.floor(r() * Math.min(3, 1 + stage + (tag ? 1 : 0)))]); }
    const net = S.base * d.k * d.m * ppl * mult, gross = Math.round(net / (1 - SALARY));
    return { id: 'c' + now.toString(36) + (seq++), client, title, seriesNo, m: d.m, ppl, req, tag, gross, posted: now, easy: !!opt.easy,
      expires: tag === 'super' ? now + SUPER_LIFE * 60000 : tag === 'rush' ? now + 120 * 60000 : now + 240 * 60000 };
  }
  // 教學案：雞塊、3 秒、一定成功
  const tutorialCase = now => ({ id: 'tut', client: 'nugget', title: '「不要沾醬」識別標誌', seriesNo: 0, m: .05, ppl: 1, req: [], tag: '', gross: 70, posted: now, expires: now + 864e5, tutorial: true });

  // 一組人做這件：合不合、成功率、多久
  function plan(c, team, ctx = {}) {
    const best = i => Math.max(0, ...team.map(s => s.st[i]));
    const short = c.req.map(([i, n]) => Math.max(0, n - best(i)));
    let p = c.tutorial || c.easy ? 1 : .92 - .18 * short.reduce((a, b) => a + b, 0);   // easy：教學完第一批，新手保護、一定成功
    p += team.reduce((a, s) => a + (s.lv - 1) * .01, 0) / Math.max(1, team.length);
    if (team.some(s => s.special && s.key === 'julie')) p += .15;
    if (team.some(s => s.special && s.key === 'dog')) p = 1 - (1 - p) * .9;
    p = c.tutorial || c.easy ? 1 : Math.max(.1, Math.min(.98, p));
    let m = c.m;
    const spd = team.reduce((a, s) => a + s.st[0], 0) / Math.max(1, team.length);
    m *= 1.1 - .04 * spd;
    if (team.some(s => s.special && s.key === 'xiaowu') && c.req.some(q => q[0] === 2)) m *= .8;
    if (team.some(s => s.special && s.key === 'captain') && c.m >= 480) m *= .85;
    const napper = team.some(s => s.special && s.key === 'julie');
    return { ok: short.every(x => x === 0), short, p, m: c.tutorial ? .05 : m, napper, who: c.req.map(([i, n]) => team.find(s => s.st[i] >= n)) };
  }
  // 幫我派：從閒著的人裡挑，先滿足條件、再挑能力高的
  function autoPick(c, idle) {
    if (idle.length < c.ppl) return null;
    let bestTeam = null, bestScore = -1;
    const n = idle.length, k = c.ppl, combo = [];
    const go = (start) => {
      if (combo.length === k) { const t = combo.map(i => idle[i]), pl = plan(c, t); const sc = pl.p * 100 - pl.m / Math.max(1, c.m) * 3 - t.reduce((a, s) => a + shares(s), 0) * .5; if (sc > bestScore) { bestScore = sc; bestTeam = t; } return; }
      for (let i = start; i < n && combo.length < k; i++) { combo.push(i); go(i + 1); combo.pop(); }
    };
    if (n <= 12) go(0); else bestTeam = idle.slice().sort((a, b) => b.st.reduce((x, y) => x + y) - a.st.reduce((x, y) => x + y)).slice(0, k);
    return bestTeam;
  }
  // 開工：結果開工時就決定（之後只是倒數），突發狀況可以改
  function start(c, team, now, ctx = {}, r = Math.random) {
    const pl = plan(c, team, ctx);
    let m = pl.m; const napped = pl.napper && r() < .3; if (napped) m *= 1.1;
    const ok = r() < pl.p;
    return { id: 'j' + now.toString(36) + (seq++), c, team: team.map(s => s.id), start: now, end: now + m * 60000, ok, great: ok && r() < (team.some(s => s.special && s.key === 'julie') ? .6 : .3), napped, p: pl.p, tip: team.some(s => s.special && s.key === 'apple') && r() < .3, bonus: 0 };
  }
  // 結案單
  function settle(job, team, ctx = {}) {
    const c = job.c, lines = [];
    let gross = c.gross;
    const mods = [];
    const has = k => team.some(s => s.special && s.key === k);
    if (job.ok) {
      if (job.great) mods.push([team.some(s => s.special && s.key === 'julie') ? '做得好（茱莉鴨細心）' : '做得好', .1]);
      if (has('nugget') && CLIENTS[c.client].breakfast) mods.push(['不要沾醬（雞塊）', .2]);
      if (has('raccoon') && c.tag === 'big') mods.push(['閃閃發光（浣熊大王）', .15]);
      if (has('cat')) mods.push(['招財（店貓）', .1]);
      if (job.tip) mods.push(['客人給小費（蘋果鴨）', .1]);
      if (job.bonus) mods.push([job.betWon ? '突發狀況・賭贏了' : '突發狀況', job.bonus]);
      if (ctx.souvenir) mods.push(['紀念品（老客戶）', .05]);
      if (ctx.equip) mods.push(['設備', ctx.equip * EQUIP_BOOST]);
    }
    const base = job.ok ? gross : Math.round(gross * FAIL_PAY);
    const extra = mods.map(([t, k]) => [t, Math.round(gross * k)]);
    const salaryFull = Math.round(gross * SALARY), salary = job.ok ? salaryFull : Math.round(salaryFull / 2);
    const tot = team.reduce((a, s) => a + shares(s), 0) || 1;
    const per = team.map(s => [s, Math.round(salaryFull * shares(s) / tot), Math.round(salary * shares(s) / tot)]);
    const net = base + extra.reduce((a, x) => a + x[1], 0) - per.reduce((a, x) => a + x[2], 0);
    return { ok: job.ok, base, extra, salary: per.reduce((a, x) => a + x[2], 0), per, net };
  }
  // 結案後員工拿經驗、升級（能力隨機一項 +1，最多 5）
  function gainExp(s, n, r = Math.random) {
    s.exp += n; const ups = [];
    while (s.lv < MAX_LV && s.exp >= expNeed(s.lv)) { s.exp -= expNeed(s.lv); s.lv++; const can = [0, 1, 2, 3].filter(i => s.st[i] < 5); const i = can.length ? pick(can, r) : -1; if (i >= 0) s.st[i]++; ups.push([s.lv, i]); }
    return ups;
  }
  const trainPrice = (stage, s) => STAGES[stage].train * s.lv;
  const overtimePrice = job => job.c.gross;   // 使用者 2026-11-25：降到跟案子差不多（原本兩倍）
  const incidentCost = (stage, k) => Math.round(STAGES[stage].base * 60 * 3 * k * 10) / 10 > 0 ? Math.max(100, Math.round(STAGES[stage].base * 60 * 3 * k / 10) * 10) : 100;

  return { STAGES, DURS, STATS, SPECIALS, SPECIES, COLORS, CLIENTS, INCIDENTS, EQUIP, EQUIP_BOOST, SALARY, BOARD_EVERY, BOARD_MAX, SUPER_LIFE, FREE_REFRESH, MAX_LV,
    KINDS, kindOf, pick, fmt, dur, clock, odds, staffName, shares, expNeed, newStaff, applicants, hireFee, newCase, tutorialCase, plan, autoPick, start, settle, gainExp, trainPrice, overtimePrice, incidentCost };
})();
