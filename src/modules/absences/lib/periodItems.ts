// Férias e ausências vistas por período: o pedido é só o canal para os RH, o que interessa
// é "quando estou fora" e o que se pode mudar em cada data.
import { format } from 'date-fns';
import type { AbsenceRow } from './absenceRules';

export type PeriodGroup = 'attention' | 'upcoming' | 'history';
export type PeriodStatus = 'pending' | 'approved' | 'rejected';

export interface PeriodItem {
  /** Id do período (ou "a:<pedido>" em pedidos antigos sem períodos). */
  id: string;
  absenceId: string;
  absenceType: string;
  trainingMode: string | null;
  start: string;
  end: string;
  businessDays: number;
  periodType: 'full_day' | 'partial';
  startTime: string | null;
  endTime: string | null;
  status: PeriodStatus;
  note: string | null;
  rejectionReason: string | null;
  requestedAt: string | null;
  /** Períodos que vieram no mesmo pedido (incluindo este). */
  siblings: number;
  documentCount: number;
  group: PeriodGroup;
  inProgress: boolean;
  canEdit: boolean;
  canCancel: boolean;
}

const asStatus = (period: string | undefined, absence: string): PeriodStatus => {
  const value = period ?? absence;
  return value === 'approved' || value === 'rejected' ? value : 'pending';
};

/**
 * Um item por período. Editar: férias (aprovadas ou pendentes) que ainda não começaram.
 * Cancelar: só em pedidos pendentes ou rejeitados (as aprovadas só se remarcam).
 */
export const buildPeriodItems = (absences: AbsenceRow[], now: Date = new Date()): PeriodItem[] => {
  const today = format(now, 'yyyy-MM-dd');
  const items: PeriodItem[] = [];
  for (const absence of absences) {
    const periods = absence.absence_periods?.length
      ? absence.absence_periods
      : [
          {
            id: `a:${absence.id}`,
            start_date: absence.start_date,
            end_date: absence.end_date,
            business_days: 0,
            status: absence.status,
            period_type: 'full_day',
            start_time: null,
            end_time: null,
          },
        ];
    for (const period of periods) {
      const status = asStatus(period.status, absence.status);
      const real = !period.id.startsWith('a:');
      const isVacation = absence.absence_type === 'vacation';
      const upcomingOrNow = period.end_date >= today;
      items.push({
        id: period.id,
        absenceId: absence.id,
        absenceType: absence.absence_type,
        trainingMode: absence.training_mode ?? null,
        start: period.start_date,
        end: period.end_date,
        businessDays: Number(period.business_days),
        periodType: period.period_type === 'partial' ? 'partial' : 'full_day',
        startTime: period.start_time?.slice(0, 5) ?? null,
        endTime: period.end_time?.slice(0, 5) ?? null,
        status,
        note: absence.notes,
        rejectionReason: status === 'rejected' ? (absence.rejection_reason ?? null) : null,
        requestedAt: absence.created_at ?? null,
        siblings: periods.length,
        documentCount: Number(absence.document_count ?? 0),
        group:
          status === 'rejected' && upcomingOrNow
            ? 'attention'
            : upcomingOrNow
              ? 'upcoming'
              : 'history',
        inProgress: period.start_date <= today && period.end_date >= today,
        canEdit:
          real &&
          isVacation &&
          (status === 'approved' || status === 'pending') &&
          ['approved', 'pending', 'partially_approved'].includes(absence.status) &&
          period.start_date > today,
        canCancel:
          real &&
          (absence.status === 'pending' || absence.status === 'rejected') &&
          status !== 'approved',
      });
    }
  }
  return items;
};

const byStart = (a: PeriodItem, b: PeriodItem) => a.start.localeCompare(b.start);

export const groupPeriodItems = (items: PeriodItem[]): Record<PeriodGroup, PeriodItem[]> => ({
  attention: items.filter(i => i.group === 'attention').sort(byStart),
  upcoming: items.filter(i => i.group === 'upcoming').sort(byStart),
  history: items.filter(i => i.group === 'history').sort((a, b) => byStart(b, a)),
});

/** Posição (0–100) de uma data na faixa do ano; null se for de outro ano. */
export const yearPosition = (iso: string, year: number): number | null => {
  const date = new Date(`${iso}T00:00:00`);
  if (date.getFullYear() !== year) return null;
  const startOfYear = new Date(year, 0, 1).getTime();
  const days = (new Date(year + 1, 0, 1).getTime() - startOfYear) / 86_400_000;
  return ((date.getTime() - startOfYear) / 86_400_000 / days) * 100;
};

/** Segmentos da faixa do ano (um por período, cortados ao ano). */
export const yearSegments = (items: PeriodItem[], year: number) =>
  items.flatMap(item => {
    const from = yearPosition(item.start < `${year}-01-01` ? `${year}-01-01` : item.start, year);
    const toRaw = item.end > `${year}-12-31` ? `${year}-12-31` : item.end;
    const to = yearPosition(toRaw, year);
    if (from === null || to === null || item.end < `${year}-01-01`) return [];
    const length = 100 / (new Date(year, 1, 29).getDate() === 29 ? 366 : 365);
    return [
      {
        id: item.id,
        status: item.status,
        left: from,
        width: Math.min(Math.max(to - from + length, 0.9), 100 - from),
      },
    ];
  });
