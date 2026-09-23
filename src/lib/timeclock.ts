// Tipos, etiquetas e cálculos da folha de ponto (partilhado admin/colaborador).
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Tables = Database['public']['Tables'];

export type TimeClockEntry = Tables['time_clock_entries']['Row'];
export type TimeClockLocation = Tables['time_clock_locations']['Row'];
export type TimeClockLocationInsert = Tables['time_clock_locations']['Insert'];
export type TimeClockTag = Omit<Tables['time_clock_tags']['Row'], 'token_hash' | 'last_counter'>;
export type TimeClockHistory = Tables['time_clock_entry_history']['Row'];
export type TimeClockAttempt = Tables['time_clock_attempts']['Row'];

export type EntryType = 'in' | 'out';
export type PunchMethod = 'nfc' | 'gps';

/** Registo com os nomes das relações usadas nas listagens. */
export type TimeClockEntryWithRelations = TimeClockEntry & {
  employee?: { id: string; name: string; company_id: string } | null;
  location?: { name: string } | null;
};

export const ENTRY_TYPE_LABELS: Record<string, string> = { in: 'Entrada', out: 'Saída' };

export const ENTRY_SOURCE_LABELS: Record<string, string> = {
  nfc: 'Tag NFC',
  gps: 'GPS (app)',
  admin: 'Admin',
};

export const ENTRY_STATUS_LABELS: Record<string, string> = {
  valid: 'Válido',
  flagged: 'Em revisão',
  voided: 'Anulado',
};

export const HISTORY_ACTION_LABELS: Record<string, string> = {
  create: 'Criado',
  update: 'Editado',
  void: 'Anulado',
  restore: 'Restaurado',
  review: 'Revisto',
  delete: 'Eliminado',
};

/** warning = coloca o registo em revisão; os restantes são informativos. */
export const FLAG_INFO: Record<string, { label: string; warning: boolean }> = {
  vpn_or_proxy: { label: 'VPN / proxy', warning: true },
  ip_far_from_location: { label: 'IP longe do local', warning: true },
  suspicious_accuracy: { label: 'Precisão GPS suspeita', warning: true },
  repeated_coordinates: { label: 'Coordenadas repetidas', warning: true },
  impossible_travel: { label: 'Deslocação impossível', warning: true },
  shared_device: { label: 'Dispositivo partilhado', warning: true },
  new_device: { label: 'Dispositivo novo', warning: false },
  trusted_network: { label: 'Rede do local', warning: false },
  gps_only: { label: 'Sem tag (só GPS)', warning: false },
  ip_check_unavailable: { label: 'IP não verificado', warning: false },
};

export const getFlagLabel = (flag: string): string => FLAG_INFO[flag]?.label ?? flag;

/** Mensagens para os códigos devolvidos pela edge function `clock-punch`. */
export const PUNCH_MESSAGES: Record<string, string> = {
  registered: 'Ponto registado com sucesso.',
  duplicate: 'Este ponto já tinha sido registado há instantes.',
  missing_position:
    'Não foi possível obter a sua localização. Ative o GPS e permita o acesso à localização.',
  invalid_position: 'Localização inválida. Tente novamente.',
  stale_position: 'A localização obtida está desatualizada. Tente novamente.',
  low_accuracy:
    'Sinal GPS fraco. Ative a localização de alta precisão ou aproxime-se de uma janela e tente de novo.',
  out_of_radius: 'Está fora da área permitida para registar o ponto.',
  vpn_blocked: 'Desative a VPN / proxy para registar o ponto.',
  invalid_tag: 'Tag NFC inválida ou desativada.',
  replayed_tag: 'Esta leitura da tag já foi usada. Encoste novamente o telemóvel à tag.',
  tag_other_company: 'Esta tag pertence a outra empresa.',
  no_location: 'A sua empresa ainda não tem locais de ponto configurados.',
  manual_not_allowed: 'Neste local o ponto só pode ser registado através da tag NFC.',
  ntag424_not_configured: 'Tag segura não configurada no servidor. Contacte o administrador.',
  not_employee: 'Esta conta não está associada a um colaborador.',
  inactive_employee: 'A sua conta de colaborador está inativa.',
  unauthorized: 'Sessão expirada. Inicie sessão novamente.',
};

