// ---- Service Worker (PWA) ----
// 版本號：每次發布改一次，確保用戶拿到新快取
const CACHE = 'hg-v4';
const APP_SHELL = ['/', '/index.html'];

// 安裝：預抓 App shell，並立刻接管（skipWaiting）
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

// 啟用：清舊快取，並立即接管所有頁面（clients.claim）
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 抓取策略：導航請求「網路優先」（可拿到最新版 index.html），失敗才回快取
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put('/index.html', clone));
        return res;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }
  // 其他資源「快取優先」
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req))
  );
});
