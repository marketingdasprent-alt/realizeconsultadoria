import { describe, expect, it } from 'vitest';
import type { TimeClockEntry } from '../timeclock';
import { buildTimesheetMonth, generateTimesheetPrintHtml } from '../timesheet-print';

let seq = 0;
const entry = (
  entry_type: 'in' | 'out',
  local: string,
  extra: Partial<TimeClockEntry> = {}
): TimeClockEntry =>
  ({
    id: `e${++seq}`,
    employee_id: 'emp-1',
    company_id: 'c-1',
    entry_type,
    punched_at: new Date(local).toISOString(),
    status: 'valid',
    flags: [],
    source: 'nfc',
    ...extra,
  }) as TimeClockEntry;

const OCT = new Date('2026-10-01T00:00:00');
const NOW = new Date('2026-11-02T10:00:00');

describe('buildTimesheetMonth', () => {
  it('lists every day of the month with weekends and holidays', () => {
    const month = buildTimesheetMonth(
      [],
      OCT,
      [{ date: '2026-10-05', name: 'Implantação da República' }],
      NOW
    );
    expect(month.rows).toHaveLength(31);
    expect(month.rows[0]).toMatchObject({ day: '01', weekday: 'qui', isWeekend: false });
    expect(month.rows[2].isWeekend).toBe(true); // sábado 3
    expect(month.rows[4].holiday).toBe('Implantação da República');
    expect(month.totalMinutes).toBe(0);
  });

  it('pairs morning and afternoon and totals the day', () => {
    const month = buildTimesheetMonth(
      [
        entry('in', '2026-10-06T09:00:00'),
        entry('out', '2026-10-06T13:00:00'),
        entry('in', '2026-10-06T14:00:00'),
        entry('out', '2026-10-06T18:30:00', { source: 'admin' }),
      ],
      OCT,
      [],
      NOW
    );
    const day = month.rows[5];
    expect(day.pairs).toEqual([
      { in: '09:00', out: '13:00' },
      { in: '14:00', out: '18:30*' },
    ]);
    expect(day.workedMinutes).toBe(8 * 60 + 30);
    expect(month).toMatchObject({ totalMinutes: 8 * 60 + 30, workedDays: 1, incompleteDays: 0 });
  });

  it('notes extra pairs, missing check-outs and ignores voided entries', () => {
    const month = buildTimesheetMonth(
      [
        entry('in', '2026-10-07T08:00:00'),
        entry('out', '2026-10-07T10:00:00'),
        entry('in', '2026-10-07T10:30:00'),
        entry('out', '2026-10-07T12:00:00'),
        entry('in', '2026-10-07T13:00:00'),
        entry('out', '2026-10-07T17:00:00'),
        entry('out', '2026-10-07T17:05:00', { status: 'voided' }),
        entry('in', '2026-10-08T09:00:00'),
      ],
      OCT,
      [],
      NOW
    );
    expect(month.rows[6].notes).toContain('Também: 13:00–17:00');
    expect(month.rows[6].workedMinutes).toBe(7 * 60 + 30);
    expect(month.rows[7].pairs).toEqual([{ in: '09:00', out: null }]);
    expect(month.rows[7].notes).toContain('Registo incompleto');
    expect(month.incompleteDays).toBe(1);
  });
});

describe('generateTimesheetPrintHtml', () => {
  it('renders one A4 sheet per employee and escapes names', () => {
    const month = buildTimesheetMonth([], OCT, [], NOW);
    const html = generateTimesheetPrintHtml({
      month: OCT,
      logoBase64: 'data:image/png;base64,',
      sheets: [
        {
          employeeName: 'Ana <b>',
          employeeRole: null,
          companyName: 'Realize',
          companyNif: '123',
          month,
        },
        {
          employeeName: 'Rui',
          employeeRole: 'Técnico',
          companyName: 'Realize',
          companyNif: null,
          month,
        },
      ],
    });
    expect(html.match(/<section class="sheet">/g)).toHaveLength(2);
    expect(html).toContain('Ana &lt;b&gt;');
    expect(html).toContain('size: A4 portrait');
    expect(html).toContain('outubro 2026');
  });
});
