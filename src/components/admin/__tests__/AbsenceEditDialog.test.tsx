import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AbsenceEditDialog from '../AbsenceEditDialog';

const { rescheduleApprovedVacation } = vi.hoisted(() => ({
  rescheduleApprovedVacation: vi.fn().mockResolvedValue({ data: 'pending', error: null }),
}));

vi.mock('@/modules/admin/services/absenceService', () => ({
  absenceService: { rescheduleApprovedVacation },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
  },
}));

describe('AbsenceEditDialog', () => {
  it('permite alterar diretamente as datas de um período de férias aprovado', () => {
    // Given: um pedido de férias aprovado com um período de dia completo
    const request = {
      id: 'absence-1',
      status: 'approved',
      absence_type: 'vacation',
      notes: null,
      employee: {
        id: 'employee-1',
        name: 'Thiago',
        email: 'thiago@example.com',
      },
      company: {
        id: 'company-1',
        name: 'Realize',
      },
      periods: [
        {
          id: 'period-1',
          start_date: '2026-10-05',
          end_date: '2026-10-09',
          business_days: 5,
          period_type: 'full_day',
          status: 'approved',
        },
      ],
    };

    // When: o responsável abre o editor
    render(<AbsenceEditDialog open onOpenChange={vi.fn()} request={request} onSuccess={vi.fn()} />);

    // Then: encontra uma ação explícita para remarcar o período existente
    expect(
      screen.getByRole('button', { name: 'Remarcar período de 05/10/2026 a 09/10/2026' })
    ).toBeInTheDocument();
  });

  it('não grava a remarcação sem uma mudança efetiva de datas', () => {
    // Given: um colaborador abriu as próprias férias aprovadas sem alterar o período
    const request = {
      id: 'absence-1',
      status: 'approved',
      absence_type: 'vacation',
      notes: 'Férias',
      employee: { id: 'employee-1', name: 'Thiago', email: 'thiago@example.com' },
      company: { id: 'company-1', name: 'Realize' },
      periods: [
        {
          id: 'period-1',
          start_date: '2026-10-05',
          end_date: '2026-10-09',
          business_days: 5,
          period_type: 'full_day',
          status: 'approved',
        },
      ],
    };

    render(
      <AbsenceEditDialog
        open
        actor="employee"
        onOpenChange={vi.fn()}
        request={request}
        onSuccess={vi.fn()}
      />
    );

    // When: tenta guardar sem escolher uma semana diferente
    const saveButton = screen.getByRole('button', { name: 'Guardar Alterações' });
    fireEvent.click(saveButton);

    // Then: a interface bloqueia a falsa remarcação antes de chamar a RPC
    expect(saveButton).toBeDisabled();
    expect(rescheduleApprovedVacation).not.toHaveBeenCalled();
  });
});
