import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SharingPage from '../SharingPage';

const company = (id: string, name: string) => ({ company_id: id, name, role: 'admin' });
const MINE = [company('c1', 'Alfa'), company('c2', 'Beta'), company('c3', 'Gama')];

vi.mock('../../hooks/useSharing', () => ({
  useMyCompanies: () => ({ data: MINE, isLoading: false, error: null, refetch: vi.fn() }),
}));

const shown = vi.hoisted(() => ({ company: '', options: [] as string[] }));
vi.mock('../../components/sharing/RequestShareDialog', () => ({
  RequestShareDialog: (props: { company: string }) => {
    shown.company = props.company;
    return null;
  },
}));
vi.mock('../../components/sharing/CompanyPicker', () => ({
  CompanyPicker: (props: { companies: { company_id: string }[] }) => {
    shown.options = props.companies.map(c => c.company_id);
    return null;
  },
}));
vi.mock('../../components/sharing/ShareCodeCard', () => ({ ShareCodeCard: () => null }));
vi.mock('../../components/sharing/RequestsPanel', () => ({ RequestsPanel: () => null }));
vi.mock('../../components/sharing/SharesPanel', () => ({ SharesPanel: () => null }));
vi.mock('../../components/sharing/GroupPanel', () => ({ GroupPanel: () => null }));
vi.mock('../../components/sharing/ViewersPanel', () => ({ ViewersPanel: () => null }));
vi.mock('../../components/sharing/AllGroupsPanel', () => ({ AllGroupsPanel: () => null }));

const scope = vi.hoisted(() => ({ ids: null as Set<string> | null }));
vi.mock('../../context/CompanyScopeContext', () => ({ useCompanyScope: () => scope }));

const renderPage = () =>
  render(
    <MemoryRouter>
      <SharingPage />
    </MemoryRouter>
  );

describe('SharingPage: Partilha entre empresas segue o seletor de empresa', () => {
  beforeEach(() => {
    shown.company = '';
    shown.options = [];
    scope.ids = null;
  });

  it('"Todas as empresas": abre na primeira e deixa escolher entre todas', () => {
    renderPage();
    expect(shown.company).toBe('c1');
    expect(shown.options).toEqual(['c1', 'c2', 'c3']);
  });

  it('com uma empresa escolhida no menu, abre nessa empresa', () => {
    scope.ids = new Set(['c3']);
    renderPage();
    expect(shown.company).toBe('c3');
  });

  it('com um grupo escolhido, só deixa escolher entre as empresas do grupo', () => {
    scope.ids = new Set(['c2', 'c3']);
    renderPage();
    expect(shown.company).toBe('c2');
    expect(shown.options).toEqual(['c2', 'c3']);
  });

  it('se a escolha do menu não tem nenhuma empresa que se administre, não fica vazio', () => {
    scope.ids = new Set(['c9']);
    renderPage();
    expect(shown.company).toBe('c1');
  });
});