/** Etiquetas curtas para os motivos de tentativas rejeitadas (vista admin). */
export const REJECT_REASON_LABELS: Record<string, string> = {
  missing_position: 'Sem localização',
  invalid_position: 'Localização inválida',
  stale_position: 'Localização antiga',
  low_accuracy: 'GPS impreciso',
  out_of_radius: 'Fora do raio',
  vpn_blocked: 'VPN bloqueada',
  invalid_tag: 'Tag inválida',
  replayed_tag: 'Leitura de tag reutilizada',
  tag_other_company: 'Tag de outra empresa',
  no_location: 'Sem locais configurados',
  manual_not_allowed: 'Só GPS não permitido',
  ntag424_not_configured: 'Chave NTAG 424 em falta',
};

export const getPunchMessage = (code: string): string =>
  PUNCH_MESSAGES[code] ?? 'Não foi possível registar o ponto. Tente novamente.';

/** Mensagem legível de Error, PostgrestError ou valor desconhecido. */
export const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
};

/** Turno máximo considerado para emparelhar entrada → saída. */
export const MAX_SHIFT_MS = 16 * 60 * 60 * 1000;

export interface DaySummary {
  date: string; // yyyy-MM-dd (hora local)
  entries: TimeClockEntry[];
  workedMinutes: number;
  /** Entrada ainda sem saída (turno em curso). */
  openSince: string | null;
  /** Entrada sem saída (ou saída sem entrada) — a rever. */
  incomplete: boolean;
  hasFlags: boolean;
}

const dateKey = (iso: string) => format(new Date(iso), 'yyyy-MM-dd');

/**
 * Agrupa registos por dia e calcula horas trabalhadas emparelhando
 * entrada → saída. Registos anulados são mostrados mas não contam.
 * Um turno que atravessa a meia-noite conta para o dia da entrada.
 */
export const summarizeDays = <T extends TimeClockEntry>(
  entries: T[],
  now: Date = new Date()
): DaySummary[] => {
  const days = new Map<string, DaySummary>();
  const getDay = (key: string): DaySummary => {
    let day = days.get(key);
    if (!day) {
      day = {
        date: key,
        entries: [],
        workedMinutes: 0,
        openSince: null,
        incomplete: false,
        hasFlags: false,
      };
      days.set(key, day);
    }
    return day;
  };

  const sorted = [...entries].sort(
    (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime()
  );

  let open: TimeClockEntry | null = null;
  for (const entry of sorted) {
    const day = getDay(dateKey(entry.punched_at));
    day.entries.push(entry);
    if (entry.status === 'flagged') day.hasFlags = true;
    if (entry.status === 'voided') continue;

    if (entry.entry_type === 'in') {
      if (open) getDay(dateKey(open.punched_at)).incomplete = true;
      open = entry;
      continue;
    }

    const elapsed = open
      ? new Date(entry.punched_at).getTime() - new Date(open.punched_at).getTime()
      : -1;
    if (open && elapsed >= 0 && elapsed <= MAX_SHIFT_MS) {
      getDay(dateKey(open.punched_at)).workedMinutes += Math.round(elapsed / 60000);
    } else {
      day.incomplete = true;
    }
    open = null;
  }

  if (open) {
    const day = getDay(dateKey(open.punched_at));
    if (now.getTime() - new Date(open.punched_at).getTime() < MAX_SHIFT_MS) {
      day.openSince = open.punched_at;
    } else {
      day.incomplete = true;
    }
  }

  return Array.from(days.values()).sort((a, b) => b.date.localeCompare(a.date));
};

export const formatMinutes = (minutes: number): string => {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
};

/** Próximo tipo de registo esperado para o colaborador. */
export const getNextEntryType = (
  lastEntry: TimeClockEntry | null,
  now: Date = new Date()
): EntryType => {
  if (!lastEntry || lastEntry.entry_type !== 'in') return 'in';
  return now.getTime() - new Date(lastEntry.punched_at).getTime() < MAX_SHIFT_MS ? 'out' : 'in';
};
