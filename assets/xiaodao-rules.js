// 我的小島：規則（純計算，不碰畫面）。網頁和後端用同一份，後端 Code.gs 之後貼一份一模一樣的進去。
// - 世界是固定的：一格 20 顆像素，44 × 38 格；地塊是不規則的一片（在格子上撒點，每一格歸最近的點），大家的地塊切法都一樣。
// - 設施的位置固定（每種設施一個「工地」），等級越高越大；蓋某一級要先擁有那一級占到的地塊。
// - 南邊一片海永遠是海（家蓋到海景別墅要靠海、碼頭要伸進海裡），那裡的格子不屬於任何地塊。
// - 存檔是一份清單（之後屋內、家具、車都是同一種寫法，見 docs/plans/jiayuan/README.md「擴充性」）。
(function (root) {
  'use strict';
  const C = 20, GW = 44, GH = 38, SEED = 37, COAST = 480;
  const SEA = [[200, 480, 520, 140]];                     // 永遠是海的範圍（像素）：[x, y, w, h]

  // 設施：mode 是每一級的圖怎麼對齊工地（br 右下、bl 左下、bc 下面置中、shore 海岸線置中）
  // sprites：每一級的圖 [寬, 高, 海岸線在圖裡第幾列]（從設計圖裁出來的，assets/xiaodao/<key><級>.png）
  const FAC = {
    house: {
      name: '家', mode: 'br', ax: 420, ay: COAST, door: 'r',
      levels: ['帳篷', '木屋', '紅瓦平房', '兩層洋房', '海景別墅'],
      prices: [0, 8000, 45000, 300000, 1200000],
      sprites: [[139, 87], [128, 92], [154, 96], [182, 106], [141, 87, 93]],
    },
    garage: {
      name: '車庫', mode: 'bl', ax: 480, ay: 440, door: 'b',
      levels: ['腳踏車棚', '車棚', '單車庫', '雙車庫＋工作坊', '展示車廊'],
      prices: [2000, 20000, 75000, 400000, 1200000],
      sprites: [[78, 81], [102, 102], [91, 110], [146, 114], [174, 112]],
      // 每一階的車位 [x, y, 寬, 高, 停得了幾級]（圖裡的座標；從設計圖原本畫車的位置記下來，tools/xiaodao/slots.json）
      slots: [[[12,26,5,15,1],[22,26,5,15,1],[33,28,9,14,1],[50,26,14,22,1]],[[15,14,18,28,2],[45,22,9,14,1],[62,16,14,22,1]],[[17,56,20,28,3],[46,80,12,18,1],[47,58,9,14,1]],[[13,54,20,34,4],[59,60,18,28,4],[84,86,12,18,1],[85,64,9,14,1]],[[13,12,18,30,5],[37,12,20,28,5],[73,25,22,30,5],[108,10,18,32,5],[127,8,22,38,5],[15,58,9,14,1],[27,58,9,14,1],[40,56,12,18,1]]],
    },
    dock: {
      name: '碼頭', mode: 'shore', ax: 560, ay: COAST, door: 't',
      levels: ['小木台', '木棧橋', '漁港碼頭', '遊艇碼頭', '私人港灣'],
      prices: [2000, 20000, 90000, 500000, 1600000],
      sprites: [[57, 43, 10], [54, 83, 9], [117, 87, 9], [166, 79, 8], [198, 98, 21]],
      slots: [[[0,21,14,22,1],[46,23,11,16,1]],[[42,34,12,27,2],[0,20,13,17,1],[0,52,14,24,1]],[[18,54,12,31,3],[22,6,14,26,3],[52,54,16,32,3],[72,6,14,27,3],[84,54,16,33,3]],[[30,24,18,39,4],[84,26,18,39,4],[108,26,18,40,4],[4,22,12,27,3],[136,23,12,21,1]],[[72,18,20,60,5],[106,7,28,72,5],[48,28,18,39,4],[28,36,12,31,3]]],
    },
    airfield: {
      name: '停機坪', mode: 'bc', ax: 330, ay: 340, door: 'b',
      levels: ['草地起降場', '直升機坪', '小機場', '私人機場', '航空站'],
      prices: [45000, 150000, 600000, 2000000, 6000000],
      sprites: [[180, 75], [150, 80], [200, 98], [200, 114], [200, 118]],
      // 機位（第三批）：熱氣球那格飄在圖上面一點；直升機位比設計圖量到的寬一點（旋翼）
      slots: [[[50,-2,27,27,1],[90,56,30,17,1],[130,2,30,28,1]],[[27,8,30,32,2],[96,34,42,20,1],[102,10,26,19,1]],[[50,29,32,30,3],[92,29,32,30,3],[134,38,30,30,3],[12,8,30,32,2]],[[28,38,37,39,4],[74,38,37,39,4],[120,43,32,30,3]],[[67,24,66,70,5],[142,36,37,39,4],[18,39,30,30,3],[18,74,34,20,2]]],
    },
    launchpad: {
      name: '發射台', mode: 'bc', ax: 590, ay: 300, door: 'b', needs: { airfield: 4 },
      levels: ['小發射架', '發射塔', '太空港'],
      prices: [2000000, 6000000, 16000000],
      sprites: [[120, 89], [170, 113], [194, 130]],
      // 發射台一次立一枚（企劃書定的），其他收倉庫；位子是主火箭連推進器的範圍
      slots: [[[57,28,10,32,1]],[[50,17,24,64,2]],[[112,12,36,100,3]]],
    },
  };
  const FAC_KEYS = ['house', 'garage', 'dock', 'airfield', 'launchpad'];

  // 車、船（第二批）：從 vehicles.html、boats.html 畫出來的圖 assets/xiaodao/v/<key>.png；cls 是幾級（停得進同級以上的位子，買之前車庫／碼頭要蓋到同一級）
  const VEH = {
    bike1: { name: '淑女車', desc: '前面有籃子', g: '腳踏車', fac: 'garage', cls: 1, price: 300, w: 7, h: 19 },
    bike2: { name: '公路車', desc: '彎把、很細', g: '腳踏車', fac: 'garage', cls: 1, price: 1200, w: 7, h: 19 },
    bike3: { name: '登山車', desc: '粗輪胎、平把', g: '腳踏車', fac: 'garage', cls: 1, price: 900, w: 9, h: 19 },
    bike4: { name: '小摺', desc: '輪子小小的', g: '腳踏車', fac: 'garage', cls: 1, price: 600, w: 6, h: 15 },
    bike5: { name: '協力車', desc: '兩個人一起騎', g: '腳踏車', fac: 'garage', cls: 1, price: 2000, w: 7, h: 27 },
    moto1: { name: '速克達', desc: '白牌、每天騎', g: '機車', fac: 'garage', cls: 1, price: 2000, w: 11, h: 18 },
    moto2: { name: '偉士牌風', desc: '圓屁股、鍍鉻', g: '機車', fac: 'garage', cls: 1, price: 9000, w: 11, h: 18 },
    moto3: { name: '外送機車', desc: '後面一個大箱子', g: '機車', fac: 'garage', cls: 1, price: 4000, w: 12, h: 22 },
    moto4: { name: '重機', desc: '大油箱、排氣管', g: '機車', fac: 'garage', cls: 1, price: 15000, w: 13, h: 21 },
    moto5: { name: '電動機車', desc: '安安靜靜', g: '機車', fac: 'garage', cls: 1, price: 6000, w: 11, h: 18 },
    sedan1: { name: '小型車', desc: '圓圓的、好停', g: '轎車', fac: 'garage', cls: 2, price: 30000, w: 18, h: 25 },
    sedan2: { name: '轎車', desc: '最普通的那種', g: '轎車', fac: 'garage', cls: 2, price: 45000, w: 20, h: 31 },
    sedan3: { name: '計程車', desc: '車頂有牌子', g: '轎車', fac: 'garage', cls: 2, price: 52000, w: 20, h: 31 },
    sedan4: { name: '旅行車', desc: '後車廂很長、車頂架', g: '轎車', fac: 'garage', cls: 2, price: 60000, w: 20, h: 33 },
    sedan5: { name: '黑頭車', desc: '長長的、黑玻璃', g: '轎車', fac: 'garage', cls: 2, price: 90000, w: 20, h: 35 },
    sport1: { name: '紅色跑車', desc: '黑車頂、兩條白線', g: '跑車', fac: 'garage', cls: 3, price: 150000, w: 22, h: 31 },
    sport2: { name: '敞篷跑車', desc: '沒有車頂、看得到座椅', g: '跑車', fac: 'garage', cls: 3, price: 250000, w: 22, h: 31 },
    sport3: { name: 'GT 雙門', desc: '長車頭、斜背', g: '跑車', fac: 'garage', cls: 3, price: 400000, w: 22, h: 33 },
    jeep1: { name: '軍綠吉普', desc: '方方正正、後面備胎', g: '越野車', fac: 'garage', cls: 4, price: 120000, w: 22, h: 37 },
    jeep2: { name: '沙漠越野', desc: '車頂燈條、行李架', g: '越野車', fac: 'garage', cls: 4, price: 220000, w: 22, h: 37 },
    camper1: { name: '奶油露營車', desc: '行李架、天窗', g: '露營車', fac: 'garage', cls: 4, price: 180000, w: 24, h: 41 },
    camper2: { name: '露營巴士', desc: '雨棚、太陽能板', g: '露營車', fac: 'garage', cls: 4, price: 300000, w: 26, h: 49 },
    classic1: { name: '綠色老爺車', desc: '敞篷、皮椅、鍍鉻保險桿', g: '古董車', fac: 'garage', cls: 5, price: 600000, w: 20, h: 33 },
    classic2: { name: '酒紅老爺車', desc: '白邊輪胎、長車頭', g: '古董車', fac: 'garage', cls: 5, price: 1000000, w: 21, h: 35 },
    super1: { name: '黃色超跑', desc: '楔形、尾翼、進氣口', g: '超跑', fac: 'garage', cls: 5, price: 1600000, w: 24, h: 33 },
    super2: { name: '寬體橘超跑', desc: '更寬、大尾翼', g: '超跑', fac: 'garage', cls: 5, price: 2200000, w: 27, h: 33 },
    super3: { name: '消光黑超跑', desc: '金色尾翼、金色線', g: '超跑', fac: 'garage', cls: 5, price: 3000000, w: 24, h: 33 },
    row1: { name: '竹筏', desc: '竹子綁的', g: '小船', fac: 'dock', cls: 1, price: 500, w: 13, h: 19 },
    row2: { name: '獨木舟', desc: '一支槳', g: '小船', fac: 'dock', cls: 1, price: 900, w: 12, h: 24 },
    row3: { name: '小划艇', desc: '兩支槳、木頭座位', g: '小船', fac: 'dock', cls: 1, price: 1500, w: 13, h: 20 },
    row4: { name: '天鵝船', desc: '用腳踩的', g: '小船', fac: 'dock', cls: 1, price: 2200, w: 14, h: 21 },
    row5: { name: '立槳板', desc: '站著划', g: '小船', fac: 'dock', cls: 1, price: 3000, w: 9, h: 25 },
    motor1: { name: '動力小艇', desc: '後面掛馬達', g: '有馬達', fac: 'dock', cls: 2, price: 15000, w: 14, h: 30 },
    motor2: { name: '小漁船', desc: '漁網、船艙', g: '有馬達', fac: 'dock', cls: 2, price: 40000, w: 16, h: 30 },
    motor3: { name: '長蘿貨運的船', desc: '載滿蘿蔔', g: '有馬達', fac: 'dock', cls: 2, price: 75000, w: 18, h: 36 },
    sail1: { name: '小帆船', desc: '一面三角帆', g: '帆船', fac: 'dock', cls: 3, price: 45000, w: 11, h: 23 },
    sail2: { name: '單桅帆船', desc: '木甲板、收起來的帆', g: '帆船', fac: 'dock', cls: 3, price: 90000, w: 14, h: 34 },
    sail3: { name: '雙體帆船', desc: '兩個船身、中間網子', g: '帆船', fac: 'dock', cls: 3, price: 160000, w: 21, h: 31 },
    sail4: { name: '戎克船', desc: '紅色竹骨帆', g: '帆船', fac: 'dock', cls: 3, price: 250000, w: 18, h: 36 },
    yacht1: { name: '白色遊艇', desc: '木甲板、日光甲板', g: '遊艇', fac: 'dock', cls: 4, price: 500000, w: 20, h: 42 },
    yacht2: { name: '深藍遊艇', desc: '深藍船身、金線', g: '遊艇', fac: 'dock', cls: 4, price: 800000, w: 20, h: 42 },
    yacht3: { name: '雙體遊艇', desc: '很寬、很穩', g: '遊艇', fac: 'dock', cls: 4, price: 1100000, w: 26, h: 42 },
    yacht4: { name: '釣魚遊艇', desc: '塔架、兩根外伸竿', g: '遊艇', fac: 'dock', cls: 4, price: 1600000, w: 33, h: 40 },
    show1: { name: '超級遊艇', desc: '直升機坪、按摩池、雷達球', g: '展示級', fac: 'dock', cls: 5, price: 8000000, w: 32, h: 77 },
    show2: { name: '古董木船', desc: '1930 年代桃花心木遊艇', g: '展示級', fac: 'dock', cls: 5, price: 3000000, w: 23, h: 63 },
    show3: { name: '古典三桅帆船', desc: '張開的方帆、雕花船尾', g: '展示級', fac: 'dock', cls: 5, price: 5000000, w: 44, h: 74 },
    // 飛機、火箭（第三批）。火箭是立起來畫的：ax、ay 是圖裡的地面點，擺的時候對齊位子的底部中間；free 的不比大小（飄在天上的、火箭）
    fly1: { name: '熱氣球', desc: '紅白條紋', g: '小飛行器', fac: 'airfield', cls: 1, price: 5000, w: 37, h: 39, free: 1 },
    fly2: { name: '動力傘', desc: '背著螺旋槳飛', g: '小飛行器', fac: 'airfield', cls: 1, price: 8000, w: 32, h: 19 },
    fly3: { name: '超輕航機', desc: '布翼、小座艙', g: '小飛行器', fac: 'airfield', cls: 1, price: 15000, w: 34, h: 17 },
    fly4: { name: '滑翔機', desc: '超長的細翼、沒有引擎', g: '小飛行器', fac: 'airfield', cls: 1, price: 25000, w: 51, h: 28 },
    fly5: { name: '自轉旋翼機', desc: '上面旋翼、後面推', g: '小飛行器', fac: 'airfield', cls: 1, price: 45000, w: 29, h: 28 },
    heli1: { name: '小直升機', desc: '圓泡泡艙', g: '直升機', fac: 'airfield', cls: 2, price: 150000, w: 29, h: 33 },
    heli2: { name: '藍色直升機', desc: '最常見的那種', g: '直升機', fac: 'airfield', cls: 2, price: 250000, w: 31, h: 37 },
    heli3: { name: '救援直升機', desc: '白紅橘、吊掛門', g: '直升機', fac: 'airfield', cls: 2, price: 400000, w: 31, h: 45 },
    heli4: { name: '商務直升機', desc: '黑金、五片旋翼', g: '直升機', fac: 'airfield', cls: 2, price: 600000, w: 30, h: 46 },
    heli5: { name: '雙旋翼直升機', desc: '前後兩組旋翼', g: '直升機', fac: 'airfield', cls: 2, price: 700000, w: 26, h: 47 },
    prop1: { name: '小飛機', desc: '上單翼、白藍', g: '小飛機', fac: 'airfield', cls: 3, price: 500000, w: 37, h: 35 },
    prop2: { name: '水上飛機', desc: '兩根浮筒', g: '小飛機', fac: 'airfield', cls: 3, price: 800000, w: 37, h: 35 },
    prop3: { name: '特技飛機', desc: '下單翼、紅白格子', g: '小飛機', fac: 'airfield', cls: 3, price: 1100000, w: 33, h: 28 },
    prop4: { name: '古董雙翼機', desc: '兩層翼、圓引擎罩', g: '小飛機', fac: 'airfield', cls: 3, price: 1600000, w: 36, h: 30 },
    jet1: { name: '白色噴射機', desc: 'T 尾、後段引擎', g: '噴射機', fac: 'airfield', cls: 4, price: 3000000, w: 41, h: 46 },
    jet2: { name: '深藍金線', desc: '深藍機身、金色 T 尾', g: '噴射機', fac: 'airfield', cls: 4, price: 4000000, w: 41, h: 46 },
    jet3: { name: '消光黑金', desc: '消光黑、金色線', g: '噴射機', fac: 'airfield', cls: 4, price: 5500000, w: 41, h: 46 },
    jet4: { name: '長程商務機', desc: '更長、翼尖小翼', g: '噴射機', fac: 'airfield', cls: 4, price: 8000000, w: 50, h: 55 },
    airshow1: { name: '私人豪華客機', desc: '四顆引擎、雙層前段、朱色小翼、金色線、尾翼徽章', g: '展示級', fac: 'airfield', cls: 5, price: 24000000, w: 74, h: 80 },
    airshow2: { name: '古典飛行艇', desc: '1930 年代、拋光銀色船身、四顆星形引擎、翼下浮筒', g: '展示級', fac: 'airfield', cls: 5, price: 12000000, w: 77, h: 70 },
    airshow3: { name: '豪華飛艇', desc: '雪茄形、金環、朱色尾翼、上面玻璃觀景台；在天上飄', g: '展示級', fac: 'airfield', cls: 5, price: 18000000, w: 47, h: 104, free: 1 },
    rks1: { name: '入門探空火箭', desc: '白身朱鼻、三片尾翼；最便宜', g: '小型（探空）', fac: 'launchpad', cls: 1, price: 400000, w: 22, h: 38, ax: 5, ay: 30, free: 1 },
    rks2: { name: '雙節探空火箭', desc: '下面一節推完會掉、上面再飛', g: '小型（探空）', fac: 'launchpad', cls: 1, price: 550000, w: 25, h: 46, ax: 7, ay: 38, free: 1 },
    rks3: { name: '氣象探空火箭', desc: '頭上有天線、儀器艙兩個小窗', g: '小型（探空）', fac: 'launchpad', cls: 1, price: 700000, w: 21, h: 45, ax: 4, ay: 37, free: 1 },
    rks4: { name: '黑白方格探空火箭', desc: '經典的黑白方格塗裝', g: '小型（探空）', fac: 'launchpad', cls: 1, price: 900000, w: 25, h: 42, ax: 7, ay: 34, free: 1 },
    rks5: { name: '朱漆探空火箭', desc: '「絆號」：全身朱色、金色鼻錐', g: '小型（探空）', fac: 'launchpad', cls: 1, price: 1200000, w: 22, h: 43, ax: 5, ay: 35, free: 1 },
    rkm1: { name: '標準運載火箭', desc: '兩顆小推進器、有舷窗', g: '中型（運載）', fac: 'launchpad', cls: 2, price: 2000000, w: 31, h: 76, ax: 8, ay: 68, free: 1 },
    rkm2: { name: '大整流罩運載火箭', desc: '頭特別大，裝得下大衛星', g: '中型（運載）', fac: 'launchpad', cls: 2, price: 3000000, w: 31, h: 77, ax: 8, ay: 69, free: 1 },
    rkm3: { name: '可回收運載火箭', desc: '柵格翼＋收起來的降落腳，底部燒黑', g: '中型（運載）', fac: 'launchpad', cls: 2, price: 4000000, w: 25, h: 79, ax: 6, ay: 71, free: 1 },
    rkm4: { name: '橘槽運載火箭', desc: '橘色燃料槽、白色推進器', g: '中型（運載）', fac: 'launchpad', cls: 2, price: 5000000, w: 31, h: 78, ax: 8, ay: 70, free: 1 },
    rkm5: { name: '夜空藍運載火箭', desc: '深藍配金環、金鼻錐', g: '中型（運載）', fac: 'launchpad', cls: 2, price: 6000000, w: 31, h: 74, ax: 8, ay: 66, free: 1 },
    rkl1: { name: '四推進器重型火箭', desc: '發射台參階那一枚；後面還有兩顆推進器', g: '大型（重型）', fac: 'launchpad', cls: 3, price: 8000000, w: 39, h: 111, ax: 12, ay: 103, free: 1 },
    rkl2: { name: '三芯重型火箭', desc: '三根一樣的芯並排，兩邊會飛回來降落', g: '大型（重型）', fac: 'launchpad', cls: 3, price: 11000000, w: 41, h: 112, ax: 14, ay: 104, free: 1 },
    rkl3: { name: '多節重型火箭', desc: '三節一路變細、黑白方格；最高', g: '大型（重型）', fac: 'launchpad', cls: 3, price: 14000000, w: 33, h: 120, ax: 11, ay: 112, free: 1 },
    rkl4: { name: '太空梭', desc: '橘色大燃料槽＋兩根推進器，三角翼', g: '大型（重型）', fac: 'launchpad', cls: 3, price: 17000000, w: 41, h: 102, ax: 13, ay: 94, free: 1 },
    rkl5: { name: '金箔重型火箭', desc: '上段包金箔、金鼻錐；重型裡最貴', g: '大型（重型）', fac: 'launchpad', cls: 3, price: 20000000, w: 39, h: 109, ax: 12, ay: 101, free: 1 },
  };
  const VEH_KEYS = Object.keys(VEH);

  // ---------- 屋內（第四批） ----------
  // 家具：furniture.html 的 40 款（tools/xiaodao/dump_furniture.js 畫成 assets/xiaodao/furn.png；colors[].d 是白天那張在圖裡的 [x, y, 寬, 高]，nt 是晚上亮燈那張）
  // w、h 是占幾格（一格 10 顆）；kind：four 四個方向、two 直放橫放、one 不用轉、wall 貼牆（自動面向房間）、pic 掛北牆、rug 地板層（可以轉）、rugone 地板層
  // 豪華的要先有洋房（企劃書：四柱床要先有洋房）
  const FURN = {
    bed1: { name: '單人木床', cat: '床', tier: '平價', note: '', w: 2, h: 4, kind: 'four', price: 1500, colors: [{ n: '淺木・藍', sw: '#6f8fa8', d: [0,0,20,40] },{ n: '胡桃木・綠', sw: '#7a9a55', d: [21,0,20,40] },{ n: '白・米', sw: '#d8c7a8', d: [42,0,20,40] }] },
    bed2: { name: '雙人床', cat: '床', tier: '高級', note: '', w: 3, h: 4, kind: 'four', price: 9000, colors: [{ n: '胡桃木・朱', sw: '#b33a2f', d: [63,0,30,40] },{ n: '淺木・深藍', sw: '#2f4166', d: [94,0,30,40] },{ n: '白・灰', sw: '#8e9396', d: [125,0,30,40] }] },
    bed3: { name: '四柱床', cat: '床', tier: '豪華', note: '', w: 4, h: 4, kind: 'four', price: 120000, colors: [{ n: '胡桃木・金', sw: '#c9a24a', d: [156,0,40,40] },{ n: '黑・朱', sw: '#b33a2f', d: [197,0,40,40] },{ n: '白・米', sw: '#d8c7a8', d: [238,0,40,40] }] },
    lamp1: { name: '床頭櫃', cat: '燈', tier: '平價', note: '附小燈', w: 1, h: 1, kind: 'wall', price: 600, colors: [{ n: '淺木', sw: '#c48d5c', d: [279,0,10,10], nt: [290,0,10,10] },{ n: '胡桃木', sw: '#8a5a34', d: [301,0,10,10], nt: [312,0,10,10] },{ n: '白', sw: '#efe9df', d: [323,0,10,10], nt: [334,0,10,10] }] },
    lamp2: { name: '立燈', cat: '燈', tier: '平價', note: '', w: 1, h: 1, kind: 'one', price: 800, colors: [{ n: '米', sw: '#d8c7a8', d: [345,0,10,10], nt: [356,0,10,10] },{ n: '灰', sw: '#8e9396', d: [367,0,10,10], nt: [378,0,10,10] },{ n: '朱', sw: '#b33a2f', d: [389,0,10,10], nt: [400,0,10,10] }] },
    lamp3: { name: '弧形落地燈', cat: '燈', tier: '高級', note: '', w: 2, h: 2, kind: 'one', price: 6000, colors: [{ n: '米', sw: '#d8c7a8', d: [411,0,20,20], nt: [432,0,20,20] },{ n: '金', sw: '#c9a24a', d: [453,0,20,20], nt: [474,0,20,20] },{ n: '灰', sw: '#8e9396', d: [0,41,20,20], nt: [21,41,20,20] }] },
    store1: { name: '雙門衣櫃', cat: '收納', tier: '平價', note: '', w: 2, h: 1, kind: 'wall', price: 1500, colors: [{ n: '淺木', sw: '#c48d5c', d: [42,41,20,10] },{ n: '胡桃木', sw: '#8a5a34', d: [63,41,20,10] },{ n: '白', sw: '#efe9df', d: [84,41,20,10] }] },
    store2: { name: '三門大衣櫃', cat: '收納', tier: '高級', note: '中間是鏡子', w: 3, h: 1, kind: 'wall', price: 12000, colors: [{ n: '胡桃木', sw: '#8a5a34', d: [105,41,30,10] },{ n: '白', sw: '#efe9df', d: [136,41,30,10] },{ n: '黑', sw: '#3d3a38', d: [167,41,30,10] }] },
    store3: { name: '矮書櫃', cat: '收納', tier: '平價', note: '', w: 2, h: 1, kind: 'wall', price: 1200, colors: [{ n: '淺木', sw: '#c48d5c', d: [198,41,20,10] },{ n: '胡桃木', sw: '#8a5a34', d: [219,41,20,10] },{ n: '黑', sw: '#3d3a38', d: [240,41,20,10] }] },
    store4: { name: '整面書牆', cat: '收納', tier: '高級', note: '', w: 3, h: 1, kind: 'wall', price: 13000, colors: [{ n: '胡桃木', sw: '#8a5a34', d: [261,41,30,10] },{ n: '黑', sw: '#3d3a38', d: [292,41,30,10] },{ n: '白', sw: '#efe9df', d: [323,41,30,10] }] },
    store5: { name: '玻璃小櫃', cat: '收納', tier: '平價', note: '展示櫃', w: 2, h: 1, kind: 'wall', price: 2000, colors: [{ n: '淺木', sw: '#c48d5c', d: [354,41,20,10] },{ n: '胡桃木', sw: '#8a5a34', d: [375,41,20,10] },{ n: '黑', sw: '#3d3a38', d: [396,41,20,10] }] },
    store6: { name: '金框大展示櫃', cat: '收納', tier: '豪華', note: '展示櫃', w: 3, h: 1, kind: 'wall', price: 80000, colors: [{ n: '原色', sw: '#9a6a40', d: [417,41,30,10] }] },
    table1: { name: '木書桌', cat: '桌椅', tier: '平價', note: '附檯燈', w: 3, h: 1, kind: 'four', price: 1500, colors: [{ n: '淺木', sw: '#c48d5c', d: [448,41,30,10], nt: [479,41,30,10] },{ n: '胡桃木', sw: '#8a5a34', d: [0,62,30,10], nt: [31,62,30,10] },{ n: '白', sw: '#efe9df', d: [62,62,30,10], nt: [93,62,30,10] }] },
    table2: { name: '電腦桌', cat: '桌椅', tier: '高級', note: '螢幕鍵盤', w: 3, h: 1, kind: 'four', price: 8000, colors: [{ n: '黑', sw: '#3d3a38', d: [124,62,30,10], nt: [155,62,30,10] },{ n: '白', sw: '#efe9df', d: [186,62,30,10], nt: [217,62,30,10] },{ n: '胡桃木', sw: '#8a5a34', d: [248,62,30,10], nt: [279,62,30,10] }] },
    table3: { name: '木椅凳', cat: '桌椅', tier: '平價', note: '', w: 1, h: 1, kind: 'one', price: 500, colors: [{ n: '淺木', sw: '#c48d5c', d: [310,62,10,10] },{ n: '胡桃木', sw: '#8a5a34', d: [321,62,10,10] },{ n: '黑', sw: '#3d3a38', d: [332,62,10,10] }] },
    table4: { name: '靠背椅', cat: '桌椅', tier: '高級', note: '', w: 1, h: 1, kind: 'four', price: 4500, colors: [{ n: '淺木・朱', sw: '#b33a2f', d: [343,62,10,10] },{ n: '胡桃木・綠', sw: '#7a9a55', d: [354,62,10,10] },{ n: '黑・米', sw: '#d8c7a8', d: [365,62,10,10] }] },
    table5: { name: '木茶几', cat: '桌椅', tier: '平價', note: '', w: 2, h: 1, kind: 'two', price: 1000, colors: [{ n: '淺木', sw: '#c48d5c', d: [376,62,20,10] },{ n: '胡桃木', sw: '#8a5a34', d: [397,62,20,10] },{ n: '白', sw: '#efe9df', d: [418,62,20,10] }] },
    table6: { name: '玻璃茶几', cat: '桌椅', tier: '高級', note: '', w: 3, h: 2, kind: 'two', price: 7000, colors: [{ n: '胡桃木', sw: '#8a5a34', d: [439,62,30,20] },{ n: '黑', sw: '#3d3a38', d: [470,62,30,20] },{ n: '淺木', sw: '#c48d5c', d: [0,83,30,20] }] },
    table7: { name: '四人方桌', cat: '桌椅', tier: '平價', note: '', w: 4, h: 4, kind: 'one', price: 2000, colors: [{ n: '淺木', sw: '#c48d5c', d: [31,83,40,40] },{ n: '胡桃木', sw: '#8a5a34', d: [72,83,40,40] },{ n: '白', sw: '#efe9df', d: [113,83,40,40] }] },
    table8: { name: '六人長桌', cat: '桌椅', tier: '高級', note: '', w: 6, h: 4, kind: 'two', price: 15000, colors: [{ n: '胡桃木', sw: '#8a5a34', d: [154,83,60,40] },{ n: '淺木', sw: '#c48d5c', d: [215,83,60,40] },{ n: '黑', sw: '#3d3a38', d: [276,83,60,40] }] },
    sofa1: { name: '布單人椅', cat: '沙發', tier: '平價', note: '', w: 1, h: 1, kind: 'four', price: 1200, colors: [{ n: '綠', sw: '#7a9a55', d: [337,83,10,10] },{ n: '米', sw: '#d8c7a8', d: [348,83,10,10] },{ n: '藍', sw: '#6f8fa8', d: [359,83,10,10] }] },
    sofa2: { name: '高背扶手椅', cat: '沙發', tier: '豪華', note: '', w: 2, h: 2, kind: 'four', price: 50000, colors: [{ n: '朱', sw: '#b33a2f', d: [370,83,20,20] },{ n: '深藍', sw: '#2f4166', d: [391,83,20,20] },{ n: '皮革咖啡', sw: '#7c4a2a', d: [412,83,20,20] }] },
    sofa3: { name: '雙人布沙發', cat: '沙發', tier: '平價', note: '', w: 3, h: 2, kind: 'four', price: 2000, colors: [{ n: '米', sw: '#d8c7a8', d: [433,83,30,20] },{ n: '藍', sw: '#6f8fa8', d: [464,83,30,20] },{ n: '綠', sw: '#7a9a55', d: [0,124,30,20] }] },
    sofa4: { name: '三人皮沙發', cat: '沙發', tier: '高級', note: '', w: 5, h: 2, kind: 'four', price: 12000, colors: [{ n: '皮革咖啡', sw: '#7c4a2a', d: [31,124,50,20] },{ n: '灰', sw: '#8e9396', d: [82,124,50,20] },{ n: '深藍', sw: '#2f4166', d: [133,124,50,20] }] },
    sofa5: { name: 'L 型沙發', cat: '沙發', tier: '豪華', note: '', w: 5, h: 4, kind: 'four', price: 160000, colors: [{ n: '灰', sw: '#8e9396', d: [184,124,50,40] },{ n: '米', sw: '#d8c7a8', d: [235,124,50,40] },{ n: '深藍', sw: '#2f4166', d: [286,124,50,40] }] },
    tv1: { name: '小電視櫃', cat: '電視', tier: '平價', note: '', w: 3, h: 1, kind: 'wall', price: 1800, colors: [{ n: '淺木', sw: '#c48d5c', d: [337,124,30,10] },{ n: '胡桃木', sw: '#8a5a34', d: [368,124,30,10] },{ n: '白', sw: '#efe9df', d: [399,124,30,10] }] },
    tv2: { name: '大電視＋音響', cat: '電視', tier: '豪華', note: '', w: 5, h: 1, kind: 'wall', price: 90000, colors: [{ n: '黑', sw: '#3d3a38', d: [430,124,50,10] },{ n: '胡桃木', sw: '#8a5a34', d: [0,165,50,10] },{ n: '白', sw: '#efe9df', d: [51,165,50,10] }] },
    rug1: { name: '長方地毯', cat: '地毯', tier: '高級', note: '地板層', w: 6, h: 4, kind: 'rug', price: 6000, colors: [{ n: '朱', sw: '#b33a2f', d: [102,165,60,40] },{ n: '深藍', sw: '#2f4166', d: [163,165,60,40] },{ n: '綠', sw: '#7a9a55', d: [224,165,60,40] }] },
    rug2: { name: '圓地毯', cat: '地毯', tier: '平價', note: '地板層', w: 4, h: 4, kind: 'rugone', price: 1500, colors: [{ n: '深藍', sw: '#2f4166', d: [285,165,40,40] },{ n: '米', sw: '#d8c7a8', d: [326,165,40,40] },{ n: '朱', sw: '#b33a2f', d: [367,165,40,40] }] },
    rug3: { name: '走道長毯', cat: '地毯', tier: '平價', note: '地板層', w: 2, h: 6, kind: 'rug', price: 1200, colors: [{ n: '朱', sw: '#b33a2f', d: [408,165,20,60] },{ n: '藍', sw: '#6f8fa8', d: [429,165,20,60] },{ n: '米', sw: '#d8c7a8', d: [450,165,20,60] }] },
    plant1: { name: '小盆栽', cat: '盆栽', tier: '平價', note: '', w: 1, h: 1, kind: 'one', price: 500, colors: [{ n: '原色', sw: '#9a6a40', d: [471,165,10,10] }] },
    plant2: { name: '小橘子樹', cat: '盆栽', tier: '高級', note: '', w: 1, h: 1, kind: 'one', price: 5000, colors: [{ n: '原色', sw: '#9a6a40', d: [482,165,10,10] }] },
    plant3: { name: '龜背芋', cat: '盆栽', tier: '高級', note: '', w: 2, h: 2, kind: 'one', price: 6000, colors: [{ n: '原色', sw: '#9a6a40', d: [0,226,20,20] }] },
    kitchen1: { name: '流理台', cat: '廚房', tier: '平價', note: '靠牆', w: 3, h: 1, kind: 'wall', price: 1500, colors: [{ n: '原色', sw: '#9a6a40', d: [21,226,30,10] }] },
    kitchen2: { name: '水槽', cat: '廚房', tier: '平價', note: '靠牆', w: 1, h: 1, kind: 'wall', price: 800, colors: [{ n: '原色', sw: '#9a6a40', d: [52,226,10,10] }] },
    kitchen3: { name: '瓦斯爐', cat: '廚房', tier: '平價', note: '靠牆', w: 1, h: 1, kind: 'wall', price: 1000, colors: [{ n: '原色', sw: '#9a6a40', d: [63,226,10,10] }] },
    kitchen4: { name: '單門冰箱', cat: '廚房', tier: '平價', note: '', w: 1, h: 1, kind: 'wall', price: 1800, colors: [{ n: '白', sw: '#efe9df', d: [74,226,10,10] },{ n: '黑', sw: '#3d3a38', d: [85,226,10,10] },{ n: '淺木', sw: '#c48d5c', d: [96,226,10,10] }] },
    kitchen5: { name: '雙門大冰箱', cat: '廚房', tier: '高級', note: '', w: 2, h: 1, kind: 'wall', price: 9000, colors: [{ n: '白', sw: '#efe9df', d: [107,226,20,10] },{ n: '黑', sw: '#3d3a38', d: [128,226,20,10] }] },
    pic1: { name: '風景畫', cat: '掛畫', tier: '平價', note: '掛北牆', w: 2, h: 0, kind: 'pic', price: 1500, colors: [{ n: '原色', sw: '#9a6a40', d: [149,226,20,16] }] },
    pic2: { name: '浣熊大王肖像', cat: '掛畫', tier: '高級', note: '掛北牆', w: 1, h: 0, kind: 'pic', price: 8000, colors: [{ n: '原色', sw: '#9a6a40', d: [170,226,10,16] }] },
  };
  const FURN_KEYS = Object.keys(FURN), FURN_LUX_HOUSE = 4, FURN_MAX = 300;
  // 地板、壁紙：木地板、米色條紋送的，其他買一次就每一間都能用
  const FLOORS = [{ n: '淺色木', p: 2000 }, { n: '木地板', p: 0 }, { n: '深色木', p: 3000 }, { n: '格子磁磚', p: 2500 }, { n: '大理石', p: 7500 }, { n: '榻榻米', p: 5000 }];
  const PAPERS = [{ n: '米色條紋', p: 0 }, { n: '薄荷綠', p: 1500 }, { n: '金點', p: 3500 }, { n: '深藍', p: 2500 }, { n: '和紙', p: 5000 }, { n: '紅磚', p: 4000 }];
  const STYLE0 = { floor: 1, paper: 0 };
  // 每一階的家有哪幾層、哪幾間（格數；block 是樓梯，不能擺）。同一個 id 的房間升級後還在，裡面的家具擺得下就留著
  const ROOMS = [null,
    [{ n: '帳篷', rooms: [{ id: 'main', name: '帳篷裡', w: 6, h: 5 }] }],
    [{ n: '木屋', rooms: [{ id: 'main', name: '小木屋', w: 10, h: 7 }] }],
    [{ n: '平房', rooms: [{ id: 'main', name: '客廳', w: 10, h: 8 }, { id: 'bed', name: '臥室', w: 8, h: 8 }] }],
    [{ n: '一樓', rooms: [{ id: 'main', name: '客廳', w: 13, h: 12, block: [[11, 8, 2, 4]] }, { id: 'kitchen', name: '廚房', w: 9, h: 12 }] },
     { n: '二樓', rooms: [{ id: 'bed', name: '臥室', w: 12, h: 12, block: [[0, 8, 2, 4]] }, { id: 'study', name: '書房', w: 10, h: 12 }] }],
    [{ n: '一樓', rooms: [{ id: 'main', name: '客廳', w: 13, h: 12, block: [[11, 8, 2, 4]] }, { id: 'kitchen', name: '廚房', w: 8, h: 12 }, { id: 'dining', name: '餐廳', w: 9, h: 12 }] },
     { n: '二樓', rooms: [{ id: 'bed', name: '主臥', w: 12, h: 12, block: [[0, 8, 2, 4]] }, { id: 'study', name: '書房', w: 9, h: 12 }, { id: 'guest', name: '客房', w: 9, h: 12 }] }],
  ];
  // ---------- 衣服、藏品（第五批） ----------
  // 衣服：clothes.html 的 20 款（tools/xiaodao/dump_items.js → assets/xiaodao/clothes.png，colors[].d 是圖裡的位置）。一模一樣的（同款同色）疊在同一格記數量
  const CLOTH = {
    top1: { name: '素T', cat: '上衣', tier: '平價', note: '', price: 300, colors: [{ n: '白', sw: '#f3f1ec', d: [0,0,24,28] },{ n: '黑', sw: '#3d3a38', d: [25,0,24,28] },{ n: '灰', sw: '#a9aeb1', d: [50,0,24,28] }] },
    top2: { name: '條紋T', cat: '上衣', tier: '平價', note: '', price: 400, colors: [{ n: '白底藍條', sw: '#f3f1ec', d: [75,0,24,28] },{ n: '白底朱條', sw: '#f3f1ec', d: [100,0,24,28] },{ n: '深藍白條', sw: '#2f4166', d: [125,0,24,28] }] },
    top3: { name: '背心', cat: '上衣', tier: '平價', note: '', price: 300, colors: [{ n: '白', sw: '#f3f1ec', d: [150,0,24,28] },{ n: '黑', sw: '#3d3a38', d: [175,0,24,28] },{ n: '卡其', sw: '#c9b48a', d: [200,0,24,28] }] },
    top4: { name: '丼步喱T', cat: '上衣', tier: '高級', note: '胸口一顆朱印', price: 2500, colors: [{ n: '白', sw: '#f3f1ec', d: [225,0,24,28] },{ n: '米', sw: '#e8dbc2', d: [250,0,24,28] },{ n: '墨', sw: '#4a4a4a', d: [275,0,24,28] }] },
    top5: { name: '長袖襯衫', cat: '上衣', tier: '高級', note: '', price: 2000, colors: [{ n: '淺藍', sw: '#a9c6da', d: [300,0,24,28] },{ n: '粉', sw: '#f0c4bc', d: [325,0,24,28] },{ n: '格子綠', sw: '#7a9a55', d: [350,0,24,28] }] },
    top6: { name: '麻花毛衣', cat: '上衣', tier: '高級', note: '', price: 4000, colors: [{ n: '米白', sw: '#efe4cf', d: [375,0,24,28] },{ n: '芥末黃', sw: '#d4a83a', d: [400,0,24,28] },{ n: '酒紅', sw: '#8f2c23', d: [425,0,24,28] }] },
    top7: { name: '連帽衫', cat: '上衣', tier: '平價', note: '', price: 800, colors: [{ n: '灰', sw: '#a9aeb1', d: [450,0,24,28] },{ n: '枯茶', sw: '#8e8070', d: [475,0,24,28] },{ n: '深藍', sw: '#2f4166', d: [0,29,24,28] }] },
    coat1: { name: '牛仔外套', cat: '外套', tier: '高級', note: '', price: 6000, colors: [{ n: '淺藍', sw: '#7d9cbd', d: [25,29,24,28] },{ n: '深藍', sw: '#3d5a80', d: [50,29,24,28] },{ n: '黑', sw: '#3d3a38', d: [75,29,24,28] }] },
    coat2: { name: '風衣', cat: '外套', tier: '豪華', note: '', price: 25000, colors: [{ n: '卡其', sw: '#c9a878', d: [100,29,24,28] },{ n: '黑', sw: '#3d3a38', d: [125,29,24,28] },{ n: '深綠', sw: '#4f6040', d: [150,29,24,28] }] },
    coat3: { name: '羽絨外套', cat: '外套', tier: '豪華', note: '', price: 30000, colors: [{ n: '黑', sw: '#3d3a38', d: [175,29,24,28] },{ n: '朱', sw: '#b33a2f', d: [200,29,24,28] },{ n: '白', sw: '#ece9e2', d: [225,29,24,28] }] },
    coat4: { name: '西裝外套', cat: '外套', tier: '豪華', note: '', price: 40000, colors: [{ n: '深藍', sw: '#2f4166', d: [250,29,24,28] },{ n: '炭灰', sw: '#4a4d52', d: [275,29,24,28] },{ n: '米', sw: '#d8c7a8', d: [300,29,24,28] }] },
    bottom1: { name: '牛仔褲', cat: '下身', tier: '平價', note: '', price: 800, colors: [{ n: '淺藍', sw: '#7d9cbd', d: [325,29,24,28] },{ n: '深藍', sw: '#3d5a80', d: [350,29,24,28] },{ n: '黑', sw: '#3d3a38', d: [375,29,24,28] }] },
    bottom2: { name: '短褲', cat: '下身', tier: '平價', note: '', price: 500, colors: [{ n: '卡其', sw: '#c9b48a', d: [400,29,24,28] },{ n: '深藍', sw: '#2f4166', d: [425,29,24,28] },{ n: '綠', sw: '#7a9a55', d: [450,29,24,28] }] },
    bottom3: { name: '百褶裙', cat: '下身', tier: '高級', note: '', price: 3000, colors: [{ n: '格紋紅', sw: '#a8342a', d: [475,29,24,28] },{ n: '深藍', sw: '#2f4166', d: [0,58,24,28] },{ n: '米', sw: '#d8c7a8', d: [25,58,24,28] }] },
    bottom4: { name: '西裝褲', cat: '下身', tier: '高級', note: '', price: 4500, colors: [{ n: '炭灰', sw: '#4a4d52', d: [50,58,24,28] },{ n: '深藍', sw: '#2f4166', d: [75,58,24,28] },{ n: '米', sw: '#d8c7a8', d: [100,58,24,28] }] },
    dress1: { name: '浴衣', cat: '連身・和風', tier: '豪華', note: '', price: 20000, colors: [{ n: '深藍', sw: '#2f4166', d: [125,58,24,28] },{ n: '朱', sw: '#b33a2f', d: [150,58,24,28] },{ n: '白', sw: '#ece9e2', d: [175,58,24,28] }] },
    dress2: { name: '連身洋裝', cat: '連身・和風', tier: '高級', note: '', price: 5000, colors: [{ n: '碎花紅', sw: '#c0574a', d: [200,58,24,28] },{ n: '黑', sw: '#3d3a38', d: [225,58,24,28] },{ n: '薄荷', sw: '#9cc5b8', d: [250,58,24,28] }] },
    dress3: { name: '吊帶褲', cat: '連身・和風', tier: '平價', note: '', price: 700, colors: [{ n: '丹寧', sw: '#5a7aa0', d: [275,58,24,28] },{ n: '卡其', sw: '#b8a070', d: [300,58,24,28] },{ n: '紅', sw: '#a8342a', d: [325,58,24,28] }] },
    special1: { name: '船長外套', cat: '特別款', tier: '豪華', note: '跟青江菜船長同款', price: 60000, colors: [{ n: '白', sw: '#f3f1ec', d: [350,58,24,28] }] },
    special2: { name: '國王紅披風', cat: '特別款', tier: '豪華', note: '浣熊大王同款', price: 60000, colors: [{ n: '朱', sw: '#b33a2f', d: [375,58,24,28] },{ n: '深紫', sw: '#5a3a6a', d: [400,58,24,28] }] },
  };
  const CLOTH_KEYS = Object.keys(CLOTH), CLOTH_MAX = 300;
  // 藏品：collectibles.html 的 29 款，全部只能扭（使用者定的）；r 是稀有度 n 普通、r 稀有、l 傳說（assets/xiaodao/collect.png）
  const COLL = {
    c_julie: { name: '茱莉鴨', g: '公仔', r: 'r', d: [0,0,24,24] },
    c_appleduck: { name: '蘋果鴨', g: '公仔', r: 'r', d: [25,0,24,24] },
    c_raccoon: { name: '浣熊大王', g: '公仔', r: 'l', d: [50,0,24,24] },
    c_xiaowu: { name: '小吳鴨', g: '公仔', r: 'r', d: [75,0,24,24] },
    c_captain: { name: '青江菜船長', g: '公仔', r: 'r', d: [100,0,24,24] },
    c_cat: { name: '店貓', g: '公仔', r: 'n', d: [125,0,24,24] },
    c_dog: { name: '坐洗部的狗', g: '公仔', r: 'n', d: [150,0,24,24] },
    c_mole: { name: '鼴鼠', g: '公仔', r: 'n', d: [175,0,24,24] },
    c_nugget: { name: '雞塊', g: '公仔', r: 'n', d: [200,0,24,24] },
    c_goldspec: { name: '金塊標本', g: '礦坑標本', r: 'n', d: [225,0,24,24] },
    c_trilobite: { name: '三葉蟲化石', g: '礦坑標本', r: 'n', d: [250,0,24,24] },
    c_geode: { name: '紫水晶洞', g: '礦坑標本', r: 'r', d: [275,0,24,24] },
    c_diamond: { name: '鑽石原石', g: '礦坑標本', r: 'r', d: [300,0,24,24] },
    c_meteor: { name: '隕石碎片', g: '礦坑標本', r: 'l', d: [325,0,24,24] },
    c_shell: { name: '貝殼標本', g: '海上撿到的', r: 'n', d: [350,0,24,24] },
    c_bottle: { name: '伊藤的漂流瓶', g: '海上撿到的', r: 'n', d: [375,0,24,24] },
    c_coral: { name: '紅珊瑚', g: '海上撿到的', r: 'r', d: [400,0,24,24] },
    c_shipbottle: { name: '長蘿號瓶中船', g: '海上撿到的', r: 'r', d: [425,0,24,24] },
    c_goldcarrot: { name: '金蘿蔔', g: '海上撿到的', r: 'l', d: [450,0,24,24] },
    c_omamori: { name: '御守', g: '和風小物', r: 'n', d: [475,0,24,24] },
    c_fan: { name: '扇子', g: '和風小物', r: 'n', d: [0,25,24,24] },
    c_furin: { name: '風鈴', g: '和風小物', r: 'n', d: [25,25,24,24] },
    c_daruma: { name: '達摩不倒翁', g: '和風小物', r: 'r', d: [50,25,24,24] },
    c_bonsai: { name: '小盆景', g: '和風小物', r: 'r', d: [75,25,24,24] },
    c_kintsugi: { name: '金繼茶碗', g: '和風小物', r: 'l', d: [100,25,24,24] },
    c_router: { name: '28 樓的舊路由器', g: '27 樓的梗', r: 'n', d: [125,25,24,24] },
    c_oldticket: { name: '泛黃的入住券', g: '27 樓的梗', r: 'r', d: [150,25,24,24] },
    c_tower: { name: '27 樓大樓模型', g: '27 樓的梗', r: 'r', d: [175,25,24,24] },
    c_key: { name: '「絆」房的鑰匙', g: '27 樓的梗', r: 'l', d: [200,25,24,24] },
  };
  const COLL_KEYS = Object.keys(COLL);
  // 扭蛋：一次 $1,500（企劃書，第一批照工資調整過）。機率：普通 60%（12 款平分 5%）、稀有 32%（12 款平分約 2.67%）、傳說 7.5%（4 款平分約 1.88%）、「絆」房的鑰匙 0.5%（最低）
  const GACHA = { price: 1500, odds: { n: 60, r: 32, l: 7.5, key: 0.5 } };
  const RARE = { n: ['普通', '#c9c2b4'], r: ['稀有', '#c9a24a'], l: ['傳說', '#b33a2f'] };
  // 收納家具：衣櫃裝幾格衣服、展示櫃放幾件藏品（企劃書：衣櫃 12 格、玻璃小櫃 4 格、金框大展示櫃 8 格）
  const HOLD = { store1: { t: 'wr', n: 12 }, store2: { t: 'wr', n: 18 }, store5: { t: 'case', n: 4 }, store6: { t: 'case', n: 8 } };

  const CLS_NAME = { garage: ['', '兩輪', '轎車', '跑車', '大車', '展示級'], dock: ['', '小船', '有馬達的船', '帆船', '遊艇', '展示級'], airfield: ['', '小飛行器', '直升機', '小飛機', '噴射機', '展示級'], launchpad: ['', '小型火箭', '中型火箭', '大型火箭'] };

  const START = { house: 1 };                             // 一開始送帳篷

  // 島的等級：地塊（含一開始送的，送 12 塊）幾塊升一階；全部設施蓋到最高剛好要 40 塊，cap 是每種設施最高到幾級（0＝還不能蓋）
  const TIERS = [
    { name: '壹', n: 0,  cap: { house: 2, garage: 2, dock: 2, airfield: 0, launchpad: 0 } },
    { name: '貳', n: 16, cap: { house: 3, garage: 3, dock: 3, airfield: 2, launchpad: 0 } },
    { name: '參', n: 22, cap: { house: 4, garage: 4, dock: 4, airfield: 3, launchpad: 0 } },
    { name: '肆', n: 30, cap: { house: 5, garage: 5, dock: 5, airfield: 4, launchpad: 0 } },
    { name: '伍', n: 40, cap: { house: 5, garage: 5, dock: 5, airfield: 5, launchpad: 3 } },
  ];
  // 第 n 塊買的地（不算送的）：$2,000 × 1.1ⁿ，取到百位（第 1 塊 $2,200、第 10 塊約 $5,200、第 20 塊約 $1.35 萬、第 27 塊（到伍）約 $2.6 萬，買到伍加起來約 27 萬）
  // 2026-11-21 使用者說「土地太貴了」，從 $1,500 × 1.2ⁿ（買到伍約 123 萬、最後一塊 $20 萬）降成這個
  // 到伍（自己買第 27 塊，送的 13 塊＋27 塊＝40 塊）之後只是把島變大，每塊多 1% 就好（使用者 2026-11-21 先選 3%、11-22 改成 1%；原本一樣 10% 會漲到第 45 塊 $14.6 萬）
  const PLOT_BREAK = 27;
  const plotPrice = n => Math.round(2000 * Math.pow(1.1, Math.min(n, PLOT_BREAK)) * Math.pow(1.01, Math.max(0, n - PLOT_BREAK)) / 100) * 100;

  // ---------- 世界：地塊怎麼切 ----------
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  function vnoise(a, b, g, seed) {
    const i = Math.floor(a / g), j = Math.floor(b / g), u = a / g - i, v = b / g - j, s = t => t * t * (3 - 2 * t);
    const h = (x, y) => hash(x + seed * 101, y - seed * 37);
    return (h(i, j) * (1 - s(u)) + h(i + 1, j) * s(u)) * (1 - s(v)) + (h(i, j + 1) * (1 - s(u)) + h(i + 1, j + 1) * s(u)) * s(v);
  }
  const inSea = (px, py) => SEA.some(([x, y, w, h]) => px >= x && px < x + w && py >= y && py < y + h);

  let WORLD = null;
  function world() {
    if (WORLD) return WORLD;
    const N = GW * GH, raw = new Int32Array(N), seeds = [];
    for (let j = -1; j <= GH / 3 + 1; j++) for (let i = -1; i <= GW / 3 + 1; i++)
      seeds.push([i * 3 + 1.5 + (hash(i * 7 + SEED, j) - .5) * 2.4 + (j % 2) * 1.5, j * 3 + 1.5 + (hash(j * 5, i + SEED) - .5) * 2.4]);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const k = y * GW + x;
      if (inSea((x + .5) * C, (y + .5) * C)) { raw[k] = -1; continue; }
      let best = 1e9, bi = 0; const jit = (vnoise(x * C, y * C, 50, SEED) - .5) * 2.4;
      seeds.forEach(([a, b], s) => { const d = Math.hypot(x + .5 - a, y + .5 - b) + jit * (hash(s, SEED) - .5); if (d < best) { best = d; bi = s; } });
      raw[k] = bi;
    }
    // 同一個點被海切成兩半的，分成兩塊（連通的才算同一塊）
    const id = new Int32Array(N).fill(-1); let n = 0;
    for (let k = 0; k < N; k++) {
      if (raw[k] < 0 || id[k] >= 0) continue;
      const q = [k]; id[k] = n;
      while (q.length) { const c = q.pop(), x = c % GW, y = (c - x) / GW;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= GW || Y >= GH) return; const d = Y * GW + X; if (id[d] < 0 && raw[d] === raw[k]) { id[d] = n; q.push(d); } }); }
      n++;
    }
    // 太小的（被海切剩一兩格）併到旁邊最大的那塊
    const sizes = () => { const s = new Array(n).fill(0); for (let k = 0; k < N; k++) if (id[k] >= 0) s[id[k]]++; return s; };
    let size = sizes();
    for (let k = 0; k < N; k++) {
      const p = id[k]; if (p < 0 || size[p] >= 4) continue;
      const x = k % GW, y = (k - x) / GW; let best = -1;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= GW || Y >= GH) return; const q = id[Y * GW + X]; if (q >= 0 && q !== p && (best < 0 || size[q] > size[best])) best = q; });
      if (best >= 0) { for (let c = 0; c < N; c++) if (id[c] === p) id[c] = best; size = sizes(); }
    }
    // 重新編號 0..P-1
    const remap = new Map(); for (let k = 0; k < N; k++) if (id[k] >= 0 && !remap.has(id[k])) remap.set(id[k], remap.size);
    for (let k = 0; k < N; k++) if (id[k] >= 0) id[k] = remap.get(id[k]);
    const P = remap.size, cells = Array.from({ length: P }, () => []), nb = Array.from({ length: P }, () => new Set()), border = new Array(P).fill(false);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const k = y * GW + x, p = id[k]; if (p < 0) continue;
      cells[p].push(k);
      if (x <= 1 || y <= 1 || x >= GW - 2 || y >= GH - 2) border[p] = true;   // 世界邊邊那圈留給海
      if (x + 1 < GW) { const q = id[k + 1]; if (q >= 0 && q !== p) { nb[p].add(q); nb[q].add(p); } }
      if (y + 1 < GH) { const q = id[k + GW]; if (q >= 0 && q !== p) { nb[p].add(q); nb[q].add(p); } }
    }
    const center = cells.map(cs => { let sx = 0, sy = 0; cs.forEach(k => { sx += k % GW; sy += Math.floor(k / GW); }); return [(sx / cs.length + .5) * C, (sy / cs.length + .5) * C]; });
    WORLD = { id, P, cells, nb: nb.map(s => [...s].sort((a, b) => a - b)), border, center };
    WORLD.start = startPlots();
    return WORLD;
  }

  // ---------- 設施的位置 ----------
  // 某一級的圖放在哪（像素）：{ x, y, w, h, shore }（shore：碼頭、別墅的海岸線在第幾列，世界座標）
  function rect(key, lv) {
    const f = FAC[key], [w, h, sh] = f.sprites[lv - 1];
    if (f.mode === 'br') { const gap = sh != null ? sh - h : 2; return { x: f.ax - w, y: f.ay - gap - h, w, h }; }
    if (f.mode === 'bl') return { x: f.ax, y: f.ay - h, w, h };
    if (f.mode === 'bc') return { x: Math.round(f.ax - w / 2), y: f.ay - h, w, h };
    return { x: Math.round(f.ax - w / 2), y: f.ay - sh, w, h, shore: f.ay };   // shore：海岸線對齊
  }
  // 這一級要先有哪幾塊地（格子中心在圖裡的那幾格；碼頭只算岸上那段）
  function needPlots(key, lv) {
    const W = world(), r = rect(key, lv), out = new Set(), bad = [];
    const y1 = r.shore != null ? r.shore : r.y + r.h, y0 = r.shore != null ? Math.min(r.y, r.shore - C) : r.y + 3;   // 碼頭：岸邊那一排格子一定要是陸地
    for (let y = Math.floor(y0 / C); y < Math.ceil(y1 / C); y++) for (let x = Math.floor(r.x / C); x < Math.ceil((r.x + r.w) / C); x++) {
      const cx = (x + .5) * C, cy = (y + .5) * C;
      if (cx < r.x + 3 || cx > r.x + r.w - 3 || cy < y0 || cy > y1 - 1) continue;
      const p = W.id[y * GW + x]; if (p >= 0) out.add(p); else bad.push([x, y]);
    }
    return { plots: [...out].sort((a, b) => a - b), bad };
  }
  // 一開始送的地：帳篷、腳踏車棚、小木台底下那幾塊＋把它們連起來
  function startPlots() {
    const W = WORLD, own = new Set();
    [['house', 1], ['garage', 1], ['dock', 1]].forEach(([k, l]) => needPlots(k, l).plots.forEach(p => own.add(p)));
    // 用最短的地塊路徑把幾群連起來（BFS）
    const groups = () => { const g = new Map(); let n = 0; own.forEach(p => { if (g.has(p)) return; const q = [p]; g.set(p, n); while (q.length) { const c = q.pop(); W.nb[c].forEach(d => { if (own.has(d) && !g.has(d)) { g.set(d, n); q.push(d); } }); } n++; }); return { g, n }; };
    for (let guard = 0; guard < 10; guard++) {
      const { g, n } = groups(); if (n <= 1) break;
      const from = [...own].filter(p => g.get(p) === 0), prev = new Map(from.map(p => [p, -1])), q = from.slice(); let hit = -1;
      while (q.length && hit < 0) { const c = q.shift(); for (const d of W.nb[c]) { if (prev.has(d)) continue; prev.set(d, c); if (own.has(d) && g.get(d) !== 0) { hit = d; break; } q.push(d); } }
      if (hit < 0) break;
      for (let c = prev.get(hit); c >= 0 && !own.has(c); c = prev.get(c)) own.add(c);
    }
    return [...own].sort((a, b) => a - b);
  }

  // ---------- 存檔 ----------
  // { v: 1, items: [ { id: 'i1', key: 'island', plots: [擁有的地塊（含送的）], bought: 買過幾塊 },
  //                  { id: 'f-house', key: 'house', lv: 1, in: 'i1', at: 'house' }, … ] }
  // 設施的 at 先是工地的名字（位置固定）；之後開放移動，改成格子座標就好。
  function fresh() {
    const W = world();
    const items = [{ id: 'i1', key: 'island', plots: W.start.slice(), bought: 0 }];
    Object.keys(START).forEach(k => items.push({ id: 'f-' + k, key: k, lv: START[k], in: 'i1', at: k }));
    return { v: 1, items };
  }
  function clean(s) {   // 讀進來的存檔整理一下（壞掉的就重新開始）
    if (!s || s.v !== 1 || !Array.isArray(s.items)) return fresh();
    const W = world(), isl = s.items.find(i => i && i.key === 'island');
    if (!isl || !Array.isArray(isl.plots)) return fresh();
    const plots = [...new Set(W.start.concat(isl.plots.filter(p => Number.isInteger(p) && p >= 0 && p < W.P)))].sort((a, b) => a - b);
    const items = [{ id: 'i1', key: 'island', plots, bought: Math.max(0, Math.floor(Number(isl.bought) || 0)) }];
    FAC_KEYS.forEach(k => { const it = s.items.find(i => i && i.key === k), max = FAC[k].levels.length; const lv = it ? Math.max(0, Math.min(max, Math.floor(Number(it.lv) || 0))) : (START[k] || 0); if (lv) items.push({ id: 'f-' + k, key: k, lv, in: 'i1', at: k }); });
    const seenV = new Set();
    s.items.forEach(i => {
      if (!i || i.key === 'island' || FAC[i.key]) return;
      if (VEH[i.key]) {   // 車、船：每種一台；停的位子不對就收進寄放處
        if (seenV.has(i.key)) return; seenV.add(i.key);
        const v = { id: 'v-' + i.key, key: i.key, in: 'depot' }, f = VEH[i.key].fac, lv = (items.find(t => t.key === f) || {}).lv || 0;
        if (i.in === 'f-' + f && lv && FAC[f].slots && Number.isInteger(i.at) && i.at >= 0 && i.at < FAC[f].slots[lv - 1].length) { v.in = i.in; v.at = i.at; }
        items.push(v); return;
      }
      if (FURN[i.key]) {   // 家具：寄放的疊成一筆（qty），擺著的一件一筆；房間、位子不對的收回倉庫
        const nc = FURN[i.key].colors.length, c = Math.max(0, Math.min(nc - 1, Math.floor(Number(i.c) || 0)));
        if (i.in === 'depot') { const q = Math.max(0, Math.min(99, Math.floor(Number(i.qty) || 0))); if (q) addStack(items, i.key, c, q); return; }
        if (typeof i.in === 'string' && i.in.indexOf('room:') === 0 && Array.isArray(i.at) && /^u\d{1,6}$/.test(String(i.id))) { items.push({ id: i.id, key: i.key, c, in: i.in, at: [Math.floor(Number(i.at[0]) || 0), Math.floor(Number(i.at[1]) || 0)], rot: Math.floor(Number(i.rot) || 0) & 3 }); return; }
        addStack(items, i.key, c, 1); return;
      }
      if (CLOTH[i.key]) {   // 衣服：倉庫或某個衣櫃裡（疊數量）；衣櫃在不在、裝不裝得下最後 fixHolds() 再看
        const c = Math.max(0, Math.min(CLOTH[i.key].colors.length - 1, Math.floor(Number(i.c) || 0))), q = Math.max(0, Math.min(99, Math.floor(Number(i.qty) || 0)));
        if (q) addCloth(items, i.key, c, typeof i.in === 'string' && /^wr:u\d+$/.test(i.in) ? i.in : 'depot', q); return;
      }
      if (COLL[i.key]) {   // 藏品：倉庫的疊數量；擺在展示櫃的一件一筆
        if (typeof i.in === 'string' && /^case:u\d+$/.test(i.in) && Number.isInteger(i.at)) { if (!items.some(t => t.in === i.in && t.at === i.at && COLL[t.key])) items.push({ id: 'cp-' + i.in.slice(5) + '-' + i.at, key: i.key, in: i.in, at: i.at }); else addColl(items, i.key, 1); return; }
        const q = Math.max(0, Math.min(999, Math.floor(Number(i.qty) || 0))); if (q) addColl(items, i.key, q); return;
      }
      if (i.key === 'gstat') { if (!items.some(t => t.key === 'gstat')) items.push({ id: 'gstat', key: 'gstat', n: Math.max(0, Math.floor(Number(i.n) || 0)) }); return; }
      if (i.key === 'style' && typeof i.room === 'string' && /^[a-z]{1,12}$/.test(i.room)) { if (!items.some(t => t.key === 'style' && t.room === i.room)) items.push({ id: 'style-' + i.room, key: 'style', room: i.room, floor: Math.max(0, Math.min(FLOORS.length - 1, Math.floor(Number(i.floor) || 0))), paper: Math.max(0, Math.min(PAPERS.length - 1, Math.floor(Number(i.paper) || 0))) }); return; }
      if (i.key === 'deco') { const ok = (a, n) => (Array.isArray(a) ? a : []).filter(x => Number.isInteger(x) && x >= 0 && x < n); if (!items.some(t => t.key === 'deco')) items.push({ id: 'deco', key: 'deco', floors: [...new Set(ok(i.floors, FLOORS.length))], papers: [...new Set(ok(i.papers, PAPERS.length))] }); return; }
      items.push(i);   // 之後的東西（衣服、藏品…）原樣留著
    });
    // 同一格停了兩台的，後面那台收回寄放處
    const taken = new Set(); items.forEach(v => { if (!VEH[v.key] || v.in === 'depot') return; const t = v.in + ':' + v.at; if (taken.has(t)) { v.in = 'depot'; delete v.at; } else taken.add(t); });
    // 擺著的家具：房間不在了、位子不對、跟別的疊到，一件一件檢查，不行的收回倉庫
    const tmp = { v: 1, items }; const placed = items.filter(t => FURN[t.key] && t.in !== 'depot');
    placed.forEach(t => { t._skip = true; });
    placed.forEach(t => { delete t._skip; const rid = t.in.slice(5), chk = canPlace(tmp, rid, t.key, t.at[0], t.at[1], t.rot, t.id); if (!chk.ok) { tmp.items = tmp.items.filter(q => q !== t); addStack(tmp.items, t.key, t.c, 1); } else t.rot = chk.rot; });
    fixHolds(tmp);
    return { v: 1, items: tmp.items };
  }
  // ---- 衣服、藏品的小工具 ----
  function addCloth(items, key, c, where, q) {
    let st = items.find(t => t.key === key && t.c === c && t.in === where);
    if (!st) { st = { id: (where === 'depot' ? 'cd-' : 'w-') + key + '-' + c + (where === 'depot' ? '' : '-' + where.slice(3)), key, c, in: where, qty: 0 }; items.push(st); }
    const room = 99 - st.qty, add = Math.min(room, q); st.qty += add; return q - add;
  }
  function addColl(items, key, q) { let st = items.find(t => t.key === key && t.in === 'depot'); if (!st) { st = { id: 'cs-' + key, key, in: 'depot', qty: 0 }; items.push(st); } st.qty = Math.min(999, st.qty + q); }
  // 衣櫃、展示櫃（擺在屋裡的那一件）
  const holders = (s, t) => s.items.filter(i => FURN[i.key] && HOLD[i.key] && HOLD[i.key].t === t && i.in !== 'depot');
  const wrStacks = (s, uid) => s.items.filter(i => CLOTH[i.key] && i.in === 'wr:' + uid);
  const caseItems = (s, uid) => s.items.filter(i => COLL[i.key] && i.in === 'case:' + uid);
  // 衣櫃、展示櫃不見了（收回倉庫、賣掉、房間沒了）或裝太多：裡面的東西回倉庫
  function fixHolds(s) {
    const ok = new Map(holders(s, 'wr').concat(holders(s, 'case')).map(i => [i.id, i]));
    s.items.filter(i => CLOTH[i.key] && i.in !== 'depot').forEach(i => { const u = ok.get(i.in.slice(3)); if (!u || HOLD[u.key].t !== 'wr') { s.items = s.items.filter(t => t !== i); addCloth(s.items, i.key, i.c, 'depot', i.qty); } });
    holders(s, 'wr').forEach(u => { const st = wrStacks(s, u.id); st.slice(HOLD[u.key].n).forEach(i => { s.items = s.items.filter(t => t !== i); addCloth(s.items, i.key, i.c, 'depot', i.qty); }); });
    s.items.filter(i => COLL[i.key] && i.in !== 'depot').forEach(i => { const u = ok.get(i.in.slice(5)); if (!u || HOLD[u.key].t !== 'case' || !(i.at >= 0 && i.at < HOLD[u.key].n)) { s.items = s.items.filter(t => t !== i); addColl(s.items, i.key, 1); } });
  }
  const clothCount = s => s.items.reduce((n, t) => n + (CLOTH[t.key] ? t.qty : 0), 0);
  const collCount = (s, k) => s.items.reduce((n, t) => n + (t.key === k ? (t.in === 'depot' ? t.qty : 1) : 0), 0);
  const clothSell = k => Math.floor(CLOTH[k].price / 2);
  // 扭一次：rng 回 0～1（網頁用 Math.random，之後後端用自己的）
  function rollGacha(rng) {
    const o = GACHA.odds, x = rng() * 100;
    if (x < o.key) return 'c_key';
    const y = x - o.key, grp = y < o.n ? 'n' : y < o.n + o.r ? 'r' : 'l', list = COLL_KEYS.filter(k => COLL[k].r === grp && k !== 'c_key');
    return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  }
  function addStack(items, key, c, q) {
    let st = items.find(t => t.key === key && t.in === 'depot' && t.c === c);
    if (!st) { st = { id: 'd-' + key + '-' + c, key, c, in: 'depot', qty: 0 }; items.push(st); }
    st.qty = Math.min(99, st.qty + q);
  }
  const island = s => s.items.find(i => i.key === 'island');
  const level = (s, k) => { const it = s.items.find(i => i.key === k); return it ? it.lv : 0; };
  function tierOf(s) { const n = island(s).plots.length; let t = 0; TIERS.forEach((x, i) => { if (n >= x.n) t = i; }); return t; }
  const nextTier = s => TIERS[tierOf(s) + 1] || null;

  // 這塊地能不能買
  function plotInfo(s, p) {
    const W = world(), own = new Set(island(s).plots);
    if (!(p >= 0 && p < W.P)) return { ok: false, why: '沒有這塊地' };
    if (own.has(p)) return { ok: false, why: '已經是你的了', owned: true };
    if (W.border[p]) return { ok: false, why: '太外海了，船開不到' };
    const price = plotPrice(island(s).bought + 1), size = W.cells[p].length;
    if (!W.nb[p].some(q => own.has(q))) return { ok: false, why: '要跟你的地連著才能買', price, size };
    return { ok: true, price, size };
  }
  // 某種設施的下一級：能不能蓋、差什麼
  function facInfo(s, k) {
    const f = FAC[k]; if (!f) return { ok: false, why: '沒有這種設施' };
    const lv = level(s, k), max = f.levels.length;
    if (lv >= max) return { ok: false, lv, max: true, why: '已經是最高級了' };
    const nl = lv + 1, t = tierOf(s), cap = TIERS[t].cap[k] || 0, price = f.prices[nl - 1];
    const out = { lv, next: nl, name: f.levels[nl - 1], price };
    if (nl > cap) {
      const ti = TIERS.findIndex(x => (x.cap[k] || 0) >= nl);
      return Object.assign(out, { ok: false, needTier: ti, why: `島升到「${TIERS[ti].name}」才能蓋` });
    }
    if (f.needs) for (const q of Object.keys(f.needs)) if (level(s, q) < f.needs[q]) return Object.assign(out, { ok: false, why: `${FAC[q].name}要先蓋到「${FAC[q].levels[f.needs[q] - 1]}」` });
    const own = new Set(island(s).plots), miss = needPlots(k, nl).plots.filter(p => !own.has(p));
    if (miss.length) return Object.assign(out, { ok: false, miss, why: `工地還差 ${miss.length} 塊地` });
    return Object.assign(out, { ok: true });
  }

  // ---------- 屋內 ----------
  // 現在這一階的家有哪幾層、哪幾間：[{ n: '一樓', rooms: [...] }]；roomOf 找一間
  const floorsOf = s => ROOMS[level(s, 'house')] || [];
  const roomOf = (s, rid) => { for (const f of floorsOf(s)) for (const r of f.rooms) if (r.id === rid) return r; return null; };
  // 轉完之後占幾格 [寬, 高]（掛畫只占北牆）
  const fpOf = (k, rot) => { const f = FURN[k]; return rot & 1 ? [f.h, f.w] : [f.w, f.h]; };
  const layerOf = k => FURN[k].kind === 'pic' ? 'pic' : (FURN[k].kind === 'rug' || FURN[k].kind === 'rugone') ? 'rug' : 'obj';
  const placedIn = (s, rid) => s.items.filter(t => FURN[t.key] && t.in === 'room:' + rid && !t._skip);
  // 貼牆的家具：貼哪面牆就轉成面向房間（北 0、東 1、南 2、西 3）；prefer 是想要的方向，那面貼得到就用它
  function wallRots(room, k, x, y) {
    const out = [];
    [0, 1, 2, 3].forEach(r => { const [w, h] = fpOf(k, r); if ((r === 0 && y === 0) || (r === 1 && x + w === room.w) || (r === 2 && y + h === room.h) || (r === 3 && x === 0)) out.push(r); });
    return out;
  }
  // 放不放得下：回 { ok, rot（貼牆的會改成貼的那面）, why }
  function canPlace(s, rid, k, x, y, rot, ignoreId) {
    const f = FURN[k], room = roomOf(s, rid); if (!f) return { ok: false, why: '沒有這件' }; if (!room) return { ok: false, why: '沒有這間房間' };
    x = Math.floor(Number(x)); y = Math.floor(Number(y)); rot = Math.floor(Number(rot) || 0) & 3;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, why: '位子不對' };
    const others = placedIn(s, rid).filter(t => t.id !== ignoreId);
    if (f.kind === 'pic') {   // 掛畫：只掛北牆，y 一定是 -1；不能跟別幅疊
      if (y !== -1) return { ok: false, why: '掛畫只能掛北邊的牆' };
      if (x < 0 || x + f.w > room.w) return { ok: false, why: '牆不夠寬' };
      if (others.some(t => layerOf(t.key) === 'pic' && x < t.at[0] + FURN[t.key].w && t.at[0] < x + f.w)) return { ok: false, why: '這裡已經掛了一幅' };
      return { ok: true, rot: 0 };
    }
    if (f.kind === 'one' || f.kind === 'rugone') rot = 0;
    if (f.kind === 'two' || f.kind === 'rug') rot &= 1;
    if (f.kind === 'wall') { const rs = wallRots(room, k, x, y); if (!rs.length) { const [w, h] = fpOf(k, rot); if (x < 0 || y < 0 || x + w > room.w || y + h > room.h) return { ok: false, why: '超出房間了' }; return { ok: false, why: `${f.name}要貼著牆` }; } if (!rs.includes(rot)) rot = rs[0]; }
    const [w, h] = fpOf(k, rot);
    if (x < 0 || y < 0 || x + w > room.w || y + h > room.h) return { ok: false, why: '超出房間了' };
    if ((room.block || []).some(([bx, by, bw, bh]) => x < bx + bw && bx < x + w && y < by + bh && by < y + h)) return { ok: false, why: '這裡是樓梯' };
    const L = layerOf(k);
    const hit = others.find(t => { if (layerOf(t.key) !== L) return false; const [tw, th] = fpOf(t.key, t.rot); return x < t.at[0] + tw && t.at[0] < x + w && y < t.at[1] + th && t.at[1] < y + h; });
    if (hit) return { ok: false, why: `這裡有${FURN[hit.key].name}了` };
    return { ok: true, rot };
  }
  // 家升級（房間變了）：同一間還在、擺得下的留著，其他收回倉庫
  function refitRooms(s) {
    const placed = s.items.filter(t => FURN[t.key] && t.in !== 'depot'); let off = 0;
    placed.forEach(t => { t._skip = true; });
    placed.forEach(t => { delete t._skip; const chk = canPlace(s, t.in.slice(5), t.key, t.at[0], t.at[1], t.rot, t.id); if (!chk.ok) { s.items = s.items.filter(q => q !== t); addStack(s.items, t.key, t.c, 1); off++; } });
    return off;
  }
  const furnCount = s => s.items.reduce((n, t) => n + (FURN[t.key] ? (t.in === 'depot' ? t.qty : 1) : 0), 0);
  const deco = s => s.items.find(t => t.key === 'deco') || { floors: [], papers: [] };
  const styleOf = (s, rid) => { const t = s.items.find(q => q.key === 'style' && q.room === rid); return t ? { floor: t.floor, paper: t.paper } : Object.assign({}, STYLE0); };
  const hasFloor = (s, i) => FLOORS[i] && (!FLOORS[i].p || deco(s).floors.includes(i));
  const hasPaper = (s, i) => PAPERS[i] && (!PAPERS[i].p || deco(s).papers.includes(i));
  function furnInfo(s, k) {
    const f = FURN[k]; if (!f) return { ok: false, why: '沒有這件' };
    if (f.tier === '豪華' && level(s, 'house') < FURN_LUX_HOUSE) return { ok: false, price: f.price, why: `豪華家具要先有「${FAC.house.levels[FURN_LUX_HOUSE - 1]}」` };
    if (furnCount(s) >= FURN_MAX) return { ok: false, price: f.price, why: `家具最多 ${FURN_MAX} 件` };
    return { ok: true, price: f.price };
  }
  const furnSell = k => Math.floor(FURN[k].price / 2);

  // ---------- 車、船 ----------
  const vehOf = (s, k) => s.items.find(i => i.key === k && VEH[i.key]);
  const vehicles = s => s.items.filter(i => VEH[i.key]);
  // 某個設施現在那一階的位子（世界座標）：[{ i, x, y, w, h, cls, v: 停在這的 key }]
  function slotsOf(s, f) {
    const lv = level(s, f); if (!lv || !FAC[f].slots) return [];
    const r = rect(f, lv), occ = {};
    vehicles(s).forEach(v => { if (v.in === 'f-' + f) occ[v.at] = v.key; });
    return FAC[f].slots[lv - 1].map(([x, y, w, h, cls], i) => ({ i, x: r.x + x, y: r.y + y, w, h, cls, v: occ[i] || null }));
  }
  // 這台停不停得進這一格（級數要夠、太大台的停不進窄的位子）
  function fitWhy(k, slot) {
    const v = VEH[k];
    if (v.cls > slot.cls) return `這格只能停${CLS_NAME[v.fac][slot.cls]}${slot.cls > 1 ? '以下' : ''}`;
    if (!v.free && (v.w > slot.w + 22 || v.h > slot.h + 16)) return v.fac === 'airfield' ? '太大架，這格停不下' : '太大台，這格停不下';
    return '';
  }
  // 買這台：設施要蓋到同一級
  function vehInfo(s, k) {
    const v = VEH[k]; if (!v) return { ok: false, why: '沒有這台' };
    if (vehOf(s, k)) return { ok: false, owned: true, why: '已經有了', price: v.price };
    const lv = level(s, v.fac);
    if (lv < v.cls) return { ok: false, price: v.price, why: `${FAC[v.fac].name}要先蓋到「${FAC[v.fac].levels[v.cls - 1]}」` };
    return { ok: true, price: v.price };
  }
  // 找一個空的、停得進去的位子（級數剛好的優先，大位子留給大車）
  function freeSlot(s, k) {
    const f = VEH[k].fac; let best = null;
    slotsOf(s, f).forEach(sl => { if (sl.v || fitWhy(k, sl)) return; if (!best || sl.cls < best.cls) best = sl; });
    return best;
  }
  // 設施升級（位子變了）：照大到小重新停，停不下的收寄放處
  function reflow(s, f) {
    const list = vehicles(s).filter(v => VEH[v.key].fac === f && v.in === 'f-' + f).sort((a, b) => VEH[b.key].cls - VEH[a.key].cls);
    list.forEach(v => { v.in = 'depot'; delete v.at; });
    list.forEach(v => { const sl = freeSlot(s, v.key); if (sl) { v.in = 'f-' + f; v.at = sl.i; } });
  }
  const sellPrice = k => Math.floor(VEH[k].price / 2);

  // 做一件事：{ t: 'plot', p } 買地、{ t: 'build', k } 蓋或升一級。money 是錢包有多少。
  // 車船：{ t: 'buyv', k } 買（自動停進空位，沒空位放寄放處）、{ t: 'park', k, f, i } 停進某一格（有車就對調）、{ t: 'depot', k } 收進寄放處、{ t: 'sell', k } 賣掉（買價一半）
  // 回 { ok: true, cost, state, msg } 或 { ok: false, err }；不改原本的 state。
  function apply(s0, act, money, rng) {
    const r = apply0(s0, act, money, rng || Math.random);
    if (r.ok && r.state) fixHolds(r.state);
    return r;
  }
  function apply0(s0, act, money, rng) {
    const s = clean(JSON.parse(JSON.stringify(s0)));
    if (!act || typeof act !== 'object') return { ok: false, err: '看不懂要做什麼' };
    if (act.t === 'plot') {
      const p = Math.floor(Number(act.p)), info = plotInfo(s, p);
      if (!info.ok) return { ok: false, err: info.why };
      if (!(money >= info.price)) return { ok: false, err: '錢包不夠' };
      const before = tierOf(s), isl = island(s);
      isl.plots.push(p); isl.plots.sort((a, b) => a - b); isl.bought++;
      const after = tierOf(s);
      return { ok: true, cost: info.price, state: s, tierUp: after > before ? after : 0 };
    }
    if (act.t === 'build') {
      const k = String(act.k || ''), info = facInfo(s, k);
      if (!info.ok) return { ok: false, err: info.why };
      if (!(money >= info.price)) return { ok: false, err: '錢包不夠' };
      const it = s.items.find(i => i.key === k);
      if (it) it.lv = info.next; else s.items.push({ id: 'f-' + k, key: k, lv: info.next, in: 'i1', at: k });
      if (FAC[k].slots) reflow(s, k);
      const stowed = k === 'house' ? refitRooms(s) : 0;
      return { ok: true, cost: info.price, state: s, built: k, lv: info.next, stowed };
    }
    if (act.t === 'buyv') {
      const k = String(act.k || ''), info = vehInfo(s, k);
      if (!info.ok) return { ok: false, err: info.why };
      if (!(money >= info.price)) return { ok: false, err: '錢包不夠' };
      let sl = freeSlot(s, k), bumped = null; const v = { id: 'v-' + k, key: k, in: 'depot' };
      if (!sl) {   // 沒空位：大位子被小台的佔著，就請小台的讓位（先換到別的空位，沒有就收進寄放處）
        slotsOf(s, VEH[k].fac).forEach(q => { if (q.v && VEH[q.v].cls < VEH[k].cls && !fitWhy(k, q) && (!sl || VEH[q.v].cls < VEH[sl.v].cls)) sl = q; });
        if (sl) { const u = vehOf(s, sl.v); u.in = 'depot'; delete u.at; const q = freeSlot(s, u.key); if (q && q.i !== sl.i) { u.in = 'f-' + VEH[k].fac; u.at = q.i; } bumped = u.key; }
      }
      if (sl) { v.in = 'f-' + VEH[k].fac; v.at = sl.i; }
      s.items.push(v);
      return { ok: true, cost: info.price, state: s, parked: !!sl, bumped };
    }
    if (act.t === 'park') {
      const k = String(act.k || ''), v = vehOf(s, k); if (!v) return { ok: false, err: '你沒有這台' };
      const f = VEH[k].fac; if (act.f && act.f !== f) return { ok: false, err: { dock: '船要停碼頭', garage: '車要停車庫', airfield: '飛機要停停機坪', launchpad: '火箭要立在發射台' }[f] };
      const sl = slotsOf(s, f)[Math.floor(Number(act.i))]; if (!sl) return { ok: false, err: '沒有這個位子' };
      const why = fitWhy(k, sl); if (why) return { ok: false, err: why };
      if (sl.v === k) return { ok: true, cost: 0, state: s };
      if (sl.v) {   // 原本停的那台：能停到這台原本的位子就對調，不然收進寄放處
        const u = vehOf(s, sl.v), old = v.in === 'f-' + f ? slotsOf(s, f)[v.at] : null;
        if (old && !fitWhy(u.key, old)) { u.at = old.i; } else { u.in = 'depot'; delete u.at; }
      }
      v.in = 'f-' + f; v.at = sl.i;
      return { ok: true, cost: 0, state: s };
    }
    if (act.t === 'depot') {
      const v = vehOf(s, String(act.k || '')); if (!v) return { ok: false, err: '你沒有這台' };
      v.in = 'depot'; delete v.at; return { ok: true, cost: 0, state: s };
    }
    if (act.t === 'buyc') {   // 買衣服：先放進擺著的衣櫃（同一格疊、或有空格的），都滿了才放倉庫
      const k = String(act.k || ''), f = CLOTH[k]; if (!f) return { ok: false, err: '沒有這件' };
      const c = Math.floor(Number(act.c) || 0); if (!(c >= 0 && c < f.colors.length)) return { ok: false, err: '沒有這個顏色' };
      if (clothCount(s) >= CLOTH_MAX) return { ok: false, err: `衣服最多 ${CLOTH_MAX} 件` };
      if (!(money >= f.price)) return { ok: false, err: '錢包不夠' };
      const wrs = holders(s, 'wr'); let to = wrs.find(u => wrStacks(s, u.id).some(t => t.key === k && t.c === c && t.qty < 99)) || wrs.find(u => wrStacks(s, u.id).length < HOLD[u.key].n);
      const where = to ? 'wr:' + to.id : 'depot';
      if (addCloth(s.items, k, c, where, 1)) return { ok: false, err: '同一款最多疊 99 件' };
      return { ok: true, cost: f.price, state: s, into: to ? to.id : null };
    }
    if (act.t === 'sellc') {   // 賣倉庫裡的衣服（一件、一半）
      const k = String(act.k || ''), c = Math.floor(Number(act.c) || 0), st = CLOTH[k] && s.items.find(t => t.key === k && t.c === c && t.in === 'depot');
      if (!st || !st.qty) return { ok: false, err: '倉庫裡沒有這件' };
      st.qty--; if (!st.qty) s.items = s.items.filter(t => t !== st); return { ok: true, cost: -clothSell(k), state: s };
    }
    if (act.t === 'wrin' || act.t === 'wrout') {   // 衣服放進衣櫃／拿出來（一件）
      const k = String(act.k || ''), c = Math.floor(Number(act.c) || 0), u = holders(s, 'wr').find(i => i.id === act.uid); if (!u) return { ok: false, err: '找不到這個衣櫃' };
      const from = act.t === 'wrin' ? 'depot' : 'wr:' + u.id, to = act.t === 'wrin' ? 'wr:' + u.id : 'depot', st = CLOTH[k] && s.items.find(t => t.key === k && t.c === c && t.in === from);
      if (!st || !st.qty) return { ok: false, err: act.t === 'wrin' ? '倉庫裡沒有這件' : '衣櫃裡沒有這件' };
      if (act.t === 'wrin' && !wrStacks(s, u.id).some(t => t.key === k && t.c === c) && wrStacks(s, u.id).length >= HOLD[u.key].n) return { ok: false, err: `衣櫃滿了（${HOLD[u.key].n} 格）` };
      if (addCloth(s.items, k, c, to, 1)) return { ok: false, err: '同一款最多疊 99 件' };
      st.qty--; if (!st.qty) s.items = s.items.filter(t => t !== st); return { ok: true, cost: 0, state: s };
    }
    if (act.t === 'gacha') {   // 扭蛋：一次或十次，扭到的進倉庫
      const n = act.n === 10 ? 10 : 1, cost = GACHA.price * n; if (!(money >= cost)) return { ok: false, err: '錢包不夠' };
      const got = [];
      for (let i = 0; i < n; i++) { const k = rollGacha(rng); got.push({ k, first: collCount(s, k) === 0 }); addColl(s.items, k, 1); }
      let g = s.items.find(t => t.key === 'gstat'); if (!g) { g = { id: 'gstat', key: 'gstat', n: 0 }; s.items.push(g); } g.n += n;
      got.forEach(x => { x.n = collCount(s, x.k); });
      return { ok: true, cost, state: s, got };
    }
    if (act.t === 'casein') {   // 藏品放進展示櫃的某一格（那格原本的回倉庫）
      const k = String(act.k || ''), u = holders(s, 'case').find(i => i.id === act.uid), at = Math.floor(Number(act.i));
      if (!u) return { ok: false, err: '找不到這個展示櫃' }; if (!(at >= 0 && at < HOLD[u.key].n)) return { ok: false, err: '沒有這一格' };
      const st = COLL[k] && s.items.find(t => t.key === k && t.in === 'depot'); if (!st || !st.qty) return { ok: false, err: '倉庫裡沒有這件' };
      const old = caseItems(s, u.id).find(t => t.at === at); if (old) { s.items = s.items.filter(t => t !== old); addColl(s.items, old.key, 1); }
      st.qty--; if (!st.qty) s.items = s.items.filter(t => t !== st);
      s.items.push({ id: 'cp-' + u.id + '-' + at, key: k, in: 'case:' + u.id, at }); return { ok: true, cost: 0, state: s };
    }
    if (act.t === 'caseout') {
      const it = s.items.find(t => COLL[t.key] && t.in === 'case:' + act.uid && t.at === Math.floor(Number(act.i))); if (!it) return { ok: false, err: '這一格是空的' };
      s.items = s.items.filter(t => t !== it); addColl(s.items, it.key, 1); return { ok: true, cost: 0, state: s };
    }
    if (act.t === 'buyf') {   // 買家具：先進倉庫
      const k = String(act.k || ''), info = furnInfo(s, k); if (!info.ok) return { ok: false, err: info.why };
      const c = Math.floor(Number(act.c) || 0); if (!(c >= 0 && c < FURN[k].colors.length)) return { ok: false, err: '沒有這個顏色' };
      const st = s.items.find(t => t.key === k && t.in === 'depot' && t.c === c); if (st && st.qty >= 99) return { ok: false, err: '同一款最多 99 件' };
      if (!(money >= info.price)) return { ok: false, err: '錢包不夠' };
      addStack(s.items, k, c, 1); return { ok: true, cost: info.price, state: s };
    }
    if (act.t === 'sellf') {   // 賣倉庫裡的家具（一件、買價一半）
      const k = String(act.k || ''), c = Math.floor(Number(act.c) || 0), st = FURN[k] && s.items.find(t => t.key === k && t.in === 'depot' && t.c === c);
      if (!st || !st.qty) return { ok: false, err: '倉庫裡沒有這件' };
      st.qty--; if (!st.qty) s.items = s.items.filter(t => t !== st);
      return { ok: true, cost: -furnSell(k), state: s };
    }
    if (act.t === 'place') {   // 從倉庫擺進房間
      const k = String(act.k || ''), c = Math.floor(Number(act.c) || 0), st = FURN[k] && s.items.find(t => t.key === k && t.in === 'depot' && t.c === c);
      if (!st || !st.qty) return { ok: false, err: '倉庫裡沒有這件' };
      const rid = String(act.room || ''), chk = canPlace(s, rid, k, act.x, act.y, act.rot); if (!chk.ok) return { ok: false, err: chk.why };
      st.qty--; if (!st.qty) s.items = s.items.filter(t => t !== st);
      const n = s.items.reduce((m, t) => { const q = /^u(\d+)$/.exec(String(t.id)); return q ? Math.max(m, +q[1]) : m; }, 0) + 1;
      const it = { id: 'u' + n, key: k, c, in: 'room:' + rid, at: [Math.floor(Number(act.x)), Math.floor(Number(act.y))], rot: chk.rot };
      s.items.push(it); return { ok: true, cost: 0, state: s, id: it.id };
    }
    if (act.t === 'move') {   // 擺著的家具換位子、轉方向（可以換房間）
      const it = s.items.find(t => t.id === act.id && FURN[t.key] && t.in !== 'depot'); if (!it) return { ok: false, err: '找不到這件' };
      const rid = String(act.room || it.in.slice(5)), chk = canPlace(s, rid, it.key, act.x, act.y, act.rot, it.id); if (!chk.ok) return { ok: false, err: chk.why };
      it.in = 'room:' + rid; it.at = [Math.floor(Number(act.x)), Math.floor(Number(act.y))]; it.rot = chk.rot; return { ok: true, cost: 0, state: s };
    }
    if (act.t === 'stow') {   // 收回倉庫
      const it = s.items.find(t => t.id === act.id && FURN[t.key] && t.in !== 'depot'); if (!it) return { ok: false, err: '找不到這件' };
      s.items = s.items.filter(t => t !== it); addStack(s.items, it.key, it.c, 1); return { ok: true, cost: 0, state: s };
    }
    if (act.t === 'deco') {   // 換地板或壁紙（還沒有的順便買，之後每一間都能用）
      const rid = String(act.room || ''); if (!roomOf(s, rid)) return { ok: false, err: '沒有這間房間' };
      const isF = act.floor != null, i = Math.floor(Number(isF ? act.floor : act.paper)), list = isF ? FLOORS : PAPERS;
      if (!list[i]) return { ok: false, err: '沒有這種' };
      const owned = isF ? hasFloor(s, i) : hasPaper(s, i), cost = owned ? 0 : list[i].p;
      if (!(money >= cost)) return { ok: false, err: '錢包不夠' };
      if (!owned) { let d = s.items.find(t => t.key === 'deco'); if (!d) { d = { id: 'deco', key: 'deco', floors: [], papers: [] }; s.items.push(d); } (isF ? d.floors : d.papers).push(i); }
      let st = s.items.find(t => t.key === 'style' && t.room === rid); if (!st) { st = Object.assign({ id: 'style-' + rid, key: 'style', room: rid }, STYLE0); s.items.push(st); }
      st[isF ? 'floor' : 'paper'] = i; return { ok: true, cost, state: s };
    }
    if (act.t === 'sell') {
      const k = String(act.k || ''), v = vehOf(s, k); if (!v) return { ok: false, err: '你沒有這台' };
      s.items = s.items.filter(i => i !== v);
      return { ok: true, cost: -sellPrice(k), state: s };
    }
    return { ok: false, err: '看不懂要做什麼' };
  }
  // 小島值多少（身價・榜之後用；送的不算）
  function worth(s) {
    let t = 0; const isl = island(s);
    for (let n = 1; n <= isl.bought; n++) t += plotPrice(n);
    FAC_KEYS.forEach(k => { const lv = level(s, k); for (let l = 1; l <= lv; l++) t += FAC[k].prices[l - 1]; });
    vehicles(s).forEach(v => { t += VEH[v.key].price; });
    s.items.forEach(i => { if (FURN[i.key]) t += FURN[i.key].price * (i.in === 'depot' ? i.qty : 1); if (CLOTH[i.key]) t += CLOTH[i.key].price * i.qty; if (COLL[i.key]) t += GACHA.price * (i.in === 'depot' ? i.qty : 1); });
    const d = deco(s); d.floors.forEach(i => { t += FLOORS[i].p; }); d.papers.forEach(i => { t += PAPERS[i].p; });
    return t;
  }

  const R = { CLOTH, CLOTH_KEYS, CLOTH_MAX, COLL, COLL_KEYS, GACHA, RARE, HOLD, holders, wrStacks, caseItems, clothCount, collCount, clothSell, rollGacha, FURN, FURN_KEYS, FURN_MAX, FURN_LUX_HOUSE, FLOORS, PAPERS, STYLE0, ROOMS, floorsOf, roomOf, fpOf, layerOf, placedIn, wallRots, canPlace, furnCount, deco, styleOf, hasFloor, hasPaper, furnInfo, furnSell, VEH, VEH_KEYS, CLS_NAME, vehOf, vehicles, slotsOf, fitWhy, vehInfo, freeSlot, sellPrice, C, GW, GH, COAST, SEA, FAC, FAC_KEYS, TIERS, START, hash, vnoise, inSea, world, rect, needPlots, plotPrice, fresh, clean, island, level, tierOf, nextTier, plotInfo, facInfo, apply, worth };
  root.XiaodaoRules = R;
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof window !== 'undefined' ? window : this);
