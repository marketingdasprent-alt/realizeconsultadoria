import { beforeEach, describe, expect, it, vi } from 'vitest';
import { absenceService } from '../absenceService';

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc },
}));

describe('absenceService.rescheduleVacation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envia todos os períodos para a RPC numa única chamada', async () => {
    // Given: a RPC aceita a remarcação e devolve o novo estado
    rpc.mockResolvedValueOnce({ data: 'pending', error: null });

    // When: o serviço recebe as novas datas
    const result = await absenceService.rescheduleVacation({
      absenceId: 'absence-1',
      notes: 'Nova semana',
      periods: [
        {
          startDate: '2026-10-12',
          endDate: '2026-10-16',
          periodType: 'full_day',
          startTime: null,
          endTime: null,
        },
      ],
    });

    // Then: existe apenas uma operação de escrita, com o contrato esperado pela base de dados
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('reschedule_vacation', {
      p_absence_id: 'absence-1',
      p_notes: 'Nova semana',
      p_periods: [
        {
          start_date: '2026-10-12',
          end_date: '2026-10-16',
          period_type: 'full_day',
          start_time: null,
          end_time: null,
        },
      ],
    });
    expect(result).toEqual({ data: 'pending', error: null });
  });
});
