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
export type TimeClockConfigHistory = Tables['time_clock_config_history']['Row'];
export type NotificationEmail = Tables['notification_emails_timeclock']['Row'];

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
  pending: 'Aguarda aprovação',
  voided: 'Anulado',
};

export const HISTORY_ACTION_LABELS: Record<string, string> = {
  create: 'Criado',
  update: 'Editado',
  void: 'Anulado',
  restore: 'Restaurado',
  review: 'Revisto',
  approve: 'Aprovado',
  reject: 'Rejeitado',
  delete: 'Eliminado',
};

/** warning = coloca o registo em revisão; os restantes são informativos. */
export const FLAG_INFO: Record<string, { label: string; warning: boolean }> = {
  vpn_or_proxy: { label: 'VPN / Tor', warning: true },
  shared_ip_proxy: { label: 'IP partilhado marcado como proxy', warning: false },
  imprecise_gps: { label: 'GPS impreciso (registou na tag)', warning: true },
  ip_far_from_location: { label: 'IP de outro país', warning: true },
  suspicious_accuracy: { label: 'Precisão GPS suspeita', warning: true },
  repeated_coordinates: { label: 'Coordenadas repetidas', warning: true },
  impossible_travel: { label: 'Deslocação impossível', warning: true },
  shared_device: { label: 'Dispositivo partilhado', warning: true },
  new_device: { label: 'Dispositivo novo', warning: false },
  trusted_network: { label: 'Rede do local', warning: false },
  gps_only: { label: 'Sem tag (só GPS)', warning: false },
  ip_check_unavailable: { label: 'IP não verificado', warning: false },
  remote: { label: 'Fora do local (a aprovar)', warning: false },
  outside_location: { label: 'Fora do local', warning: false },
  no_gps: { label: 'Sem GPS', warning: true },
  stale_gps: { label: 'GPS desatualizado', warning: true },
  weak_gps: { label: 'GPS fraco', warning: false },
  approximate_location: { label: 'Localização aproximada', warning: false },
  no_location_configured: { label: 'Sem locais configurados', warning: false },
  tag_required: { label: 'Sem tag (local exige tag)', warning: false },
};

export const getFlagLabel = (flag: string): string => FLAG_INFO[flag]?.label ?? flag;

/** Mensagens para os códigos devolvidos pela edge function `clock-punch`. */
export const PUNCH_MESSAGES: Record<string, string> = {
  registered: 'Ponto registado.',
  pending_approval: 'Registado. Fica a aguardar aprovação dos RH.',
  duplicate: 'Este registo já tinha sido feito há instantes.',
  invalid_state:
    'O seu dia mudou entretanto (registo feito noutro telemóvel?). O painel foi atualizado: confirme e tente de novo.',
  vpn_blocked: 'Desative a VPN para registar o ponto.',
  invalid_tag: 'Tag NFC inválida ou desativada.',
  replayed_tag: 'Esta leitura da tag já foi usada. Encoste novamente o telemóvel à tag.',
  tag_other_company: 'Esta tag pertence a outra empresa.',
  ntag424_not_configured: 'Tag segura não configurada no servidor. Contacte o administrador.',
  not_employee: 'Esta conta não está associada a um colaborador.',
  inactive_employee: 'A sua conta de colaborador está inativa.',
  unauthorized: 'Sessão expirada. Inicie sessão novamente.',
  network: 'Sem ligação ao servidor. Verifique a internet e tente novamente.',
};

/** Etiquetas curtas para os motivos de tentativas rejeitadas (vista admin). */
export const REJECT_REASON_LABELS: Record<string, string> = {
  missing_position: 'Sem localização',
  invalid_position: 'Localização inválida',
  stale_position: 'Localização antiga',
  low_accuracy: 'GPS impreciso',
  approximate_location: 'Localização aproximada',
  out_of_radius: 'Fora do raio',
  vpn_blocked: 'VPN bloqueada',
  invalid_tag: 'Tag inválida',
  replayed_tag: 'Leitura de tag reutilizada',
  tag_other_company: 'Tag de outra empresa',
  no_location: 'Sem locais configurados',
  manual_not_allowed: 'Só GPS não permitido',
  ntag424_not_configured: 'Chave NTAG 424 em falta',
};

/** A partir desta distância já não é "fora do raio": não há local configurado perto. */
export const NO_NEARBY_LOCATION_M = 1000;

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

/** Tamanho máximo da observação do colaborador (igual ao limite na BD e na edge function). */
export const PUNCH_NOTE_MAX_LENGTH = 300;

