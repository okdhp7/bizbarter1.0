/* BizBarter 서비스 워커 — 앱 설치(PWA)와 오프라인 시 기본 화면 제공
   - /api 요청은 항상 네트워크 (캐시하지 않음)
   - 페이지 이동: 네트워크 우선, 실패 시 캐시된 index.html
   - 정적 파일(js/css/폰트/아이콘): 캐시 우선 */
const CACHE = 'bizbarter-v1'
const SHELL = ['/', '/index.html', '/favicon.svg', '/icon-192.png', '/icon-512.png', '/site.webmanifest']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api')) return

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/index.html')))
    return
  }
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && (url.pathname.startsWith('/assets/') || /\.(png|svg|ico|woff2?)$/.test(url.pathname))) {
        const copy = res.clone()
        caches.open(CACHE).then(c => c.put(req, copy))
      }
      return res
    }))
  )
})
