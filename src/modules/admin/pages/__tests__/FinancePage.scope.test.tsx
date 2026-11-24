import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FinancePage from '../FinancePage';

const person = (id: string, name: string, company: string, active = true) => ({
  id,
  name,
  email: `${id}@x.pt`,
  company_id: company,
  is_active: active,
  iban: '',
  companies: { id: company, name: `Empresa ${company}` },
});
const EMPLOYEES = [
  person('e1', 'Ana', 'c1'),
  person('e2', 'Rui', 'c2'),
  person('e3', 'Eva', 'c3'),
  person('e4', 'Inativo', 'c1', false),
];

vi.mock('@/hooks/useEmployees', () => ({
  useEmployees: () => ({ employees: EMPLOYEES, isLoading: false }),
}));
vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({ canExecuteTopic: () => false }),
}));

const tab = vi.hoisted(() => ({ employees: [] as { id: string }[] }));
vi.mock('../../components/employee/EmployeeFinancialTab', () => ({
  default: (props: { employees: { id: string }[] }) => {
    tab.employees = props.employees;
    return <div data-testid="folha" />;
  },
}));
vi.mock('../../components/employees/ImportPayslipsDialog', () => ({
  ImportPayslipsDialog: () => null,
}));
vi.mock('@/components/admin/CompanyScopeNotice', () => ({ CompanyScopeNotice: () => null }));

const scope = vi.hoisted(() => ({
  value: { ids: null as Set<string> | null, singleCompanyId: null as string | null },
}));
vi.mock('../../context/CompanyScopeContext', () => ({ useCompanyScope: () => scope.value }));

const renderPage = (url = '/admin/financeiro') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <FinancePage />
    </MemoryRouter>
  );
const shown = () => tab.employees.map(e => e.id).sort();

describe('FinancePage: Financeiro segue o seletor de empresa', () => {
  beforeEach(() => {
    tab.employees = [];
    scope.value = { ids: null, singleCompanyId: null };
  });

  it('"Todas as empresas": todos os colaboradores ativos', () => {
    renderPage();
    expect(shown()).toEqual(['e1', 'e2', 'e3']);
  });

  it('com um grupo escolhido, só os colaboradores das empresas do grupo', () => {
    scope.value = { ids: new Set(['c1', 'c2']), singleCompanyId: null };
    renderPage();
    expect(shown()).toEqual(['e1', 'e2']);
  });

  it('com uma empresa escolhida, só os dela e sem o filtro de empresa da página', () => {
    scope.value = { ids: new Set(['c3']), singleCompanyId: 'c3' };
    renderPage();
    expect(shown()).toEqual(['e3']);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('um ?empresa= de fora da escolha do menu não traz gente de outra empresa', () => {
    scope.value = { ids: new Set(['c1']), singleCompanyId: 'c1' };
    renderPage('/admin/financeiro?empresa=c2');
    expect(shown()).toEqual(['e1']);
  });
});
