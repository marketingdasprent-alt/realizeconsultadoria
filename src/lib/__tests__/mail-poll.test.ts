// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// http.ts importa o cliente Supabase por URL (Deno): aqui só é preciso o errorMessage.
vi.mock('../../../supabase/functions/_shared/mail-server/http', () => ({
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

import { pollNewMail } from '../../../supabase/functions/mail-api/poll';
import type { MailAccountRow } from '../../../supabase/functions/_shared/mail-server/accounts';
import type { MailDriver, MailSummary } from '../../../supabase/functions/_shared/mail/types';

type Row = Record<string, unknown>;
type Filter = { op: 'eq' | 'neq'; column: string; value: unknown };

/** BD falsa: guarda as contas em memória e regista cada UPDATE e cada RPC. */
const fakeDb = (tables: Record<string, Row[]>, claim = { claimed: true, imap: true }) => {
  const updates: { table: string; patch: Row; filters: Filter[] }[] = [];
  const rpcs: { name: string; args: Row }[] = [];
  const selects: { table: string; filters: Filter[] }[] = [];

  const builder = (table: string, patch?: Row) => {
    const filters: Filter[] = [];
    const matches = (row: Row) =>
      filters.every(f => (f.op === 'eq' ? row[f.column] === f.value : row[f.column] !== f.value));
    const run = () => {
      if (patch) {
        updates.push({ table, patch, filters });
        (tables[table] ?? []).filter(matches).forEach(row => Object.assign(row, patch));
        return { data: null, error: null };
      }
      selects.push({ table, filters });
      return { data: (tables[table] ?? []).filter(matches).map(row => ({ ...row })), error: null };
    };
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => (filters.push({ op: 'eq', column, value }), query),
      neq: (column: string, value: unknown) => (filters.push({ op: 'neq', column, value }), query),
      then: <T>(resolve: (value: ReturnType<typeof run>) => T) =>
        Promise.resolve(run()).then(resolve),
    };
    return query;
  };

  const db = {
    from: (table: string) => ({
      select: () => builder(table),
      update: (patch: Row) => builder(table, patch),
    }),
    rpc: async (name: string, args: Row) => {
      rpcs.push({ name, args });
      return { data: name === 'mail_poll_claim' ? claim : null, error: null };
    },
  } as unknown as SupabaseClient;

  return { db, updates, rpcs, selects };
};

/** Como o PostgREST devolve um timestamptz (com "+00:00", não "Z"). */
const pgTime = (iso: string) => iso.replace(/\.000Z$/, '+00:00');

const account = (index: number, overrides: Partial<Row> = {}): Row => ({
  id: `acc-${index}`,
  user_id: `user-${index}`,
  access_id: null,
  company_id: null,
  provider: 'microsoft',
  auth_method: index % 4 === 0 ? 'imap' : 'app-microsoft',
  email: `caixa${index}@realize.pt`,
  display_name: null,
  imap_host: null,
  imap_port: null,
  smtp_host: null,
  smtp_port: null,
  status: 'active',
  is_default: true,
  notified_until: pgTime('2026-10-20T19:25:06.000Z'),
  notify: true,
  ...overrides,
});

const mail = (date: string, unread: boolean, subject = 'Olá'): MailSummary =>
  ({
    id: `m-${date}`,
    date,
    unread,
    subject,
    from: { name: 'Cliente', email: 'cliente@exemplo.pt' },
  }) as unknown as MailSummary;

const driverWith = (byAccount: Record<string, MailSummary[]>) =>
  vi.fn(async (_db: SupabaseClient, row: MailAccountRow) => {
    const messages = byAccount[row.id] ?? [];
    return {
      list: vi.fn(async () => ({ messages, nextPageToken: null })),
    } as unknown as MailDriver;
  });

const mailAccountUpdates = <T extends { table: string }>(updates: T[]) =>
  updates.filter(u => u.table === 'mail_accounts');

describe('pollNewMail', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('N contas sem novidades → 0 UPDATE em mail_accounts e uma só reserva', async () => {
    const accounts = Array.from({ length: 20 }, (_, i) => account(i));
    const { db, updates, rpcs } = fakeDb({ mail_accounts: accounts });
    // Os mesmos emails de sempre: o mais recente é exatamente o notified_until guardado.
    const old = [mail('2026-10-20T19:25:06.000Z', true), mail('2026-10-20T10:00:00.000Z', false)];
    const createDriver = driverWith(Object.fromEntries(accounts.map(a => [a.id, old])));

    const result = await pollNewMail(db, createDriver);

    expect(result).toEqual({ accounts: 20, notified: 0 });
    expect(createDriver).toHaveBeenCalledTimes(20);
    expect(mailAccountUpdates(updates)).toHaveLength(0);
    expect(rpcs.map(r => r.name)).toEqual(['mail_poll_claim']);
  });

  it('caixa vazia já marcada → 0 UPDATE', async () => {
    const { db, updates } = fakeDb({ mail_accounts: [account(1), account(2)] });
    await pollNewMail(db, driverWith({}));
    expect(mailAccountUpdates(updates)).toHaveLength(0);
  });

  it('email novo por ler → avisa e grava notified_until só nessa conta', async () => {
    const accounts = [account(1), account(2), account(3)];
    const { db, updates, rpcs } = fakeDb({ mail_accounts: accounts });
    const createDriver = driverWith({
      'acc-2': [
        mail('2026-10-21T08:30:00.000Z', true, 'Fatura'),
        mail('2026-10-20T09:00:00.000Z', true),
      ],
    });

    const result = await pollNewMail(db, createDriver);

    expect(result.notified).toBe(1);
    expect(mailAccountUpdates(updates)).toEqual([
      {
        table: 'mail_accounts',
        patch: { notified_until: '2026-10-21T08:30:00.000Z' },
        filters: [{ op: 'eq', column: 'id', value: 'acc-2' }],
      },
    ]);
    const notices = rpcs.filter(r => r.name === 'rz_notify');
    expect(notices).toHaveLength(1);
    expect(notices[0].args).toMatchObject({
      _user_id: 'user-2',
      _title: 'Cliente',
      _body: 'Fatura',
    });
  });

  it('a passagem seguinte com os mesmos emails já não grava nada', async () => {
    const accounts = [account(1)];
    const { db, updates } = fakeDb({ mail_accounts: accounts });
    const createDriver = driverWith({ 'acc-1': [mail('2026-10-21T08:30:00.000Z', true)] });

    await pollNewMail(db, createDriver);
    // Como a BD o devolveria na leitura seguinte.
    accounts[0].notified_until = pgTime(String(accounts[0].notified_until));
    await pollNewMail(db, createDriver);

    expect(mailAccountUpdates(updates)).toHaveLength(1);
  });

  it('email novo já lido → avança o notified_until sem avisar', async () => {
    const { db, updates, rpcs } = fakeDb({ mail_accounts: [account(1)] });
    await pollNewMail(db, driverWith({ 'acc-1': [mail('2026-10-21T08:30:00.000Z', false)] }));
    expect(mailAccountUpdates(updates)).toHaveLength(1);
    expect(rpcs.filter(r => r.name === 'rz_notify')).toHaveLength(0);
  });

  it('primeira passagem numa conta → marca o ponto de partida sem avisar', async () => {
    const { db, updates, rpcs } = fakeDb({
      mail_accounts: [account(1, { notified_until: null })],
    });
    await pollNewMail(db, driverWith({ 'acc-1': [mail('2026-10-21T08:30:00.000Z', true)] }));
    expect(mailAccountUpdates(updates)).toEqual([
      expect.objectContaining({ patch: { notified_until: '2026-10-21T08:30:00.000Z' } }),
    ]);
    expect(rpcs.filter(r => r.name === 'rz_notify')).toHaveLength(0);
  });

  it('reserva ocupada por outra passagem → não lê nem grava nada', async () => {
    const { db, updates, selects } = fakeDb(
      { mail_accounts: [account(1), account(2)] },
      { claimed: false, imap: false }
    );
    const createDriver = driverWith({});

    expect(await pollNewMail(db, createDriver)).toEqual({ accounts: 0, notified: 0 });
    expect(createDriver).not.toHaveBeenCalled();
    expect(selects).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  it('fora da vez das IMAP → só lê as outras caixas', async () => {
    const accounts = Array.from({ length: 8 }, (_, i) => account(i));
    const { db } = fakeDb({ mail_accounts: accounts }, { claimed: true, imap: false });
    const createDriver = driverWith({});

    const result = await pollNewMail(db, createDriver);

    const polled = createDriver.mock.calls.map(([, row]) => row.auth_method);
    expect(result.accounts).toBe(6);
    expect(polled).not.toContain('imap');
  });

  it('uma caixa com erro não para as outras nem grava nada nela', async () => {
    const { db, updates } = fakeDb({ mail_accounts: [account(1), account(2)] });
    const createDriver = vi.fn(async (_db: SupabaseClient, row: MailAccountRow) => {
      if (row.id === 'acc-1') throw new Error('servidor em baixo');
      return {
        list: vi.fn(async () => ({
          messages: [mail('2026-10-21T08:30:00.000Z', true)],
          nextPageToken: null,
        })),
      } as unknown as MailDriver;
    });

    const result = await pollNewMail(db, createDriver);

    expect(result.notified).toBe(1);
    expect(mailAccountUpdates(updates).map(u => u.filters[0].value)).toEqual(['acc-2']);
  });
});
