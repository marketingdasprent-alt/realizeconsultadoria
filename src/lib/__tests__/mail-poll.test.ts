// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MailDriver, MailSummary } from '../../../supabase/functions/_shared/mail/types';
import { imapSummary } from '../../../supabase/functions/_shared/mail/imap-parse';
import { pickFresh } from '../../../supabase/functions/mail-api/pollFresh';

// O poll.ts importa o cliente Supabase por URL (só existe na função): troca-se por simulações.
vi.mock('../../../supabase/functions/_shared/mail-server/http.ts', () => ({
  errorMessage: (e: unknown) => String(e),
  mapWithGroupLimit: <T, R>(items: T[], _key: unknown, _limit: number, fn: (x: T) => Promise<R>) =>
    Promise.all(items.map(fn)),
}));
vi.mock('../../../supabase/functions/mail-api/rules.ts', () => ({
  activeRulesByAccount: async () => new Map(),
  applyRules: async () => ({ moved: new Set<string>() }),
}));
vi.mock('../../../supabase/functions/mail-api/messageCache.ts', () => ({
  inBackground: () => undefined,
  pruneCached: async () => undefined,
  writeCached: async () => undefined,
}));

import { pollNewMail } from '../../../supabase/functions/mail-api/poll';

const NOW = Date.parse('2026-11-20T12:00:00.000Z');
const iso = (offsetMin: number) => new Date(NOW + offsetMin * 60_000).toISOString();

const mail = (
  id: string,
  over: Partial<MailSummary> & { arrived?: number; header?: number } = {}
): MailSummary => ({
  id,
  thread_id: null,
  from: { name: `Remetente ${id}`, email: `${id}@exemplo.pt` },
  to: [],
  subject: `Assunto ${id}`,
  snippet: '',
  // Como no IMAP: `date` é a do cabeçalho (o remetente escolhe-a), `received_at` a de chegada
  date: iso(over.header ?? over.arrived ?? 0),
  received_at: iso(over.arrived ?? 0),
  unread: true,
  starred: false,
  has_attachments: false,
  ...over,
});

/** Base simulada: só o que o poll usa (contas, membros, reservas e avisos). */
const makeDb = (account: Record<string, unknown>) => {
  const row: Record<string, unknown> = { polled_at: null, notified_until: null, ...account };
  const notices: { user: string; title: string; body: string }[] = [];
  const builder = (table: string) => {
    const q = {
      op: 'select',
      patch: null as Record<string, unknown> | null,
      filters: [] as ((r: typeof row) => boolean)[],
    };
    const run = () => {
      if (table === 'mail_account_members') return { data: [{ user_id: 'u2' }] };
      const hits = q.filters.every(f => f(row)) ? [row] : [];
      if (q.op === 'update' && hits.length) Object.assign(row, q.patch);
      return { data: hits.map(r => ({ id: r.id })), error: null };
    };
    const b: Record<string, unknown> = {
      select: () => b,
      update: (patch: Record<string, unknown>) => ((q.op = 'update'), (q.patch = patch), b),
      eq: (col: string, value: unknown) => (q.filters.push(r => (r as never)[col] === value), b),
      is: (col: string, value: unknown) => (q.filters.push(r => (r as never)[col] === value), b),
      or: () => b,
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(
          table === 'mail_accounts' && q.op === 'select' ? { data: [row], error: null } : run()
        ).then(ok, ko),
    };
    return b;
  };
  const db = {
    from: builder,
    rpc: async (_name: string, args: { _user_id: string; _title: string; _body: string }) => {
      notices.push({ user: args._user_id, title: args._title, body: args._body });
      return { error: null };
    },
  };
  return { db: db as never, row, notices };
};

const account = (over: Record<string, unknown> = {}) => ({
  id: 'conta-1',
  user_id: 'u1',
  notify: true,
  email: 'caixa@dasprent.pt',
  auth_method: 'graph',
  provider: 'microsoft',
  status: 'active',
  imap_host: null,
  ...over,
});

const driverOf = (inbox: () => MailSummary[]): MailDriver =>
  ({
    list: async () => ({ messages: inbox(), next_page_token: null }),
    get: async (id: string) => ({ ...mail(id), text: '', html: null }),
  }) as unknown as MailDriver;

