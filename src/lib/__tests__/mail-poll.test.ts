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
  activeRulesByAccount: vi.fn(async () => new Map()),
  applyRules: vi.fn(async () => ({ moved: new Set<string>() })),
}));
vi.mock('../../../supabase/functions/mail-api/messageCache.ts', () => ({
  inBackground: () => undefined,
  pruneCached: async () => undefined,
  writeCached: async () => undefined,
}));

import { pollNewMail } from '../../../supabase/functions/mail-api/poll';
import { activeRulesByAccount, applyRules } from '../../../supabase/functions/mail-api/rules';

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

/** Parser limitado aos operadores do poll, sem ignorar filtros desconhecidos. */
const splitFilters = (text: string) => {
  let depth = 0;
  let start = 0;
  const parts: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    if (text[i] === ')') depth--;
    if (text[i] === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  return [...parts, text.slice(start)];
};
const matches = (row: Record<string, unknown>, filter: string): boolean => {
  if (filter.startsWith('and('))
    return splitFilters(filter.slice(4, -1)).every(f => matches(row, f));
  const [, col, op, value] = filter.match(/^([^.]+)\.(eq|is|lt)\.(.*)$/) ?? [];
  if (!col) throw new Error(`Filtro não simulado: ${filter}`);
  if (op === 'is') return value === 'null' && row[col] === null;
  if (op === 'eq') return row[col] === value;
  return typeof row[col] === 'string' && row[col] < value;
};

/** Base em memória: filtros, snapshots e versão nova a cada UPDATE. Não simula Postgres. */
const makeDb = (account: Record<string, unknown>) => {
  const row: Record<string, unknown> = {
    polled_at: null,
    notified_until: null,
    updated_at: iso(-60),
    ...account,
  };
  let version = 0;
  const writes: Record<string, unknown>[] = [];
  const notices: { user: string; title: string; body: string }[] = [];
  const builder = (table: string) => {
    const q = {
      op: 'select',
      columns: '*',
      patch: null as Record<string, unknown> | null,
      filters: [] as ((r: typeof row) => boolean)[],
    };
    const run = () => {
      if (table === 'mail_account_members') return { data: [{ user_id: 'u2' }] };
      if (table !== 'mail_accounts') throw new Error(`Tabela não simulada: ${table}`);
      const hits = q.filters.every(f => f(row)) ? [row] : [];
      if (q.op === 'update' && hits.length) {
        writes.push({ ...q.patch });
        Object.assign(row, q.patch, { updated_at: new Date(NOW + ++version).toISOString() });
      }
      return {
        data: hits.map(r =>
          Object.fromEntries(
            q.columns === '*'
              ? Object.entries(r)
              : q.columns.split(',').map(c => [c.trim(), r[c.trim()]])
          )
        ),
        error: null,
      };
    };
    const b: Record<string, unknown> = {
      select: (columns = '*') => ((q.columns = columns), b),
      update: (patch: Record<string, unknown>) => ((q.op = 'update'), (q.patch = patch), b),
      eq: (col: string, value: unknown) => (q.filters.push(r => (r as never)[col] === value), b),
      is: (col: string, value: unknown) => (q.filters.push(r => (r as never)[col] === value), b),
      or: (filter: string) => (
        q.filters.push(r => splitFilters(filter).some(f => matches(r, f))),
        b
      ),
      then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(ok, ko),
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
  return { db: db as never, row, notices, writes };
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
    vi.setSystemTime(NOW + 120_000);
    await pass(db, [late, ...inbox]);
    expect(notices.map(n => n.title)).toEqual(['Remetente x', 'Remetente y']);
    expect(row.notified_until).toBe(iso(-2));
  });

  it('o mesmo email não avisa duas vezes, nem com passagens repetidas', async () => {
    const { db, notices } = makeDb(account({ notified_until: iso(-5) }));
    const inbox = [mail('novo', { arrived: -1, header: -999 })];
    await pass(db, inbox);
    vi.setSystemTime(NOW + 120_000);
    await pass(db, inbox);
    vi.setSystemTime(NOW + 240_000);
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

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
};
const recoveryAccount = (over: Record<string, unknown> = {}) =>
  account({
    auth_method: 'imap',
    provider: 'imap',
    imap_host: 'imap.example.invalid',
    status: 'reauth',
    last_error: 'recusa anterior',
    notified_until: iso(-10),
    ...over,
  });
const simulatedDriver = () => ({
  list: vi.fn(async (_params: Parameters<MailDriver['list']>[0]) => ({
    messages: [] as MailSummary[],
    next_page_token: null,
  })),
  get: vi.fn(),
  send: vi.fn(),
  move: vi.fn(),
  mark: vi.fn(),
});
const asDriver = (d: ReturnType<typeof simulatedDriver>) => d as unknown as MailDriver;

describe('recuperação IMAP', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.mocked(activeRulesByAccount).mockResolvedValue(
      new Map([['conta-1', [{ id: 'regra-simulada' } as never]]])
    );
    vi.mocked(applyRules).mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([false, true])('recupera com lista vazia=%s sem efeitos laterais', async empty => {
    const state = makeDb(
      recoveryAccount({ credentials: 'simuladas', permissions: ['ler'], members: ['u1'] })
    );
    const before = { ...state.row };
    const driver = simulatedDriver();
    if (!empty) driver.list.mockResolvedValue({ messages: [mail('novo')], next_page_token: null });
    const result = await pollNewMail(state.db, async () => asDriver(driver));
    expect(state.row).toEqual({
      ...before,
      status: 'active',
      last_error: null,
      polled_at: iso(0),
      updated_at: state.row.updated_at,
    });
    expect(state.writes).toEqual([{ polled_at: iso(0) }, { status: 'active', last_error: null }]);
    expect(driver.list).toHaveBeenCalledExactlyOnceWith({
      folder: 'inbox',
      query: null,
      pageToken: null,
      limit: 1,
      withoutSnippets: true,
    });
    expect(driver.get).not.toHaveBeenCalled();
    expect(driver.send).not.toHaveBeenCalled();
    expect(driver.move).not.toHaveBeenCalled();
    expect(driver.mark).not.toHaveBeenCalled();
    expect(applyRules).not.toHaveBeenCalled();
    expect(state.notices).toHaveLength(0);
    expect(result.notified).toBe(0);
  });

  it.each(['credenciais', 'rede'])(
    'falha de %s permanece bloqueada e respeita 30 minutos',
    async cause => {
      const state = makeDb(recoveryAccount());
      const driver = simulatedDriver();
      driver.list.mockRejectedValue(new Error(cause));
      const create = vi.fn(async () => asDriver(driver));
      await pollNewMail(state.db, create);
      expect(state.row.status).toBe('reauth');
      expect(state.row.last_error).toBe('recusa anterior');
      vi.setSystemTime(NOW + 30 * 60_000 - 1);
      await pollNewMail(state.db, create);
      expect(create).toHaveBeenCalledTimes(1);
      vi.setSystemTime(NOW + 30 * 60_000 + 1);
      await pollNewMail(state.db, create);
      expect(create).toHaveBeenCalledTimes(2);
      expect(state.row.status).toBe('reauth');
    }
  );

  it('duas passagens concorrentes só reservam e consultam uma vez', async () => {
    const state = makeDb(recoveryAccount());
    const driver = simulatedDriver();
    const entered = deferred<void>();
    const finish = deferred<{ messages: MailSummary[]; next_page_token: null }>();
    driver.list.mockImplementation(async () => {
      entered.resolve();
      return finish.promise;
    });
    const create = vi.fn(async () => asDriver(driver));
    const first = pollNewMail(state.db, create);
    const second = pollNewMail(state.db, create);
    await entered.promise;
    expect(create).toHaveBeenCalledTimes(1);
    finish.resolve({ messages: [], next_page_token: null });
    await Promise.all([first, second]);
    expect(state.row.status).toBe('active');
    expect(state.writes).toHaveLength(2);
  });

  it.each(['lista', 'createDriver'])(
    'resposta tardia em %s não reativa nem continua leitura',
    async slow => {
      const state = makeDb(recoveryAccount());
      const driver = simulatedDriver();
      const gate = deferred<void>();
      const entered = deferred<void>();
      if (slow === 'lista')
        driver.list.mockImplementation(async () => {
          entered.resolve();
          await gate.promise;
          return { messages: [], next_page_token: null };
        });
      const pending = pollNewMail(state.db, async () => {
        if (slow === 'createDriver') {
          entered.resolve();
          await gate.promise;
        }
        return asDriver(driver);
      });
      await entered.promise;
      await vi.advanceTimersByTimeAsync(20_001);
      await pending;
      expect(state.row.status).toBe('reauth');
      gate.resolve();
      await vi.advanceTimersByTimeAsync(0);
      expect(state.row.status).toBe('reauth');
      expect(driver.list).toHaveBeenCalledTimes(slow === 'lista' ? 1 : 0);
      expect(state.writes).toEqual([{ polled_at: iso(0) }]);
    }
  );

  it.each([19_999, 20_000])('resposta aos %i ms respeita prazo estrito', async ms => {
    const state = makeDb(recoveryAccount());
    const driver = simulatedDriver();
    driver.list.mockImplementation(async () => {
      vi.setSystemTime(NOW + ms);
      return { messages: [], next_page_token: null };
    });
    await pollNewMail(state.db, async () => asDriver(driver));
    expect(state.row.status).toBe(ms < 20_000 ? 'active' : 'reauth');
  });

  it.each(['status', 'polled_at', 'updated_at'])(
    'não sobrescreve mudança concorrente de %s',
    async field => {
      const state = makeDb(recoveryAccount());
      const driver = simulatedDriver();
      driver.list.mockImplementation(async () => {
        state.row[field] = field === 'status' ? 'error' : iso(1);
        state.row.last_error = 'alteração concorrente';
        return { messages: [], next_page_token: null };
      });
      await pollNewMail(state.db, async () => asDriver(driver));
      expect(state.row.status).toBe(field === 'status' ? 'error' : 'reauth');
      expect(state.row.last_error).toBe('alteração concorrente');
      expect(state.writes).toEqual([{ polled_at: iso(0) }]);
    }
  );

  it.each([
    { auth_method: 'oauth-google', status: 'reauth' },
    { auth_method: 'oauth-microsoft', status: 'reauth' },
    { auth_method: 'app-microsoft', status: 'reauth' },
    { auth_method: 'imap', status: 'error' },
  ])('exclui $auth_method em $status antes de reservar', async over => {
    const state = makeDb(recoveryAccount(over));
    const create = vi.fn();
    const result = await pollNewMail(state.db, create);
    expect(result.accounts).toBe(0);
    expect(create).not.toHaveBeenCalled();
    expect(state.writes).toHaveLength(0);
  });

  it('mudança de estado entre seleção e reserva impede a leitura', async () => {
    const state = makeDb(recoveryAccount());
    vi.mocked(activeRulesByAccount).mockImplementationOnce(async () => {
      state.row.status = 'error';
      return new Map();
    });
    const create = vi.fn();
    await pollNewMail(state.db, create);
    expect(create).not.toHaveBeenCalled();
    expect(state.writes).toHaveLength(0);
  });

  it('após recuperar só a passagem normal seguinte aplica regras e avisa', async () => {
    const state = makeDb(recoveryAccount());
    const driver = simulatedDriver();
    driver.list.mockResolvedValue({
      messages: [mail('novo', { arrived: -1 })],
      next_page_token: null,
    });
    const create = vi.fn(async () => asDriver(driver));
    await pollNewMail(state.db, create);
    expect(state.row.notified_until).toBe(iso(-10));
    expect(applyRules).not.toHaveBeenCalled();
    vi.setSystemTime(NOW + 109_999);
    await pollNewMail(state.db, create);
    expect(create).toHaveBeenCalledTimes(1);
    vi.setSystemTime(NOW + 120_000);
    await pollNewMail(state.db, create);
    expect(driver.list.mock.calls[1][0]).toMatchObject({ limit: 10 });
    expect(applyRules).toHaveBeenCalledTimes(1);
    expect(state.notices).toEqual([{ user: 'u1', title: 'Remetente novo', body: 'Assunto novo' }]);
    expect(state.row.notified_until).toBe(iso(-1));
  });
});
