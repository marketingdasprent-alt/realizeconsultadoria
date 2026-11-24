// @vitest-environment node
// deleteIfDraft (IMAP): regista quando o rascunho a apagar já não existe. Tudo simulado.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const imap = vi.hoisted(() => ({
  fetchOne: vi.fn(),
  messageDelete: vi.fn(async () => true),
}));
vi.mock('npm:imapflow@1.0.164', () => ({
  ImapFlow: class {
    usable = true;
    on() {}
    async connect() {}
    async logout() {}
    close() {}
    async list() {
      return [
        { path: 'INBOX', specialUse: '\\Inbox', flags: new Set() },
        { path: 'INBOX.Drafts', specialUse: '\\Drafts', flags: new Set(['\\Drafts']) },
      ];
    }
    async getMailboxLock() {
      return { release() {} };
    }
    fetchOne = imap.fetchOne;
    messageDelete = imap.messageDelete;
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

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  imap.fetchOne.mockReset();
  imap.messageDelete.mockClear();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

const driver = () => createImapDriver(cfg, async () => mailError('reauth'));

describe('IMAP deleteDraft', () => {
  it('rascunho que já não existe: regista pasta e uid, sem erro e sem apagar', async () => {
    imap.fetchOne.mockResolvedValue(false);
    await expect(driver().deleteDraft('INBOX.Drafts:68')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'mail-api imap: rascunho a apagar já não existe',
      'INBOX.Drafts',
      68
    );
    expect(imap.messageDelete).not.toHaveBeenCalled();
  });

  it('rascunho que existe: apaga, sem aviso', async () => {
    imap.fetchOne.mockResolvedValue({ uid: 69, flags: new Set(['\\Draft']) });
    await driver().deleteDraft('INBOX.Drafts:69');
    expect(imap.messageDelete).toHaveBeenCalledWith('69', { uid: true });
    expect(warn).not.toHaveBeenCalled();
  });

  it('email que não é rascunho noutra pasta: continua recusado', async () => {
    imap.fetchOne.mockResolvedValue({ uid: 5, flags: new Set(['\\Seen']) });
    await driver().deleteDraft('INBOX:5');
    expect(imap.messageDelete).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'mail-api imap: recusado apagar um email que não é rascunho',
      'INBOX',
      5
    );
  });
});
