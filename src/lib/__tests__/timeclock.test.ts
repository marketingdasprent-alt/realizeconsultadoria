import { describe, expect, it } from 'vitest';
import { parseTagUrl } from '../nfc';
import {
  formatMinutes,
  getErrorMessage,
  getNextEntryType,
  summarizeDays,
  type TimeClockEntry,
} from '../timeclock';

let seq = 0;
const entry = (entry_type: 'in' | 'out', local: string, status = 'valid'): TimeClockEntry =>
  ({
    id: `e${++seq}`,
    employee_id: 'emp-1',
    company_id: 'c-1',
    entry_type,
    punched_at: new Date(local).toISOString(),
    status,
    flags: [],
    source: 'nfc',
  }) as TimeClockEntry;

describe('summarizeDays', () => {
  it('sums paired in/out intervals per day, including breaks', () => {
    const [day] = summarizeDays([
      entry('in', '2026-09-21T09:00:00'),
      entry('out', '2026-09-21T13:00:00'),
      entry('in', '2026-09-21T14:00:00'),
      entry('out', '2026-09-21T18:30:00'),
    ]);
    expect(day.date).toBe('2026-09-21');
    expect(day.workedMinutes).toBe(8 * 60 + 30);
    expect(day.incomplete).toBe(false);
  });

  it('ignores voided entries in the totals but keeps them listed', () => {
    const [day] = summarizeDays([
      entry('in', '2026-09-21T09:00:00'),
      entry('out', '2026-09-21T10:00:00', 'voided'),
      entry('out', '2026-09-21T17:00:00'),
    ]);
    expect(day.entries).toHaveLength(3);
    expect(day.workedMinutes).toBe(8 * 60);
  });

  it('marks forgotten check-outs on past days as incomplete', () => {
    const days = summarizeDays(
      [entry('in', '2026-09-20T09:00:00')],
      new Date('2026-09-22T10:00:00')
    );
    expect(days[0].incomplete).toBe(true);
    expect(days[0].openSince).toBeNull();
  });

  it('keeps the current shift open', () => {
    const [day] = summarizeDays(
      [entry('in', '2026-09-23T09:00:00')],
      new Date('2026-09-23T11:00:00')
    );
    expect(day.openSince).not.toBeNull();
    expect(day.incomplete).toBe(false);
  });

  it('assigns overnight shifts to the check-in day', () => {
    const days = summarizeDays([
      entry('in', '2026-09-21T22:00:00'),
      entry('out', '2026-09-22T06:00:00'),
    ]);
    const monday = days.find(d => d.date === '2026-09-21');
    const tuesday = days.find(d => d.date === '2026-09-22');
    expect(monday?.workedMinutes).toBe(8 * 60);
    expect(tuesday?.workedMinutes).toBe(0);
    expect(tuesday?.entries).toHaveLength(1);
  });

  it('flags a check-out without check-in', () => {
    const [day] = summarizeDays([entry('out', '2026-09-21T18:00:00')]);
    expect(day.incomplete).toBe(true);
  });
});

describe('helpers', () => {
  it('formats minutes as hours', () => {
    expect(formatMinutes(0)).toBe('0h00');
    expect(formatMinutes(485)).toBe('8h05');
  });

  it('suggests the next entry type', () => {
    const now = new Date('2026-09-23T12:00:00');
    expect(getNextEntryType(null, now)).toBe('in');
    expect(getNextEntryType(entry('in', '2026-09-23T09:00:00'), now)).toBe('out');
    expect(getNextEntryType(entry('out', '2026-09-23T11:00:00'), now)).toBe('in');
  });

  it('extracts messages from Error and PostgrestError-like objects', () => {
    expect(getErrorMessage(new Error('boom'), 'x')).toBe('boom');
    expect(getErrorMessage({ message: 'Indique o motivo', code: 'P0001' }, 'x')).toBe(
      'Indique o motivo'
    );
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
  });
});

describe('parseTagUrl', () => {
  it('parses static and NTAG 424 tag URLs', () => {
    expect(parseTagUrl('https://realize.dasprent.pt/ponto/nfc?t=abc123')).toEqual({ t: 'abc123' });
    expect(parseTagUrl('https://realize.dasprent.pt/ponto/nfc?e=AA&c=BB')).toEqual({
      e: 'AA',
      c: 'BB',
    });
    expect(parseTagUrl('https://realize.dasprent.pt/ponto/nfc?e=AA')).toBeNull();
    expect(parseTagUrl('not a url')).toBeNull();
  });
});

describe('tag URLs', () => {
  it('always point to the production domain', async () => {
    const { buildStaticTagUrl } =
      await import('@/modules/timeclock/services/timeClockLocationService');
    expect(buildStaticTagUrl('abc')).toBe('https://realize.dasprent.pt/ponto/nfc?t=abc');
  });
});
