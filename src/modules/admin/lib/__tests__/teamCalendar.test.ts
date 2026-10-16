import { describe, expect, it } from 'vitest';
import {
  approvedDaysInMonth,
  buildTeamRows,
  entriesForDay,
  formatDays,
  type CalendarAbsence,
} from '../teamCalendar';

const person = (name: string) => ({ name, company_id: 'c1', companies: { name: 'Realize' } });

const absence = (overrides: Partial<CalendarAbsence>): CalendarAbsence => ({
  id: 'a1',
  employee_id: 'e1',
  start_date: '2026-10-12',
  end_date: '2026-10-16',
  absence_type: 'vacation',
  status: 'approved',
  absence_periods: [],
  employees: person('Ana'),
  ...overrides,
});

const holidays = [
  { id: 'h', date: '2026-10-05', name: 'Implantação', year: 2026, is_national: true },
];

describe('entriesForDay', () => {
  it('mostra quem está fora num dia útil', () => {
    const entries = entriesForDay([absence({})], new Date(2026, 9, 14), holidays);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ name: 'Ana', status: 'approved', type: 'vacation' });
  });

  it('deixa vazios os fins de semana e os feriados', () => {
    const long = absence({ start_date: '2026-10-01', end_date: '2026-10-31' });
    expect(entriesForDay([long], new Date(2026, 9, 10), holidays)).toEqual([]);
    expect(entriesForDay([long], new Date(2026, 9, 5), holidays)).toEqual([]);
  });

  it('ignora reprovados e fica com o aprovado quando há dois pedidos no mesmo dia', () => {
    const entries = entriesForDay(
      [
        absence({ id: 'r', status: 'rejected' }),
        absence({ id: 'p', status: 'pending', absence_type: 'appointment' }),
        absence({ id: 'ok' }),
      ],
      new Date(2026, 9, 13),
      holidays
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].absenceId).toBe('ok');
  });

  it('usa os períodos (estado e horas) quando existem', () => {
    const withPeriods = absence({
      status: 'partially_approved',
      absence_periods: [
        {
          id: 'p1',
          start_date: '2026-10-13',
          end_date: '2026-10-13',
          status: 'approved',
          period_type: 'partial',
          start_time: '09:00',
          end_time: '13:00',
          business_days: 0.5,
        },
        { id: 'p2', start_date: '2026-10-15', end_date: '2026-10-15', status: 'rejected' },
      ],
    });
    const [tuesday] = entriesForDay([withPeriods], new Date(2026, 9, 13), holidays);
    expect(tuesday).toMatchObject({ partial: true, startTime: '09:00', status: 'approved' });
    expect(entriesForDay([withPeriods], new Date(2026, 9, 14), holidays)).toEqual([]);
    expect(entriesForDay([withPeriods], new Date(2026, 9, 15), holidays)).toEqual([]);
  });
});

describe('approvedDaysInMonth', () => {
  it('soma os dias úteis aprovados dentro do mês', () => {
    const totals = approvedDaysInMonth(
      [
        absence({ start_date: '2026-09-28', end_date: '2026-10-06' }),
        absence({ id: 'p', employee_id: 'e2', status: 'pending' }),
      ],
      new Date(2026, 9, 1),
      new Date(2026, 9, 31),
      holidays
    );
    // 1, 2 (qui/sex) + 6 (ter); o dia 5 é feriado
    expect(totals.get('e1')).toBe(3);
    expect(totals.has('e2')).toBe(false);
  });
});

describe('buildTeamRows', () => {
  it('junta os dias de cada pessoa e, sem filtro, inclui quem não tem ausências', () => {
    const days = [new Date(2026, 9, 13), new Date(2026, 9, 14)];
    const entries = days.map(day => entriesForDay([absence({})], day, holidays));
    const employees = [
      { id: 'e1', name: 'Ana', companyId: 'c1', companyName: 'Realize' },
      { id: 'e9', name: 'Bruno', companyId: 'c1', companyName: 'Realize' },
    ];
    const onlyAbsent = buildTeamRows(employees, entries, new Map([['e1', 2]]), true);
    expect(onlyAbsent.map(row => row.name)).toEqual(['Ana']);
    expect(onlyAbsent[0].cells.every(Boolean)).toBe(true);
    expect(onlyAbsent[0].approvedDays).toBe(2);
    expect(buildTeamRows(employees, entries, new Map(), false)).toHaveLength(2);
  });
});

describe('formatDays', () => {
  it('mostra meios dias com vírgula', () => {
    expect(formatDays(10)).toBe('10');
    expect(formatDays(0.5)).toBe('0,5');
  });
});
