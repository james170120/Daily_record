// 🌟 媽媽的健康日記：圖片快取 Service Worker 🌟
// - PNG 圖片：第一次下載後存在手機裡，之後直接讀取 (開啟更快、更省流量)
// - HTML 與 n8n API：一律走網路，確保資料與程式永遠是最新的
// ⚠️ 如果你「用同一個檔名」換掉某張圖片，請把下面的 v1 改成 v2，手機才會抓新圖

const CACHE = 'garden-img-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
    // 清掉舊版本的圖片快取
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // n8n API 不快取
    if (!url.pathname.endsWith('.png')) return;

    e.respondWith(
        caches.open(CACHE).then(async cache => {
            const cached = await cache.match(e.request);
            if (cached) return cached;
            const response = await fetch(e.request);
            if (response.ok) cache.put(e.request, response.clone());
            return response;
        })
    );
});
