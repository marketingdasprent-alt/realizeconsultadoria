// Regras do ecrã Início do colaborador: alertas e próximos eventos.
import { addMonths, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

export interface HomeNotice {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

export interface HomeData {
  pendingRequests: number;
  nextAbsence: { start_date: string; end_date: string; absence_type: string } | null;
  balance: { total_days: number; used_days: number } | null;
  notices: HomeNotice[];
  unreadNotices: number;
  nextHoliday: { date: string; name: string } | null;
  /** Documentos aprovados pela empresa nos últimos 14 dias. */
  newDocuments: number;
  rejectedDocuments: number;
  pendingDocuments: number;
  openTickets: number;
}

export interface HomeAlert {
  id: string;
  tone: 'info' | 'warning';
  text: string;
  to: string;
}

export interface SafetyCheckupStatus {
  nextDate: Date;
  daysLeft: number;
  state: 'ok' | 'soon' | 'overdue';
}

export const SAFETY_CHECKUP_WARNING_DAYS = 60;

/** Próximo exame de medicina do trabalho a partir do último exame e da periodicidade. */
export const getSafetyCheckupStatus = (
  lastCheckup: string | null,
  renewalMonths: number | null,
  today: Date = new Date()
): SafetyCheckupStatus | null => {
  if (!lastCheckup || !renewalMonths) return null;
  const nextDate = addMonths(parseISO(lastCheckup), renewalMonths);
  const daysLeft = differenceInCalendarDays(nextDate, today);
  const state = daysLeft < 0 ? 'overdue' : daysLeft <= SAFETY_CHECKUP_WARNING_DAYS ? 'soon' : 'ok';
  return { nextDate, daysLeft, state };
};

interface AlertInputs {
  data: HomeData;
  /** Dias (excluindo hoje) com entrada sem saída ou saída sem entrada. */
  incompleteDays: number;
  safety: SafetyCheckupStatus | null;
  routes: { requests: string; timeclock: string; documents: string; notices: string; more: string };
  today?: Date;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * Alertas do Início, do mais urgente para o menos. Só o que exige atenção;
 * o resto vive nas secções normais.
 */
export const buildHomeAlerts = ({
  data,
  incompleteDays,
  safety,
  routes,
  today = new Date(),
}: AlertInputs): HomeAlert[] => {
  const alerts: HomeAlert[] = [];

  if (safety?.state === 'overdue') {
    alerts.push({
      id: 'safety-overdue',
      tone: 'warning',
      text: 'Exame de medicina do trabalho em atraso. Fale com os RH.',
      to: routes.more,
    });
  } else if (safety?.state === 'soon') {
    alerts.push({
      id: 'safety-soon',
      tone: 'info',
      text: `Exame de medicina do trabalho em ${safety.daysLeft} dias (${format(safety.nextDate, 'dd/MM', { locale: pt })}).`,
      to: routes.more,
    });
  }

  if (incompleteDays > 0) {
    alerts.push({
      id: 'timeclock-incomplete',
      tone: 'warning',
      text: `${incompleteDays} ${plural(incompleteDays, 'dia', 'dias')} com registo de ponto incompleto. Peça correção aos RH.`,
      to: routes.timeclock,
    });
  }

  if (data.rejectedDocuments > 0) {
    alerts.push({
      id: 'documents-rejected',
      tone: 'warning',
      text: `${data.rejectedDocuments} ${plural(data.rejectedDocuments, 'documento rejeitado', 'documentos rejeitados')}. Veja o motivo e envie de novo.`,
      to: routes.documents,
    });
  }

  if (data.unreadNotices > 0) {
    alerts.push({
      id: 'notices-unread',
      tone: 'info',
      text: `${data.unreadNotices} ${plural(data.unreadNotices, 'aviso novo', 'avisos novos')}.`,
      to: routes.notices,
    });
  }

  if (data.pendingRequests > 0) {
    alerts.push({
      id: 'requests-pending',
      tone: 'info',
      text: `${data.pendingRequests} ${plural(data.pendingRequests, 'pedido', 'pedidos')} de ausência à espera de aprovação.`,
      to: routes.requests,
    });
  }

  if (data.nextAbsence) {
    const days = differenceInCalendarDays(parseISO(data.nextAbsence.start_date), today);
    if (days >= 0 && days <= 2) {
      alerts.push({
        id: 'absence-soon',
        tone: 'info',
        text:
          days === 0
            ? 'Tem uma ausência aprovada para hoje.'
            : days === 1
              ? 'Tem uma ausência aprovada amanhã.'
              : 'Tem uma ausência aprovada daqui a 2 dias.',
        to: routes.requests,
      });
    }
  }

  if (data.newDocuments > 0) {
    alerts.push({
      id: 'documents-new',
      tone: 'info',
      text: `${data.newDocuments} ${plural(data.newDocuments, 'documento novo', 'documentos novos')} disponibilizado${data.newDocuments === 1 ? '' : 's'} pela empresa.`,
      to: routes.documents,
    });
  }

  if (data.pendingDocuments > 0) {
    alerts.push({
      id: 'documents-pending',
      tone: 'info',
      text: `${data.pendingDocuments} ${plural(data.pendingDocuments, 'documento enviado aguarda', 'documentos enviados aguardam')} aprovação.`,
      to: routes.documents,
    });
  }

  return alerts;
};

/** "seg, 5 out" para listas compactas. */
export const formatShortDate = (iso: string): string =>
  format(parseISO(iso), 'EEE, d MMM', { locale: pt });
