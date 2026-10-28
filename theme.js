/*
 * 259D 主題引擎
 * ----------------
 * 三個軸決定版面：
 *   季節  春／夏／秋／冬        （按月份，香港定義）
 *   時段  清晨／上午／下午／黃昏／晚上／深夜
 *   天氣  晴／多雲／雨／雷暴／潮濕／熱／冷
 *
 * 全部都只改 <html data-season data-part data-weather>，
 * 實際顏色與動畫由 CSS 負責，JS 只負責判斷與文字。
 */
(function (global) {
  'use strict';

  var SEASON_LABEL = { spring: '春天', summer: '夏天', autumn: '秋天', winter: '冬天' };
  var PART_LABEL = {
    dawn: '清晨',
    morning: '上午',
    afternoon: '下午',
    dusk: '黃昏',
    evening: '晚上',
    night: '深夜',
  };
  var WEATHER_LABEL = {
    clear: '天晴',
    cloudy: '多雲',
    rain: '有雨',
    storm: '風雨',
    mist: '潮濕',
    hot: '炎熱',
    cold: '寒冷',
  };
  var WEATHER_ICON = {
    clear: '☀️',
    cloudy: '⛅',
    rain: '🌧️',
    storm: '⛈️',
    mist: '🌫️',
    hot: '🥵',
    cold: '🥶',
  };

  /** 香港季節：3–5 春、6–9 夏、10–11 秋、12–2 冬 */
  function seasonOf(month) {
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 9) return 'summer';
    if (month >= 10 && month <= 11) return 'autumn';
    return 'winter';
  }

  function partOf(hour) {
    if (hour >= 5 && hour < 8) return 'dawn';
    if (hour >= 8 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 19) return 'dusk';
    if (hour >= 19 && hour < 23) return 'evening';
    return 'night';
  }

  /** 由天文台 rhrread 判斷天氣類別；警告優先。 */
  function weatherOf(readings) {
    if (!readings) return 'cloudy';
    var warnings = String(readings.warning || '');
    if (/颱風|熱帶氣旋|暴風|烈風|八號|九號|十號|風球/.test(warnings)) return 'storm';
    if (/暴雨|大雨|雷暴|水浸/.test(warnings)) return 'rain';
    if (/寒冷|霜凍/.test(warnings)) return 'cold';
    if (/酷熱|炎熱/.test(warnings)) return 'hot';
    if (typeof readings.rainMaxMm === 'number' && readings.rainMaxMm > 0) return 'rain';
    var temp = readings.tempC;
    if (typeof temp === 'number' && temp >= 32) return 'hot';
    if (typeof temp === 'number' && temp <= 12) return 'cold';
    if (typeof readings.humidity === 'number' && readings.humidity >= 92) return 'mist';
    if (typeof readings.uvDesc === 'string' && /高|甚高|極高/.test(readings.uvDesc)) return 'clear';
    return 'cloudy';
  }

  /** 每個「時段」一句招呼（保留原本的親密語氣）。 */
  function greetingFor(season, part, weather) {
    var base = {
      dawn: '天未光就起身，辛苦你啦，路上小心 ☁️',
      morning: '早晨呀親愛的，今日返工都要開開心心呀 ☀️',
      afternoon: '晏晝啦，記住飲杯水先再搏殺 💧',
      dusk: '黃昏喇，收工路上望下個天，會靚啲 🌇',
      evening: '放工喇，慢慢行，唔使急，我等你返嚟 ❤️',
      night: '咁夜先返到，辛苦晒，沖個涼早啲休息 🌙',
    }[part];

    var weatherLine = {
      storm: '大風大雨，如果可以就遲少少出門口。',
      rain: '落緊雨，記得帶遮，鞋會濕。',
      mist: '今日好潮濕，地板會滑，行慢啲。',
      hot: '今日好熱，帶支水，唔好中暑。',
      cold: '今日凍，著多件衫先出門呀。',
      clear: '今天天清，心情都會好啲。',
      cloudy: '天色一般，帶把摺傘穩陣啲。',
    }[weather];

    var seasonLine = {
      spring: '春天潮濕，把遮長期放袋啦。',
      summer: '夏天太陽猛，帽同水都要帶。',
      autumn: '秋天最舒服，慢慢行都唔覺熱。',
      winter: '冬天日短，夜咗記得著外套。',
    }[season];

    return { main: base, extra: weatherLine || '', season: seasonLine || '' };
  }

  function describeSeasonPart(season, part) {
    return SEASON_LABEL[season] + '・' + PART_LABEL[part];
  }

  function apply(theme) {
    var root = document.documentElement;
    root.dataset.season = theme.season;
    root.dataset.part = theme.part;
    root.dataset.weather = theme.weather;
    root.dataset.dark = theme.part === 'evening' || theme.part === 'night' ? '1' : '0';
  }

  var THEME_COLOR = {
    spring: '#ffe9f4', summer: '#d6f2ff', autumn: '#ffe2c9', winter: '#e2ecff', dark: '#0a1122'
  };

  function renderCopy(theme) {
    // 手機瀏覽器網址欄跟隨主題（夜晚轉深色）
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var dark = theme.part === 'evening' || theme.part === 'night';
      meta.setAttribute('content', dark ? THEME_COLOR.dark : (THEME_COLOR[theme.season] || '#102653'));
    }
    var copy = greetingFor(theme.season, theme.part, theme.weather);

    var hero = document.getElementById('heroMessage');
    if (hero) hero.textContent = copy.main;

    var kicker = document.getElementById('heroKicker');
    if (kicker) kicker.textContent = describeSeasonPart(theme.season, theme.part) + '・為你整嘅專屬通勤小助手 ❤️';

    var chip = document.getElementById('weatherChip');
    if (chip) {
      if (theme.reading) {
        var temp = theme.reading.tempC != null ? theme.reading.tempC + '°C' : '--°C';
        chip.textContent = WEATHER_ICON[theme.weather] + ' ' + temp + ' ' + WEATHER_LABEL[theme.weather];
        chip.hidden = false;
      } else {
        chip.hidden = true;
      }
    }

    var note = document.getElementById('weatherNote');
    if (note) {
      var parts = [copy.extra, copy.season].filter(Boolean);
      note.textContent = parts.join(' ');
    }
  }

  /** 解析網址上的 ?preview=autumn-dusk-rain（方便預覽全部組合）。 */
  function previewOverride() {
    var raw = new URLSearchParams(location.search).get('preview');
    if (!raw) return null;
    var bits = raw.split(/[-_]/);
    var season = bits[0];
    var part = bits[1];
    var weather = bits[2] || 'cloudy';
    if (!SEASON_LABEL[season] || !PART_LABEL[part] || !WEATHER_LABEL[weather]) return null;
    return { season: season, part: part, weather: weather };
  }

  function currentTheme() {
    var forced = previewOverride();
    if (forced) return forced;
    var now = new Date();
    return {
      season: seasonOf(now.getMonth() + 1),
      part: partOf(now.getHours()),
      weather: 'cloudy',
    };
  }

  global.NDTheme = {
    seasonOf: seasonOf,
    partOf: partOf,
    weatherOf: weatherOf,
    greetingFor: greetingFor,
    currentTheme: currentTheme,
    currentThemeForced: previewOverride,
    apply: apply,
    renderCopy: renderCopy,
    labels: { season: SEASON_LABEL, part: PART_LABEL, weather: WEATHER_LABEL, icon: WEATHER_ICON },
  };
})(window);

