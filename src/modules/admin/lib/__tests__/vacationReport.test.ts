import { describe, expect, it } from 'vitest';
import { buildVacationReportHtml, vacationReportRows } from '../vacationReport';

const employees = [
  { id: 'e1', name: 'Ana Silva', companyName: 'Realize' },
  { id: 'e2', name: 'Bruno Costa', companyName: 'Realize' },
];

describe('vacationReportRows', () => {
  it('calcula disponíveis, pendentes e quanto o colaborador ainda pode marcar', () => {
    const [ana, bruno] = vacationReportRows({
      year: 2026,
      employees,
      balances: [{ employee_id: 'e1', total_days: 22, used_days: 5, self_schedulable_days: 11 }],
      absences: [
        {
          employee_id: 'e1',
          status: 'pending',
          created_by_role: 'employee',
          absence_periods: [{ business_days: 3, start_date: '2026-08-03' }],
        },
        {
          employee_id: 'e1',
          status: 'approved',
          created_by_role: 'employee',
          absence_periods: [{ business_days: 5, start_date: '2025-12-29' }],
        },
      ],
    });
    expect(ana).toMatchObject({ available: 17, pending: 3, remainingSelf: 8, adminReserved: 11 });
    expect(bruno.missing).toBe(true);
  });
});

describe('buildVacationReportHtml', () => {
  it('lista os colaboradores e avisa quem não tem saldo', () => {
    const html = buildVacationReportHtml({
      year: 2026,
      employees,
      balances: [{ employee_id: 'e1', total_days: 22, used_days: 0, self_schedulable_days: null }],
      absences: [],
      logoBase64: '',
    });
    expect(html).toContain('Ana Silva');
    expect(html).toContain('Sem saldo configurado para 2026');
    expect(html).toContain('1 colaboradores sem saldo');
  });
});
