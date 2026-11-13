// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

type Listener = (event: Record<string, unknown>) => void;

/** Carrega public/push-sw.js num "self" falso e devolve o que ele fez. */
const load = (clients: Record<string, unknown>[] = []) => {
  const listeners: Record<string, Listener> = {};
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const self = {
    location: { origin: 'https://email.realizeconsultadoria.pt' },
    registration: {
      showNotification: vi.fn((title: string, options: Record<string, unknown>) => {
        shown.push({ title, options });
        return Promise.resolve();
      }),
    },
    clients: {
      matchAll: vi.fn(() => Promise.resolve(clients)),
      openWindow: vi.fn(() => Promise.resolve()),
    },
    addEventListener: (name: string, fn: Listener) => {
      listeners[name] = fn;
    },
  };
  new Function('self', readFileSync(resolve(__dirname, '../../../public/push-sw.js'), 'utf8'))(
    self
  );
  const run = async (name: string, event: Record<string, unknown>) => {
    const waits: Promise<unknown>[] = [];
    listeners[name]({ ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  };
  return { self, shown, run };
};

const push = (data: unknown) => ({ data: { json: () => data, text: () => '' } });
const window = (over: Record<string, unknown> = {}) => ({
  url: 'https://email.realizeconsultadoria.pt/',
  visibilityState: 'visible',
  focused: true,
  postMessage: vi.fn(),
  navigate: vi.fn(),
  focus: vi.fn(() => Promise.resolve()),
  ...over,
});

describe('push-sw: email novo', () => {
  const mail = {
    title: 'Ana Silva',
    body: 'Proposta',
    url: 'https://email.realizeconsultadoria.pt/',
    tag: 'mail',
    kind: 'mail',
  };

  it('mostra um aviso de destaque: fica no ecrã, vibra, ícone grande e botão Abrir', async () => {
    const { shown, run } = load();
    await run('push', push(mail));
    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe('📩 Ana Silva');
    expect(shown[0].options).toMatchObject({
      body: 'Proposta',
      requireInteraction: true,
      renotify: true,
      tag: 'mail',
      icon: '/pwa-512x512.png',
    });
    expect(shown[0].options.vibrate).toEqual([250, 120, 250, 120, 450]);
    expect(shown[0].options.actions).toEqual([{ action: 'open', title: 'Abrir o email' }]);
  });

  it('avisa as janelas visíveis (popup grande) e não as escondidas', async () => {
    const visible = window();
    const hidden = window({ visibilityState: 'hidden' });
    const { run } = load([visible, hidden]);
    await run('push', push(mail));
    expect(visible.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'rz-push',
        kind: 'mail',
        title: 'Ana Silva',
        body: 'Proposta',
      })
    );
    expect(hidden.postMessage).not.toHaveBeenCalled();
  });

  it('os outros avisos continuam como eram (sem destaque, sem popup)', async () => {
    const open = window();
    const { shown, run } = load([open]);
    await run('push', push({ title: 'Ponto', body: 'Já registou?', tag: 'task', kind: 'task' }));
    expect(shown[0].title).toBe('Ponto');
    expect(shown[0].options.requireInteraction).toBe(false);
    expect(shown[0].options.vibrate).toBeUndefined();
    expect(open.postMessage).not.toHaveBeenCalled();
  });

  it('push sem JSON não rebenta', async () => {
    const { shown, run } = load();
    await run('push', {
      data: {
        json: () => {
          throw new Error('x');
        },
        text: () => 'olá',
      },
    });
    expect(shown[0].options.body).toBe('olá');
  });
});

describe('push-sw: tocar no aviso', () => {
  const click = (kind: string | null) => ({
    notification: { close: vi.fn(), data: { url: 'https://email.realizeconsultadoria.pt/', kind } },
  });

  it('email: a app aberta recebe o pedido e fica à frente, sem recarregar', async () => {
    const open = window();
    const { run } = load([open]);
    await run('notificationclick', click('mail'));
    expect(open.postMessage).toHaveBeenCalledWith({
      type: 'rz-open',
      url: 'https://email.realizeconsultadoria.pt/',
    });
    expect(open.navigate).not.toHaveBeenCalled();
    expect(open.focus).toHaveBeenCalled();
  });

  it('outros avisos navegam como antes', async () => {
    const open = window();
    const { run } = load([open]);
    await run('notificationclick', click(null));
    expect(open.navigate).toHaveBeenCalledWith('https://email.realizeconsultadoria.pt/');
  });

  it('sem janela aberta, abre uma', async () => {
    const { self, run } = load([]);
    await run('notificationclick', click('mail'));
    expect(self.clients.openWindow).toHaveBeenCalledWith('https://email.realizeconsultadoria.pt/');
  });
});
