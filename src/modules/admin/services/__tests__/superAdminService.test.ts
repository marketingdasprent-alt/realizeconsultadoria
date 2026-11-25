import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharingError } from '../../lib/sharing';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from '@/integrations/supabase/client';
import { superAdminService } from '../superAdminService';

const rpc = vi.mocked(supabase.rpc) as unknown as ReturnType<typeof vi.fn>;

const ADMIN = {
  user_id: 'u1',
  name: 'Ana Silva',
  email: 'ana@realize.pt',
  since: '2025-01-10T09:00:00Z',
  mfa_enabled: true,
  added_by_name: null,
  is_self: true,
};

const CANDIDATE = {
  user_id: 'u2',
  name: 'Rui Costa',
  email: 'rui@acme.pt',
  companies: 'Acme Lda, Beta Lda',
  mfa_enabled: false,
};

/** Apanha a rejeição para poder inspecionar o erro. */
const failure = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Era esperado um erro');
};

describe('superAdminService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('list', () => {
    it('chama rz_list_super_admins sem argumentos e devolve a lista', async () => {
      rpc.mockResolvedValue({ data: [ADMIN], error: null });
      const result = await superAdminService.list();
      expect(rpc).toHaveBeenCalledWith('rz_list_super_admins', {});
      expect(result).toEqual([ADMIN]);
    });

    it('uma resposta null vira lista vazia', async () => {
      rpc.mockResolvedValue({ data: null, error: null });
      expect(await superAdminService.list()).toEqual([]);
    });

    it('o erro not_platform_admin da base vira SharingError com o mesmo código', async () => {
      rpc.mockResolvedValue({ data: null, error: { message: 'not_platform_admin' } });
      const error = await failure(superAdminService.list());
      expect(error).toBeInstanceOf(SharingError);
      expect(error).toMatchObject({ code: 'not_platform_admin' });
    });

    it('função inexistente (migração por aplicar) vira "unavailable"', async () => {
      rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'x' } });
      expect(await failure(superAdminService.list())).toMatchObject({ code: 'unavailable' });
    });
  });

  describe('candidates', () => {
    it('chama rz_super_admin_candidates sem argumentos e devolve os candidatos', async () => {
      rpc.mockResolvedValue({ data: [CANDIDATE], error: null });
      const result = await superAdminService.candidates();
      expect(rpc).toHaveBeenCalledWith('rz_super_admin_candidates', {});
      expect(result).toEqual([CANDIDATE]);
    });

    it('uma resposta null vira lista vazia', async () => {
      rpc.mockResolvedValue({ data: null, error: null });
      expect(await superAdminService.candidates()).toEqual([]);
    });

    it('os erros viram SharingError', async () => {
      rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });
      expect(await failure(superAdminService.candidates())).toBeInstanceOf(SharingError);
    });
  });

  describe('add', () => {
    it('chama rz_add_super_admin com p_user', async () => {
      rpc.mockResolvedValue({ data: null, error: null });
      await expect(superAdminService.add('u2')).resolves.toBeUndefined();
      expect(rpc).toHaveBeenCalledWith('rz_add_super_admin', { p_user: 'u2' });
    });

    it('o código RZ402 vira mfa_required (o ecrã pede o código do autenticador)', async () => {
      rpc.mockResolvedValue({ data: null, error: { code: 'RZ402', message: 'x' } });
      expect(await failure(superAdminService.add('u2'))).toMatchObject({ code: 'mfa_required' });
    });

    it('o código RZ401 vira reauth_required', async () => {
      rpc.mockResolvedValue({ data: null, error: { code: 'RZ401', message: 'x' } });
      expect(await failure(superAdminService.add('u2'))).toMatchObject({
        code: 'reauth_required',
      });
    });

    it('already_super_admin passa como SharingError com esse código', async () => {
      rpc.mockResolvedValue({ data: null, error: { message: 'already_super_admin' } });
      expect(await failure(superAdminService.add('u2'))).toMatchObject({
        code: 'already_super_admin',
      });
    });
  });

  describe('remove', () => {
    it('chama rz_remove_super_admin com p_user', async () => {
      rpc.mockResolvedValue({ data: null, error: null });
      await expect(superAdminService.remove('u1')).resolves.toBeUndefined();
      expect(rpc).toHaveBeenCalledWith('rz_remove_super_admin', { p_user: 'u1' });
    });

    it('last_super_admin passa como SharingError com esse código', async () => {
      rpc.mockResolvedValue({ data: null, error: { message: 'last_super_admin' } });
      expect(await failure(superAdminService.remove('u1'))).toMatchObject({
        code: 'last_super_admin',
      });
    });

    it('uma mensagem que não é um código estável vira "unknown", mantendo o detalhe', async () => {
      rpc.mockResolvedValue({
        data: null,
        error: { message: 'Erro Interno: algo!', details: 'detalhe do servidor' },
      });
      const error = await failure(superAdminService.remove('u1'));
      expect(error).toMatchObject({ code: 'unknown', detail: 'detalhe do servidor' });
    });
  });
});