describe('avisos de email novo (poll)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  const pass = (db: never, inbox: MailSummary[]) =>
    pollNewMail(db, async () => driverOf(() => inbox));

  it('a primeira passagem só marca o ponto de partida e não avisa dos antigos', async () => {
    const { db, row, notices } = makeDb(account());
    const inbox = [mail('a', { arrived: -30 }), mail('b', { arrived: -10 })];
    const result = await pass(db, inbox);
    expect(result.notified).toBe(0);
    expect(notices).toHaveLength(0);
    expect(row.notified_until).toBe(iso(-10));
  });

  it('avisa um email com Date antigo que chegou depois do último avisado', async () => {
    const { db, notices } = makeDb(account({ notified_until: iso(-5) }));
    // Resposta automática: cabeçalho Date de há 2 dias, mas chegou agora
    const auto = mail('auto', { arrived: -1, header: -2 * 24 * 60 });
    const result = await pass(db, [auto, mail('velho', { arrived: -30, unread: false })]);
    expect(result.notified).toBe(1);
    expect(notices).toEqual([{ user: 'u1', title: 'Remetente auto', body: 'Assunto auto' }]);
  });

  it('avisa quando o email chegou depois mas o Date é anterior ao de outro já avisado', async () => {
    const { db, row, notices } = makeDb(account({ notified_until: iso(-10) }));
    const inbox = [mail('x', { arrived: -4, header: -3 })];
    await pass(db, inbox);
    expect(notices).toHaveLength(1);
    // Chega outro, com Date de há 1 hora (anterior ao anterior), mas a chegada é posterior
    const late = mail('y', { arrived: -2, header: -60 });
    await pass(db, [late, ...inbox]);
    expect(notices.map(n => n.title)).toEqual(['Remetente x', 'Remetente y']);
    expect(row.notified_until).toBe(iso(-2));
  });

  it('o mesmo email não avisa duas vezes, nem com passagens repetidas', async () => {
    const { db, notices } = makeDb(account({ notified_until: iso(-5) }));
    const inbox = [mail('novo', { arrived: -1, header: -999 })];
    await pass(db, inbox);
    await pass(db, inbox);
    await pass(db, inbox);
    expect(notices).toHaveLength(1);
  });

  it('não avisa dos lidos nem de uma caixa com os avisos desligados', async () => {
    const lidos = makeDb(account({ notified_until: iso(-5) }));
    await pass(lidos.db, [mail('lido', { arrived: -1, unread: false })]);
    expect(lidos.notices).toHaveLength(0);
    const desligada = makeDb(account({ notified_until: iso(-5), notify: false }));
    await pass(desligada.db, [mail('n', { arrived: -1 })]);
    expect(desligada.notices).toHaveLength(0);
  });

  it('mais de 3 emails novos vão num só aviso', async () => {
    const { db, notices } = makeDb(account({ notified_until: iso(-30) }));
    await pass(
      db,
      ['a', 'b', 'c', 'd'].map((id, i) => mail(id, { arrived: -10 + i, header: -5000 }))
    );
    expect(notices).toHaveLength(1);
    expect(notices[0].title).toBe('4 emails novos');
  });
});

describe('pickFresh', () => {
  const now = NOW;

  it('decide pela chegada e não pela data do cabeçalho', () => {
    const since = Date.parse(iso(-5));
    const antigoDate = mail('a', { arrived: -1, header: -9999 });
    const futuroDate = mail('b', { arrived: -20, header: 60 });
    const { fresh } = pickFresh([antigoDate, futuroDate], since, undefined, now);
    expect(fresh.map(m => m.id)).toEqual(['a']);
  });

  it('sem received_at usa a data do fornecedor (Gmail e Microsoft 365)', () => {
    const m = { ...mail('g', { arrived: -1 }), received_at: undefined };
    const { fresh } = pickFresh([m], Date.parse(iso(-5)), undefined, now);
    expect(fresh).toHaveLength(1);
  });

  it('ordena do mais antigo para o mais recente pela chegada', () => {
    const a = mail('a', { arrived: -1, header: -100 });
    const b = mail('b', { arrived: -3, header: 0 });
    const { fresh } = pickFresh([a, b], Date.parse(iso(-5)), undefined, now);
    expect(fresh.map(m => m.id)).toEqual(['b', 'a']);
  });

  it('ignora os movidos pelas regras e a primeira passagem (since null)', () => {
    const m = mail('m', { arrived: -1 });
    expect(pickFresh([m], Date.parse(iso(-5)), new Set(['m']), now).fresh).toHaveLength(0);
    const first = pickFresh([m], null, undefined, now);
    expect(first.fresh).toHaveLength(0);
    expect(first.newest).toBe(Date.parse(iso(-1)));
  });

  it('uma chegada no futuro conta como agora e o ponto de partida nunca recua', () => {
    const futuro = mail('f', { arrived: 60 * 24 });
    const { newest } = pickFresh([futuro], Date.parse(iso(-5)), undefined, now);
    expect(newest).toBe(now + 5 * 60_000);
    const velho = pickFresh([mail('v', { arrived: -90 })], Date.parse(iso(-5)), undefined, now);
    expect(velho.newest).toBe(Date.parse(iso(-5)));
  });
});

describe('imapSummary: data de chegada', () => {
  it('guarda o INTERNALDATE em received_at, mesmo com um cabeçalho Date antigo', () => {
    const summary = imapSummary({
      id: 'INBOX:1',
      envelope: { date: new Date('2024-01-01T00:00:00Z') as never, subject: 'Resposta automática' },
      internalDate: new Date('2026-11-20T11:59:00Z'),
    });
    expect(summary.date).toBe('2024-01-01T00:00:00.000Z');
    expect(summary.received_at).toBe('2026-11-20T11:59:00.000Z');
  });

  it('sem INTERNALDATE válido, received_at fica a null', () => {
    expect(imapSummary({ id: 'INBOX:2', internalDate: 'lixo' }).received_at).toBeNull();
    expect(imapSummary({ id: 'INBOX:3' }).received_at).toBeNull();
  });
});
