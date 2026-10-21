// Comunicados → Enviados: quem confirmou a leitura na app e quem falta.
import type { BroadcastEmployee } from './broadcast';

export interface SentNotice {
  id: string;
  company_id: string | null;
  employee_id: string | null;
}

export interface NoticeRead {
  notification_id: string;
  employee_id: string;
  read_at: string;
}

export interface Confirmations {
  confirmed: { employee: BroadcastEmployee; readAt: string }[];
  pending: BroadcastEmployee[];
  /** Avisos de cada pessoa (para lembrar só quem falta). */
  noticeOf: Map<string, string>;
}

/**
 * A quem chegou cada aviso (todos, uma empresa ou uma pessoa) e se já confirmou. Quem está em
 * vários avisos conta uma vez, com a primeira confirmação.
 */
export const confirmationsOf = (
  notices: SentNotice[],
  reads: NoticeRead[],
  employees: BroadcastEmployee[]
): Confirmations => {
  const active = employees.filter(e => e.is_active);
  const noticeOf = new Map<string, string>();
  for (const notice of notices) {
    const reached = notice.employee_id
      ? active.filter(e => e.id === notice.employee_id)
      : notice.company_id
        ? active.filter(e => e.company_id === notice.company_id)
        : active;
    for (const employee of reached)
      if (!noticeOf.has(employee.id)) noticeOf.set(employee.id, notice.id);
  }

  const readAt = new Map<string, string>();
  const ids = new Set(notices.map(n => n.id));
  for (const read of reads) {
    if (!ids.has(read.notification_id)) continue;
    const current = readAt.get(read.employee_id);
    if (!current || read.read_at < current) readAt.set(read.employee_id, read.read_at);
  }

  const people = active.filter(e => noticeOf.has(e.id));
  return {
    confirmed: people
      .filter(e => readAt.has(e.id))
      .map(employee => ({ employee, readAt: readAt.get(employee.id)! }))
      .sort((a, b) => a.readAt.localeCompare(b.readAt)),
    pending: people
      .filter(e => !readAt.has(e.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    noticeOf,
  };
};
