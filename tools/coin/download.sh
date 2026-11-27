#!/bin/bash
# 下載 Binance 公開的每月 K 線 zip，解壓到 raw/<幣>/（15 分鐘，2019～2026）和 raw1m/<幣>/（1 分鐘，只抓 windows.json 用到的月份）。沒上市的月份 404 跳過。
set -u
mkdir -p raw raw1m
get() {  # get <幣> <間隔> <年-月> <資料夾>
  F=$1-$2-$3
  curl -sf -o /tmp/$F.zip "https://data.binance.vision/data/spot/monthly/klines/$1/$2/$F.zip" || return 0
  unzip -oq /tmp/$F.zip -d $4/$1 && rm /tmp/$F.zip
}
for SYM in BTCUSDT ETHUSDT DOGEUSDT SOLUSDT PEPEUSDT; do
  mkdir -p raw/$SYM raw1m/$SYM
  for Y in 2019 2020 2021 2022 2023 2024 2025 2026; do
    for M in 01 02 03 04 05 06 07 08 09 10 11 12; do get $SYM 15m $Y-$M raw; done
  done
  echo "$SYM 15 分鐘：$(ls raw/$SYM | wc -l) 個月"
done
# 1 分鐘：每一檔從（起點 − pre 天）到（起點 ＋ years 年 ＋ 1 個月）
if [ -f tools/coin/windows.json ]; then
  node -e '
    const c = require("./tools/coin/windows.json");
    for (const x of c.coins) {
      const a = new Date(Date.parse(x.start + "T00:00:00Z") - x.pre * 864e5), b = new Date(Date.parse(x.start + "T00:00:00Z") + (x.years * 365.25 + 31) * 864e5);
      for (let d = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1)); d <= b; d.setUTCMonth(d.getUTCMonth() + 1))
        console.log(x.sym, d.toISOString().slice(0, 7));
    }' | while read SYM YM; do get $SYM 1m $YM raw1m; done
  for SYM in BTCUSDT ETHUSDT DOGEUSDT SOLUSDT PEPEUSDT; do echo "$SYM 1 分鐘：$(ls raw1m/$SYM | wc -l) 個月"; done
fi
