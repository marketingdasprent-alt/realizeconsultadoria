// Documentos de registo do colaborador (identificação, NIF, NISS, IBAN…). Recibos e
// comunicados não são documentos pessoais: ficam noutros sítios da ficha.
import { PAYSLIP_CATEGORY, type EmployeeDocument } from '@/lib/documents';

/** Documentos de identificação: basta um deles (CC, passaporte, título de residência…). */
export const ID_CATEGORIES = [
  'cartao_cidadao',
  'passaporte',
  'titulo_residencia',
  'documento_identificacao',
];

export const REGISTRATION_CATEGORIES = [
  ...ID_CATEGORIES,
  'carta_conducao',
  'nif',
  'niss',
  'comprovativo_morada',
  'iban',
];

export interface RegistrationRow {
  doc: EmployeeDocument;
  /** Há um documento novo do mesmo tipo à espera de aprovação. */
  pendingReplacement: boolean;
}

export interface MissingDocument {
  key: 'id' | 'iban';
  label: string;
  hint: string;
  /** Tipo já escolhido no envio (null = a pessoa escolhe). */
  category: string | null;
  pending: boolean;
}

/** Os documentos de registo em vigor, o que falta e os outros ficheiros da empresa. */
export const buildRegistration = (all: EmployeeDocument[]) => {
  const approved = all.filter(d => d.status === 'approved' && d.is_current);
  const pending = all.filter(d => d.status === 'pending');
  const isRegistration = (d: EmployeeDocument) =>
    !!d.category && REGISTRATION_CATEGORIES.includes(d.category);

  const rows: RegistrationRow[] = approved.filter(isRegistration).map(doc => ({
    doc,
    pendingReplacement: pending.some(p => p.category === doc.category),
  }));

  const has = (categories: string[]) => rows.some(r => categories.includes(r.doc.category ?? ''));
  const waiting = (categories: string[]) =>
    pending.some(p => categories.includes(p.category ?? ''));
  const missing: MissingDocument[] = [];
  if (!has(ID_CATEGORIES))
    missing.push({
      key: 'id',
      label: 'Documento de identificação',
      hint: 'Cartão de Cidadão, Passaporte ou Título de Residência',
      category: null,
      pending: waiting(ID_CATEGORIES),
    });
  if (!has(['iban']))
    missing.push({
      key: 'iban',
      label: 'Comprovativo de IBAN',
      hint: 'Para receber o vencimento',
      category: 'iban',
      pending: waiting(['iban']),
    });

  // Comunicados, contratos e outros ficheiros que a empresa partilhou.
  const others = approved.filter(d => !isRegistration(d) && d.category !== PAYSLIP_CATEGORY);
  return { rows, missing, others };
};

// ---------------------------------------------------------------------------
// Os documentos de registo, um lugar cada (app do colaborador e ficha no admin)
// ---------------------------------------------------------------------------

export interface RegistrationSlot {
  key: string;
  label: string;
  hint: string;
  /** Tipos que contam para este lugar (a identificação aceita vários). */
  categories: string[];
  /** Obrigatório para o registo (aparece "em falta" em destaque). */
  required: boolean;
}

export const REGISTRATION_SLOTS: RegistrationSlot[] = [
  {
    key: 'id',
    label: 'Documento de identificação',
    hint: 'Cartão de Cidadão, Passaporte ou Título de Residência',
    categories: ID_CATEGORIES,
    required: true,
  },
  {
    key: 'iban',
    label: 'Comprovativo de IBAN',
    hint: 'Para receber o vencimento',
    categories: ['iban'],
    required: true,
  },
  {
    key: 'nif',
    label: 'NIF',
    hint: 'Número de identificação fiscal',
    categories: ['nif'],
    required: false,
  },
  {
    key: 'niss',
    label: 'NISS',
    hint: 'Segurança Social',
    categories: ['niss'],
    required: false,
  },
  {
    key: 'morada',
    label: 'Comprovativo de morada',
    hint: 'Fatura ou atestado recente',
    categories: ['comprovativo_morada'],
    required: false,
  },
  {
    key: 'carta',
    label: 'Carta de condução',
    hint: 'Se conduz viaturas da empresa',
    categories: ['carta_conducao'],
    required: false,
  },
];

export interface SlotState {
  slot: RegistrationSlot;
  /** Documento aprovado em vigor (o mais recente). */
  current: EmployeeDocument | null;
  /** Enviados pelo colaborador à espera de aprovação. */
  pending: EmployeeDocument[];
}

const newestFirst = (a: EmployeeDocument, b: EmployeeDocument) =>
  b.created_at.localeCompare(a.created_at);

/** Estado de cada lugar a partir de todos os documentos do colaborador. */
export const slotStates = (docs: EmployeeDocument[]): SlotState[] =>
  REGISTRATION_SLOTS.map(slot => {
    const ofSlot = docs.filter(doc => slot.categories.includes(doc.category ?? ''));
    return {
      slot,
      current:
        ofSlot.filter(doc => doc.status === 'approved' && doc.is_current).sort(newestFirst)[0] ??
        null,
      pending: ofSlot.filter(doc => doc.status === 'pending').sort(newestFirst),
    };
  });

/** Pendente que conta para aprovação: de registo ou ainda sem tipo (o admin escolhe). */
export const isReviewable = (doc: EmployeeDocument): boolean =>
  doc.status === 'pending' && (!doc.category || REGISTRATION_CATEGORIES.includes(doc.category));
