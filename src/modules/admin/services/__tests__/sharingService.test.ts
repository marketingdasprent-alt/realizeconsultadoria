import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharingError } from '../../lib/sharing';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn(), auth: { signInWithPassword: vi.fn() } },
}));

import { supabase } from '@/integrations/supabase/client';
import { sharingService } from '../sharingService';

const rpc = vi.mocked(supabase.rpc) as unknown as ReturnType<typeof vi.fn>;

describe('sharingService: gestão de grupos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createGroup chama rz_create_group com nome, empresas e módulos', async () => {
    rpc.mockResolvedValue({ data: { group_id: 'g1' }, error: null });
    const result = await sharingService.createGroup('Grupo X', ['a', 'b'], ['directory.read']);
    expect(rpc).toHaveBeenCalledWith('rz_create_group', {
      p_name: 'Grupo X',
      p_companies: ['a', 'b'],
      p_capabilities: ['directory.read'],
    });
    expect(result).toEqual({ group_id: 'g1' });
  });

  it('renameGroup chama rz_rename_group', async () => {
    rpc.mockResolvedValue({ data: { group_id: 'g1', name: 'Novo' }, error: null });
    await sharingService.renameGroup('g1', 'Novo');
    expect(rpc).toHaveBeenCalledWith('rz_rename_group', { p_group: 'g1', p_name: 'Novo' });
  });

  it('setGroupMembers chama rz_set_group_members com o conjunto completo', async () => {
    rpc.mockResolvedValue({
      data: { group_id: 'g1', added: 1, removed: 0, revoked: 0 },
      error: null,
    });
    const result = await sharingService.setGroupMembers('g1', ['a', 'b', 'c']);
    expect(rpc).toHaveBeenCalledWith('rz_set_group_members', {
      p_group: 'g1',
      p_companies: ['a', 'b', 'c'],
    });
    expect(result.added).toBe(1);
  });

  it('setGroupCapabilities chama rz_set_group_capabilities', async () => {
    rpc.mockResolvedValue({ data: { group_id: 'g1', capabilities: ['feed.read'] }, error: null });
    await sharingService.setGroupCapabilities('g1', ['feed.read']);
    expect(rpc).toHaveBeenCalledWith('rz_set_group_capabilities', {
      p_group: 'g1',
      p_capabilities: ['feed.read'],
    });
  });

  it('dissolveGroup chama rz_dissolve_group e devolve quantas partilhas foram revogadas', async () => {
    rpc.mockResolvedValue({ data: { group_id: 'g1', revoked: 3 }, error: null });
    const result = await sharingService.dissolveGroup('g1');
    expect(rpc).toHaveBeenCalledWith('rz_dissolve_group', { p_group: 'g1' });
    expect(result.revoked).toBe(3);
  });

  it('um erro da base vira SharingError com o código e o texto em português', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'invalid_argument',
        details: 'A empresa X já pertence a um grupo.',
        code: '22023',
      },
    });
    const error = await sharingService.createGroup('G', ['a', 'b'], []).catch(e => e);
    expect(error).toBeInstanceOf(SharingError);
    expect(error.code).toBe('invalid_argument');
    expect(error.detail).toBe('A empresa X já pertence a um grupo.');
  });

  it('a falta de login recente chega como reauth_required', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'reauth_required',
        details: 'Confirme a sua palavra-passe.',
        code: 'RZ401',
      },
    });
    const error = await sharingService.dissolveGroup('g1').catch(e => e);
    expect(error.code).toBe('reauth_required');
  });

  it('listAllGroups e listGroup trazem módulos vazios quando a base ainda não os devolve', async () => {
    rpc.mockResolvedValueOnce({ data: [{ group_id: 'g1', company_id: 'a' }], error: null });
    const all = await sharingService.listAllGroups();
    expect(all[0].default_capabilities).toEqual([]);
    rpc.mockResolvedValueOnce({
      data: [{ group_id: 'g1', company_id: 'a', default_capabilities: ['feed.read'] }],
      error: null,
    });
    const mine = await sharingService.listGroup('a');
    expect(mine[0].default_capabilities).toEqual(['feed.read']);
  });
});
