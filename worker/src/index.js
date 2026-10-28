/**
 * 259D 通勤小助手 — Cloudflare Worker
 * ------------------------------------
 * 唯一工作：向九巴取得 259D 兩個上車站的實時 ETA，整理成前端要用的形狀。
 *
 * 為什麼要有這個 Worker：
 *   1. 九巴端點雖然有 CORS，但一次要打兩個站，而且回應夾雜全部路線；
 *      在 Worker 過濾 + 快取可以少一半流量、快一截。
 *   2. 前端唔需要知道「邊個站、邊條線、邊個方向」——改路線只要改這裡。
 *
 * 端點：
 *   GET /api/259d?direction=outbound|inbound
 *   GET /health
 */

const ROUTE = '259D';

/** 兩個方向的設定。改站號、改名稱只需改這裡。 */
const DIRECTIONS = {
  outbound: {
    dir: 'O',
    name: '往鯉魚門邨',
    from: { id: '1ACA45F806F2554A', name_tc: '湖景邨湖翠樓', stop_code: 'TM648' },
    to: { id: '598F766175BE3EF3', name_tc: '觀塘道休憩處', stop_code: 'KT329' },
  },
  inbound: {
    dir: 'I',
    name: '往屯門（龍門居）',
    from: { id: '4B17C55C032D3A37', name_tc: '觀塘定富街 (KT650)', stop_code: 'KT650' },
    to: { id: '1ACA45F806F2554A', name_tc: '湖景邨湖翠樓', stop_code: 'TM648' },
  },
};

/** 快取 20 秒：前端每 60 秒拉一次，20 秒足夠擋走重複請求又唔會太舊。 */
const TTL_SECONDS = 20;
const MAX_BUSES = 5;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type',
  };
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Cache-Control': `public, max-age=${TTL_SECONDS}`,
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(),
      ...extra,
    },
  });
}

function minutesUntil(iso, now) {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return null;
  const diff = Math.round((at - now) / 60000);
  return diff < 0 ? 0 : diff;
}

/**
 * 由九巴 stop-eta 回應抽出 259D 某一方向的班次。
 *
 * 同一班車可能因為 service_type 不同而重複出現（例如 1 與 3），
 * 所以按 eta 去重，保留 service_type 最小的一個。
 */
function pickBuses(payload, direction, now) {
  const rows = Array.isArray(payload && payload.data) ? payload.data : [];
  const seen = new Map();

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    if (String(row.route || '').toUpperCase() !== ROUTE) continue;
    if (String(row.dir || '').toUpperCase() !== direction.dir) continue;
    if (!row.eta) continue;

    const key = String(row.eta);
    const type = Number(row.service_type ?? 0);
    const existing = seen.get(key);
    if (existing && Number(existing.service_type ?? 0) <= type) continue;

    seen.set(key, {
      route: ROUTE,
      destination: row.dest_tc || direction.name.replace('往', ''),
      eta: row.eta,
      minutes: minutesUntil(row.eta, now),
      dir: direction.dir,
      service_type: type,
    });
  }

  return [...seen.values()].sort((a, b) => String(a.eta).localeCompare(String(b.eta))).slice(0, MAX_BUSES);
}

async function handle(env, direction) {
  const upstream = await fetch(
    `https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${direction.from.id}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!upstream.ok) throw new Error(`九巴 HTTP ${upstream.status}`);

  const payload = await upstream.json();
  const now = Date.now();
  const buses = pickBuses(payload, direction, now);

  return {
    ok: true,
    route: ROUTE,
    direction: direction.dir,
    direction_name: direction.name,
    from: direction.from,
    to: direction.to,
    next_bus: buses[0] ?? null,
    next_buses: buses,
    updated: new Date(now).toISOString(),
  };
}

export { DIRECTIONS, ROUTE, pickBuses };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== 'GET') {
      return json({ ok: false, error: '只支援 GET' }, 405);
    }

    if (url.pathname === '/health') {
      return json({ ok: true, service: '259d-kmb-proxy', now: new Date().toISOString() });
    }

    if (url.pathname !== '/api/259d') {
      return json({ ok: false, error: '找不到端點' }, 404);
    }

    const key = (url.searchParams.get('direction') || 'outbound').toLowerCase();
    const direction = DIRECTIONS[key];
    if (!direction) {
      return json({ ok: false, error: 'direction 只接受 outbound 或 inbound' }, 400);
    }

    // 邊緣快取：同一個方向 20 秒內只打九巴一次。
    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/api/259d?direction=${key}`, { method: 'GET' });
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    try {
      const body = await handle(env, direction);
      const response = json(body);
      if (ctx && ctx.waitUntil) ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return json({ ok: false, error: `暫時取不到九巴資料：${message}` }, 502);
    }
  },
};
