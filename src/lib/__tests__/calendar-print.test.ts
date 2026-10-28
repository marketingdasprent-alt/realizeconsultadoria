import { describe, expect, it } from 'vitest';
import { buildMapRows, generateCalendarPrintHtml, type PrintAbsence } from '../calendar-print';

const holidays = [
  { id: 'h', date: '2026-10-05', name: 'Implantação', year: 2026, is_national: true },
];

const vacation = (overrides: Partial<PrintAbsence>): PrintAbsence => ({
  id: 'a1',
  employee_id: 'e1',
  start_date: '2026-10-01',
  end_date: '2026-10-09',
  absence_type: 'vacation',
  status: 'approved',
  employees: { name: 'Arthur Lopes Murali', companies: { name: 'Realize' } },
  absence_periods: [],
  ...overrides,
});

describe('buildMapRows', () => {
  it('uma linha por pessoa com o nome completo, os períodos e os dias úteis', () => {
    const { days, rows } = buildMapRows(2026, 9, [vacation({})], holidays);
    expect(days).toHaveLength(31);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Arthur Lopes Murali');
    expect(rows[0].periods).toEqual(['01/10 – 09/10']);
    // 1, 2, 6, 7, 8, 9 (o 5 é feriado; 3 e 4 fim de semana)
    expect(rows[0].total).toBe(6);
    expect(rows[0].cells[4]).toBeNull();
    expect(rows[0].cells[0]).toEqual({ kind: 'full', type: 'vacation' });
  });

  it('conta meio dia e ignora pedidos não aprovados', () => {
    const { rows } = buildMapRows(
      2026,
      9,
      [
        vacation({
          absence_periods: [
            {
              start_date: '2026-10-02',
              end_date: '2026-10-02',
              status: 'approved',
              period_type: 'partial',
              start_time: '09:00',
              end_time: '13:00',
              business_days: 0.5,
            },
          ],
        }),
        vacation({ id: 'p', employee_id: 'e2', status: 'pending' }),
      ],
      holidays
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(0.5);
    expect(rows[0].periods).toEqual(['02/10 (09:00–13:00)']);
    expect(rows[0].cells[1]).toEqual({ kind: 'half', type: 'vacation' });
  });
});

describe('generateCalendarPrintHtml', () => {
  it('escreve o nome completo de cada pessoa', () => {
    const html = generateCalendarPrintHtml({
      absences: [vacation({})],
      holidays,
      months: [{ year: 2026, month: 9 }],
      companyLabel: 'Todas as Empresas',
      logoBase64: '',
      orientation: 'landscape',
    });
    expect(html).toContain('Arthur Lopes Murali');
    expect(html).toContain('Implantação');
  });

  it('com outros tipos passa a Mapa de Ausências, com a legenda de cada tipo', () => {
    const html = generateCalendarPrintHtml({
      absences: [
        vacation({}),
        vacation({ id: 'a2', employee_id: 'e2', absence_type: 'sick_leave' }),
      ],
      holidays,
      months: [{ year: 2026, month: 9 }],
      companyLabel: 'Todas as Empresas',
      logoBase64: '',
      orientation: 'landscape',
      types: ['vacation', 'sick_leave'],
    });
    expect(html).toContain('<title>Mapa de Ausências</title>');
    expect(html).toContain('Baixa Médica');
    expect(html).toContain('Ausentes por dia');
  });
});
