import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MailPostoDialog } from '../MailPostoDialog';
import type { PostoAccess } from '../../../services/mailPostosService';

const accesses: PostoAccess[] = [
  {
    accessId: 'a1',
    title: 'Geral',
    email: 'geral@empresa.pt',
    companyName: 'Empresa',
    connected: true,
  },
  {
    accessId: 'a2',
    title: 'Vendas',
    email: 'vendas@empresa.pt',
    companyName: null,
    connected: false,
  },
];

const setup = (onSave = vi.fn().mockResolvedValue(null)) => {
  render(
    <MailPostoDialog
      open
      posto={null}
      accesses={accesses}
      accessesLoading={false}
      onClose={vi.fn()}
      onSave={onSave}
    />
  );
  return onSave;
};

describe('MailPostoDialog', () => {
  it('só deixa criar com nome e pelo menos uma caixa', () => {
    setup();
    const create = screen.getByRole('button', { name: 'Criar posto' });
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('Ex.: Receção Lisboa'), {
      target: { value: 'Receção' },
    });
    expect(create).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/geral@empresa.pt/));
    expect(create).toBeEnabled();
  });

  it('grava o nome sem espaços a mais e as caixas escolhidas', async () => {
    const onSave = setup();
    fireEvent.change(screen.getByPlaceholderText('Ex.: Receção Lisboa'), {
      target: { value: '  Receção   Lisboa ' },
    });
    fireEvent.click(screen.getByLabelText(/geral@empresa.pt/));
    fireEvent.click(screen.getByLabelText(/vendas@empresa.pt/));
    fireEvent.click(screen.getByRole('button', { name: 'Criar posto' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Receção Lisboa', ['a1', 'a2']));
  });

  it('mostra o erro do servidor e mantém o que foi escrito', async () => {
    const onSave = vi.fn().mockResolvedValue('Há caixas que não são acessos de email.');
    setup(onSave);
    fireEvent.change(screen.getByPlaceholderText('Ex.: Receção Lisboa'), {
      target: { value: 'Receção' },
    });
    fireEvent.click(screen.getByLabelText(/geral@empresa.pt/));
    fireEvent.click(screen.getByRole('button', { name: 'Criar posto' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('não são acessos de email');
    expect(screen.getByPlaceholderText('Ex.: Receção Lisboa')).toHaveValue('Receção');
  });

  it('a pesquisa filtra as caixas e mostra "nenhuma" quando não há', () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText(/Procurar/), { target: { value: 'vendas' } });
    expect(screen.queryByLabelText(/geral@empresa.pt/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Procurar/), { target: { value: 'zzz' } });
    expect(screen.getByText('Nenhuma caixa encontrada.')).toBeInTheDocument();
  });
});
