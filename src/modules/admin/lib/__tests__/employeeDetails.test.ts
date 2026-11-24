import { describe, expect, it } from 'vitest';
import { buildEmployeeDetails, type EmployeeFormValues } from '../employeeDetails';

const form = (overrides: Partial<EmployeeFormValues> = {}) => ({
  name: 'Ana Exemplo',
  company_id: 'company-1',
  phone: '',
  position: 'Técnica',
  department: '  RH  ',
  safety_checkup_renewal_months: '12',
  hire_date: '',
  notes: '  nota  ',
  safety_checkup_date_iso: '2026-01-02',
  birth_date_iso: null,
  ...overrides,
});

describe('buildEmployeeDetails', () => {
  it('em edição NÃO envia company_id (a troca faz-se com "Mover para empresa…")', () => {
    const details = buildEmployeeDetails(form(), 'edit');
    expect(details).not.toHaveProperty('company_id');
  });

  it('em edição, um company_id diferente no formulário também não vai', () => {
    const details = buildEmployeeDetails(form({ company_id: 'outra-empresa' }), 'edit');
    expect(Object.keys(details)).not.toContain('company_id');
  });

  it('ao criar envia company_id', () => {
    const details = buildEmployeeDetails(form(), 'create');
    expect(details).toHaveProperty('company_id', 'company-1');
  });

  it('mantém o tratamento dos restantes campos nos dois modos', () => {
    for (const mode of ['edit', 'create'] as const) {
      const details = buildEmployeeDetails(form(), mode);
      expect(details).toMatchObject({
        name: 'Ana Exemplo',
        phone: null,
        position: 'Técnica',
        department: 'RH',
        notes: 'nota',
        hire_date: null,
        safety_checkup_date: '2026-01-02',
        safety_checkup_renewal_months: 12,
        birth_date: null,
      });
    }
  });
});
