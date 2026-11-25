import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompanyRow } from '../CompanyRow';
import type { Company } from '@/modules/admin/services/companyService';

vi.mock('@/modules/admin/services/companyLogoService', () => ({
  companyLogoService: { publicUrl: () => null },
}));

const COMPANY: Company = {
  id: 'c1',
  name: 'Acme Lda',
  nif: '123456789',
  email: 'geral@acme.pt',
  phone: '',
  address: '',
  city: 'Lisboa',
  postal_code: '',
  notes: '',
  is_active: true,
  logo_path: null,
  country: 'PT',
  created_at: '2024-01-01T00:00:00Z',
  domain: '',
  updated_at: '2024-01-01T00:00:00Z',
};

const renderRow = (canAdministerPlatform = false) => {
  const onOpen = vi.fn();
  const onToggleStatus = vi.fn();
  render(
    <MemoryRouter>
      <table>
        <tbody>
          <CompanyRow
            company={COMPANY}
            canManage
            canAdministerPlatform={canAdministerPlatform}
            onOpen={onOpen}
            onToggleStatus={onToggleStatus}
            onDelete={vi.fn()}
          />
        </tbody>
      </table>
    </MemoryRouter>
  );
  return { onOpen, onToggleStatus, cell: screen.getByText('123456789') };
};

afterEach(() => vi.restoreAllMocks());

describe('CompanyRow — clique na linha', () => {
  it('um clique simples abre a ficha', () => {
    const { onOpen, cell } = renderRow();
    fireEvent.click(cell, { detail: 1 });
    expect(onOpen).toHaveBeenCalledWith(COMPANY);
  });

  it.each([['ctrlKey'], ['metaKey'], ['shiftKey'], ['altKey']])(
    '%s+clique não abre a ficha',
    modifier => {
      const { onOpen, cell } = renderRow();
      fireEvent.click(cell, { detail: 1, [modifier]: true });
      expect(onOpen).not.toHaveBeenCalled();
    }
  );

  it('o botão do meio não abre a ficha', () => {
    const { onOpen, cell } = renderRow();
    fireEvent.click(cell, { detail: 1, button: 1 });
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('o duplo clique abre uma só vez', () => {
    const { onOpen, cell } = renderRow();
    fireEvent.click(cell, { detail: 1 });
    fireEvent.click(cell, { detail: 2 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('um clique que termina uma seleção de texto não abre a ficha', () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'Acme',
    } as unknown as Selection);
    const { onOpen, cell } = renderRow();
    fireEvent.click(cell, { detail: 1 });
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('CompanyRow — estado', () => {
  it('o botão do estado não tem um div lá dentro e não abre a ficha', () => {
    const { onOpen, onToggleStatus } = renderRow(true);
    const button = screen.getByRole('button', { name: /desativar Acme Lda/i });
    expect(button.querySelector('div')).toBeNull();
    fireEvent.click(button, { detail: 1 });
    expect(onToggleStatus).toHaveBeenCalledWith(COMPANY);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
