import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  remember: vi.fn(),
}));
vi.mock('../../services/mailService', () => ({ mailService: { list: mocks.list } }));
vi.mock('../../services/contactService', () => ({
  contactService: { remember: mocks.remember },
}));

import { resetSessionMemory } from '@/lib/session-memory';
import { backfillContacts } from '../contactBackfill';

const sentPage = {
  data: { messages: [{ to: [{ email: 'cliente@exemplo.pt', name: 'Cliente' }] }] },
  error: null,
};

describe('backfillContacts: troca de conta a meio', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('sem troca de conta regista os contactos e marca como feito', async () => {
    mocks.list.mockResolvedValue(sentPage);
    mocks.remember.mockResolvedValue({ error: null });
    expect(await backfillContacts(['caixa-1'])).toBe(true);
    expect(mocks.remember).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('rz.mail.contacts.backfilled')).toBe('1');
  });

  it('se a conta mudar durante o pedido, os destinatários da anterior não vão para a nova', async () => {
    let answer!: (value: unknown) => void;
    mocks.list.mockReturnValue(
      new Promise(resolve => {
        answer = resolve;
      })
    );
    const running = backfillContacts(['caixa-1']);

    resetSessionMemory(); // outra conta entrou no separador
    answer(sentPage);

    expect(await running).toBe(false);
    expect(mocks.remember).not.toHaveBeenCalled();
    // e a conta nova ainda faz o seu próprio backfill
    expect(localStorage.getItem('rz.mail.contacts.backfilled')).toBeNull();
  });
});
