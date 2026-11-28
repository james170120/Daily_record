// 🌟 媽媽的健康日記：快取 Service Worker 🌟
// - PNG 圖片、.glb 模型：第一次下載後存在手機裡，之後直接讀取 (開啟更快、更省流量)
// - Three.js（unpkg 上固定版本 0.160.0，內容不會變）：存起來，沒網路也能開群島
// - HTML / JS / JSON：先走網路拿最新版；只有沒網路時才用上次存的版本
// - n8n API：一律走網路，不快取
// ⚠️ 如果你「用同一個檔名」換掉某張圖片或模型，請把 garden-img-v1 改成 v2，手機才會抓新檔

const CACHE = 'garden-img-v1';
const LIB_CACHE = 'garden-lib-v1';
const PAGE_CACHE = 'garden-page-v1';
const KEEP = [CACHE, LIB_CACHE, PAGE_CACHE];
const LIB_PREFIX = 'https://unpkg.com/three@0.160.0/';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => !KEEP.includes(k)).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

async function cacheFirst(cacheName, request) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
}

async function networkFirst(request) {
    const cache = await caches.open(PAGE_CACHE);
    try {
        // no-cache：每次都跟伺服器確認是不是最新版，避免瀏覽器拿舊的 HTML/JS
        const response = await fetch(request, { cache: 'no-cache' });
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (err) {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        throw err;
    }
}

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);

    if (url.href.startsWith(LIB_PREFIX)) {
        e.respondWith(cacheFirst(LIB_CACHE, e.request));
        return;
    }
    if (url.origin !== self.location.origin) return; // n8n API 不快取

    const path = url.pathname;
    if (path.endsWith('.png') || path.endsWith('.glb')) {
        e.respondWith(cacheFirst(CACHE, e.request));
    } else if (e.request.mode === 'navigate' || /\.(html|js|json|css)$/.test(path)) {
        e.respondWith(networkFirst(e.request));
    }
});

// 🔔 晚上 9 點提醒（家裡伺服器 push-server/ 送來的；內容 { title, body, url }）
self.addEventListener('push', e => {
    let data = {};
    try { data = e.data ? e.data.json() : {}; } catch (err) { data = { body: e.data ? e.data.text() : '' }; }
    e.waitUntil(self.registration.showNotification(data.title || '🌸 花園的小提醒', {
        body: data.body || '今天也辛苦了，記得上傳步數喔 👣',
        icon: 'icon.png',
        badge: 'icon.png',
        tag: 'garden-evening',
        data: { url: data.url || './?steps=1' }
    }));
});

// 點通知：群島已經開著 → 叫它跳出上傳步數；沒開 → 打開群島
self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = new URL(e.notification.data?.url || './?steps=1', self.registration.scope).href;
    e.waitUntil((async () => {
        const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const win = wins.find(w => new URL(w.url).pathname.replace(/index\.html$/, '') === new URL(url).pathname.replace(/index\.html$/, ''));
        if (win) {
            await win.focus();
            win.postMessage({ type: 'steps' });
            return;
        }
        await self.clients.openWindow(url);
    })());
});
