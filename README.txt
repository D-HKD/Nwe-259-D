259D 親愛的通勤小助手

Files:
- index.html
- style.css
- theme.js       ← 季節／時段／天氣主題引擎
- app.js
- sw.js          ← Service Worker（外殼快取，不快取實時資料）
- manifest.json
- icon-192.png / icon-512.png / icon-maskable-512.png
- hero-wu-king-clean.jpg
- kmb-259d-cutout.png
- worker/        ← Cloudflare Worker 原始碼（259d-kmb-proxy）

Features:
- 259D work/home commute ETA
- Home mode shows KT650 觀塘定富街 and KT654 牛頭角下邨 on the same page
- KT654 uses live KMB ETA when available and falls back to an estimated offset from KT650
- No Google Maps
- Mobile layout tuned for iPhone-width screens
- ETA text stays on one line; bus images are contained inside fixed visual areas without cropping

Theme system (2026-10-28)
------------------------
版面會按三個軸自動變化：

1. 季節（按月份）
   spring 3-5 / summer 6-9 / autumn 10-11 / winter 12-2

2. 時段（按香港時間）
   dawn 05-07 / morning 08-11 / afternoon 12-16 / dusk 17-18 / evening 19-22 / night 23-04
   晚上與深夜會轉深色版面。

3. 天氣（香港天文台 rhrread，瀏覽器直連，有 CORS）
   clear 天晴 / cloudy 多雲 / rain 有雨 / storm 風雨 / mist 潮濕 / hot 炎熱 / cold 寒冷
   警告信號（颱風、暴雨、雷暴、寒冷、酷熱）優先。

每一軸都會影響：頁面漸變、卡片色、主色、頁首招呼語、以及頁首天氣標籤。
天氣動畫（雨幕、雲飄、日光、霧氣、閃電、結霜）全部用 CSS 完成。

預覽任意組合（不需要等季節到）：
  ?preview=autumn-dusk-rain
  ?preview=winter-night-storm
  ?preview=summer-afternoon-clear
  ?preview=spring-morning-cloudy

尊重 prefers-reduced-motion：開啟後所有天氣動畫會停止。

Bug fix (2026-10-28)
-------------------
舊 Worker 會回傳 `destination_eta`，但佢其實係「另一部已經接近觀塘的車」的時間，
前端當成「呢班車到達時間」，結果顯示「預計到達觀塘：約 2 分鐘後」（實際要 48 分鐘）。
重建 Worker 後不再輸出該欄位，前端改用「下一班 ETA + 車程 48 分鐘」推算，
並明確標示「按實時班次推算」。

Worker
------
worker/src/index.js 是 259d-kmb-proxy 的完整原始碼（之前只有部署後的成品，冇源碼）。

  端點：
    GET /api/259d?direction=outbound|inbound
    GET /health

  部署（需要 Cloudflare 帳戶）：
    cd worker
    npx wrangler deploy          # 會覆蓋同名 Worker
    npx wrangler tail            # 睇即時 log

  測試：
    cd worker
    node --test                  # 6 個測試（去重、方向過濾、排序、上限、壞資料）

  Worker 只做兩件事：向九巴取 259D 一個站的 ETA、過濾＋去重＋排序。
  邊緣快取 20 秒，所以前端每 60 秒拉一次實際只會打九巴一次。

PWA
---
- manifest.json 有三個 icon（含 maskable）
- sw.js 只快取外殼（HTML／CSS／JS／圖片），跨網域實時資料一律不快取，
  以免顯示過期班次
- 手機「加到主畫面」後可全螢幕開啟

Deployment:
Upload all files to the repository root and enable GitHub Pages from main / root.
2026-10-28 第二批改動
--------------------
1. 自動偵測位置（一次授權）
   - 屯門／天水圍一帶 → 自動選「返工（往鯉魚門邨）」
   - 觀塘／九龍東一帶 → 自動選「放工（往屯門）」
   - 判斷方式：比較與「湖景邨湖翠樓」及「觀塘定富街」的距離，取較近者
   - 座標存 localStorage 30 分鐘；只在瀏覽器「已授權」時才靜靜更新，
     所以授權一次之後開頁面唔會再問
   - 手動撳「返工／放工」會即刻停用自動切換（該次瀏覽）

2. 早／遲提示 + 目標時間
   - 目的地卡多一行：「早 12 分鐘到（目標 09:00）」／「遲 5 分鐘」
   - 目標時間預設：返工 09:00、放工 19:30；撳一下即可改，存 localStorage
   - 目標與實際相差超過 60 分鐘時唔會顯示荒謬數字，只提示「目標 xx:xx・撳一下改」

3. 班次間隔提示
   - 「錯過呢班要等 N 分鐘」；N ≥ 20 分鐘會用警告色

4. 修正
   - 巴士圖「貼紙感」：移除視覺框的內邊框與底色，改用柔和光暈 + 投影 + 留白
   - 巴士圖右上角殘留天空：用限定區域遮罩清走（保留車窗反光）
   - 夜晚「親愛的小提示」文字睇唔到：卡片文字改用主題色變數
   - 目的地「約 2 分鐘後到達觀塘」的錯誤推算（見上節 Bug fix）