import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DIRECTIONS, pickBuses } from '../src/index.js';

const now = Date.parse('2026-10-28T19:40:00+08:00');

function row(over) {
  return {
    route: '259D',
    dir: 'O',
    dest_tc: '鯉魚門邨',
    eta: '2026-10-28T19:45:54+08:00',
    eta_seq: 1,
    service_type: 1,
    ...over,
  };
}

test('只保留 259D 與指定方向', () => {
  const payload = {
    data: [
      row({ eta: '2026-10-28T19:45:54+08:00' }),
      row({ route: '258D' }),
      row({ dir: 'I' }),
      row({ eta: '2026-10-28T20:15:24+08:00', eta_seq: 2 }),
    ],
  };
  const buses = pickBuses(payload, DIRECTIONS.outbound, now);
  assert.equal(buses.length, 2);
  assert.equal(buses[0].eta, '2026-10-28T19:45:54+08:00');
});

test('同一班車不同 service_type 會去重，保留較細的 type', () => {
  const payload = {
    data: [
      row({ service_type: 3 }),
      row({ service_type: 1 }),
    ],
  };
  const buses = pickBuses(payload, DIRECTIONS.outbound, now);
  assert.equal(buses.length, 1);
  assert.equal(buses[0].service_type, 1);
});

test('按時間排序並計算剩餘分鐘', () => {
  const payload = {
    data: [
      row({ eta: '2026-10-28T20:15:24+08:00' }),
      row({ eta: '2026-10-28T19:45:54+08:00' }),
    ],
  };
  const buses = pickBuses(payload, DIRECTIONS.outbound, now);
  assert.deepEqual(buses.map((b) => b.minutes), [6, 35]); // 19:40 → 19:45:54 ≈ 6 分鐘
});

test('最多 5 班', () => {
  const payload = {
    data: Array.from({ length: 9 }, (_, i) =>
      row({ eta: `2026-10-28T${String(20 + i).padStart(2, '0')}:00:00+08:00` }),
    ),
  };
  assert.equal(pickBuses(payload, DIRECTIONS.outbound, now).length, 5);
});

test('壞資料不會拋錯', () => {
  for (const bad of [null, {}, { data: 'x' }, { data: [null, 3, { route: '259D' }] }]) {
    assert.deepEqual(pickBuses(bad, DIRECTIONS.outbound, now), []);
  }
});

test('已過時間的班次顯示 0 分鐘而不會負數', () => {
  const payload = { data: [row({ eta: '2026-10-28T19:30:00+08:00' })] };
  assert.equal(pickBuses(payload, DIRECTIONS.outbound, now)[0].minutes, 0);
});