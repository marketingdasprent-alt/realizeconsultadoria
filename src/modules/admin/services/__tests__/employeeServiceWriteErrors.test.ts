import { beforeEach, describe, expect, it, vi } from 'vitest';
import { employeeService } from '../employeeService';
import { ONE_COMPANY_INDEX, ONE_COMPANY_MESSAGE } from '../../lib/employeeWriteError';

const single = vi.fn();
const select = vi.fn(() => ({ single }));
const eq = vi.fn(() => ({ select }));
const update = vi.fn(() => ({ eq }));
const insert = vi.fn(() => ({ select }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({ update, insert })),
  },
}));

const oneCompanyError = {
  code: '23505',
  message: `duplicate key value violates unique constraint "${ONE_COMPANY_INDEX}"`,
  details: null,
};

describe('employeeService: regra "uma só empresa" (23505)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reativar uma ficha (toggleActive) dá a frase em português, sem código', async () => {
    single.mockResolvedValue({ data: null, error: oneCompanyError });
    const result = await employeeService.toggleActive('e1', true);
    expect(result.data).toBeNull();
    expect((result.error as Error).message).toBe(ONE_COMPANY_MESSAGE);
  });

  it('criar uma ficha (create) dá a frase em português, sem código', async () => {
    single.mockResolvedValue({ data: null, error: oneCompanyError });
    const result = await employeeService.create({
      name: 'Ana',
      email: 'ana@exemplo.invalid',
      company_id: 'c1',
    });
    expect((result.error as Error).message).toBe(ONE_COMPANY_MESSAGE);
  });

  it('guardar a ficha (update, também usado ao ativar na ficha) dá a mesma frase', async () => {
    single.mockResolvedValue({ data: null, error: oneCompanyError });
    const result = await employeeService.update('e1', { is_active: true });
    expect((result.error as Error).message).toBe(ONE_COMPANY_MESSAGE);
  });

  it('outro erro da base passa como estava', async () => {
    const other = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "employees_email_company_id_key"',
      details: null,
    };
    single.mockResolvedValue({ data: null, error: other });
    const result = await employeeService.toggleActive('e1', true);
    expect(result.error).toBe(other);
  });

  it('sem erro devolve os dados', async () => {
    single.mockResolvedValue({ data: { id: 'e1' }, error: null });
    const result = await employeeService.toggleActive('e1', false);
    expect(result).toEqual({ data: { id: 'e1' }, error: null });
  });
});
