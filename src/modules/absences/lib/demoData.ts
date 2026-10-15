// Pedidos de exemplo para a pré-visualização (/dev/realize-2/pedidos).
import { addDays, format } from 'date-fns';
import type { AbsencesData } from '../services/absenceRequestService';

const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd');

export const DEMO_ABSENCES: AbsencesData = {
  balance: { total_days: 22, used_days: 6, self_schedulable_days: 11 },
  scheduledByEmployee: 9,
  pendingVacationDays: 3,
  holidays: [],
  absences: [
    {
      id: 'demo-1',
      start_date: day(20),
      end_date: day(22),
      absence_type: 'vacation',
      status: 'pending',
      notes: 'Viagem em família',
      absence_periods: [
        {
          id: 'p1',
          start_date: day(20),
          end_date: day(22),
          business_days: 3,
          status: 'pending',
          period_type: 'full_day',
        },
      ],
      document_count: 0,
    },
    {
      id: 'demo-2',
      start_date: day(45),
      end_date: day(52),
      absence_type: 'vacation',
      status: 'approved',
      notes: null,
      absence_periods: [
        {
          id: 'p2',
          start_date: day(45),
          end_date: day(52),
          business_days: 6,
          status: 'approved',
          period_type: 'full_day',
        },
      ],
      document_count: 0,
    },
    {
      id: 'demo-3',
      start_date: day(-12),
      end_date: day(-12),
      absence_type: 'appointment',
      status: 'approved',
      notes: 'Consulta de rotina',
      absence_periods: [
        {
          id: 'p3',
          start_date: day(-12),
          end_date: day(-12),
          business_days: 0.5,
          status: 'approved',
          period_type: 'partial',
          start_time: '09:00',
          end_time: '13:00',
        },
      ],
      document_count: 1,
    },
    {
      id: 'demo-4',
      start_date: day(-40),
      end_date: day(-38),
      absence_type: 'vacation',
      status: 'rejected',
      notes: null,
      rejection_reason: 'Período de fecho de contas — escolha outra semana, por favor.',
      absence_periods: [
        {
          id: 'p4',
          start_date: day(-40),
          end_date: day(-38),
          business_days: 3,
          status: 'rejected',
          period_type: 'full_day',
        },
      ],
      document_count: 0,
    },
  ],
};
