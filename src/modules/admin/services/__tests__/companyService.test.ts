import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
const rpc = vi.fn();
const from = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    rpc: (...args: unknown[]) => rpc(...args),
    from: (...args: unknown[]) => from(...args),
  },
}));

import { companyService } from '../companyService';

const INPUT = {
  name: ' Externa Lda ',
  nif: '123456789',
  email: 'geral@externa.pt',
  is_active: true,
  admin_name: ' Ana ',
  admin_email: ' ana@externa.pt ',
  admin_password: 'segredo123',
  group_id: '',
  group_name: ' Grupo X ',
};

beforeEach(() => vi.clearAllMocks());

describe('companyService — criar e apagar só pelas funções do super admin', () => {
  it('createWithAdmin chama a função de servidor com a empresa nova, sem inserir direto', async () => {
    invoke.mockResolvedValue({ data: { company_id: 'c9' }, error: null });
    const result = await companyService.createWithAdmin(INPUT);
    expect(invoke).toHaveBeenCalledWith('invite-admin', {
      body: {
        email: 'ana@externa.pt',
        name: 'Ana',
        password: 'segredo123',
        new_company: {
          name: 'Externa Lda',
          nif: '123456789',
          email: 'geral@externa.pt',
          group_id: null,
          group_name: 'Grupo X',
        },
      },
    });
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ data: { id: 'c9' }, error: null });
  });

  it('createWithAdmin devolve o erro da função (ex.: NIF repetido)', async () => {
    invoke.mockResolvedValue({
      data: { error: 'Já existe uma empresa com este NIF.' },
      error: null,
    });
    const result = await companyService.createWithAdmin(INPUT);
    expect(result.data).toBeNull();
    expect((result.error as Error).message).toBe('Já existe uma empresa com este NIF.');
  });

  it('delete usa rz_delete_company e não apaga direto na tabela', async () => {
    rpc.mockResolvedValue({ data: { deleted: true }, error: null });
    const result = await companyService.delete('c1');
    expect(rpc).toHaveBeenCalledWith('rz_delete_company', { p_company: 'c1' });
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, error: null });
  });

  it('delete devolve a mensagem quando a empresa ainda tem colaboradores', async () => {
    const error = { message: 'invalid_argument', details: 'A empresa ainda tem colaboradores.' };
    rpc.mockResolvedValue({ data: null, error });
    const result = await companyService.delete('c1');
    expect(result.success).toBe(false);
    expect((result.error as Error).message).toBe('A empresa ainda tem colaboradores.');
  });
});
