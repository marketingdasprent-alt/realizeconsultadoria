import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CompanyForm } from '../CompanyForm';

// O zod 4 instalado não funciona com @hookform/resolvers 3.10 (lança em vez de devolver erros),
// por isso aqui o resolver é simulado: o que se testa é a ligação campo/rótulo/erro do formulário.
vi.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => async (values: { name?: string }) =>
    values.name
      ? { values, errors: {} }
      : { values: {}, errors: { name: { type: 'required', message: 'Nome em falta' } } },
}));

describe('CompanyForm — acessibilidade', () => {
  it('cada campo tem o seu rótulo associado (clicar no texto dá foco ao campo)', () => {
    render(<CompanyForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
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
    expect(name).toHaveAccessibleDescription('Nome em falta');
    expect(screen.getByLabelText(/^telefone/i)).not.toHaveAttribute('aria-invalid');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('com os dados válidos não há erro e o formulário é enviado', async () => {
    const onSubmit = vi.fn();
    render(<CompanyForm onSubmit={onSubmit} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/nome da empresa/i), { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('button', { name: /criar empresa/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText(/nome da empresa/i)).not.toHaveAttribute('aria-invalid');
  });
});