/* ================================================================
   天氣：天文台 rhrread（有 CORS，可以直接由瀏覽器抓）
   ================================================================ */
(function (global) {
  'use strict';
  var HKO = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc';
  var CACHE_KEY = 'nd259-weather-v1';
  var CACHE_MS = 10 * 60 * 1000;

  function warnText(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.filter(function (v) { return typeof v === 'string'; }).join(' ');
    return '';
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.at !== 'number') return null;
      if (Date.now() - parsed.at > CACHE_MS) return null;
      return parsed.reading || null;
    } catch (e) { return null; }
  }

  function writeCache(reading) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), reading: reading })); } catch (e) {}
  }

  function pick(list, name) {
    if (!Array.isArray(list)) return null;
    for (var i = 0; i < list.length; i++) {
      var row = list[i];
      if (row && typeof row.place === 'string' && row.place.indexOf(name) >= 0) return row;
    }
    return list.length ? list[0] : null;
  }

  function normalise(payload) {
    var tempRow = pick(payload && payload.temperature && payload.temperature.data, '香港天文台');
    var humRow = pick(payload && payload.humidity && payload.humidity.data, '香港天文台');
    var rainRows = (payload && payload.rainfall && Array.isArray(payload.rainfall.data)) ? payload.rainfall.data : [];
    var rainMax = null;
    for (var i = 0; i < rainRows.length; i++) {
      var v = Number(rainRows[i] && rainRows[i].max);
      if (Number.isFinite(v) && (rainMax === null || v > rainMax)) rainMax = v;
    }
    var uvRows = (payload && payload.uvindex && Array.isArray(payload.uvindex.data)) ? payload.uvindex.data : [];
    return {
      tempC: tempRow && Number.isFinite(Number(tempRow.value)) ? Number(tempRow.value) : null,
      humidity: humRow && Number.isFinite(Number(humRow.value)) ? Number(humRow.value) : null,
      rainMaxMm: rainMax,
      uvDesc: uvRows[0] && typeof uvRows[0].desc === 'string' ? uvRows[0].desc : null,
      warning: warnText(payload && payload.warningMessage)
    };
  }

  function fetchReading() {
    return fetch(HKO, { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('HKO HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var reading = normalise(json);
        writeCache(reading);
        return reading;
      });
  }

  /* ================================================================
     啟動：即時套用（唔等天氣），再用天氣修正
     ================================================================ */
  function start() {
    var forced = global.NDTheme.currentThemeForced ? global.NDTheme.currentThemeForced() : null;

    function paint(reading) {
      var now = new Date();
      var theme = forced || {
        season: global.NDTheme.seasonOf(now.getMonth() + 1),
        part: global.NDTheme.partOf(now.getHours()),
        weather: global.NDTheme.weatherOf(reading)
      };
      theme.reading = reading;
      global.NDTheme.apply(theme);
      global.NDTheme.renderCopy(theme);
    }

    var cached = readCache();
    paint(cached);

    if (!cached) {
      fetchReading().then(paint).catch(function () { /* 冇天氣就用預設多雲 */ });
    }

    // 每分鐘重算時段（跨過黃昏／入夜會即時轉版）
    setInterval(function () {
      var reading = readCache();
      paint(reading);
    }, 60 * 1000);

    // 每 10 分鐘更新天氣
    setInterval(function () {
      fetchReading().then(paint).catch(function () {});
    }, CACHE_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})(window);