import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LegacySharingRedirect from '../LegacySharingRedirect';

const company = (id: string, name: string, role = 'admin') => ({
  company_id: id,
  name,
  role,
  status: 'ativo',
  origin: 'convite',
  is_group_member: false,
});

const mine = vi.hoisted(() => ({
  value: { data: [] as unknown[], isLoading: false, error: null as unknown },
}));
vi.mock('../../hooks/useSharing', () => ({ useMyCompanies: () => mine.value }));

const scope = vi.hoisted(() => ({ ids: null as Set<string> | null }));
vi.mock('../../context/CompanyScopeContext', () => ({ useCompanyScope: () => scope }));

const Where = () => {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin/partilha" element={<LegacySharingRedirect />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );

describe('/admin/partilha redireciona para Empresas (links e notificações antigos)', () => {
  beforeEach(() => {
    mine.value = {
      data: [company('c1', 'Alfa'), company('c2', 'Beta'), company('c3', 'Gama', 'colaborador')],
      isLoading: false,
      error: null,
    };
    scope.ids = null;
  });

  it('sem separador abre o Código da primeira empresa que se administra', () => {
    renderAt('/admin/partilha');
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c1?tab=partilha');
  });

  it('mantém o separador antigo como sub-separador (?tab=pedidos)', () => {
    renderAt('/admin/partilha?tab=pedidos');
    expect(screen.getByTestId('where')).toHaveTextContent(
      '/admin/empresas/c1?tab=partilha&sub=pedidos'
    );
  });

  it('?tab=grupos vai para a zona Grupos da lista', () => {
    renderAt('/admin/partilha?tab=grupos');
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas?tab=grupos');
  });

  it('com uma empresa escolhida no menu abre essa empresa', () => {
    scope.ids = new Set(['c2']);
    renderAt('/admin/partilha');
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c2?tab=partilha');
  });

  it('nunca abre uma empresa que a conta não administra', () => {
    scope.ids = new Set(['c3']);
    renderAt('/admin/partilha');
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/empresas/c1?tab=partilha');
  });

  it('sem nenhuma empresa administrada vai para a lista (não fica um link partido)', () => {
    mine.value = { data: [company('c3', 'Gama', 'colaborador')], isLoading: false, error: null };
    renderAt('/admin/partilha?tab=pedidos');
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/admin\/empresas$/);
  });

  it('enquanto carrega as empresas não decide nada', () => {
    mine.value = { data: [], isLoading: true, error: null };
    renderAt('/admin/partilha');
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });
});
