import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/mailService', () => ({
  mailService: { outboxStatus: vi.fn() },
}));

import { mailService } from '../../services/mailService';
import { waitForOutbox } from '../outbox';

const status = vi.mocked(mailService.outboxStatus);

describe('waitForOutbox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    status.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('espera enquanto está na fila e acaba quando sai', async () => {
    status
      .mockResolvedValueOnce({
        data: [{ id: 'a', status: 'queued', last_error: null }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ id: 'a', status: 'sent', last_error: null }],
        error: null,
      });
    const result = waitForOutbox('a');
    await vi.advanceTimersByTimeAsync(6000);
    await expect(result).resolves.toEqual({ status: 'sent' });
    expect(status).toHaveBeenCalledTimes(2);
  });

  it('devolve o motivo quando falha', async () => {
    status.mockResolvedValueOnce({
      data: [{ id: 'a', status: 'failed', last_error: 'O servidor SMTP recusou o envio.' }],
      error: null,
    });
    const result = waitForOutbox('a');
    await vi.advanceTimersByTimeAsync(3000);
    await expect(result).resolves.toEqual({
      status: 'failed',
      error: { code: 'error', message: 'O servidor SMTP recusou o envio.' },
    });
  });

  it('deixa de esperar ao fim de 5 minutos (o servidor continua)', async () => {
    status.mockResolvedValue({
      data: [{ id: 'a', status: 'sending', last_error: null }],
      error: null,
    });
    const result = waitForOutbox('a');
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 3000);
    await expect(result).resolves.toEqual({ status: 'pending' });
  });
});
