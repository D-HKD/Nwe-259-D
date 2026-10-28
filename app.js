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
  let de=destinationEstimate(first,d);if(de){$('destinationTime').textContent=fmt(de.eta);$('destinationName').textContent=r.dest;$('destinationMeta').textContent=de.official?(de.minutes==null?'KMB 目的地 ETA':`約 ${Math.max(0,Math.round(de.minutes))} 分鐘後`):`按實時班次推算，車程約 ${DEST_MINUTES[direction]} 分鐘`}else{$('destinationTime').textContent='--:--';$('destinationName').textContent=r.dest;$('destinationMeta').textContent='暫時沒有足夠資料推算'}
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
document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.mode').forEach(x=>x.classList.remove('active'));b.classList.add('active');direction=b.dataset.direction;load()}));
$('refreshBtn').addEventListener('click',load);clock();setInterval(clock,1000);load();setInterval(load,60000);
