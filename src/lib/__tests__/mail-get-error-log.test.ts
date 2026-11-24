// @vitest-environment node
// Registo dos erros do get na mail-api (diagnóstico do «O rascunho não abriu»). Tudo simulado.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ACCOUNT = '1f1302c2-0000-4000-8000-000000000001';
const { driverGet } = vi.hoisted(() => ({ driverGet: vi.fn() }));

vi.mock('../../../supabase/functions/_shared/mail-server/http.ts', () => ({
  corsHeaders: {},
  json: (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  serviceClient: () => ({}),
  authenticatedUserId: async () => 'user-1',
  errorMessage: (e: unknown) => String(e),
  fetchWithTimeout: vi.fn(),
  mapWithConcurrency: async <T, R>(items: T[], _l: number, fn: (x: T, i: number) => Promise<R>) =>
    Promise.all(items.map(fn)),
  mapWithGroupLimit: async <T, R>(items: T[], _k: unknown, _l: number, fn: (x: T) => Promise<R>) =>
    Promise.all(items.map(fn)),
}));
vi.mock('../../../supabase/functions/_shared/mail-server/accounts.ts', () => ({
  ACCOUNT_COLUMNS: '*',
  deleteMailAccount: vi.fn(),
  loadAccount: async (_db: unknown, id: string) => ({
    id,
    user_id: 'user-1',
    email: 'marketing@useauto.pt',
    display_name: null,
    auth_method: 'imap',
    imap_host: 'imap.x',
    imap_port: 993,
    smtp_host: 'smtp.x',
    smtp_port: 465,
  }),
  readSecret: async () => JSON.stringify({ username: 'u', password: 'p' }),
  saveMailAccount: vi.fn(),
  storeSecret: vi.fn(),
  updateAccountStatus: vi.fn(),
}));
vi.mock('../../../supabase/functions/mail-api/drivers/imap.ts', () => ({
  createImapDriver: () => ({ get: driverGet }),
  testImapLogin: vi.fn(),
}));
vi.mock('../../../supabase/functions/mail-api/messageCache.ts', () => ({
  clearCachedMessages: vi.fn(),
  inBackground: () => undefined,
  readCached: async () => null,
  writeCached: async () => undefined,
}));
vi.mock('../../../supabase/functions/mail-api/labels.ts', () => ({
  attachLabels: async (_db: unknown, _a: string, list: unknown[]) => list,
}));
vi.mock('../../../supabase/functions/mail-api/sendLog.ts', () => ({
  logSend: vi.fn(),
  sendDailyReport: vi.fn(),
}));

(globalThis as { Deno?: unknown }).Deno = { env: { get: () => undefined } };

import { mailError } from '../../../supabase/functions/_shared/mail/errors';
import { mailApiHandler } from '../../../supabase/functions/mail-api/handler';

const call = (body: Record<string, unknown>) =>
  mailApiHandler(
    new Request('https://x/mail-api', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
      body: JSON.stringify(body),
    })
  );

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  driverGet.mockReset();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

const getWarnings = () =>
  warn.mock.calls.filter(args => String(args[0]).startsWith('mail-api get falhou'));

describe('mail-api: registo do get que falha', () => {
  it('MailError: regista conta, id, código e mensagem; a resposta fica igual', async () => {
    driverGet.mockRejectedValue(
      mailError('message_not_found', 'A mensagem já não existe nesta caixa.')
    );
    const res = await call({ action: 'get', account_id: ACCOUNT, message_id: 'INBOX.Drafts:42' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: false,
      code: 'message_not_found',
      message: 'A mensagem já não existe nesta caixa.',
    });
    expect(getWarnings()).toEqual([
      [
        `mail-api get falhou: conta=${ACCOUNT}`,
        'id=INBOX.Drafts:42',
        'message_not_found',
        'A mensagem já não existe nesta caixa.',
      ],
    ]);
  });

  it('id com quebras de linha e enorme: sem quebras e cortado a 300', async () => {
    driverGet.mockRejectedValue(mailError('message_not_found'));
    const id = `INBOX.Drafts:42\r\nX-Injetado: sim${'a'.repeat(1500)}`;
    await call({ action: 'get', account_id: ACCOUNT, message_id: id });
    const [entry] = getWarnings();
    const idPart = String(entry[1]);
    expect(idPart).not.toMatch(/[\r\n\0]/);
    expect(idPart.length).toBe('id='.length + 300);
    expect(idPart.startsWith('id=INBOX.Drafts:42  X-Injetado')).toBe(true);
  });

  it('sem conteúdo do email no registo', async () => {
    const err = mailError('provider_error', 'O servidor de email recusou o pedido.');
    driverGet.mockRejectedValue(err);
    await call({ action: 'get', account_id: ACCOUNT, message_id: 'INBOX.Drafts:42' });
    const text = JSON.stringify(getWarnings());
    expect(text).not.toMatch(/subject|html|password|"u"|"p"/i);
    expect(getWarnings()).toHaveLength(1);
  });

  it('get que corre bem não regista nada', async () => {
    driverGet.mockResolvedValue({
      id: 'INBOX.Drafts:42',
      html: null,
      text: 'olá',
      attachments: [],
    });
    const res = await call({ action: 'get', account_id: ACCOUNT, message_id: 'INBOX.Drafts:42' });
    expect((await res.json()).ok).toBe(true);
    expect(getWarnings()).toHaveLength(0);
  });

  it('outras ações com erro não usam esta linha', async () => {
    driverGet.mockRejectedValue(mailError('message_not_found'));
    await call({
      action: 'attachment',
      account_id: ACCOUNT,
      message_id: 'm',
      attachment_id: 'p:2',
    });
    expect(getWarnings()).toHaveLength(0);
  });
});
