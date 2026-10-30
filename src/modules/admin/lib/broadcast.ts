// Pessoas → Comunicados: a quem vai um comunicado (email e, se escolhido, aviso na app).
import { normalizeForSearch } from '@/lib/utils';

export interface BroadcastEmployee {
  id: string;
  name: string;
  email: string;
  company_id: string;
  companyName: string | null;
  department: string | null;
  is_active: boolean;
  user_id: string | null;
}

export type AudienceMode = 'all' | 'company' | 'department' | 'people';

export interface Audience {
  mode: AudienceMode;
  companyIds: string[];
  departments: string[];
  peopleIds: string[];
}

export const emptyAudience = (): Audience => ({
  mode: 'all',
  companyIds: [],
  departments: [],
  peopleIds: [],
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Departamentos que existem (sem repetir "RH" e "rh "), por ordem alfabética. */
export const departmentsOf = (employees: BroadcastEmployee[]): string[] => {
  const names = new Map<string, string>();
  for (const e of employees) {
    const name = e.department?.trim();
    if (e.is_active && name && !names.has(normalizeForSearch(name)))
      names.set(normalizeForSearch(name), name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'pt'));
};

/** Colaboradores ativos escolhidos (todos, por empresa, departamento ou um a um). */
export const audienceOf = (
  employees: BroadcastEmployee[],
  audience: Audience
): BroadcastEmployee[] => {
  const active = employees.filter(e => e.is_active);
  switch (audience.mode) {
    case 'all':
      return active;
    case 'company':
      return active.filter(e => audience.companyIds.includes(e.company_id));
    case 'department': {
      const wanted = new Set(audience.departments.map(normalizeForSearch));
      return active.filter(e => !!e.department && wanted.has(normalizeForSearch(e.department)));
    }
    case 'people':
      return active.filter(e => audience.peopleIds.includes(e.id));
  }
};

const hasEmail = (employee: BroadcastEmployee) => EMAIL.test(employee.email.trim());

/** Quem recebe o email: os escolhidos com email válido, sem endereços repetidos. */
export const recipientsOf = (
  employees: BroadcastEmployee[],
  audience: Audience
): BroadcastEmployee[] => {
  const seen = new Set<string>();
  return audienceOf(employees, audience)
    .filter(e => {
      const email = e.email.trim().toLowerCase();
      if (!hasEmail(e) || seen.has(email)) return false;
      seen.add(email);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
};

/** Escolhidos sem email válido (só veem o aviso na app, se for publicado). */
export const withoutEmail = (employees: BroadcastEmployee[], audience: Audience): number =>
  audienceOf(employees, audience).filter(e => !hasEmail(e)).length;

export interface BroadcastDraft {
  subject: string;
  message: string;
  senderName: string;
  /** Assinatura de email de quem envia (Webmail); null = só o nome; undefined = ainda por escolher. */
  signatureId?: string | null;
}

export type BroadcastErrors = Partial<Record<keyof BroadcastDraft | 'audience', string>>;

export const validateBroadcast = (draft: BroadcastDraft, recipients: number): BroadcastErrors => {
  const errors: BroadcastErrors = {};
  if (!draft.subject.trim()) errors.subject = 'Escreva o assunto.';
  if (!draft.message.trim()) errors.message = 'Escreva a mensagem.';
  if (!draft.senderName.trim()) errors.senderName = 'Indique quem assina.';
  if (recipients === 0) errors.audience = 'Ninguém recebe com esta escolha.';
  return errors;
};

/** Para quem foi, em poucas palavras (histórico): "Todos", empresas, departamentos ou "N pessoas". */
export const audienceLabel = (
  audience: Audience,
  companies: { id: string; name: string }[]
): string => {
  switch (audience.mode) {
    case 'all':
      return 'Todos os colaboradores';
    case 'company':
      return companies
        .filter(c => audience.companyIds.includes(c.id))
        .map(c => c.name)
        .join(', ');
    case 'department':
      return `Departamento: ${audience.departments.join(', ')}`;
    case 'people':
      return `${audience.peopleIds.length} ${audience.peopleIds.length === 1 ? 'pessoa' : 'pessoas'}`;
  }
};
