import { describe, it, expect, beforeEach, vi } from 'vitest';
import { employeeService } from '../employeeService';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      getSession: vi.fn(),
    },
  },
}));

import { supabase } from '@/integrations/supabase/client';

/**
 * Simula um FunctionsHttpError do Supabase (resposta non-2xx de edge function).
 * Se errorBody for fornecido, context.json() resolve com esse body.
 * Se não, context.json() rejeita (simula response body não-JSON ou vazio).
 */
function makeFunctionsHttpError(errorBody?: Record<string, unknown>) {
  return Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: {
      json: errorBody
        ? vi.fn().mockResolvedValue(errorBody)
        : vi.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input')),
    },
  });
}

describe('employeeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createWithPassword', () => {
    it('deve criar colaborador com sucesso e retornar dados', async () => {
      const mockEmployee = { id: 'emp-1', name: 'João Silva', email: 'joao@empresa.pt' };
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true, employee: mockEmployee, employeeId: 'emp-1', emailSent: true },
        error: null,
      });

      const result = await employeeService.createWithPassword({
        name: 'João Silva',
        email: 'joao@empresa.pt',
        password: 'senha1234',
        company_id: 'comp-1',
      });

      expect(result.error).toBeNull();
      expect(result.data?.success).toBe(true);
      expect(result.data?.employeeId).toBe('emp-1');
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'create-employee-with-password',
        expect.objectContaining({ body: expect.objectContaining({ email: 'joao@empresa.pt' }) })
      );
    });

    it('deve expor mensagem real quando email já existe em auth.users', async () => {
      const mensagemEsperada =
        'Este email já está em uso no sistema. Por favor utilize um email diferente para o colaborador.';
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: makeFunctionsHttpError({ error: mensagemEsperada }),
      });

      const result = await employeeService.createWithPassword({
        name: 'Maria Santos',
        email: 'duplicado@empresa.pt',
        password: 'senha1234',
        company_id: 'comp-1',
      });

      expect(result.data).toBeNull();
      expect((result.error as Error).message).toBe(mensagemEsperada);
    });

    it('deve expor mensagem real quando colaborador já existe com esse email', async () => {
      const mensagemEsperada = 'Já existe um colaborador com este email';
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: makeFunctionsHttpError({ error: mensagemEsperada }),
      });

      const result = await employeeService.createWithPassword({
        name: 'Carlos Oliveira',
        email: 'carlos@empresa.pt',
        password: 'senha1234',
        company_id: 'comp-1',
      });

      expect(result.data).toBeNull();
      expect((result.error as Error).message).toBe(mensagemEsperada);
    });

    it('deve expor mensagem real para senha demasiado curta', async () => {
      const mensagemEsperada = 'A senha deve ter pelo menos 8 caracteres';
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: makeFunctionsHttpError({ error: mensagemEsperada }),
      });

      const result = await employeeService.createWithPassword({
        name: 'Ana Costa',
        email: 'ana@empresa.pt',
        password: '123',
        company_id: 'comp-1',
      });

      expect((result.error as Error).message).toBe(mensagemEsperada);
    });

    it('deve usar mensagem genérica se o body da resposta não for JSON válido', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: makeFunctionsHttpError(), // context.json() rejeita
      });

      const result = await employeeService.createWithPassword({
        name: 'Teste',
        email: 'teste@empresa.pt',
        password: 'senha1234',
        company_id: 'comp-1',
      });

      expect(result.data).toBeNull();
      expect((result.error as Error).message).toBe('Edge Function returned a non-2xx status code');
    });

    it('deve retornar erro quando a invocação lança exceção de rede', async () => {
      vi.mocked(supabase.functions.invoke).mockRejectedValue(new Error('Network error'));

      const result = await employeeService.createWithPassword({
        name: 'Teste',
        email: 'teste@empresa.pt',
        password: 'senha1234',
        company_id: 'comp-1',
      });

      expect(result.data).toBeNull();
      expect((result.error as Error).message).toBe('Network error');
    });

    it('deve criar colaborador mesmo que o envio de email falhe (emailSent: false)', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          employeeId: 'emp-2',
          emailSent: false,
          emailError: 'Configuração de API de email ausente',
          message: 'Colaborador criado, mas houve uma falha no email',
        },
        error: null,
      });

      const result = await employeeService.createWithPassword({
        name: 'Rui Faria',
        email: 'rui@empresa.pt',
        password: 'senha1234',
        company_id: 'comp-1',
      });

      expect(result.error).toBeNull();
      expect(result.data?.success).toBe(true);
      expect(result.data?.emailSent).toBe(false);
    });
  });

  describe('updateEmail', () => {
    it('deve atualizar email com sucesso', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: true,
          message:
            'Email atualizado com sucesso. O colaborador receberá as novas credenciais por email.',
        },
        error: null,
      });

      const result = await employeeService.updateEmail('emp-1', 'novo@empresa.pt');

      expect(result.error).toBeNull();
      expect(result.data?.success).toBe(true);
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'update-employee-email',
        expect.objectContaining({
          body: { employee_id: 'emp-1', new_email: 'novo@empresa.pt' },
        })
      );
    });

    it('deve expor mensagem real quando email pertence a conta de administrador', async () => {
      const mensagemEsperada =
        'Este email pertence a uma conta de administrador. Por favor utilize um email diferente.';
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: makeFunctionsHttpError({ error: mensagemEsperada }),
      });

      const result = await employeeService.updateEmail('emp-1', 'admin@empresa.pt');

      expect(result.data).toBeNull();
      expect((result.error as Error).message).toBe(mensagemEsperada);
    });

    it('deve expor mensagem real quando email já é usado por outro colaborador', async () => {
      const mensagemEsperada = 'Este email já está a ser utilizado por outro colaborador';
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: makeFunctionsHttpError({ error: mensagemEsperada }),
      });

      const result = await employeeService.updateEmail('emp-1', 'outro@empresa.pt');

      expect(result.data).toBeNull();
      expect((result.error as Error).message).toBe(mensagemEsperada);
    });

    it('deve expor mensagem real quando colaborador não tem conta de utilizador', async () => {
      const mensagemEsperada = 'Colaborador não tem conta de utilizador associada';
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: makeFunctionsHttpError({ error: mensagemEsperada }),
      });

      const result = await employeeService.updateEmail('emp-sem-conta', 'email@empresa.pt');

      expect((result.error as Error).message).toBe(mensagemEsperada);
    });

    it('deve expor mensagem real quando colaborador não é encontrado', async () => {
      const mensagemEsperada = 'Colaborador não encontrado';
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: makeFunctionsHttpError({ error: mensagemEsperada }),
      });

      const result = await employeeService.updateEmail('id-inexistente', 'email@empresa.pt');

      expect((result.error as Error).message).toBe(mensagemEsperada);
    });

    it('deve usar mensagem genérica se o body da resposta não for JSON válido', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: makeFunctionsHttpError(), // context.json() rejeita
      });

      const result = await employeeService.updateEmail('emp-1', 'email@empresa.pt');

      expect(result.data).toBeNull();
      expect((result.error as Error).message).toBe('Edge Function returned a non-2xx status code');
    });

    it('deve retornar erro quando a invocação lança exceção de rede', async () => {
      vi.mocked(supabase.functions.invoke).mockRejectedValue(new Error('Network error'));

      const result = await employeeService.updateEmail('emp-1', 'email@empresa.pt');

      expect(result.data).toBeNull();
      expect((result.error as Error).message).toBe('Network error');
    });

    it('deve passar employee_id e new_email corretamente para a edge function', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await employeeService.updateEmail('uuid-colaborador-123', 'correto@empresa.pt');

      expect(supabase.functions.invoke).toHaveBeenCalledWith('update-employee-email', {
        body: {
          employee_id: 'uuid-colaborador-123',
          new_email: 'correto@empresa.pt',
        },
      });
    });
  });
});
