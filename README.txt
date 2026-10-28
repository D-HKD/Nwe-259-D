259D 親愛的通勤小助手

Files:
- index.html
- style.css
- theme.js       ← 季節／時段／天氣主題引擎
- app.js
- manifest.json
- hero-wu-king-clean.jpg
- kmb-259d-cutout.png

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

Deployment:
Upload all files to the repository root and enable GitHub Pages from main / root.