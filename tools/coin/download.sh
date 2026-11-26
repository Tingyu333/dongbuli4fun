#!/bin/bash
# 下載五檔的 15 分鐘 K 線（每月一個 zip），解壓到 raw/<幣>/。沒上市的月份 404 跳過。
set -u
mkdir -p raw
for SYM in BTCUSDT ETHUSDT DOGEUSDT SOLUSDT PEPEUSDT; do
  mkdir -p raw/$SYM
  for Y in 2019 2020 2021 2022 2023 2024 2025 2026; do
    for M in 01 02 03 04 05 06 07 08 09 10 11 12; do
      F=$SYM-15m-$Y-$M
      curl -sf -o /tmp/$F.zip "https://data.binance.vision/data/spot/monthly/klines/$SYM/15m/$F.zip" || continue
      unzip -oq /tmp/$F.zip -d raw/$SYM && rm /tmp/$F.zip
    done
  done
  echo "$SYM: $(ls raw/$SYM | wc -l) 個月"
done
