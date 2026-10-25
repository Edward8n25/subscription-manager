/* Service Worker — 导航/静态均 network-first，离线回退缓存（规范 §14，禁止 cache-first：
   cache-first 会让发版后的 HTML/JS 永远拿不到更新）。
   缓存名纪律：改任何缓存策略必须连动 bump CACHE（W-01 修复时 v1 → v2）。 */
const CACHE = 'subtrack-v2';
const ASSETS = [
  './',
  './index.html',
  './src/app.js',
  './manifest.json',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      // 只清理自己前缀的旧缓存：GitHub Pages 项目站共享 origin，
      // 无差别清理会删掉同 origin 其他项目（如 habit-quit-tracker）的缓存
      Promise.all(keys.filter((k) => k.startsWith('subtrack-') && k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    // 网络优先：在线一律拿最新；离线才回退缓存
    fetch(req).then((res) => {
      // 导航请求不写缓存（避免旧 HTML 回填）；静态资源成功且同源才写
      if (res.ok && req.mode !== 'navigate' && new URL(req.url).origin === self.location.origin) {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone));
      }
      return res;
    }).catch(() =>
      caches.match(req).then((cached) => cached || caches.match('./index.html'))
    )
  );
});
