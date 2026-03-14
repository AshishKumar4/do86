/*! coi-serviceworker v0.1.7 - Guido Zuidhof, licensed under MIT */
// Minimal version — enables SharedArrayBuffer by setting COOP+COEP headers via service worker
if (typeof window === 'undefined') {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
  self.addEventListener("fetch", function (e) {
    if (e.request.cache === "only-if-cached" && e.request.mode !== "same-origin") return;
    e.respondWith(
      fetch(e.request).then(function (r) {
        if (r.status === 0) return r;
        const headers = new Headers(r.headers);
        headers.set("Cross-Origin-Embedder-Policy", "require-corp");
        headers.set("Cross-Origin-Opener-Policy", "same-origin");
        return new Response(r.body, { status: r.status, statusText: r.statusText, headers });
      }).catch((e) => console.error(e))
    );
  });
} else {
  (async function () {
    if (window.crossOriginIsolated !== false) return;
    const reg = await navigator.serviceWorker.register(window.document.currentScript.src);
    if (reg.active && !navigator.serviceWorker.controller) {
      window.location.reload();
    } else if (!reg.active) {
      reg.addEventListener("updatefound", function () {
        reg.installing.addEventListener("statechange", function () {
          if (this.state === "activated") window.location.reload();
        });
      });
    }
  })();
}
