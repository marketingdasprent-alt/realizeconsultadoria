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
  // Mensagem de uma conversa que a pessoa tem aberta e à frente: não precisa de aviso.
  if (!data.conversationId) return event.waitUntil(show());
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const reading = clients.some(
        client =>
          client.focused &&
          client.visibilityState === 'visible' &&
          client.url.includes('c=' + data.conversationId)
      );
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
