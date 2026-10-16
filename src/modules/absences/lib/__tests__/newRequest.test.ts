import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import type { DatePeriod, Holiday } from '@/lib/vacation-utils';
import type { AbsenceRow } from '../absenceRules';
import {
  addDaysToPeriods,
  addPeriod,
  busyDays,
  docsFirst,
  isUnavailable,
  noticeFor,
  normalizePeriods,
  periodDays,
  freeDaysBetween,
  removeDay,
  totalDays,
} from '../newRequest';

const d = (iso: string) => new Date(`${iso}T00:00:00`);
const holidays: Holiday[] = [
  { id: 'h', date: '2026-12-08', name: 'Imaculada Conceição', year: 2026, is_national: true },
];
const NOW = new Date(2026, 9, 15, 12);

const absence = (periods: AbsenceRow['absence_periods'], status = 'approved'): AbsenceRow => ({
  id: 'a',
  start_date: '2026-11-02',
  end_date: '2026-11-04',
  absence_type: 'vacation',
  status,
  notes: null,
  absence_periods: periods,
});

describe('novo pedido', () => {
  it('antecedência de 48 h só nas férias', () => {
    expect(noticeFor('vacation', NOW)).toEqual(d('2026-10-17'));
    expect(noticeFor('sick_leave', NOW)).toBeNull();
    expect(docsFirst('vacation')).toBe(false);
    expect(docsFirst('appointment')).toBe(true);
    expect(docsFirst('')).toBe(false);
  });

  it('dias indisponíveis: fim de semana, feriado, antecedência e já ocupados', () => {
    const busy = busyDays([
      absence([
        {
          id: 'p',
          start_date: '2026-11-02',
          end_date: '2026-11-03',
          business_days: 2,
          status: 'approved',
        },
      ]),
    ]);
    const notice = noticeFor('vacation', NOW);
    expect(isUnavailable(d('2026-10-17'), holidays, notice, busy)).toBe(true); // sábado
    expect(isUnavailable(d('2026-12-08'), holidays, notice, busy)).toBe(true); // feriado
    expect(isUnavailable(d('2026-10-16'), holidays, notice, busy)).toBe(true); // < 48 h
    expect(isUnavailable(d('2026-10-16'), holidays, null, busy)).toBe(false); // baixa: amanhã serve
    expect(isUnavailable(d('2026-11-02'), holidays, notice, busy)).toBe(true); // aprovado
    expect(isUnavailable(d('2026-11-04'), holidays, notice, busy)).toBe(false);
  });

  it('períodos com horas não bloqueiam o dia; rejeitados também não', () => {
    const busy = busyDays([
      absence([
        {
          id: 'p1',
          start_date: '2026-11-05',
          end_date: '2026-11-05',
          business_days: 0.5,
          status: 'approved',
          period_type: 'partial',
          start_time: '09:00',
          end_time: '13:00',
        },
        {
          id: 'p2',
          start_date: '2026-11-06',
          end_date: '2026-11-06',
          business_days: 1,
          status: 'rejected',
        },
      ]),
    ]);
    expect(busy.approved).toHaveLength(0);
    expect(busy.pending).toHaveLength(0);
  });

  it('dias de cada período e total (feriados e fins de semana não contam)', () => {
    const periods: DatePeriod[] = [
      { from: d('2026-12-07'), to: d('2026-12-11'), periodType: 'full_day' },
      {
        from: d('2026-12-14'),
        to: d('2026-12-14'),
        periodType: 'partial',
        startTime: '09:00',
        endTime: '13:00',
      },
    ];
    expect(periodDays(periods[0], holidays)).toBe(4); // 8 dez é feriado
    expect(periodDays(periods[1], holidays)).toBe(0.5);
    expect(totalDays(periods, holidays)).toBe(4.5);
  });

  describe('juntar e tirar dias', () => {
    it('dias soltos juntam-se: 19, 20, 22 e depois 21 dão um só período', () => {
      const periods = addDaysToPeriods(
        [],
        [d('2026-10-19'), d('2026-10-20'), d('2026-10-22')],
        holidays,
        { approved: [], pending: [] }
      );
      expect(periods).toHaveLength(2);
      const all = addDaysToPeriods(periods, [d('2026-10-21')], holidays, {
        approved: [],
        pending: [],
      });
      expect(all).toHaveLength(1);
      expect(totalDays(all, holidays)).toBe(4);
    });

    it('um intervalo salta o que está ocupado ou já escolhido, em vez de falhar', () => {
      const busy = busyDays([
        absence([
          {
            id: 'p',
            start_date: '2026-11-11',
            end_date: '2026-11-11',
            business_days: 1,
            status: 'pending',
          },
        ]),
      ]);
      const chosen: DatePeriod[] = [
        { from: d('2026-11-12'), to: d('2026-11-12'), periodType: 'full_day' },
      ];
      const free = freeDaysBetween(d('2026-11-09'), d('2026-11-13'), holidays, null, busy, chosen);
      expect(free.map(day => format(day, 'dd'))).toEqual(['09', '10', '13']);
    });

    const none = { approved: [], pending: [] };
    const full = (from: string, to: string): DatePeriod => ({
      from: d(from),
      to: d(to),
      periodType: 'full_day',
    });
    const show = (periods: DatePeriod[]) =>
      periods.map(p => `${format(p.from, 'MM-dd')}..${format(p.to, 'MM-dd')}`);

    it('períodos seguidos (só um fim de semana no meio) são um só', () => {
      const merged = addPeriod(
        [full('2026-10-19', '2026-10-23')],
        full('2026-10-26', '2026-10-28'),
        holidays,
        none
      );
      expect(merged).toHaveLength(1);
      expect(merged[0].from).toEqual(d('2026-10-19'));
      expect(merged[0].to).toEqual(d('2026-10-28'));
      expect(totalDays(merged, holidays)).toBe(8);
    });

    it('com um dia útil livre no meio ficam dois períodos', () => {
      const two = addPeriod(
        [full('2026-10-19', '2026-10-21')],
        full('2026-10-23', '2026-10-23'),
        holidays,
        none
      );
      expect(two).toHaveLength(2);
    });

    it('um feriado no meio também junta (o 8 de dezembro)', () => {
      const merged = normalizePeriods(
        [full('2026-12-07', '2026-12-07'), full('2026-12-09', '2026-12-10')],
        holidays,
        none
      );
      expect(merged).toHaveLength(1);
    });

    it('não junta se o que está no meio já está ocupado', () => {
      const busy = busyDays([
        absence([
          {
            id: 'x',
            start_date: '2026-10-24',
            end_date: '2026-10-25',
            business_days: 0,
            status: 'approved',
          },
        ]),
      ]);
      expect(
        normalizePeriods(
          [full('2026-10-19', '2026-10-23'), full('2026-10-26', '2026-10-28')],
          holidays,
          busy
        )
      ).toHaveLength(2);
    });

    it('tirar o último dia encurta; tirar um do meio parte em dois; tirar o único apaga', () => {
      const base = [full('2026-10-19', '2026-10-28')];
      expect(show(removeDay(base, d('2026-10-28'), holidays, none))).toEqual(['10-19..10-27']);
      expect(show(removeDay(base, d('2026-10-22'), holidays, none))).toEqual([
        '10-19..10-21',
        '10-23..10-28',
      ]);
      expect(show(removeDay(base, d('2026-10-26'), holidays, none))).toEqual([
        '10-19..10-23',
        '10-27..10-28',
      ]);
      expect(
        removeDay([full('2026-10-20', '2026-10-20')], d('2026-10-20'), holidays, none)
      ).toEqual([]);
    });

    it('os períodos de horas não se juntam a nada', () => {
      const partial: DatePeriod = {
        from: d('2026-10-20'),
        to: d('2026-10-20'),
        periodType: 'partial',
        startTime: '09:00',
        endTime: '13:00',
      };
      const result = normalizePeriods([partial, full('2026-10-21', '2026-10-22')], holidays, none);
      expect(result).toHaveLength(2);
    });
  });
});
