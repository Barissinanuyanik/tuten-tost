self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // PWA şartını sağlamak için boş bir fetch dinleyicisi yeterlidir.
});