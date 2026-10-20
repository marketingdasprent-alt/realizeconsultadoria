import { describe, expect, it } from 'vitest';
import {
  dateRange,
  filterRequests,
  formatAmount,
  groupOverlaps,
  periodDuration,
  requestDuration,
  requestedAgo,
  requestSpan,
  startUrgency,
  statusCounts,
  toStatusFilter,
  workingHours,
  type AbsenceRequest,
  type RequestFilters,
} from '../absenceRequests';

const NOW = new Date(2026, 9, 20, 10, 0);

const request = (overrides: Partial<AbsenceRequest> & { id: string }): AbsenceRequest => ({
  status: 'pending',
  absence_type: 'vacation',
  training_mode: null,
  notes: null,
  rejection_reason: null,
  created_at: '2026-10-10T09:00:00Z',
  start_date: '2026-11-02',
  end_date: '2026-11-06',
  employee_id: 'e1',
  total_business_days: 5,
  document_count: 0,
  approved_by: null,
  approver_name: null,
  employee: {
    id: 'e1',
    name: 'João Pereira',
    email: 'j@x.pt',
    user_id: null,
    position: null,
    department: null,
  },
  company: { id: 'c1', name: 'DASPRENT' },
  periods: [],
  ...overrides,
});

const ALL: RequestFilters = { status: 'all', search: '', type: 'all', companyId: 'all' };

describe('filterRequests / statusCounts', () => {
  const list = [
    request({ id: 'a', status: 'approved', created_at: '2026-10-01T00:00:00Z' }),
    request({ id: 'b', start_date: '2026-12-01' }),
    request({ id: 'c', start_date: '2026-10-22', absence_type: 'sick_leave' }),
    request({ id: 'd', status: 'partially_approved', created_at: '2026-10-05T00:00:00Z' }),
    request({
      id: 'e',
      status: 'rejected',
      company: { id: 'c2', name: 'Razão' },
      employee: { ...request({ id: 'x' }).employee, name: 'Ana Costa' },
    }),
  ];

  it('mostra os pendentes primeiro, os que começam mais cedo à frente', () => {
    expect(filterRequests(list, ALL).map(item => item.id)).toEqual(['c', 'b', 'e', 'd', 'a']);
  });

  it('"Aprovados" inclui os aprovados em parte', () => {
    const ids = filterRequests(list, { ...ALL, status: 'approved' }).map(item => item.id);
    expect(ids).toEqual(['d', 'a']);
  });

  it('filtra por tipo, empresa e nome (sem acentos, qualquer ordem)', () => {
    expect(filterRequests(list, { ...ALL, type: 'sick_leave' }).map(item => item.id)).toEqual([
      'c',
    ]);
    expect(filterRequests(list, { ...ALL, companyId: 'c2' }).map(item => item.id)).toEqual(['e']);
    expect(filterRequests(list, { ...ALL, search: 'pereira joao' })).toHaveLength(4);
  });

  it('conta cada estado com os outros filtros, mas não o do estado', () => {
    expect(statusCounts(list, { ...ALL, status: 'pending' })).toEqual({
      pending: 2,
      approved: 2,
      rejected: 1,
      all: 5,
    });
    expect(statusCounts(list, { ...ALL, companyId: 'c1' }).rejected).toBe(0);
  });

  it('estado desconhecido no endereço → pendentes', () => {
    expect(toStatusFilter(null)).toBe('pending');
    expect(toStatusFilter('rejected')).toBe('rejected');
    expect(toStatusFilter('xpto')).toBe('pending');
  });
});

