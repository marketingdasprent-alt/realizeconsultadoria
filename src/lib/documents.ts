// Tipos, categorias e regras dos documentos do colaborador (BackOffice + portal).
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

export type EmployeeDocument = Database['public']['Tables']['employee_documents']['Row'];
export type EmployeeDocumentInsert = Database['public']['Tables']['employee_documents']['Insert'];
export type DocumentStatus = 'pending' | 'approved' | 'rejected';

export interface DocumentCategory {
  value: string;
  label: string;
  /** Documento pessoal com um único exemplar "atual" (substituído ao aprovar um novo). */
  unique: boolean;
  hasNumber: boolean;
  hasExpiry: boolean;
  /** O colaborador pode submeter este tipo pela app. */
  employeeCanSubmit: boolean;
}

export const PAYSLIP_CATEGORY = 'recibo_vencimento';

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    value: 'cartao_cidadao',
    label: 'Cartão de Cidadão',
    unique: true,
    hasNumber: true,
    hasExpiry: true,
    employeeCanSubmit: true,
  },
  {
    value: 'passaporte',
    label: 'Passaporte',
    unique: true,
    hasNumber: true,
    hasExpiry: true,
    employeeCanSubmit: true,
  },
  {
    value: 'titulo_residencia',
    label: 'Título de Residência',
    unique: true,
    hasNumber: true,
    hasExpiry: true,
    employeeCanSubmit: true,
  },
  {
    value: 'carta_conducao',
    label: 'Carta de Condução',
    unique: true,
    hasNumber: true,
    hasExpiry: true,
    employeeCanSubmit: true,
  },
  {
    value: 'nif',
    label: 'NIF',
    unique: true,
    hasNumber: true,
    hasExpiry: false,
    employeeCanSubmit: true,
  },
  {
    value: 'niss',
    label: 'NISS (Segurança Social)',
    unique: true,
    hasNumber: true,
    hasExpiry: false,
    employeeCanSubmit: true,
  },
  {
    value: 'comprovativo_morada',
    label: 'Comprovativo de Morada',
    unique: true,
    hasNumber: false,
    hasExpiry: false,
    employeeCanSubmit: true,
  },
  {
    value: 'iban',
    label: 'Comprovativo de IBAN',
    unique: true,
    hasNumber: true,
    hasExpiry: false,
    employeeCanSubmit: true,
  },
  {
    value: 'certificado_habilitacoes',
    label: 'Certificado de Habilitações',
    unique: true,
    hasNumber: false,
    hasExpiry: false,
    employeeCanSubmit: true,
  },
  {
    value: 'ficha_medica',
    label: 'Ficha de Aptidão Médica',
    unique: true,
    hasNumber: false,
    hasExpiry: true,
    employeeCanSubmit: true,
  },
  {
    value: 'documento_identificacao',
    label: 'Documento de Identificação (outro)',
    unique: true,
    hasNumber: true,
    hasExpiry: true,
    employeeCanSubmit: true,
  },
  {
    value: 'contrato',
    label: 'Contrato',
    unique: true,
    hasNumber: false,
    hasExpiry: true,
    employeeCanSubmit: false,
  },
  {
    value: 'ficha_admissao',
    label: 'Ficha de Admissão',
    unique: true,
    hasNumber: false,
    hasExpiry: false,
    employeeCanSubmit: false,
  },
  {
    value: PAYSLIP_CATEGORY,
    label: 'Recibo de Vencimento',
    unique: false,
    hasNumber: false,
    hasExpiry: false,
    employeeCanSubmit: false,
  },
  {
    value: 'certificado',
    label: 'Certificado',
    unique: false,
    hasNumber: false,
    hasExpiry: true,
    employeeCanSubmit: true,
  },
  {
    value: 'comunicado',
    label: 'Comunicado',
    unique: false,
    hasNumber: false,
    hasExpiry: false,
    employeeCanSubmit: false,
  },
  {
    value: 'outro',
    label: 'Outro',
    unique: false,
    hasNumber: false,
    hasExpiry: false,
    employeeCanSubmit: true,
  },
];

export const getDocumentCategory = (
  value: string | null | undefined
): DocumentCategory | undefined => DOCUMENT_CATEGORIES.find(c => c.value === value);

