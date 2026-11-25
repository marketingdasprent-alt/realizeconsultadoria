import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const publicUrl = vi.fn();
vi.mock('@/modules/admin/services/companyLogoService', () => ({
  companyLogoService: { publicUrl: (...args: unknown[]) => publicUrl(...args) },
}));

import { CompanyLogo } from '../CompanyLogo';

const image = (container: HTMLElement) => container.querySelector('img');

describe('CompanyLogo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publicUrl.mockImplementation((path: string) => `https://cdn.test/company-logos/${path}`);
  });

  it('sem logo mostra as iniciais e não pede o endereço público', () => {
    const { container, getByText } = render(<CompanyLogo name="Acme Lda" logoPath={null} />);
    expect(getByText('AL')).toBeInTheDocument();
    expect(image(container)).toBeNull();
    expect(publicUrl).not.toHaveBeenCalled();
  });

  it('sem a propriedade logoPath também mostra as iniciais', () => {
    const { container, getByText } = render(<CompanyLogo name="Razão Dinâmica, Lda" />);
    expect(getByText('RD')).toBeInTheDocument();
    expect(image(container)).toBeNull();
  });

  it('um caminho vazio conta como sem logo', () => {
    const { container, getByText } = render(<CompanyLogo name="Beta" logoPath="" />);
    expect(getByText('B')).toBeInTheDocument();
    expect(image(container)).toBeNull();
  });

  it('as iniciais ignoram os espaços a mais do nome na base', () => {
    const { getByText } = render(<CompanyLogo name="  Razão   Dinâmica, Lda" />);
    expect(getByText('RD')).toBeInTheDocument();
  });

  it('as iniciais ficam escondidas dos leitores de ecrã (o nome já está ao lado)', () => {
    const { getByText } = render(<CompanyLogo name="Acme Lda" />);
    expect(getByText('AL')).toHaveAttribute('aria-hidden', 'true');
  });

  it('com logo mostra a imagem com o endereço público do caminho', () => {
    const { container, queryByText } = render(
      <CompanyLogo name="Acme Lda" logoPath="c1/1700000000000.webp" />
    );
    expect(publicUrl).toHaveBeenCalledWith('c1/1700000000000.webp');
    expect(image(container)).toHaveAttribute(
      'src',
      'https://cdn.test/company-logos/c1/1700000000000.webp'
    );
    expect(queryByText('AL')).not.toBeInTheDocument();
  });

  it('a imagem é decorativa (alt vazio)', () => {
    const { container } = render(<CompanyLogo name="Acme Lda" logoPath="c1/1.webp" />);
    expect(image(container)).toHaveAttribute('alt', '');
  });

  it('se a imagem não carrega cai nas iniciais', () => {
    const { container, getByText } = render(<CompanyLogo name="Acme Lda" logoPath="c1/1.webp" />);
    fireEvent.error(image(container) as HTMLImageElement);
    expect(image(container)).toBeNull();
    expect(getByText('AL')).toBeInTheDocument();
  });

  it('depois de falhar, uma logo nova (outro caminho) volta a tentar a imagem', () => {
    const { container, rerender, getByText } = render(
      <CompanyLogo name="Acme Lda" logoPath="c1/velha.webp" />
    );
    fireEvent.error(image(container) as HTMLImageElement);
    expect(getByText('AL')).toBeInTheDocument();

    rerender(<CompanyLogo name="Acme Lda" logoPath="c1/nova.webp" />);
    expect(image(container)).toHaveAttribute('src', 'https://cdn.test/company-logos/c1/nova.webp');
  });

  it('o endereço público ausente (null) também cai nas iniciais', () => {
    publicUrl.mockReturnValue(null);
    const { container, getByText } = render(<CompanyLogo name="Acme Lda" logoPath="c1/1.webp" />);
    expect(image(container)).toBeNull();
    expect(getByText('AL')).toBeInTheDocument();
  });

  it.each([
    ['sm', 'h-8'],
    ['md', 'h-10'],
    ['lg', 'h-24'],
  ] as const)('o tamanho %s aplica a altura %s', (size, heightClass) => {
    const { getByText } = render(<CompanyLogo name="Acme Lda" size={size} />);
    expect(getByText('AL')).toHaveClass(heightClass);
  });

  it('o tamanho por omissão é o médio e aceita uma classe extra', () => {
    const { getByText } = render(<CompanyLogo name="Acme Lda" className="minha-classe" />);
    expect(getByText('AL')).toHaveClass('h-10', 'minha-classe');
  });

  it('a logo fica sempre sobre fundo claro', () => {
    const { container } = render(<CompanyLogo name="Acme Lda" logoPath="c1/1.webp" />);
    expect(image(container)?.parentElement).toHaveStyle({ backgroundColor: '#fff' });
  });
});