describe('durações', () => {
  it('tira a hora de almoço às horas', () => {
    expect(workingHours('09:00', '18:00')).toBe(8);
    expect(workingHours('09:00', '13:00')).toBe(4);
    expect(workingHours('13:30', '15:00')).toBe(1);
  });

  it('pedido só de horas em horas; o resto em dias', () => {
    const partial = {
      id: 'p',
      period_type: 'partial',
      start_time: '09:00:00',
      end_time: '13:00:00',
    };
    expect(
      requestDuration({
        total_business_days: 0.5,
        periods: [
          { ...partial, start_date: '2026-11-02', end_date: '2026-11-02', business_days: 0.5 },
        ],
      })
    ).toBe('4h');
    expect(requestDuration({ total_business_days: 1, periods: [] })).toBe('1 dia');
    expect(requestDuration({ total_business_days: 2.5, periods: [] })).toBe('2,5 dias');
    expect(
      periodDuration({
        ...partial,
        start_date: '2026-11-02',
        end_date: '2026-11-02',
        business_days: 0.5,
      })
    ).toBe('09:00–13:00 · 4h');
    expect(formatAmount(1.25)).toBe('1,25');
  });
});

describe('datas', () => {
  it('intervalo curto, com o ano só quando não é o atual', () => {
    expect(dateRange('2026-10-14', '2026-10-14', NOW)).toBe('14 out');
    expect(dateRange('2026-10-14', '2026-10-18', NOW)).toBe('14–18 out');
    expect(dateRange('2026-10-28', '2026-11-03', NOW)).toBe('28 out – 3 nov');
    expect(dateRange('2026-12-28', '2027-01-02', NOW)).toBe('28 dez 2026 – 2 jan 2027');
    expect(dateRange('2027-02-01', '2027-02-05', NOW)).toBe('1–5 fev 2027');
  });

  it('primeiro e último dia pelos períodos', () => {
    const span = requestSpan({
      start_date: '2026-01-01',
      end_date: '2026-01-01',
      periods: [
        { id: '2', start_date: '2026-11-10', end_date: '2026-11-12', business_days: 3 },
        { id: '1', start_date: '2026-11-02', end_date: '2026-11-03', business_days: 2 },
      ],
    });
    expect(span).toEqual({ start: '2026-11-02', end: '2026-11-12' });
  });

  it('quando foi pedido e urgência', () => {
    expect(requestedAgo('2026-10-20T08:00:00', NOW)).toBe('hoje');
    expect(requestedAgo('2026-10-19T08:00:00', NOW)).toBe('ontem');
    expect(requestedAgo('2026-10-16T08:00:00', NOW)).toBe('há 4 dias');
    expect(startUrgency('2026-10-12', '2026-10-16', NOW)).toEqual({
      label: 'Já passou',
      tone: 'late',
    });
    expect(startUrgency('2026-10-19', '2026-10-21', NOW)).toEqual({
      label: 'Já começou',
      tone: 'late',
    });
    expect(startUrgency('2026-10-20', '2026-10-20', NOW)?.label).toBe('Começa hoje');
    expect(startUrgency('2026-10-25', '2026-10-26', NOW)?.label).toBe('Em 5 dias');
    expect(startUrgency('2026-11-25', '2026-11-25', NOW)).toBeNull();
  });
});

describe('groupOverlaps', () => {
  it('só quem coincide com os dias pedidos, um por pessoa', () => {
    const periods = [
      { start_date: '2026-09-18', end_date: '2026-09-18' },
      { start_date: '2026-10-30', end_date: '2026-10-30' },
    ];
    const people = groupOverlaps(
      [
        {
          name: 'Ana',
          absenceType: 'vacation',
          start: '2026-09-14',
          end: '2026-09-18',
          pending: false,
        },
        {
          name: 'Ana',
          absenceType: 'other',
          start: '2026-10-30',
          end: '2026-10-30',
          pending: true,
        },
        {
          name: 'Rui',
          absenceType: 'vacation',
          start: '2026-09-21',
          end: '2026-09-25',
          pending: false,
        },
        {
          name: 'Eva',
          absenceType: 'vacation',
          start: '2026-10-29',
          end: '2026-10-31',
          pending: true,
        },
      ],
      periods
    );
    expect(people.map(person => [person.name, person.items.length, person.pending])).toEqual([
      ['Ana', 2, false],
      ['Eva', 1, true],
    ]);
  });
});