export const getDocumentCategoryLabel = (value: string | null | undefined): string =>
  getDocumentCategory(value)?.label ?? value ?? 'Sem categoria';

export const EMPLOYEE_SUBMITTABLE_CATEGORIES = DOCUMENT_CATEGORIES.filter(c => c.employeeCanSubmit);
export const ADMIN_UPLOAD_CATEGORIES = DOCUMENT_CATEGORIES.filter(
  c => c.value !== PAYSLIP_CATEGORY
);

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Aguarda aprovação',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

export type ExpiryState = 'none' | 'valid' | 'expiring' | 'expired';

export interface ExpiryInfo {
  state: ExpiryState;
  daysLeft: number | null;
  label: string;
}

export const EXPIRY_WARNING_DAYS = 60;

/** Estado de validade de um documento em relação a hoje. */
export const getExpiryInfo = (expiryDate: string | null, today: Date = new Date()): ExpiryInfo => {
  if (!expiryDate) return { state: 'none', daysLeft: null, label: 'Sem validade' };
  const daysLeft = differenceInCalendarDays(parseISO(expiryDate), today);
  if (daysLeft < 0)
    return { state: 'expired', daysLeft, label: `Expirado há ${Math.abs(daysLeft)} dias` };
  if (daysLeft === 0) return { state: 'expiring', daysLeft, label: 'Expira hoje' };
  if (daysLeft <= EXPIRY_WARNING_DAYS)
    return { state: 'expiring', daysLeft, label: `Expira em ${daysLeft} dias` };
  return {
    state: 'valid',
    daysLeft,
    label: `Válido até ${format(parseISO(expiryDate), 'dd/MM/yyyy')}`,
  };
};

/** "setembro 2026" a partir de period_month (yyyy-MM-dd). */
export const formatPeriodMonth = (periodMonth: string | null): string =>
  periodMonth ? format(parseISO(periodMonth), 'MMMM yyyy', { locale: pt }) : '—';

/** Primeiro dia do mês em yyyy-MM-dd a partir de "yyyy-MM". */
export const toPeriodMonth = (yearMonth: string): string => `${yearMonth}-01`;

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ---------------------------------------------------------------------------
// Importação de recibos em lote: associar ficheiros a colaboradores pelo nome
// ---------------------------------------------------------------------------

export interface MatchableEmployee {
  id: string;
  name: string;
  document_number?: string | null;
}

export interface PayslipFileMatch<F = File> {
  file: F;
  employeeId: string | null;
  /** 'exact' = nome completo no ficheiro; 'partial' = 2+ palavras do nome; null = sem correspondência. */
  confidence: 'exact' | 'partial' | null;
}

const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const STOP_WORDS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);

const significantWords = (name: string): string[] =>
  normalize(name)
    .split(' ')
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));

/**
 * Tenta associar cada ficheiro a um colaborador: nome completo normalizado no
 * nome do ficheiro (exato), senão primeiro + último nome, senão NIF/nº documento.
 * Ambiguidades (2+ colaboradores possíveis) ficam sem correspondência.
 */
export const matchPayslipFiles = <F extends { name: string }>(
  files: F[],
  employees: MatchableEmployee[]
): PayslipFileMatch<F>[] =>
  files.map(file => {
    const haystack = ` ${normalize(file.name.replace(/\.[a-z0-9]+$/i, ''))} `;

    const exact = employees.filter(e => haystack.includes(` ${normalize(e.name)} `));
    if (exact.length === 1) return { file, employeeId: exact[0].id, confidence: 'exact' };
    if (exact.length > 1) return { file, employeeId: null, confidence: null };

    const partial = employees.filter(e => {
      const words = significantWords(e.name);
      if (words.length < 2) return false;
      const first = words[0];
      const last = words[words.length - 1];
      return haystack.includes(` ${first} `) && haystack.includes(` ${last} `);
    });
    if (partial.length === 1) return { file, employeeId: partial[0].id, confidence: 'partial' };

    const byNumber = employees.filter(e => {
      const num = e.document_number ? normalize(e.document_number) : '';
      return num.length >= 6 && haystack.includes(` ${num} `);
    });
    if (byNumber.length === 1) return { file, employeeId: byNumber[0].id, confidence: 'exact' };

    return { file, employeeId: null, confidence: null };
  });
