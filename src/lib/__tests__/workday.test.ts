import { describe, expect, it } from 'vitest';
import type { TimeClockEntry, TimeClockEntryWithRelations } from '../timeclock';
import {
  buildCorrection,
  deriveWorkday,
  formatTimer,
  getActionLabel,
  getAllowedActions,
  getEntryAction,
  getEntryLabel,
  getEntryPlace,
  getWorkdayStatus,
} from '../workday';

let seq = 0;
const at = (
  entry_type: 'in' | 'out',
  kind: 'work' | 'break',
  local: string,
  status = 'valid'
): TimeClockEntry =>
  ({
    id: `w${++seq}`,
    employee_id: 'emp-1',
    company_id: 'c-1',
    entry_type,
    kind,
    punched_at: new Date(local).toISOString(),
    status,
    flags: [],
    source: 'gps',
  }) as TimeClockEntry;
const start = (local: string, status?: string) => at('in', 'work', local, status);
const pause = (local: string) => at('out', 'break', local);
const resume = (local: string) => at('in', 'break', local);
const stop = (local: string) => at('out', 'work', local);

const MIN = 60_000;

describe('workday labels', () => {
  it('maps entry type + kind to the four actions', () => {
    expect(getEntryAction({ entry_type: 'in', kind: 'work' })).toBe('start');
    expect(getEntryAction({ entry_type: 'out', kind: 'break' })).toBe('pause');
    expect(getEntryAction({ entry_type: 'in', kind: 'break' })).toBe('resume');
    expect(getEntryAction({ entry_type: 'out', kind: 'work' })).toBe('stop');
    expect(getEntryLabel({ entry_type: 'out', kind: 'break' })).toBe('Pausa');
  });

  it('offers only the buttons that make sense in each state', () => {
    expect(getAllowedActions({ status: 'closed', canContinue: false })).toEqual(['start']);
    expect(getAllowedActions({ status: 'closed', canContinue: true })).toEqual(['resume']);
    expect(getAllowedActions({ status: 'working', canContinue: false })).toEqual(['pause', 'stop']);
    expect(getAllowedActions({ status: 'paused', canContinue: false })).toEqual(['resume', 'stop']);
    expect(getActionLabel('resume', 'closed')).toBe('Retomar dia');
    expect(getActionLabel('resume', 'paused')).toBe('Retomar');
  });

  it('formats the running timer', () => {
    expect(formatTimer(0)).toBe('00:00:00');
    expect(formatTimer((3 * 3600 + 12 * 60 + 45) * 1000)).toBe('03:12:45');
    expect(formatTimer(-5000)).toBe('00:00:00');
  });
});

describe('getWorkdayStatus', () => {
  const now = new Date('2026-10-14T15:00:00');
  it('follows the last entry like the database does', () => {
    expect(getWorkdayStatus(null, now)).toBe('closed');
    expect(getWorkdayStatus(start('2026-10-14T09:00:00'), now)).toBe('working');
    expect(getWorkdayStatus(pause('2026-10-14T12:00:00'), now)).toBe('paused');
    expect(getWorkdayStatus(resume('2026-10-14T13:00:00'), now)).toBe('working');
    expect(getWorkdayStatus(stop('2026-10-14T14:00:00'), now)).toBe('closed');
  });

  it('treats a day left open for 12 hours as finished', () => {
    expect(getWorkdayStatus(start('2026-10-14T02:59:00'), now)).toBe('closed');
    expect(getWorkdayStatus(pause('2026-10-14T02:00:00'), now)).toBe('closed');
  });
});

