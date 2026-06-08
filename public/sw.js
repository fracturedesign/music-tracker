// Orbit Service Worker — minimal, for local notifications
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Allow the page to trigger a notification via postMessage
self.addEventListener("message", e => {
  if (e.data?.type === "TIMER_DONE") {
    const { title = "Time's up!", body = "Your focus session is complete.", icon = "/icon-192.png" } = e.data;
    self.registration.showNotification(title, {
      body,
      icon,
      badge: "/icon-192.png",
      tag: "orbit-timer",          // replaces any previous timer notification
      renotify: true,
      vibrate: [200, 100, 200],
    });
  }
});
