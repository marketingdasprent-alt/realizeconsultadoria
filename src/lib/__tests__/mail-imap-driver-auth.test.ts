// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Substitui apenas os pacotes externos: o driver e a classificação são os reais.
const transport = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock('npm:imapflow@1.0.164', () => ({
  ImapFlow: class {
    on() {}
    connect = transport.connect;
  },
}));
vi.mock('npm:mailparser@3.7.1', () => ({ simpleParser: vi.fn() }));
vi.mock('npm:nodemailer@6.9.15', () => ({ default: { createTransport: vi.fn() } }));
vi.mock('../../../supabase/functions/_shared/mail-server/http.ts', () => ({
  errorMessage: (e: unknown) => String(e),
}));
import { createImapDriver } from '../../../supabase/functions/mail-api/drivers/imap';
import { mailError } from '../../../supabase/functions/_shared/mail/errors';

const cfg = {
  email: 'simulado@example.invalid',
  displayName: null,
  username: 'simulado',
  password: 'valor-ficticio',
  imapHost: 'imap.example.invalid',
  imapPort: 993,
  smtpHost: 'smtp.example.invalid',
  smtpPort: 465,
};

describe('driver IMAP: recusa de login', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    transport.connect.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each(['UNAVAILABLE', 'TRYLATER', 'ETIMEDOUT'])(
    'erro %s não chama alteração para reauth',
    async code => {
      transport.connect.mockRejectedValue({ authenticationFailed: true, responseCode: code });
      const onAuth = vi.fn(async () => mailError('reauth'));
      const driver = createImapDriver(cfg, onAuth);
      const failure = expect(
        driver.list({
          folder: 'inbox',
          query: null,
          pageToken: null,
          limit: 1,
          withoutSnippets: true,
        })
      ).rejects.toMatchObject({ code: 'provider_error' });
      await vi.advanceTimersByTimeAsync(801);
      await failure;
      expect(transport.connect).toHaveBeenCalledTimes(2);
      expect(onAuth).not.toHaveBeenCalled();
    }
  );

  it('credenciais recusadas chamam reauth uma vez, sem repetição', async () => {
    transport.connect.mockRejectedValue({
      authenticationFailed: true,
      responseText: 'Invalid credentials',
    });
    const onAuth = vi.fn(async () => mailError('reauth', 'O servidor recusou o acesso à caixa.'));
    const driver = createImapDriver(cfg, onAuth);
    await expect(
      driver.list({
        folder: 'inbox',
        query: null,
        pageToken: null,
        limit: 1,
        withoutSnippets: true,
      })
    ).rejects.toMatchObject({ code: 'reauth', message: 'O servidor recusou o acesso à caixa.' });
    expect(onAuth).toHaveBeenCalledTimes(1);
    expect(transport.connect).toHaveBeenCalledTimes(1);
  });
});
