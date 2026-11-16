/* sw.js - Service worker Rakumaku
 * Tujuan: membuat aplikasi bisa diinstal (PWA) tanpa mengganggu data.
 * - Hanya menangani permintaan GET ke domain yang sama.
 * - Permintaan ke Google Apps Script (POST / lintas domain) tidak disentuh sama sekali.
 * - Halaman utama: jaringan dulu (selalu versi terbaru), cadangan dari cache saat offline.
 */
var CACHE = "rakumaku-v1";

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return fetch("/", { cache: "reload" }).then(function (res) {
        if (res && res.ok && !res.redirected) return cache.put("/", res);
      });
    }).catch(function () { /* tidak apa-apa bila gagal */ })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Buka halaman: jaringan dulu, cache sebagai cadangan offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok && !res.redirected) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put("/", copy); });
        }
        return res;
      }).catch(function () {
        return caches.match("/").then(function (hit) {
          return hit || new Response(
            "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
            "<title>Rakumaku</title><body style='font-family:system-ui;text-align:center;padding:48px 16px'>" +
            "<h2>Sedang offline</h2><p>Sambungkan ke internet lalu muat ulang halaman.</p></body>",
            { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
          );
        });
      })
    );
    return;
  }

  // Berkas statis lain (manifest, dll.): ambil dari jaringan, simpan salinan
  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && !res.redirected) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () { return caches.match(req); })
  );
});
