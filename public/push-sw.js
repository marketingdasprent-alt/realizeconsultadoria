// Notificações push do Realize (importado pelo service worker gerado pelo vite-plugin-pwa).
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Realize', body: event.data ? event.data.text() : '' };
  }
  const show = () =>
    self.registration.showNotification(data.title || 'Realize', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || '/colaborador' },
    });
  // Mensagens: só não há aviso quando essa mesma conversa está aberta e à frente (como no
  // WhatsApp Web). Com o Realize aberto noutra página (Email, Início…), o aviso aparece.
  if (!data.conversationId) return event.waitUntil(show());
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const reading = clients.some(client => {
        if (!client.focused || client.visibilityState !== 'visible') return false;
        try {
          return new URL(client.url).searchParams.get('c') === data.conversationId;
        } catch {
          return false;
        }
      });
      return reading ? undefined : show();
    })
  );
});

// Tocar na notificação: abre (ou foca) o Realize na página certa.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/colaborador';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
