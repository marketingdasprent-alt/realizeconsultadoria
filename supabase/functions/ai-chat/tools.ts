// Ferramentas do assistente. Tudo corre com o cliente da PESSOA (JWT dela): as regras de
// acesso da base de dados aplicam-se como se ela própria o fizesse. As ferramentas de leitura
// respondem logo; as de escrita só PREPARAM uma proposta, que a pessoa confirma no ecrã.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  describeInstant,
  lisbonToUtc,
  matchPeople,
  utcToLisbon,
  type Person,
} from '../_shared/ai/time.ts';

export interface ToolContext {
  db: SupabaseClient;
  userId: string;
  companyId: string;
  now: Date;
  directory: () => Promise<Person[]>;
}

export interface Proposal {
  id: string;
  tool: 'event' | 'task' | 'reminder';
  title: string;
  lines: string[];
  args: Record<string, unknown>;
}

export interface ToolResult {
  /** O que o modelo lê. */
  content: string;
  proposal?: Proposal;
}

const str = (value: unknown, max = 200): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export const TOOL_DEFS = [
  {
    name: 'get_agenda',
    description: 'Lê os eventos da agenda da pessoa entre duas datas (inclusive).',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Primeiro dia, AAAA-MM-DD' },
        to: { type: 'string', description: 'Último dia, AAAA-MM-DD (por omissão, o mesmo dia)' },
      },
      required: ['from'],
    },
  },
  {
    name: 'list_tasks',
    description: 'Lista as tarefas abertas da pessoa, com prazo.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_vacation_balance',
    description: 'Dias de férias do ano: total, usados e disponíveis.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'find_colleague',
    description: 'Procura colegas pelo nome (para saber quem é antes de os convidar).',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  },
  {
    name: 'propose_event',
    description:
      'Prepara um evento na agenda (a pessoa confirma depois). Datas em hora de Lisboa, AAAA-MM-DDTHH:MM.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start: { type: 'string', description: 'AAAA-MM-DDTHH:MM' },
        end: { type: 'string', description: 'AAAA-MM-DDTHH:MM (por omissão, 1 hora depois)' },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Nomes dos convidados',
        },
        location: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['title', 'start'],
    },
  },
  {
    name: 'propose_task',
    description: 'Prepara uma tarefa (a pessoa confirma depois).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        due: { type: 'string', description: 'Prazo, AAAA-MM-DDTHH:MM' },
        assignee: {
          type: 'string',
          description: 'Nome do responsável (por omissão, a própria pessoa)',
        },
        description: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'propose_reminder',
    description:
      'Prepara um lembrete para a pessoa receber como notificação (ela confirma depois).',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        when: { type: 'string', description: 'Quando lembrar, AAAA-MM-DDTHH:MM' },
      },
      required: ['text', 'when'],
    },
  },
];

const dayRange = (from: string, to: string): [Date, Date] | null => {
  const start = lisbonToUtc(`${from.slice(0, 10)}T00:00`);
  const endDay = lisbonToUtc(`${to.slice(0, 10)}T00:00`);
  if (!start || !endDay) return null;
  return [start, new Date(endDay.getTime() + 24 * 3_600_000)];
};

