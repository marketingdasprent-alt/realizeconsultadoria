import { describe, expect, it } from 'vitest';
import type { TimeClockEntry } from '../timeclock';
import {
  ALLOWED_ACTIONS,
  deriveWorkday,
  formatTimer,
  getEntryAction,
  getEntryLabel,
  getPendingReason,
  getPendingTip,
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
    expect(ALLOWED_ACTIONS.closed).toEqual(['start']);
    expect(ALLOWED_ACTIONS.working).toEqual(['pause', 'stop']);
    expect(ALLOWED_ACTIONS.paused).toEqual(['resume', 'stop']);
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

describe('pending explanations', () => {
  it('explains why the punch waits for approval', () => {
    expect(getPendingReason(['no_gps'])).toContain('localização');
    expect(getPendingReason(['outside_location'], 80, 'Rua Das Oliveiras')).toBe(
      'Está a 80 m de Rua Das Oliveiras, fora do raio.'
    );
    expect(getPendingReason(['outside_location'], 10_266, 'Premium Ride')).toBe(
      'Não há nenhum local de trabalho registado perto de si (o mais próximo, Premium Ride, fica a 10,3 km). Se está no seu local habitual, avise os RH para o adicionarem.'
    );
    expect(getPendingTip(['approximate_location'])).toContain('Localização exata');
    expect(getPendingTip(['outside_location'])).toBeNull();
  });
});
