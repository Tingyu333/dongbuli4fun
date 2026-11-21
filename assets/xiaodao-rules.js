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
  // 第 n 塊買的地（不算送的）：$1,500 × 1.2ⁿ，取到百位（第 1 塊 $1,800、第 10 塊約 $9,300、第 20 塊約 $5.7 萬、第 28 塊（到伍）約 $35.6 萬，買到伍加起來約 128 萬）
  const plotPrice = n => Math.round(1500 * Math.pow(1.2, n) / 100) * 100;

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
      items.push(i);   // 之後的東西（家具…）原樣留著
    });
    // 同一格停了兩台的，後面那台收回寄放處
    const taken = new Set(); items.forEach(v => { if (!VEH[v.key] || v.in === 'depot') return; const t = v.in + ':' + v.at; if (taken.has(t)) { v.in = 'depot'; delete v.at; } else taken.add(t); });
    return { v: 1, items };
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
  function apply(s0, act, money) {
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
      return { ok: true, cost: info.price, state: s, built: k, lv: info.next };
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
    return t;
  }

  const R = { VEH, VEH_KEYS, CLS_NAME, vehOf, vehicles, slotsOf, fitWhy, vehInfo, freeSlot, sellPrice, C, GW, GH, COAST, SEA, FAC, FAC_KEYS, TIERS, START, hash, vnoise, inSea, world, rect, needPlots, plotPrice, fresh, clean, island, level, tierOf, nextTier, plotInfo, facInfo, apply, worth };
  root.XiaodaoRules = R;
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof window !== 'undefined' ? window : this);
