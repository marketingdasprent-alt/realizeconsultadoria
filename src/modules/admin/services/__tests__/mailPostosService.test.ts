import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mailPostosService } from '../mailPostosService';

const { rpc, invoke } = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, functions: { invoke } },
}));

describe('mailPostosService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lista os postos pela função do admin', async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: 'p1' }], error: null });
    const result = await mailPostosService.list();
    expect(rpc).toHaveBeenCalledWith('admin_mail_postos');
    expect(result.data).toEqual([{ id: 'p1' }]);
  });

  it('sem postos devolve lista vazia', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect((await mailPostosService.list()).data).toEqual([]);
  });

  it('cria o posto com o nome e as caixas', async () => {
    invoke.mockResolvedValueOnce({
      data: { ok: true, data: { id: 'p1', problems: [] } },
      error: null,
    });
    const result = await mailPostosService.create('Receção', ['a1', 'a2']);
    expect(invoke).toHaveBeenCalledWith('mail-posto', {
      body: { action: 'create', name: 'Receção', access_ids: ['a1', 'a2'] },
    });
    expect(result).toEqual({ data: { id: 'p1', problems: [] }, error: null });
  });

  it('devolve a mensagem do servidor quando recusa', async () => {
    invoke.mockResolvedValueOnce({
      data: { ok: false, message: 'Escolha pelo menos uma caixa para o posto.' },
      error: null,
    });
    const result = await mailPostosService.create('Receção', []);
    expect(result.data).toBeNull();
    expect(result.error).toBe('Escolha pelo menos uma caixa para o posto.');
  });

  it('sem ligação ao servidor dá uma mensagem clara, sem rebentar', async () => {
    invoke.mockRejectedValueOnce(new Error('rede'));
    const result = await mailPostosService.invite('p1');
    expect(result.data).toBeNull();
    expect(result.error).toBe('Não foi possível. Tente outra vez.');
  });

  it('pede o link, muda e apaga com o id do posto', async () => {
    invoke.mockResolvedValue({ data: { ok: true, data: {} }, error: null });
    await mailPostosService.invite('p1');
    await mailPostosService.update('p1', 'Novo', ['a1']);
    await mailPostosService.remove('p1');
    expect(invoke.mock.calls.map(call => call[1].body)).toEqual([
      { action: 'invite', posto_id: 'p1' },
      { action: 'update', posto_id: 'p1', name: 'Novo', access_ids: ['a1'] },
      { action: 'delete', posto_id: 'p1' },
    ]);
  });
});
