const WORKER_URL="https://259d-kmb-proxy.idyl-2014061.workers.dev";
let direction="outbound";
const DEST_MINUTES={outbound:48,inbound:52};
const SECOND_STOP_OFFSET=4; // KT650 → KT654 約 4 分鐘，只作備用推算
const $=id=>document.getElementById(id);
const route={outbound:{title:"往鯉魚門邨",from:"湖景邨湖翠樓",to:"觀塘道休憩處",dest:"觀塘道休憩處"},inbound:{title:"往屯門（龍門居）",from:"觀塘定富街",to:"湖景邨湖翠樓",dest:"湖景邨湖翠樓"}};

function hkDate(v){if(!v)return null;if(v instanceof Date)return v;if(typeof v==='number')return new Date(v<1e12?v*1000:v);let s=String(v).trim();if(/^\d{2}:\d{2}(:\d{2})?$/.test(s)){let [h,m,sec="00"]=s.split(':').map(Number),d=new Date();d.setHours(h,m,Number(sec),0);return d}return new Date(s.replace(' ','T'))}
function fmt(v){let d=hkDate(v);if(!d||isNaN(d))return"--:--";return new Intl.DateTimeFormat('zh-HK',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Hong_Kong'}).format(d)}
function mins(v){let d=hkDate(v);if(!d||isNaN(d))return null;return Math.round((d.getTime()-Date.now())/60000)}
function minText(n){if(n==null||isNaN(n))return'--';n=Math.max(0,Math.round(n));return n===0?'即將到站':`約${n}分鐘`}
function etaOf(x){return x?.eta||x?.estimated_arrival_time||x?.arrival_time||x?.time||x?.estimatedArrival||null}
function normal(x){let e=etaOf(x);if(!e)return null;let m=x.minutes??x.eta_minutes??mins(e);return{eta:e,minutes:Number.isFinite(Number(m))?Number(m):null,destination:x.destination||x.dest||x.to||route[direction].title.replace('往','')}}
function addValue(a,v){if(Array.isArray(v))v.forEach(x=>{let n=normal(x);if(n)a.push(n)});else if(v&&typeof v==='object')Object.values(v).forEach(x=>{if(Array.isArray(x))x.forEach(y=>{let n=normal(y);if(n)a.push(n)});else{let n=normal(x);if(n)a.push(n)}})}
function cleanBuses(a){let seen=new Set();return a.filter(x=>{let k=String(x.eta);if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>hkDate(a.eta)-hkDate(b.eta)).slice(0,5)}
function busesFrom(d){let a=[];addValue(a,d.next_buses);addValue(a,d.buses);addValue(a,d.etas);addValue(a,direction==='outbound'?d.work_eta:d.home_eta);if(d.next_bus){let n=normal(d.next_bus);if(n)a.unshift(n)}return cleanBuses(a)}
function busesFromSecond(d){let a=[];addValue(a,d.home_eta_2);addValue(a,d.second_home_eta);addValue(a,d.kt654_eta);addValue(a,d.second_stop_eta);if(a.length)return cleanBuses(a);return cleanBuses(busesFrom(d).map(x=>{let dt=hkDate(x.eta);return dt?{...x,eta:new Date(dt.getTime()+SECOND_STOP_OFFSET*60000),minutes:x.minutes==null?null:x.minutes+SECOND_STOP_OFFSET}:x}))}
function traffic(b){if(!b.length)return{e:'⚪',l:'暫時冇班次',n:'九巴實時 ETA 暫時未提供班次，稍後會自動再查'};let m=b[0]?.minutes,g=b[1]?.minutes!=null&&m!=null?b[1].minutes-m:null;if(m!=null&&m<=8&& (g==null||g<=22))return{e:'🟢',l:'幾順呀！',n:'按目前九巴實時班次推算，暫時未見明顯延誤'};if((m!=null&&m>=16)||(g!=null&&g>30))return{e:'🟠',l:'可能有啲繁忙',n:'班次等待時間較長，建議預留多少少時間'};return{e:'🟡',l:'一般',n:'按九巴實時班次間隔推算，路程大致正常'}}
function destinationEstimate(first,d){if(d.destination_eta?.eta)return{eta:d.destination_eta.eta,minutes:d.destination_eta.minutes,official:true};if(!first)return null;let base=hkDate(first.eta);if(!base||isNaN(base))return null;return{eta:new Date(base.getTime()+DEST_MINUTES[direction]*60000),minutes:(first.minutes??0)+DEST_MINUTES[direction],official:false}}
function renderSecondStop(d,primary){
  const card=$('secondStopCard');
  if(direction!=='inbound'){card.classList.add('hidden');return}
  card.classList.remove('hidden');
  const b=busesFromSecond(d),first=b[0];
  $('secondStopTitle').textContent='牛頭角下邨（KT654）';
  if(first){
    $('secondMinutes').textContent=minText(first.minutes);
    $('secondTime').textContent=fmt(first.eta);
    const hasOfficial=(Array.isArray(d.home_eta_2)&&d.home_eta_2.length)||(Array.isArray(d.second_home_eta)&&d.second_home_eta.length)||(Array.isArray(d.kt654_eta)&&d.kt654_eta.length)||(Array.isArray(d.second_stop_eta)&&d.second_stop_eta.length);
    $('secondStopNote').textContent=hasOfficial?'九巴實時 ETA · 牛頭角下邨':'按「觀塘定富街」九巴實時班次推算，約再 4 分鐘到牛頭角下邨';
  }else{
    $('secondMinutes').textContent='--';$('secondTime').textContent='暫時沒有班次';$('secondStopNote').textContent='暫時未有足夠資料';
  }
  const later=b.slice(1,3);
  $('secondEtaList').innerHTML=later.length?later.map(x=>`<div class="eta-item"><strong>${fmt(x.eta)}</strong><span>${minText(x.minutes)}</span></div>`).join(''):'<div class="loading">暫時沒有更多班次</div>';
}
function render(d){
  let r=route[direction],b=busesFrom(d),first=b[0];
  let t=traffic(b);
  if(d.traffic&&typeof d.traffic==='object'){const raw=d.traffic;const label=raw.label||raw.l;const emoji=raw.emoji||raw.e;if(label&&label!=='暫時未能判斷'&&label!=='資料不足'&&label!=='未知')t={e:emoji||t.e,l:label,n:raw.note||raw.n||t.n}}
  $('directionTitle').textContent=d.direction_name||r.title;
  $('routeText').textContent=`${d.from?.name_tc||r.from} → ${d.to?.name_tc||r.to}`;
  $('updated').textContent=`最後更新：${fmt(d.updated||new Date())}`;
  $('trafficUpdated').textContent=fmt(d.updated||new Date());
  $('trafficEmoji').textContent=t.emoji||t.e;
  $('trafficLabel').textContent=t.label||t.l;
  $('trafficNote').textContent=t.note||t.n;
  $('arrivalPill').textContent=first&&first.minutes!=null&&first.minutes<=1?'即將到站':'實時';
  $('primaryStopLabel').textContent=direction==='inbound'?'觀塘定富街（KT650）':'下一班 259D';
  if(first){$('nextMinutes').textContent=minText(first.minutes);$('nextTime').textContent=fmt(first.eta);$('nextDestination').textContent=`${first.destination} · KMB 實時 ETA`;$('progressBar').style.width=`${Math.max(12,Math.min(92,100-(first.minutes||0)*3))}%`}else{$('nextMinutes').textContent='--';$('nextTime').textContent='暫時沒有班次';$('nextDestination').textContent=''}
  let later=b.slice(1,3);$('etaList').innerHTML=later.length?later.map(x=>`<div class="eta-item"><strong>${fmt(x.eta)}</strong><span>${minText(x.minutes)}</span></div>`).join(''):'<div class="loading">暫時沒有更多班次</div>';
  renderSecondStop(d,b);
  renderGap(b);
  let de=destinationEstimate(first,d);if(de){$('destinationTime').textContent=fmt(de.eta);$('destinationName').textContent=r.dest;$('destinationMeta').textContent=de.official?(de.minutes==null?'KMB 目的地 ETA':`約 ${Math.max(0,Math.round(de.minutes))} 分鐘後`):`按實時班次推算，車程約 ${DEST_MINUTES[direction]} 分鐘`}else{$('destinationTime').textContent='--:--';$('destinationName').textContent=r.dest;$('destinationMeta').textContent='暫時沒有足夠資料推算'}
  renderVerdict(de);
  // heroMessage 由 theme.js 按「季節／時段／天氣」決定，唔在這裡覆寫。
  $('loveMessage').innerHTML=direction==='inbound'?'辛苦咗一日，放工記得食啲嘢先返嚟。<br>路上小心，我一直喺度等你 ❤️':'早晨呀親愛的，返工路上小心。<br>今日都加油呀，我支持你 ❤️';
  $('destinationHeading').textContent=direction==='inbound'?'預計返到屋企':'預計到達觀塘';
}
async function fetchKT654Actual(){
  const url="https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/52AE04E9C3E77BE1";
  const res=await fetch(`${url}?_=${Date.now()}`,{cache:"no-store"});
  if(!res.ok)throw Error(`KT654 HTTP ${res.status}`);
  const j=await res.json();
  const rows=Array.isArray(j.data)?j.data:[];
  return rows.filter(x=>String(x.route||"").toUpperCase()==="259D" && String(x.dir||"").toUpperCase()==="I" && x.eta).map(x=>({eta:x.eta,destination:x.dest||"屯門（龍門居）"}));
}
async function load(){
  $('errorBox').classList.add('hidden');
  try{
    let res=await fetch(`${WORKER_URL}/api/259d?direction=${direction}&_=${Date.now()}`,{cache:'no-store'});
    let d=await res.json();
    if(!res.ok||!d.ok)throw Error(d.error||`HTTP ${res.status}`);
    if(direction==='inbound'){
      try{d.home_eta_2=await fetchKT654Actual()}catch(_){d.home_eta_2=[]}
    }
    render(d);
  }catch(e){$('errorBox').textContent=`暫時無法取得九巴資料：${e.message}`;$('errorBox').classList.remove('hidden')}
}
function clock(){let d=new Date();$('clock').textContent=new Intl.DateTimeFormat('zh-HK',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Hong_Kong'}).format(d)}
document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',()=>{manualDirection=true;document.querySelectorAll('.mode').forEach(x=>x.classList.remove('active'));b.classList.add('active');direction=b.dataset.direction;load()}));
$('refreshBtn').addEventListener('click',load);
$('arrivalVerdict').addEventListener('click',editTarget);loadTarget();clock();setInterval(clock,1000);load();bootGeo();setInterval(function(){ if (!document.hidden) load(); }, 60000);

/* ================================================================
   自動偵測位置 → 自動揀方向
   ---------------------------------------------------------------
   屯門／天水圍一帶 → 返工（往鯉魚門邨）
   觀塘／九龍東一帶 → 放工（往屯門）
   授權一次之後，瀏覽器會記住，之後開頁面唔會再問。
   座標會存 30 分鐘，避免每次開都定位。
   ================================================================ */
var GEO_KEY = 'nd259-geo-v1';
var GEO_MAX_AGE = 30 * 60 * 1000;
var ANCHOR = {
  outbound: { lat: 22.376415, lon: 113.966141 }, // 湖景邨湖翠樓（屯門）
  inbound: { lat: 22.316726, lon: 114.215543 },  // 觀塘定富街（觀塘）
};
var manualDirection = false;

function haversineM(a, b) {
  var R = 6371000, rad = Math.PI / 180;
  var dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function bucketOf(lat, lon) {
  var point = { lat: lat, lon: lon };
  var toTuenMun = haversineM(point, ANCHOR.outbound);
  var toKwunTong = haversineM(point, ANCHOR.inbound);
  return toTuenMun <= toKwunTong ? 'outbound' : 'inbound';
}

function readGeo() {
  try {
    var raw = localStorage.getItem(GEO_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.lat !== 'number' || typeof parsed.lon !== 'number') return null;
    if (Date.now() - parsed.at > GEO_MAX_AGE) return parsed; // 過期仍可用一次，但會再定位
    return parsed;
  } catch (e) { return null; }
}

function saveGeo(lat, lon) {
  try { localStorage.setItem(GEO_KEY, JSON.stringify({ lat: lat, lon: lon, at: Date.now() })); } catch (e) {}
}

function setDirection(next, fromGeo) {
  if (direction === next) return;
  direction = next;
  document.querySelectorAll('.mode').forEach(function (b) {
    b.classList.toggle('active', b.dataset.direction === next);
  });
  load();
  if (fromGeo) {
    var label = next === 'outbound' ? '屯門一帶' : '觀塘一帶';
    var el = document.getElementById('updated');
    if (el) el.textContent = '已按位置（' + label + '）選方向';
  }
}

function applyLocation(lat, lon) {
  if (manualDirection) return;
  setDirection(bucketOf(lat, lon), true);
}

function requestFix() {
  navigator.geolocation.getCurrentPosition(function (pos) {
    saveGeo(pos.coords.latitude, pos.coords.longitude);
    applyLocation(pos.coords.latitude, pos.coords.longitude);
  }, function () { /* 拒絕或失敗：沿用預設方向，唔騷擾用戶 */ },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 });
}

function bootGeo() {
  var cached = readGeo();
  if (cached) applyLocation(cached.lat, cached.lon);
  if (!('geolocation' in navigator)) return;

  // 冇快取：直接問一次（瀏覽器只會問一次，之後記住）
  if (!cached) { requestFix(); return; }

  // 有快取：只在「權限已授予」時靜靜更新，唔會彈提示
  if (Date.now() - cached.at < 10 * 60 * 1000) return;
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then(function (status) {
      if (status.state === 'granted') requestFix();
    }).catch(function () {});
  }
}

/* ================================================================
   早／遲：同目標到達時間比較
   ================================================================ */
var TARGET_KEY = 'nd259-target-v1';
var TARGET = { outbound: '09:00', inbound: '19:30' };

function loadTarget() {
  try {
    var saved = JSON.parse(localStorage.getItem(TARGET_KEY) || 'null');
    if (saved && /^\d{2}:\d{2}$/.test(saved.outbound)) TARGET.outbound = saved.outbound;
    if (saved && /^\d{2}:\d{2}$/.test(saved.inbound)) TARGET.inbound = saved.inbound;
  } catch (e) {}
}

function saveTarget() {
  try { localStorage.setItem(TARGET_KEY, JSON.stringify(TARGET)); } catch (e) {}
}

/** 撳一下就可以改「目標到達時間」，例如返工 09:00、放工 19:30。 */
function editTarget() {
  var current = TARGET[direction];
  var input = window.prompt('目標到達時間（24 小時制，例如 09:00）', current);
  if (!input) return;
  var match = input.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return;
  var hour = Number(match[1]), minute = Number(match[2]);
  if (hour > 23 || minute > 59) return;
  TARGET[direction] = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  saveTarget();
  load();
}

function clockMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function targetMinutes(dir) {
  var bits = TARGET[dir].split(':');
  return Number(bits[0]) * 60 + Number(bits[1]);
}

function renderVerdict(de) {
  var el = $('arrivalVerdict');
  if (!el) return;
  var target = TARGET[direction];

  // 目標時間距離太遠（例如朝早 9 點的目標，晚上 8 點睇）就唔講「遲 700 分鐘」，
  // 只提示可以撳一下改目標。
  function hint() {
    el.textContent = '目標 ' + target + '・撳一下改';
    el.className = 'home-verdict';
    el.title = '設定你嘅目標到達時間';
  }

  var arrival = de ? hkDate(de.eta) : null;
  if (!arrival || isNaN(arrival)) { hint(); return; }

  var diff = targetMinutes(direction) - clockMinutes(arrival); // 正數 = 早到
  if (Math.abs(diff) > 60) { hint(); return; }

  if (Math.abs(diff) <= 2) {
    el.textContent = '差唔多啱時間（目標 ' + target + '）';
    el.className = 'home-verdict ontime';
  } else if (diff > 0) {
    el.textContent = '早 ' + diff + ' 分鐘到（目標 ' + target + '）';
    el.className = 'home-verdict early';
  } else {
    el.textContent = '遲 ' + Math.abs(diff) + ' 分鐘（目標 ' + target + '）';
    el.className = 'home-verdict late';
  }
}

function renderGap(buses) {
  var el = $('gapNote');
  if (!el) return;
  var first = buses[0], second = buses[1];
  if (!first || !second || first.minutes == null || second.minutes == null) {
    el.textContent = '';
    return;
  }
  var gap = second.minutes - first.minutes;
  el.textContent = gap >= 20
    ? '⚠ 錯過呢班要等 ' + gap + ' 分鐘'
    : '錯過呢班要等 ' + gap + ' 分鐘';
  el.className = 'gap-note' + (gap >= 20 ? ' warn' : '');
}// 由其他 App 切返嚟即刻更新一次（唔使等最多 60 秒）
document.addEventListener('visibilitychange', function(){ if (!document.hidden) load(); });
/* Service Worker：開得快、離線都開到（唔會快取實時資料） */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () { /* 失敗就照常運作 */ });
  });
}
