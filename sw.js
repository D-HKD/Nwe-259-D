/*
 * Service Worker — 只負責「開得快 + 離線都開到」。
 *
 * 刻意唔快取任何實時資料（九巴 ETA、天文台天氣、自家 Worker）：
 * 顯示過期班次比顯示「連線失敗」更危險。離線時版面照開，
 * 資料區塊會如實顯示錯誤，唔會假裝有班次。
 */

const VERSION = 'nd259-v1';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './hero-wu-king-clean.jpg',
  './kmb-259d-cutout.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      // 逐個加，任何一個失敗都唔好令整個安裝失敗
      Promise.all(CORE.map((url) => cache.add(url).catch(() => null))),
    ).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 跨網域（九巴／天文台／Worker）一律直接上網，唔經快取
  if (url.origin !== self.location.origin) return;

  // 開頁面：先試網絡，失敗就用快取的外殼
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      }).catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }

  // 其他同源資源：先快取，同時背景更新
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => hit);
      return hit || network;
    }),
  );
});
