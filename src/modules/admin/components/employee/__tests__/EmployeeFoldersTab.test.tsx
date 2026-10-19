import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { folderAccessService } from '../../../services/folderAccessService';
import EmployeeFoldersTab from '../EmployeeFoldersTab';

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

vi.mock('../../../services/folderAccessService', () => ({
  folderAccessService: {
    listForEmployee: vi.fn(async () => ({
      data: [
        {
          id: 'a1',
          employee_id: 'emp1',
          path: '_SAAS_TESTE',
          label: null,
          permission: 'edit',
          created_by: null,
          created_at: '2026-10-19T10:00:00Z',
        },
      ],
      error: null,
    })),
    assign: vi.fn(async () => ({ error: null })),
    setPermission: vi.fn(async () => ({ error: null })),
    remove: vi.fn(async () => ({ error: null })),
    browse: vi.fn(async (path: string | null) => ({
      data: {
        path,
        entries: path
          ? [{ name: 'Marketing', path: `${path}/Marketing` }]
          : [
              { name: 'DASPRENT', path: 'DASPRENT' },
              { name: '_SAAS_TESTE', path: '_SAAS_TESTE' },
            ],
      },
      error: null,
    })),
    createFolder: vi.fn(async (path: string) => ({ data: { path, created: true }, error: null })),
  },
}));

const renderTab = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <EmployeeFoldersTab employeeId="emp1" />
    </QueryClientProvider>
  );

describe('Pastas da empresa na ficha do colaborador', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mostra as pastas atribuídas e muda a permissão', async () => {
    renderTab();
    expect(
      await screen.findByText('_SAAS_TESTE', { selector: 'p.text-\\[12\\.5px\\]' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ler' }));
    await waitFor(() =>
      expect(folderAccessService.setPermission).toHaveBeenCalledWith('a1', 'read')
    );
  });

  it('escolhe uma pasta do servidor e dá acesso de edição', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Adicionar pasta'));
    fireEvent.click(await screen.findByText('DASPRENT'));
    // dentro da DASPRENT: subpastas e "Nova pasta aqui"
    expect(await screen.findByText('Marketing')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(
      Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === 'Editar')!
    );
    fireEvent.click(screen.getByText('Dar acesso a esta pasta'));
    await waitFor(() =>
      expect(folderAccessService.assign).toHaveBeenCalledWith('emp1', 'DASPRENT', 'edit')
    );
  });

  it('cria uma pasta nova no servidor dentro da pasta aberta', async () => {
    renderTab();
    fireEvent.click(await screen.findByText('Adicionar pasta'));
    fireEvent.click(await screen.findByText('DASPRENT'));
    fireEvent.click(await screen.findByText('Nova pasta aqui'));
    fireEvent.change(screen.getByLabelText('Nome da pasta nova'), {
      target: { value: 'Ana Silva' },
    });
    fireEvent.click(screen.getByText('Criar'));
    await waitFor(() =>
      expect(folderAccessService.createFolder).toHaveBeenCalledWith('DASPRENT/Ana Silva')
    );
  });
});