/** Turno máximo considerado para emparelhar entrada → saída. */
export const MAX_SHIFT_MS = 12 * 60 * 60 * 1000;

export interface DaySummary {
  date: string; // yyyy-MM-dd (hora local)
  entries: TimeClockEntry[];
  workedMinutes: number;
  /** Tempo em pausa (pausa → retoma); não conta como trabalhado. */
  breakMinutes: number;
  /** Entrada ainda sem saída (turno em curso). */
  openSince: string | null;
  /** Em pausa desde (ainda sem retoma nem fim do dia). */
  pausedSince: string | null;
  /** Entrada sem saída (ou saída sem entrada) — a rever. */
  incomplete: boolean;
  hasFlags: boolean;
  /** Tem registos remotos a aguardar aprovação (contam provisoriamente). */
  hasPending: boolean;
}

const dateKey = (iso: string) => format(new Date(iso), 'yyyy-MM-dd');

/**
 * Agrupa registos por dia e calcula horas trabalhadas emparelhando
 * entrada → saída (início/retoma → pausa/fim): as pausas ficam fora.
 * Registos anulados são mostrados mas não contam.
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
        breakMinutes: 0,
        openSince: null,
        pausedSince: null,
        incomplete: false,
        hasFlags: false,
        hasPending: false,
      };
      days.set(key, day);
    }
    return day;
  };

  const sorted = [...entries].sort(
    (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime()
  );

  const ms = (from: TimeClockEntry, to: TimeClockEntry) =>
    new Date(to.punched_at).getTime() - new Date(from.punched_at).getTime();
  const within = (elapsed: number) => elapsed >= 0 && elapsed <= MAX_SHIFT_MS;
  const dayOf = (entry: TimeClockEntry) => getDay(dateKey(entry.punched_at));

  let open: TimeClockEntry | null = null;
  // Pausa ainda sem retoma nem fim do dia.
  let pause: TimeClockEntry | null = null;
  for (const entry of sorted) {
    const day = dayOf(entry);
    day.entries.push(entry);
    if (entry.status === 'flagged') day.hasFlags = true;
    if (entry.status === 'pending') day.hasPending = true;
    if (entry.status === 'voided') continue;

    const sincePause = pause ? ms(pause, entry) : -1;
    const pauseOk = pause !== null && within(sincePause);
    if (pause && !pauseOk) dayOf(pause).incomplete = true;

    if (entry.entry_type === 'in') {
      if (open) dayOf(open).incomplete = true;
      if (pause && pauseOk) {
        // Retoma: a pausa fica fora das horas. Novo início sem terminar o dia: a rever.
        if (entry.kind === 'break') dayOf(pause).breakMinutes += Math.round(sincePause / 60000);
        else dayOf(pause).incomplete = true;
      }
      pause = null;
      open = entry;
      continue;
    }

    const elapsed = open ? ms(open, entry) : -1;
    if (open && within(elapsed)) {
      dayOf(open).workedMinutes += Math.round(elapsed / 60000);
    } else if (!(pauseOk && entry.kind !== 'break')) {
      // Terminar o dia durante a pausa é normal; outra saída sem entrada não.
      day.incomplete = true;
    }
    pause = entry.kind === 'break' ? entry : null;
    open = null;
  }

  if (open) {
    const day = dayOf(open);
    if (now.getTime() - new Date(open.punched_at).getTime() < MAX_SHIFT_MS) {
      day.openSince = open.punched_at;
    } else {
      day.incomplete = true;
    }
  } else if (pause) {
    const day = dayOf(pause);
    if (now.getTime() - new Date(pause.punched_at).getTime() < MAX_SHIFT_MS) {
      day.pausedSince = pause.punched_at;
    } else {
      day.incomplete = true;
    }
  }

  return Array.from(days.values()).sort((a, b) => b.date.localeCompare(a.date));
};

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * Pesquisa por nome sem acentos nem maiúsculas; todas as palavras têm de aparecer
 * ("joao bahia" encontra "João Victor Da Silva Bahia"). Pesquisa vazia aceita tudo.
 */
export const matchesNameSearch = (name: string | null | undefined, query: string): boolean => {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const target = normalizeText(name ?? '');
  return words.every(word => target.includes(word));
};

export const formatMinutes = (minutes: number): string => {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
};

/** Distância legível: "45 m" ou "2,3 km". */
export const formatDistance = (meters: number): string =>
  meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
