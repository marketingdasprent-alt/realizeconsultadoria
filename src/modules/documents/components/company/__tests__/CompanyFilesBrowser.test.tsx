import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { companyFilesService } from '../../../services/companyFilesService';
import { CompanyFilesBrowser } from '../CompanyFilesBrowser';

vi.mock('../../../services/companyFilesService', () => ({
  companyFilesService: {
    folders: vi.fn(async () => ({
      data: [{ path: '_SAAS_TESTE', name: 'Pasta de testes', permission: 'edit' }],
      error: null,
    })),
    list: vi.fn(async (path: string) => ({
      data: {
        path,
        permission: 'edit',
        truncated: false,
        entries: [
          {
            name: 'Documento de teste.docx',
            type: 'file',
            size: 2048,
            modified: '2026-10-16T10:00:00Z',
          },
          { name: 'Colaborador Teste', type: 'dir', modified: '2026-10-16T10:00:00Z' },
        ],
      },
      error: null,
    })),
    createFolder: vi.fn(async (path: string) => ({ data: { path, created: true }, error: null })),
  },
}));

const renderBrowser = (path: string | null) => {
  const handlers = { onNavigate: vi.fn(), onOpenFile: vi.fn(), onDownload: vi.fn() };
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <CompanyFilesBrowser path={path} {...handlers} />
    </QueryClientProvider>
  );
  return handlers;
};

describe('CompanyFilesBrowser', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mostra as pastas atribuídas e entra nelas', async () => {
    const { onNavigate } = renderBrowser(null);
    fireEvent.click(await screen.findByText('Pasta de testes'));
    expect(onNavigate).toHaveBeenCalledWith('_SAAS_TESTE');
    expect(screen.queryByText('Nova pasta')).toBeNull();
  });

  it('lista a pasta (pastas primeiro) com o caminho completo', async () => {
    const { onOpenFile, onDownload } = renderBrowser('_SAAS_TESTE');
    const names = (await screen.findAllByRole('listitem')).map(item => item.textContent);
    expect(names[0]).toContain('Colaborador Teste');
    expect(screen.getByText('Pasta de testes')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Documento de teste.docx'));
    expect(onOpenFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: '_SAAS_TESTE/Documento de teste.docx' })
    );
    fireEvent.click(screen.getByLabelText('Descarregar Documento de teste.docx'));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('cria uma pasta dentro da pasta aberta', async () => {
    renderBrowser('_SAAS_TESTE');
    fireEvent.click(await screen.findByText('Nova pasta'));
    fireEvent.change(screen.getByLabelText('Nome da pasta'), { target: { value: 'Ana Silva' } });
    fireEvent.click(screen.getByText('Criar'));
    await waitFor(
      () => expect(companyFilesService.createFolder).toHaveBeenCalledWith('_SAAS_TESTE/Ana Silva'),
      { timeout: 3000 }
    );
  });
});
