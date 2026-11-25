import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const publicUrl = vi.fn();
vi.mock('@/modules/admin/services/companyLogoService', () => ({
  companyLogoService: { publicUrl: (...args: unknown[]) => publicUrl(...args) },
}));

import { CompanyHeader } from '../CompanyHeader';

const COMPANY = {
  name: ' Acme   Lda',
  nif: '123456789',
  is_active: true,
  logo_path: null as string | null,
};

type Props = React.ComponentProps<typeof CompanyHeader>;

const renderHeader = (props: Partial<Props> = {}) => {
  const onBack = vi.fn();
  const view = render(
    <CompanyHeader
      company={COMPANY}
      group="Grupo Sol"
      admins={2}
      employees={14}
      onBack={onBack}
      {...props}
    />
  );
  return { onBack, ...view };
};

/** O valor (dd) que acompanha uma etiqueta (dt) da lista de factos. */
const fact = (label: string) => {
  const term = screen.getByText(label, { selector: 'dt' });
  return term.nextElementSibling as HTMLElement;
};

describe('CompanyHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicUrl.mockImplementation((path: string) => `https://cdn.test/${path}`);
  });

  it('mostra o nome limpo de espaços a mais num título', () => {
    renderHeader();
    expect(screen.getByRole('heading', { level: 1, name: 'Acme Lda' })).toBeInTheDocument();
  });

  it('mostra o NIF, o grupo e as contagens', () => {
    renderHeader();
    expect(fact('NIF')).toHaveTextContent('123456789');
    expect(fact('Grupo')).toHaveTextContent('Grupo Sol');
    expect(fact('Administradores')).toHaveTextContent('2');
    expect(fact('Colaboradores')).toHaveTextContent('14');
  });

  it('mostra zero como número (não como traço)', () => {
    renderHeader({ admins: 0, employees: 0 });
    expect(fact('Administradores')).toHaveTextContent(/^0$/);
    expect(fact('Colaboradores')).toHaveTextContent(/^0$/);
  });

  it('mostra um traço quando as contagens são null (a carregar ou sem permissão)', () => {
    renderHeader({ admins: null, employees: null });
    expect(fact('Administradores')).toHaveTextContent(/^—$/);
    expect(fact('Colaboradores')).toHaveTextContent(/^—$/);
  });

  it('o traço aplica-se a cada contagem em separado', () => {
    renderHeader({ admins: 3, employees: null });
    expect(fact('Administradores')).toHaveTextContent(/^3$/);
    expect(fact('Colaboradores')).toHaveTextContent(/^—$/);
  });

  it('diz "Sem grupo" quando a empresa não está em nenhum', () => {
    renderHeader({ group: null });
    expect(fact('Grupo')).toHaveTextContent('Sem grupo');
  });

  it('empresa ativa tem o selo Ativa', () => {
    renderHeader();
    expect(screen.getByText('Ativa')).toBeInTheDocument();
    expect(screen.queryByText('Desativada')).not.toBeInTheDocument();
  });

  it('empresa desativada tem o selo Desativada', () => {
    renderHeader({ company: { ...COMPANY, is_active: false } });
    expect(screen.getByText('Desativada')).toBeInTheDocument();
    expect(screen.queryByText('Ativa')).not.toBeInTheDocument();
  });

  it('sem logo mostra as iniciais', () => {
    renderHeader();
    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('com logo mostra a imagem em vez das iniciais', () => {
    renderHeader({ company: { ...COMPANY, logo_path: 'c1/1.webp' } });
    expect(document.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/c1/1.webp');
    expect(screen.queryByText('AL')).not.toBeInTheDocument();
  });

  it('o botão "Voltar às empresas" chama onBack', async () => {
    const { onBack } = renderHeader();
    await userEvent.click(screen.getByRole('button', { name: 'Voltar às empresas' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  describe('empresa nova (company null)', () => {
    it('mostra o título Nova empresa, sem selo nem factos', () => {
      renderHeader({ company: null });
      expect(screen.getByRole('heading', { level: 1, name: 'Nova empresa' })).toBeInTheDocument();
      expect(screen.queryByText('Ativa')).not.toBeInTheDocument();
      expect(screen.queryByText('NIF')).not.toBeInTheDocument();
      expect(screen.queryByRole('term')).not.toBeInTheDocument();
    });

    it('mantém o botão de voltar', async () => {
      const { onBack } = renderHeader({ company: null });
      const header = screen.getByRole('banner');
      await userEvent.click(within(header).getByRole('button', { name: 'Voltar às empresas' }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });
});
