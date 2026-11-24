import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CompanySharing } from '../CompanySharing';

// A área de scroll dos separadores observa o tamanho; o jsdom não tem ResizeObserver.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);

vi.mock('../../sharing/ShareCodeCard', () => ({
  ShareCodeCard: ({ company }: { company: string }) => (
    <div data-testid="codigo">codigo de {company}</div>
  ),
}));
vi.mock('../../sharing/RequestsPanel', () => ({
  RequestsPanel: ({ company }: { company: string }) => (
    <div data-testid="pedidos">pedidos de {company}</div>
  ),
}));
vi.mock('../../sharing/SharesPanel', () => ({
  SharesPanel: ({ company }: { company: string }) => (
    <div data-testid="acesso">acesso de {company}</div>
  ),
}));
vi.mock('../../sharing/GroupPanel', () => ({
  GroupPanel: ({ company }: { company: string }) => (
    <div data-testid="grupo">grupo de {company}</div>
  ),
}));
vi.mock('../../sharing/ViewersPanel', () => ({
  ViewersPanel: ({ company, name }: { company: string; name: string }) => (
    <div data-testid="quem-ve">
      quem-ve de {company} ({name})
    </div>
  ),
}));
vi.mock('../../sharing/RequestShareDialog', () => ({
  RequestShareDialog: ({ company }: { company: string }) => (
    <button type="button">Pedir partilha ({company})</button>
  ),
}));

const Where = () => <div data-testid="where">{useLocation().search}</div>;

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Where />
      <CompanySharing company={{ id: 'c1', name: 'Alfa Lda' }} />
    </MemoryRouter>
  );

describe('CompanySharing: a Partilha de uma empresa (antiga página "Partilha entre empresas")', () => {
  it('abre no Código da empresa da ficha e tem as cinco funções da antiga página', () => {
    renderAt('/admin/empresas/c1?tab=partilha');
    expect(screen.getByTestId('codigo')).toHaveTextContent('c1');
    for (const name of ['Código', 'Pedidos', 'Quem tem acesso', 'Grupo', 'Quem pode ver']) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    }
  });

  it('"Pedir partilha" está lá, para a empresa da ficha', () => {
    renderAt('/admin/empresas/c1?tab=partilha');
    expect(screen.getByRole('button', { name: 'Pedir partilha (c1)' })).toBeInTheDocument();
  });

  it('não há escolha de empresa (já vem fixada pela ficha)', () => {
    renderAt('/admin/empresas/c1?tab=partilha');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Empresa')).not.toBeInTheDocument();
  });

  it('?sub abre o sub-separador pedido, para a mesma empresa', () => {
    renderAt('/admin/empresas/c1?tab=partilha&sub=pedidos');
    expect(screen.getByTestId('pedidos')).toHaveTextContent('c1');
  });

  it('?sub desconhecido abre o Código', () => {
    renderAt('/admin/empresas/c1?tab=partilha&sub=xpto');
    expect(screen.getByTestId('codigo')).toBeInTheDocument();
  });

  it('"Quem pode ver" recebe o nome da empresa', async () => {
    const user = userEvent.setup();
    renderAt('/admin/empresas/c1?tab=partilha');
    await user.click(screen.getByRole('tab', { name: 'Quem pode ver' }));
    expect(screen.getByTestId('quem-ve')).toHaveTextContent('c1');
  });

  it('mudar de sub-separador escreve ?sub e mantém ?tab=partilha; voltar ao Código limpa ?sub', async () => {
    const user = userEvent.setup();
    renderAt('/admin/empresas/c1?tab=partilha');
    await user.click(screen.getByRole('tab', { name: 'Grupo' }));
    expect(screen.getByTestId('where')).toHaveTextContent('?tab=partilha&sub=grupo');
    expect(screen.getByTestId('grupo')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Código' }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\?tab=partilha$/);
  });
});
