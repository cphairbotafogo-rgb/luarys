// Service Worker — Luarys Portal
// Recebe notificações Web Push e as exibe ao cliente mesmo com o portal fechado.

self.addEventListener('push', function (event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { titulo: 'Luarys', corpo: event.data.text() };
  }

  const titulo = payload.titulo || 'Luarys';
  const opcoes = {
    body: payload.corpo || '',
    icon: '/luarys-favicon-256.png',
    badge: '/luarys-favicon-256.png',
    tag: payload.tag || 'luarys-notificacao',
    renotify: false,
    data: { url: payload.url || '/portal' },
  };

  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/portal';
  const targetUrl = new URL(url, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
      for (const cliente of lista) {
        // Valida origem para não focar aba de outro domínio
        try {
          if (new URL(cliente.url).origin === self.location.origin && 'focus' in cliente) {
            return cliente.focus();
          }
        } catch { /* URL inválida — ignora */ }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
