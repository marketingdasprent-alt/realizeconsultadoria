import { beforeEach, describe, expect, it, vi } from 'vitest';
import { employeeService } from '../employeeService';

const single = vi.fn();
const eq = vi.fn(() => ({ select: () => ({ single }) }));
const update = vi.fn((_values: Record<string, unknown>) => ({ eq }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({ update })),
  },
}));

describe('employeeService.update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    single.mockResolvedValue({ data: { id: 'e1' }, error: null });
  });

  it('nunca envia company_id: a empresa só muda com rz_transfer_employee', async () => {
    await employeeService.update('e1', { name: 'Ana', company_id: 'outra-empresa' });
    const sent = update.mock.calls[0][0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty('company_id');
    expect(sent.name).toBe('Ana');
    expect(eq).toHaveBeenCalledWith('id', 'e1');
  });

  it('continua a gravar os outros campos', async () => {
    const result = await employeeService.update('e1', { is_active: false });
    const sent = update.mock.calls[0][0] as Record<string, unknown>;
    expect(sent.is_active).toBe(false);
    expect(sent.updated_at).toBeTruthy();
    expect(result.error).toBeNull();
  });
});
