import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompanyForm } from '../CompanyForm';

vi.mock('../../hooks/useSharing', () => ({
  useAllGroups: () => ({
    data: [
      { group_id: 'g1', group_name: 'Grupo Realize', company_id: 'c1' },
      { group_id: 'g1', group_name: 'Grupo Realize', company_id: 'c2' },
    ],
  }),
}));

const COMPANY = {
  id: 'c1',
  name: 'Acme Lda',
  nif: '123456789',
  email: 'geral@acme.pt',
  phone: '',
  address: '',
  city: '',
  postal_code: '',
  notes: '',
  is_active: true,
} as never;

const fillCompany = () => {
  fireEvent.change(screen.getByLabelText(/nome da empresa/i), { target: { value: 'Nova Lda' } });
  fireEvent.change(screen.getByLabelText(/^nif/i), { target: { value: '987654321' } });
  fireEvent.change(screen.getByLabelText(/^email \*/i), { target: { value: 'nova@lda.pt' } });
};

const fillAdmin = () => {
  fireEvent.change(screen.getByLabelText(/nome do administrador/i), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText(/email do administrador/i), {
    target: { value: 'ana@nova.pt' },
  });
  fireEvent.change(screen.getByLabelText(/palavra-passe inicial/i), {
    target: { value: 'segredo123' },
  });
};

describe('CompanyForm — acessibilidade', () => {
  it('cada campo tem o seu rótulo associado (clicar no texto dá foco ao campo)', () => {
    render(<CompanyForm initialData={COMPANY} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    for (const label of [
      /nome da empresa/i,
      /^nif/i,
      /^telefone/i,
      /^email/i,
      /^morada/i,
      /^cidade/i,
      /código postal/i,
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByText('Cidade'));
    expect(screen.getByLabelText(/^cidade/i).tagName).toBe('INPUT');
  });

  it('um erro de validação marca só esse campo e liga a mensagem a ele', async () => {
    const onSubmit = vi.fn();
    render(<CompanyForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    const name = screen.getByLabelText(/nome da empresa/i);
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    expect(name).toHaveAccessibleDescription('Nome deve ter pelo menos 2 caracteres');
    expect(screen.getByLabelText(/^telefone/i)).not.toHaveAttribute('aria-invalid');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('com os dados válidos não há erro e o formulário é enviado', async () => {
    const onSubmit = vi.fn();
    render(<CompanyForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillCompany();
    fillAdmin();
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText(/nome da empresa/i)).not.toHaveAttribute('aria-invalid');
  });
});

describe('CompanyForm — empresa nova com primeiro administrador e grupo', () => {
  it('a criação pede o primeiro administrador; a edição não', () => {
    const { unmount } = render(<CompanyForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText(/email do administrador/i)).toBeInTheDocument();
    unmount();
    render(<CompanyForm initialData={COMPANY} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByLabelText(/email do administrador/i)).not.toBeInTheDocument();
  });

  it('sem os dados do administrador não envia e mostra os erros', async () => {
    const onSubmit = vi.fn();
    render(<CompanyForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillCompany();
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    expect(await screen.findByText('Indique o nome do administrador')).toBeInTheDocument();
    expect(
      screen.getByText('A palavra-passe deve ter pelo menos 8 caracteres')
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('a lista de grupos tem cada grupo uma só vez', () => {
    render(<CompanyForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getAllByRole('option', { name: 'Grupo Realize' })).toHaveLength(1);
  });

  it('escolher um grupo existente envia o seu id', async () => {
    const onSubmit = vi.fn();
    render(<CompanyForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillCompany();
    fillAdmin();
    fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: 'g1' } });
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ group_id: 'g1', group_name: '' });
  });

  it('criar um grupo novo envia o nome e nenhum id', async () => {
    const onSubmit = vi.fn();
    render(<CompanyForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fillCompany();
    fillAdmin();
    fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: '__novo__' } });
    fireEvent.change(screen.getByLabelText(/nome do grupo novo/i), {
      target: { value: 'Grupo Externo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ group_id: '', group_name: 'Grupo Externo' });
  });
});
