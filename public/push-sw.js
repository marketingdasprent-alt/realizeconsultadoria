// Notificações push do Realize (importado pelo service worker gerado pelo vite-plugin-pwa).

// Email novo: aviso de destaque (fica no ecrã até lhe tocarem, vibra e mostra o botão "Abrir") e,
// com a app aberta, um popup grande dentro dela (mensagem 'rz-push' para as janelas visíveis).
const isMail = data => data.kind === 'mail' || data.tag === 'mail';

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Realize', body: event.data ? event.data.text() : '' };
  }
  const mail = isMail(data);
  const show = () =>
    self.registration.showNotification(
      mail ? `📩 ${data.title || 'Email novo'}` : data.title || 'Realize',
      {
        body: data.body || '',
        icon: mail ? '/pwa-512x512.png' : '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: data.tag || undefined,
        renotify: !!data.tag,
        // Os emails ficam no ecrã até a pessoa os ver (um só de cada vez: o seguinte substitui-o)
        requireInteraction: mail,
        vibrate: mail ? [250, 120, 250, 120, 450] : undefined,
        silent: false,
        timestamp: Date.now(),
        actions: mail ? [{ action: 'open', title: 'Abrir o email' }] : undefined,
        data: { url: data.url || '/colaborador', kind: data.kind || null },
      }
    );
  // Mensagens: só não há aviso quando essa mesma conversa está aberta e à frente (como no
  // WhatsApp Web). Com o Realize aberto noutra página (Email, Início…), o aviso aparece.
  if (!data.conversationId) {
    const tell = mail ? tellOpenWindows(data) : Promise.resolve();
    return event.waitUntil(Promise.all([show(), tell]));
  }
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

// Avisa as janelas abertas (e visíveis) para mostrarem o popup grande de email novo.
function tellOpenWindows(data) {
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    for (const client of clients) {
      if (client.visibilityState !== 'visible') continue;
      client.postMessage({
        type: 'rz-push',
        kind: data.kind || 'mail',
        title: data.title || 'Email novo',
        body: data.body || '',
        url: data.url || '/',
      });
    }
  });
}

// Tocar na notificação: abre (ou foca) o Realize na página certa.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/colaborador';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          // Email: a app aberta vai ela própria para o email (navegar recarregava-a e perdia
          // a mensagem que a pessoa estivesse a escrever)
          if (event.notification.data && event.notification.data.kind === 'mail')
            client.postMessage({ type: 'rz-open', url });
          else client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
