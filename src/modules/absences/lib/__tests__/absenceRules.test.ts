import { describe, expect, it } from 'vitest';
import type { Holiday } from '@/lib/vacation-utils';
import {
  canCancel,
  canReschedule,
  daysToPeriods,
  filterAbsences,
  formatDays,
  formatPeriodDays,
  maxVacationDays,
  periodsRange,
  summarizeBalance,
  toPeriodRows,
  violatesVacationNotice,
  type AbsenceRow,
} from '../absenceRules';

const absence = (overrides: Partial<AbsenceRow>): AbsenceRow => ({
  id: 'a',
  start_date: '2026-10-20',
  end_date: '2026-10-22',
  absence_type: 'vacation',
  status: 'pending',
  notes: null,
  ...overrides,
});

const holiday = (date: string): Holiday => ({
  id: date,
  date,
  name: 'Feriado',
  year: Number(date.slice(0, 4)),
  is_national: true,
});

describe('violatesVacationNotice (48 h, só férias)', () => {
  const now = new Date(2026, 9, 15, 10, 30); // quinta 15/10, 10:30

  it('recusa férias para hoje e amanhã', () => {
    expect(violatesVacationNotice('vacation', new Date(2026, 9, 15), now)).toBe(true);
    expect(violatesVacationNotice('vacation', new Date(2026, 9, 16), now)).toBe(true);
  });

  it('aceita férias a partir de depois de amanhã', () => {
    expect(violatesVacationNotice('vacation', new Date(2026, 9, 17), now)).toBe(false);
  });

  it('não se aplica a outros tipos (baixa, consulta…)', () => {
    expect(violatesVacationNotice('sick_leave', new Date(2026, 9, 15), now)).toBe(false);
    expect(violatesVacationNotice('appointment', new Date(2026, 9, 15), now)).toBe(false);
  });
});

describe('filterAbsences', () => {
  const list = [
    absence({ id: 'pend', status: 'pending', end_date: '2026-10-30' }),
    absence({ id: 'appr-future', status: 'approved', end_date: '2026-11-02' }),
    absence({ id: 'rej-future', status: 'rejected', end_date: '2026-11-02' }),
    absence({ id: 'past', status: 'approved', end_date: '2026-10-01' }),
  ];
  const ids = (f: Parameters<typeof filterAbsences>[1]) =>
    filterAbsences(list, f, '2026-10-15').map(a => a.id);

  it('Todos', () => expect(ids('all')).toHaveLength(4));
  it('Pendentes', () => expect(ids('pending')).toEqual(['pend']));
  it('Próximos inclui pendentes e exclui rejeitados', () =>
    expect(ids('upcoming')).toEqual(['pend', 'appr-future']));
  it('Passados', () => expect(ids('past')).toEqual(['past']));
});

describe('toPeriodRows (dias úteis)', () => {
  it('desconta fins de semana e feriados', () => {
    // seg 07/12 a dom 13/12/2026, com feriado a 08/12
    const [row] = toPeriodRows(
      [{ from: new Date(2026, 11, 7), to: new Date(2026, 11, 13), periodType: 'full_day' }],
      [holiday('2026-12-08')]
    );
    expect(row.business_days).toBe(4);
    expect(row).toMatchObject({
      start_date: '2026-12-07',
      end_date: '2026-12-13',
      start_time: null,
    });
  });

  it('nos parciais usa os dias já calculados pelas horas', () => {
    const [row] = toPeriodRows(
      [
        {
          from: new Date(2026, 11, 9),
          to: new Date(2026, 11, 9),
          periodType: 'partial',
          startTime: '09:00',
          endTime: '13:00',
          businessDays: 0.5,
        },
      ],
      []
    );
    expect(row).toMatchObject({ business_days: 0.5, start_time: '09:00', end_time: '13:00' });
  });
});

describe('periodsRange', () => {
  it('devolve o primeiro e o último dia de vários períodos', () => {
    const range = periodsRange([
      { from: new Date(2026, 11, 14), to: new Date(2026, 11, 18), periodType: 'full_day' },
      { from: new Date(2026, 11, 2), to: new Date(2026, 11, 2), periodType: 'full_day' },
    ]);
    expect(range.from).toEqual(new Date(2026, 11, 2));
    expect(range.to).toEqual(new Date(2026, 11, 18));
  });
});

describe('saldo de férias', () => {
  it('sem quota própria: máximo = disponível', () => {
    expect(maxVacationDays({ total_days: 22, used_days: 5, self_schedulable_days: null }, 0)).toBe(
      17
    );
  });

  it('com quota própria: máximo = quota − já marcados (nunca negativo)', () => {
    const balance = { total_days: 22, used_days: 0, self_schedulable_days: 11 };
    expect(maxVacationDays(balance, 4)).toBe(7);
    expect(maxVacationDays(balance, 15)).toBe(0);
  });

  it('sem saldo configurado não há limite', () => {
    expect(maxVacationDays(null, 0)).toBeUndefined();
  });

  it('reserva da empresa: o excedente da quota própria come da reserva', () => {
    const balance = { total_days: 22, used_days: 3, self_schedulable_days: 11 };
    expect(summarizeBalance(balance, 4, 2)).toMatchObject({
      available: 19,
      pending: 2,
      remainingSelf: 7,
      companyReserved: 11,
    });
    expect(summarizeBalance(balance, 14, 0).companyReserved).toBe(8);
  });
});

describe('ações sobre um pedido', () => {
  const now = new Date(2026, 9, 15, 12);

  it('remarcar/editar só férias futuras aprovadas ou pendentes', () => {
    expect(canReschedule(absence({ status: 'approved', start_date: '2026-10-20' }), now)).toBe(
      true
    );
    expect(canReschedule(absence({ status: 'pending', start_date: '2026-10-20' }), now)).toBe(true);
    expect(canReschedule(absence({ status: 'approved', start_date: '2026-10-15' }), now)).toBe(
      false
    );
    expect(canReschedule(absence({ status: 'rejected', start_date: '2026-10-20' }), now)).toBe(
      false
    );
    expect(
      canReschedule(absence({ absence_type: 'sick_leave', start_date: '2026-10-20' }), now)
    ).toBe(false);
  });

  it('cancelar só pendentes ou rejeitados', () => {
    expect(canCancel(absence({ status: 'pending' }))).toBe(true);
    expect(canCancel(absence({ status: 'rejected' }))).toBe(true);
    expect(canCancel(absence({ status: 'approved' }))).toBe(false);
    expect(canCancel(absence({ status: 'partially_approved' }))).toBe(false);
  });
});

describe('formatação de dias', () => {
  it('saldo', () => {
    expect(formatDays(5)).toBe('5');
    expect(formatDays(2.5)).toBe('2.5');
  });
  it('períodos', () => {
    expect(formatPeriodDays(1)).toBe('1 dia');
    expect(formatPeriodDays(5)).toBe('5 dias');
    expect(formatPeriodDays(0.25)).toBe('0.25 dias');
  });
});

describe('daysToPeriods (marcar férias no calendário)', () => {
  it('junta dias seguidos e separa os soltos', () => {
    const periods = daysToPeriods(['2026-11-04', '2026-11-02', '2026-11-03', '2026-11-10']);
    expect(periods.map(p => [p.from.getDate(), p.to.getDate()])).toEqual([
      [2, 4],
      [10, 10],
    ]);
    expect(periods.every(p => p.periodType === 'full_day')).toBe(true);
  });
});
