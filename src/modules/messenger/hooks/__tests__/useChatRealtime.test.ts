import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

type StatusCb = (status: string) => void;

const created: { topic: string; statusCb?: StatusCb; state: string }[] = [];

vi.mock('@/integrations/supabase/client', () => {
  const makeChannel = (topic: string) => {
    const record: { topic: string; statusCb?: StatusCb; state: string } = {
      topic,
      state: 'joining',
    };
    created.push(record);
    const channel = {
      get state() {
        return record.state;
      },
      on: () => channel,
      subscribe: (cb: StatusCb) => {
        record.statusCb = cb;
        return channel;
      },
    };
    return channel;
  };
  return {
    supabase: {
      channel: vi.fn((topic: string) => makeChannel(topic)),
      removeChannel: vi.fn(async () => 'ok'),
    },
  };
});

import { useChatRealtime } from '../useChatRealtime';

const handlers = () => ({
  onMessage: vi.fn(),
  onMembership: vi.fn(),
  onSettings: vi.fn(),
  onResync: vi.fn(),
});

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useChatRealtime', () => {
  beforeEach(() => {
    created.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reconnects after the channel closes and fetches what was missed', async () => {
    const h = handlers();
    renderHook(() => useChatRealtime('user-1', h));
    await flush();
    expect(created).toHaveLength(1);

    act(() => created[0].statusCb?.('SUBSCRIBED'));
    expect(h.onResync).not.toHaveBeenCalled();

    // O servidor fecha o canal (BD lenta): volta a ligar com espera e pede o que perdeu.
    act(() => created[0].statusCb?.('CLOSED'));
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await flush();
    expect(created).toHaveLength(2);
    act(() => created[1].statusCb?.('SUBSCRIBED'));
    expect(h.onResync).toHaveBeenCalledTimes(1);
  });

  it('ignores status from a replaced channel and resyncs when the app comes back', async () => {
    const h = handlers();
    renderHook(() => useChatRealtime('user-1', h));
    await flush();
    act(() => created[0].statusCb?.('SUBSCRIBED'));
    created[0].state = 'joined';

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(h.onResync).toHaveBeenCalledTimes(1);
    // Não repete enquanto não passa o intervalo mínimo.
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(h.onResync).toHaveBeenCalledTimes(1);
    // Canal vivo: não abre outro.
    expect(created).toHaveLength(1);
  });
});
