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
  // Mensagens: com o Realize aberto e à frente não há aviso do sistema (como no WhatsApp Web);
  // a bolinha e a conversa atualizam-se dentro da app.
  if (!data.conversationId) return event.waitUntil(show());
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const reading = clients.some(
        client => client.focused && client.visibilityState === 'visible'
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
