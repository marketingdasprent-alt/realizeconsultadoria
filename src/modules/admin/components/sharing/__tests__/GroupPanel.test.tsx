import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupPanel } from '../GroupPanel';

const svc = vi.hoisted(() => ({ listGroup: vi.fn(), leaveGroup: vi.fn() }));
vi.mock('../../../services/sharingService', () => ({ sharingService: svc }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../ReauthDialog', () => ({ ReauthDialog: () => null }));

const member = (id: string, name: string, caps?: string[]) => ({
  group_id: 'g1',
  company_id: id,
  name,
  joined_at: '2026-11-17T10:00:00Z',
  origin: 'manual',
  is_me: id === 'a',
  ...(caps ? { default_capabilities: caps } : {}),
});

const renderPanel = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <GroupPanel company="a" />
    </QueryClientProvider>
  );

describe('GroupPanel — o que o grupo mostra por defeito (só leitura)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista os módulos por defeito do grupo', async () => {
    svc.listGroup.mockResolvedValue([
      member('a', 'Empresa A', ['directory.read', 'feed.read']),
      member('b', 'Empresa B', ['directory.read', 'feed.read']),
    ]);
    renderPanel();
    expect(
      await screen.findByText('O seu grupo mostra por defeito: Colaboradores, Comunicados de grupo')
    ).toBeInTheDocument();
    expect(screen.getByText(/ainda não têm efeito/)).toBeInTheDocument();
    expect(screen.getByText(/O Feed do grupo já mostra/)).toBeInTheDocument();
  });

  it('sem módulos diz que não há nada por defeito', async () => {
    svc.listGroup.mockResolvedValue([member('a', 'Empresa A', []), member('b', 'Empresa B', [])]);
    renderPanel();
    expect(
      await screen.findByText('O seu grupo mostra por defeito: Nada por defeito')
    ).toBeInTheDocument();
  });

  it('com uma base que ainda não devolve os módulos não parte e diz que não há nada por defeito', async () => {
    svc.listGroup.mockResolvedValue([member('a', 'Empresa A'), member('b', 'Empresa B')]);
    renderPanel();
    expect(
      await screen.findByText('O seu grupo mostra por defeito: Nada por defeito')
    ).toBeInTheDocument();
  });

  it('não oferece nenhuma forma de alterar os módulos (quem altera é o super admin)', async () => {
    svc.listGroup.mockResolvedValue([
      member('a', 'Empresa A', ['feed.read']),
      member('b', 'Empresa B', ['feed.read']),
    ]);
    renderPanel();
    await screen.findByText(/O seu grupo mostra por defeito/);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /módulos/i })).not.toBeInTheDocument();
  });

  it('a empresa sem grupo continua a ver o estado vazio', async () => {
    svc.listGroup.mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText('A sua empresa não está em nenhum grupo')).toBeInTheDocument();
    expect(screen.queryByText(/O seu grupo mostra por defeito/)).not.toBeInTheDocument();
  });
});
