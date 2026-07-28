/* 漫漫工作台 Service Worker · 网络优先，离线回退 */
const CACHE = "wb-v4";
const STATIC = [
  "./", "./index.html", "./manifest.json", "./style.css",
  "./app.js", "./data.js", "./icons/icon.svg"
];

self.addEventListener("install", e => {
  // 单个文件失败（如 404）不影响整体安装；装完立即激活
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(STATIC.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