describe('deriveWorkday', () => {
  it('counts the running work time without the pauses', () => {
    const day = deriveWorkday(
      [start('2026-10-14T09:00:00'), pause('2026-10-14T12:30:00'), resume('2026-10-14T13:15:00')],
      new Date('2026-10-14T15:15:00')
    );
    expect(day.status).toBe('working');
    expect(day.since).toBe(new Date('2026-10-14T13:15:00').toISOString());
    expect(day.workedMs).toBe((3 * 60 + 30 + 2 * 60) * MIN);
    expect(day.breakMs).toBe(45 * MIN);
    expect(day.entries).toHaveLength(3);
  });

  it('runs the pause clock while paused', () => {
    const day = deriveWorkday(
      [start('2026-10-14T09:00:00'), pause('2026-10-14T12:30:00')],
      new Date('2026-10-14T12:40:00')
    );
    expect(day.status).toBe('paused');
    expect(day.workedMs).toBe(210 * MIN);
    expect(day.breakMs).toBe(10 * MIN);
  });

  it('shows the finished day with its totals', () => {
    const day = deriveWorkday(
      [
        start('2026-10-14T09:00:00'),
        pause('2026-10-14T13:00:00'),
        resume('2026-10-14T14:00:00'),
        stop('2026-10-14T18:00:00'),
      ],
      new Date('2026-10-14T20:00:00')
    );
    expect(day.status).toBe('closed');
    expect(day.workedMs).toBe(8 * 60 * MIN);
    expect(day.startedAt).toBe(new Date('2026-10-14T09:00:00').toISOString());
    expect(day.endedAt).toBe(new Date('2026-10-14T18:00:00').toISOString());
  });

  it('ignores voided entries (e.g. an undone start)', () => {
    const day = deriveWorkday(
      [start('2026-10-14T09:00:00', 'voided')],
      new Date('2026-10-14T09:01:00')
    );
    expect(day.status).toBe('closed');
    expect(day.entries).toHaveLength(0);
  });

  it('keeps a night shift that started yesterday as the current day', () => {
    const day = deriveWorkday(
      [stop('2026-10-13T08:00:00'), start('2026-10-13T22:00:00')],
      new Date('2026-10-14T02:00:00')
    );
    expect(day.status).toBe('working');
    expect(day.workedMs).toBe(4 * 60 * MIN);
    expect(day.entries).toHaveLength(1);
  });

  it('starts fresh after yesterday ended', () => {
    const day = deriveWorkday(
      [start('2026-10-13T09:00:00'), stop('2026-10-13T17:00:00')],
      new Date('2026-10-14T08:00:00')
    );
    expect(day.status).toBe('closed');
    expect(day.workedMs).toBe(0);
    expect(day.endedAt).toBeNull();
    expect(day.entries).toHaveLength(0);
  });
});

describe('Retomar dia (terminou por engano)', () => {
  it('can continue a day that ended today, as Bitrix24 does', () => {
    // A saída para o almoço ficou gravada como fim do dia (versão antiga).
    const entries = [start('2026-10-14T08:44:00'), stop('2026-10-14T13:01:00')];
    const day = deriveWorkday(entries, new Date('2026-10-14T17:38:00'));
    expect(day.status).toBe('closed');
    expect(day.endedAt).toBe(new Date('2026-10-14T13:01:00').toISOString());
    expect(day.canContinue).toBe(true);
    expect(getAllowedActions(day)).toEqual(['resume']);
  });

  it('starts a new day after yesterday or after 12 hours', () => {
    const yesterday = [start('2026-10-13T09:00:00'), stop('2026-10-13T18:00:00')];
    expect(deriveWorkday(yesterday, new Date('2026-10-14T08:00:00')).canContinue).toBe(false);
    const early = [start('2026-10-14T00:10:00'), stop('2026-10-14T01:00:00')];
    expect(deriveWorkday(early, new Date('2026-10-14T13:30:00')).canContinue).toBe(false);
    expect(deriveWorkday([], new Date('2026-10-14T08:00:00')).canContinue).toBe(false);
  });
});

describe('buildCorrection (✎ registo esquecido)', () => {
  const now = new Date('2026-10-14T17:38:00');
  const lunch = stop('2026-10-14T13:01:00');

  it('turns 14:00 + motivo into today 14:00', () => {
    expect(buildCorrection('14:00', 'Esqueci-me de retomar', lunch, now)).toEqual({
      at: new Date('2026-10-14T14:00:00').toISOString(),
    });
  });

  it('explains what is wrong before sending', () => {
    expect(buildCorrection('', 'motivo', lunch, now)).toEqual({ error: 'Indique a hora.' });
    expect(buildCorrection('18:00', 'motivo', lunch, now)).toEqual({
      error: 'A hora não pode ser no futuro.',
    });
    expect(buildCorrection('12:30', 'motivo', lunch, now)).toEqual({
      error: 'Tem de ser depois do último registo (13:01).',
    });
    expect(buildCorrection('14:00', '  ', lunch, now)).toEqual({
      error: 'Escreva o motivo da correção.',
    });
    expect('error' in buildCorrection('05:00', 'motivo', null, now)).toBe(true);
  });
});

describe('getEntryPlace', () => {
  const entry = (extra: Partial<TimeClockEntryWithRelations>) =>
    ({
      ...start('2026-10-14T09:00:00'),
      latitude: 39.7,
      address: null,
      ...extra,
    }) as TimeClockEntryWithRelations;

  it('shows the workplace, else the street, else that there was no GPS', () => {
    expect(getEntryPlace(entry({ location: { name: 'Rua Das Oliveiras' }, address: 'x' }))).toBe(
      'Rua Das Oliveiras'
    );
    expect(getEntryPlace(entry({ address: 'Rua da Ferraria 3, Leiria' }))).toBe(
      'Rua da Ferraria 3, Leiria'
    );
    expect(getEntryPlace(entry({ latitude: null }))).toBe('Sem localização');
    expect(getEntryPlace(entry({ latitude: null, source: 'admin' }))).toBeNull();
  });
});
