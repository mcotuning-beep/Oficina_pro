// Service worker do OficinaPro — hoje só existe para permitir notificações
// push (o navegador exige um service worker com um handler de "push" para
// poder mostrar notificações mesmo com o app fechado). Não faz cache de
// nada — sem isso, uma atualização do app é sempre pega na hora.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "OficinaPro", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "OficinaPro";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-96.png",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
