// Regras da pesquisa global (briefing §19): normalização, padrões ILIKE e excertos.

export type SearchGroup =
  | 'people'
  | 'conversations'
  | 'messages'
  | 'tasks'
  | 'events'
  | 'documents'
  | 'tickets'
  | 'posts'
  | 'modules';

export interface SearchHit {
  key: string;
  group: SearchGroup;
  title: string;
  subtitle?: string;
  /** Destino (ex.: "/colaborador/tarefas?tarefa=1"). */
  to: string;
  /** Nome para o avatar (pessoas e conversas). */
  avatarName?: string;
  /** Ícone do módulo (grupo "modules"). */
  moduleKey?: string;
}

export const SEARCH_GROUPS: { key: SearchGroup; label: string }[] = [
  { key: 'people', label: 'Pessoas' },
  { key: 'conversations', label: 'Conversas' },
  { key: 'messages', label: 'Mensagens' },
  { key: 'tasks', label: 'Tarefas' },
  { key: 'events', label: 'Eventos' },
  { key: 'documents', label: 'Documentos' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'posts', label: 'Publicações' },
  { key: 'modules', label: 'Módulos' },
];

/** Mínimo de caracteres antes de ir ao servidor. */
export const MIN_SERVER_TERM = 2;
/** Resultados por grupo. */
export const PER_GROUP = 5;

/** Sem acentos e em minúsculas: "Férias" encontra "ferias". */
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export const matchesTerm = (term: string, ...fields: (string | null | undefined)[]) => {
  const needle = normalize(term.trim());
  return !needle || fields.some(field => !!field && normalize(field).includes(needle));
};

/** Padrão ILIKE com os curingas do utilizador escapados (% e _ passam a literais). */
export const likePattern = (term: string) =>
  `%${term.trim().replace(/[\\%_]/g, char => `\\${char}`)}%`;

/** Excerto à volta da primeira ocorrência, para mensagens e publicações longas. */
export const snippet = (text: string, term: string, radius = 40) => {
  const flat = text.replace(/\s+/g, ' ').trim();
  const at = normalize(flat).indexOf(normalize(term.trim()));
  if (at < 0 || flat.length <= radius * 2) return flat.slice(0, radius * 2);
  const start = Math.max(0, at - radius);
  const end = Math.min(flat.length, at + term.length + radius);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
};
