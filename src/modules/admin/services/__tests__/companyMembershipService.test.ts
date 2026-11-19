import { beforeEach, describe, expect, it, vi } from 'vitest';
import { companyMembershipService } from '../companyMembershipService';
import { SharingError } from '../../lib/sharing';
import { membershipErrorText } from '../../lib/companyMembership';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';

const rpc = vi.mocked(supabase.rpc) as unknown as ReturnType<typeof vi.fn>;

const effects = {
  tasks_open_assigned: 1,
  tasks_open_participant: 0,
  events_future_attending: 0,
  events_future_owned: 0,
  folders_assigned: 2,
  chat_conversations_origin: 0,
};

const transfer = {
  employee_id: 'e1',
  from_company: 'a',
  to_company: 'b',
  note: null,
  pending_effects: effects,
};

/** Como o PostgREST devolve um RAISE EXCEPTION 'codigo' USING DETAIL = 'texto'. */
const dbError = (code: string, detail: string | null, sqlstate = 'P0001') => ({
  data: null,
  error: { message: code, details: detail, code: sqlstate },
});

describe('companyMembershipService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transferEmployee', () => {
    it('chama rz_transfer_employee com os argumentos do contrato e valida o resultado', async () => {
      rpc.mockResolvedValue({ data: transfer, error: null });
      const result = await companyMembershipService.transferEmployee('e1', 'b', 'nota');
      expect(rpc).toHaveBeenCalledWith('rz_transfer_employee', {
        p_employee: 'e1',
        p_to_company: 'b',
        p_note: 'nota',
      });
      expect(result.pending_effects.folders_assigned).toBe(2);
    });

    it('sem nota envia null', async () => {
      rpc.mockResolvedValue({ data: transfer, error: null });
      await companyMembershipService.transferEmployee('e1', 'b');
      expect(rpc).toHaveBeenCalledWith('rz_transfer_employee', {
        p_employee: 'e1',
        p_to_company: 'b',
        p_note: null,
      });
    });

    it('o texto em português da base (details) chega a quem mostra o erro', async () => {
      rpc.mockResolvedValue(
        dbError(
          'invalid_argument',
          'Já existe um colaborador com este email na empresa de destino.',
          '22023'
        )
      );
      const error = await companyMembershipService.transferEmployee('e1', 'b').catch(e => e);
      expect(error).toBeInstanceOf(SharingError);
      expect(error.code).toBe('invalid_argument');
      expect(membershipErrorText(error)).toBe(
        'Já existe um colaborador com este email na empresa de destino.'
      );
    });

    it.each([
      ['not_found', 'Colaborador não encontrado.', '02000'],
      ['not_company_admin', 'Só o administrador da empresa pode fazer isto.', '42501'],
      ['last_admin', 'Uma empresa tem de ter pelo menos um administrador ativo.', '55000'],
    ])('mapeia o código %s sem o mostrar', async (code, detail, sqlstate) => {
      rpc.mockResolvedValue(dbError(code, detail, sqlstate));
      const error = await companyMembershipService.transferEmployee('e1', 'b').catch(e => e);
      expect(error.code).toBe(code);
      expect(membershipErrorText(error)).toBe(detail);
    });

    it('reauth_required (RZ401) dá um erro de nova autenticação', async () => {
      rpc.mockResolvedValue(dbError('reauth_required', null, 'RZ401'));
      const error = await companyMembershipService.transferEmployee('e1', 'b').catch(e => e);
      expect(error.code).toBe('reauth_required');
      expect(membershipErrorText(error)).toBe('Confirme a sua palavra-passe para continuar.');
    });

    it('função inexistente (PGRST202) diz que ainda não está ativa', async () => {
      rpc.mockResolvedValue(dbError('Could not find the function', null, 'PGRST202'));
      const error = await companyMembershipService.transferEmployee('e1', 'b').catch(e => e);
      expect(error.code).toBe('unavailable');
    });

    it('uma resposta fora do contrato é um erro desconhecido (nunca dados a meio)', async () => {
      rpc.mockResolvedValue({ data: { employee_id: 'e1' }, error: null });
      const error = await companyMembershipService.transferEmployee('e1', 'b').catch(e => e);
      expect(error).toBeInstanceOf(SharingError);
      expect(error.code).toBe('unknown');
    });
  });

  describe('transferEmployees', () => {
    it('envia as fichas e devolve um item por ficha', async () => {
      rpc.mockResolvedValue({
        data: {
          total: 2,
          ok: 1,
          failed: 1,
          results: [
            { employee_id: 'e1', ok: true, result: transfer },
            { employee_id: 'e2', ok: false, error: 'invalid_argument', detail: 'Ficha inativa.' },
          ],
        },
        error: null,
      });
      const result = await companyMembershipService.transferEmployees(['e1', 'e2'], 'b');
      expect(rpc).toHaveBeenCalledWith('rz_transfer_employees', {
        p_employees: ['e1', 'e2'],
        p_to_company: 'b',
      });
      expect(result.ok).toBe(1);
      expect(result.results[1].detail).toBe('Ficha inativa.');
    });

    it('falha inteira (sem direito sobre o destino) vira erro com o texto da base', async () => {
      rpc.mockResolvedValue(
        dbError('not_company_admin', 'Só o administrador da empresa pode fazer isto.', '42501')
      );
      const error = await companyMembershipService.transferEmployees(['e1'], 'b').catch(e => e);
      expect(membershipErrorText(error)).toBe('Só o administrador da empresa pode fazer isto.');
    });
  });

  describe('administradores', () => {
    it('addAdmin envia o papel e valida o resultado', async () => {
      rpc.mockResolvedValue({
        data: { company_id: 'a', user_id: 'u1', role: 'gestor', previous_role: null },
        error: null,
      });
      const result = await companyMembershipService.addAdmin('a', 'u1', 'gestor');
      expect(rpc).toHaveBeenCalledWith('rz_add_company_admin', {
        p_company: 'a',
        p_user: 'u1',
        p_role: 'gestor',
      });
      expect(result.role).toBe('gestor');
    });

    it('removeAdmin do último administrador mostra a mensagem clara da base', async () => {
      rpc.mockResolvedValue(
        dbError(
          'last_admin',
          'Não pode retirar o último administrador da empresa. Adicione outro administrador primeiro.',
          '55000'
        )
      );
      const error = await companyMembershipService.removeAdmin('a', 'u1').catch(e => e);
      expect(error.code).toBe('last_admin');
      expect(membershipErrorText(error)).toContain('último administrador');
    });

    it('removeAdmin devolve o novo estado', async () => {
      rpc.mockResolvedValue({
        data: {
          company_id: 'a',
          user_id: 'u1',
          previous_role: 'admin',
          role: 'colaborador',
          status: 'ativo',
        },
        error: null,
      });
      const result = await companyMembershipService.removeAdmin('a', 'u1');
      expect(rpc).toHaveBeenCalledWith('rz_remove_company_admin', { p_company: 'a', p_user: 'u1' });
      expect(result.role).toBe('colaborador');
    });
  });

  describe('listas de colaboradores da empresa', () => {
    /** Cadeia do query builder do Supabase: cada passo devolve a cadeia; `await` dá o resultado. */
    const chain = (result: unknown) => {
      const calls: [string, unknown[]][] = [];
      const proxy: unknown = new Proxy(
        {},
        {
          get: (_target, name: string) => {
            if (name === 'then') return (resolve: (value: unknown) => void) => resolve(result);
            return (...args: unknown[]) => {
              calls.push([name, args]);
              return proxy;
            };
          },
        }
      );
      return { proxy, calls };
    };
    const from = vi.mocked(supabase.from) as unknown as ReturnType<typeof vi.fn>;

    it('companyEmployees lê só as fichas ativas da empresa, por nome', async () => {
      const row = { id: 'e1', name: 'Ana', email: 'a@x.pt', company_id: 'c1', user_id: null };
      const { proxy, calls } = chain({ data: [row], error: null });
      from.mockReturnValue(proxy);
      expect(await companyMembershipService.companyEmployees('c1')).toEqual([row]);
      expect(from).toHaveBeenCalledWith('employees');
      expect(calls).toContainEqual(['eq', ['company_id', 'c1']]);
      expect(calls).toContainEqual(['eq', ['is_active', true]]);
      expect(calls).toContainEqual(['order', ['name']]);
    });

    it('companyEmployees falha com erro desconhecido quando a leitura falha', async () => {
      from.mockReturnValue(chain({ data: null, error: { message: 'x' } }).proxy);
      await expect(companyMembershipService.companyEmployees('c1')).rejects.toBeInstanceOf(
        SharingError
      );
    });

    it('employeesOutsideCompany lê as fichas ativas das outras empresas e traz o nome da empresa', async () => {
      const row = {
        id: 'e2',
        name: 'Dina',
        email: 'd@x.pt',
        company_id: 'c2',
        user_id: 'u2',
        is_active: true,
        position: null,
        department: null,
        companies: { name: 'Beta Lda' },
      };
      const { proxy, calls } = chain({ data: [row], error: null });
      from.mockReturnValue(proxy);
      const result = await companyMembershipService.employeesOutsideCompany('c1');
      expect(calls).toContainEqual(['neq', ['company_id', 'c1']]);
      expect(calls).toContainEqual(['eq', ['is_active', true]]);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'e2', companyName: 'Beta Lda' });
      expect(result[0]).not.toHaveProperty('companies');
    });
  });
});