const getAgenda = async (ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult> => {
  const from = str(args.from, 10);
  const range = dayRange(from, str(args.to, 10) || from);
  if (!range) return { content: 'Datas inválidas: usa AAAA-MM-DD.' };
  const [start, end] = range;
  const { data, error } = await ctx.db
    .from('calendar_events')
    .select(
      'id, title, starts_at, ends_at, all_day, owner_id, recurrence, calendar_event_attendees(user_id)'
    )
    .lt('starts_at', end.toISOString())
    .or(`ends_at.gte.${start.toISOString()},recurrence.not.is.null`)
    .order('starts_at')
    .limit(40);
  if (error) return { content: 'Não foi possível ler a agenda.' };
  const mine = (data ?? []).filter(
    e =>
      e.owner_id === ctx.userId ||
      (e.calendar_event_attendees ?? []).some((a: { user_id: string }) => a.user_id === ctx.userId)
  );
  if (!mine.length) return { content: 'Sem eventos nesse período.' };
  return {
    content: mine
      .map(
        e =>
          `- ${e.title}: ${e.all_day ? 'dia inteiro, ' + utcToLisbon(new Date(e.starts_at)).slice(0, 10) : utcToLisbon(new Date(e.starts_at)).replace('T', ' ') + ' até ' + utcToLisbon(new Date(e.ends_at)).slice(11)}${e.recurrence ? ' (repete-se)' : ''}`
      )
      .join('\n'),
  };
};

const listTasks = async (ctx: ToolContext): Promise<ToolResult> => {
  const { data, error } = await ctx.db
    .from('tasks')
    .select('title, due_at, status, assignee_id, created_by')
    .neq('status', 'done')
    .is('parent_id', null)
    .order('due_at', { ascending: true, nullsFirst: false })
    .limit(15);
  if (error) return { content: 'Não foi possível ler as tarefas.' };
  const mine = (data ?? []).filter(
    t => t.assignee_id === ctx.userId || t.created_by === ctx.userId
  );
  if (!mine.length) return { content: 'Sem tarefas abertas.' };
  return {
    content: mine
      .map(
        t =>
          `- ${t.title}${t.due_at ? ' (prazo ' + utcToLisbon(new Date(t.due_at)).replace('T', ' ') + ')' : ''}`
      )
      .join('\n'),
  };
};

const getVacationBalance = async (ctx: ToolContext): Promise<ToolResult> => {
  const { data: employee } = await ctx.db
    .from('employees')
    .select('id')
    .eq('user_id', ctx.userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!employee) return { content: 'Sem ficha de colaborador.' };
  const year = new Date(ctx.now).getFullYear();
  const { data } = await ctx.db
    .from('employee_vacation_balances')
    .select('total_days, used_days')
    .eq('employee_id', employee.id)
    .eq('year', year)
    .maybeSingle();
  if (!data) return { content: `Sem saldo de férias definido para ${year}.` };
  return {
    content: `Férias ${year}: ${data.total_days} dias no total, ${data.used_days} usados, ${data.total_days - data.used_days} disponíveis.`,
  };
};

const findColleague = async (
  ctx: ToolContext,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const found = matchPeople(str(args.name), await ctx.directory()).slice(0, 5);
  if (!found.length) return { content: 'Não encontrei ninguém com esse nome.' };
  return {
    content: found.map(p => `- ${p.name}${p.position ? ' (' + p.position + ')' : ''}`).join('\n'),
  };
};

/** Um nome → uma pessoa, ou a pergunta que o modelo deve fazer. */
const resolvePerson = async (
  ctx: ToolContext,
  name: string
): Promise<{ person?: Person; ask?: string }> => {
  const found = matchPeople(name, await ctx.directory());
  if (found.length === 1) return { person: found[0] };
  if (!found.length)
    return { ask: `Não encontrei "${name}". Pergunta ao utilizador o nome completo.` };
  return {
    ask: `Há várias pessoas para "${name}": ${found
      .slice(0, 5)
      .map(p => p.name)
      .join('; ')}. Pergunta qual.`,
  };
};

const proposeEvent = async (
  ctx: ToolContext,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const title = str(args.title, 120);
  const start = lisbonToUtc(str(args.start, 20));
  if (!title || !start)
    return { content: 'Falta o título ou a data/hora de início (AAAA-MM-DDTHH:MM).' };
  const end = args.end ? lisbonToUtc(str(args.end, 20)) : new Date(start.getTime() + 3_600_000);
  if (!end || end <= start) return { content: 'A hora de fim tem de ser depois da de início.' };
  if (start.getTime() < ctx.now.getTime() - 60_000)
    return { content: 'Essa data já passou. Pergunta qual é a data certa.' };

  const attendeeIds: string[] = [];
  const attendeeNames: string[] = [];
  for (const raw of Array.isArray(args.attendees) ? args.attendees.slice(0, 20) : []) {
    const { person, ask } = await resolvePerson(ctx, str(raw, 80));
    if (ask) return { content: ask };
    if (person && person.user_id !== ctx.userId && !attendeeIds.includes(person.user_id)) {
      attendeeIds.push(person.user_id);
      attendeeNames.push(person.name);
    }
  }

  const lines = [describeInstant(start) + ` até ${utcToLisbon(end).slice(11)}`];
  if (attendeeNames.length) lines.push('Convidados: ' + attendeeNames.join(', '));
  const location = str(args.location, 120);
  if (location) lines.push('Local: ' + location);
  const { data: clash } = await ctx.db
    .from('calendar_events')
    .select('title')
    .eq('owner_id', ctx.userId)
    .lt('starts_at', end.toISOString())
    .gt('ends_at', start.toISOString())
    .limit(1);
  if (clash?.length) lines.push(`Atenção: sobrepõe-se a «${clash[0].title}».`);

  return {
    content: `Proposta de evento preparada (a pessoa confirma no cartão).${clash?.length ? ' Avisa que se sobrepõe a ' + clash[0].title + '.' : ''}`,
    proposal: {
      id: crypto.randomUUID(),
      tool: 'event',
      title,
      lines,
      args: {
        title,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        attendeeIds,
        location,
        description: str(args.description, 500),
      },
    },
  };
};

const proposeTask = async (
  ctx: ToolContext,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  const title = str(args.title, 160);
  if (!title) return { content: 'Falta o título da tarefa.' };
  const due = args.due ? lisbonToUtc(str(args.due, 20)) : null;
  if (args.due && !due) return { content: 'Prazo inválido: usa AAAA-MM-DDTHH:MM.' };
  let assigneeId = ctx.userId;
  let assigneeName = 'Você';
  if (args.assignee) {
    const { person, ask } = await resolvePerson(ctx, str(args.assignee, 80));
    if (ask) return { content: ask };
    if (person) {
      assigneeId = person.user_id;
      assigneeName = person.name;
    }
  }
  const lines = [`Responsável: ${assigneeName}`];
  if (due) lines.push('Prazo: ' + describeInstant(due));
  return {
    content: 'Proposta de tarefa preparada (a pessoa confirma no cartão).',
    proposal: {
      id: crypto.randomUUID(),
      tool: 'task',
      title,
      lines,
      args: {
        title,
        dueAt: due?.toISOString() ?? null,
        assigneeId,
        description: str(args.description, 800),
      },
    },
  };
};

const proposeReminder = (ctx: ToolContext, args: Record<string, unknown>): ToolResult => {
  const text = str(args.text, 280);
  const when = lisbonToUtc(str(args.when, 20));
  if (!text || !when)
    return { content: 'Falta o texto ou a data/hora do lembrete (AAAA-MM-DDTHH:MM).' };
  if (when.getTime() < ctx.now.getTime())
    return { content: 'Essa hora já passou. Pergunta quando lembrar.' };
  return {
    content: 'Proposta de lembrete preparada (a pessoa confirma no cartão).',
    proposal: {
      id: crypto.randomUUID(),
      tool: 'reminder',
      title: text,
      lines: ['Aviso em ' + describeInstant(when)],
      args: { text, remindAt: when.toISOString() },
    },
  };
};

/** Corre uma ferramenta pedida pelo modelo. Nunca lança: o erro volta como texto ao modelo. */
export const runTool = async (
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult> => {
  try {
    switch (name) {
      case 'get_agenda':
        return await getAgenda(ctx, args);
      case 'list_tasks':
        return await listTasks(ctx);
      case 'get_vacation_balance':
        return await getVacationBalance(ctx);
      case 'find_colleague':
        return await findColleague(ctx, args);
      case 'propose_event':
        return await proposeEvent(ctx, args);
      case 'propose_task':
        return await proposeTask(ctx, args);
      case 'propose_reminder':
        return proposeReminder(ctx, args);
      default:
        return { content: `A ferramenta "${name}" não existe.` };
    }
  } catch {
    return { content: 'A ferramenta falhou. Diz à pessoa que não foi possível.' };
  }
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isoDate = (value: unknown): string | null => {
  const date = typeof value === 'string' ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
};

export interface ExecuteResult {
  ok: boolean;
  message: string;
  link?: string;
}

/** Grava uma proposta confirmada, com as regras da própria pessoa (RLS). */
export const executeProposal = async (
  ctx: ToolContext,
  tool: string,
  args: Record<string, unknown>
): Promise<ExecuteResult> => {
  if (tool === 'event') {
    const startsAt = isoDate(args.startsAt);
    const endsAt = isoDate(args.endsAt);
    const title = str(args.title, 120);
    const ids = (Array.isArray(args.attendeeIds) ? args.attendeeIds : []).filter(
      (id): id is string => typeof id === 'string' && UUID.test(id) && id !== ctx.userId
    );
    if (!title || !startsAt || !endsAt || endsAt <= startsAt)
      return { ok: false, message: 'O evento não é válido.' };
    const { data, error } = await ctx.db
      .from('calendar_events')
      .insert({
        company_id: ctx.companyId,
        owner_id: ctx.userId,
        title,
        description: str(args.description, 500) || null,
        location: str(args.location, 120) || null,
        starts_at: startsAt,
        ends_at: endsAt,
        all_day: false,
        visibility: 'participants',
        reminder_minutes: 15,
        color: 'violet',
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, message: 'O evento não foi criado.' };
    if (ids.length) {
      const res = await ctx.db
        .from('calendar_event_attendees')
        .insert(ids.slice(0, 30).map(user_id => ({ event_id: data.id, user_id })));
      if (res.error)
        return {
          ok: true,
          message: 'Evento criado, mas nem todos os convidados foram adicionados.',
          link: `/colaborador/calendario?evento=${data.id}`,
        };
    }
    return {
      ok: true,
      message: 'Evento criado',
      link: `/colaborador/calendario?evento=${data.id}`,
    };
  }

  if (tool === 'task') {
    const title = str(args.title, 160);
    const assigneeId =
      typeof args.assigneeId === 'string' && UUID.test(args.assigneeId)
        ? args.assigneeId
        : ctx.userId;
    if (!title) return { ok: false, message: 'A tarefa não é válida.' };
    const { data, error } = await ctx.db
      .from('tasks')
      .insert({
        company_id: ctx.companyId,
        created_by: ctx.userId,
        title,
        description: str(args.description, 800) || null,
        assignee_id: assigneeId,
        due_at: isoDate(args.dueAt),
        priority: 'medium',
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, message: 'A tarefa não foi criada.' };
    return { ok: true, message: 'Tarefa criada', link: `/colaborador/tarefas?tarefa=${data.id}` };
  }

  if (tool === 'reminder') {
    const remindAt = isoDate(args.remindAt);
    const text = str(args.text, 280);
    if (!text || !remindAt) return { ok: false, message: 'O lembrete não é válido.' };
    const { error } = await ctx.db
      .from('ai_reminders')
      .insert({ user_id: ctx.userId, text, remind_at: remindAt });
    if (error) return { ok: false, message: 'O lembrete não foi criado.' };
    return { ok: true, message: 'Lembrete criado' };
  }
  return { ok: false, message: 'Ação desconhecida.' };
};
