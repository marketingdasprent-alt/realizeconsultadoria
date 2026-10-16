// Documentos de registo na ficha do colaborador (BackOffice): um lugar por documento, com o
// atual aprovado, o que o colaborador enviou e ainda espera aprovação, ou "em falta".
import { PAYSLIP_CATEGORY, type EmployeeDocument } from '@/lib/documents';
import { ID_CATEGORIES, REGISTRATION_CATEGORIES } from '@/modules/documents/lib/registration';

export interface RegistrationSlot {
  key: string;
  label: string;
  hint: string;
  /** Tipos que contam para este lugar (a identificação aceita vários). */
  categories: string[];
  /** Obrigatório para o registo (aparece "em falta" a vermelho). */
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
    hint: 'Para o pagamento do vencimento',
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

/** Documentos de registo antigos: substituídos ou rejeitados (histórico). */
export const registrationHistory = (docs: EmployeeDocument[]): EmployeeDocument[] =>
  docs
    .filter(
      doc =>
        REGISTRATION_CATEGORIES.includes(doc.category ?? '') &&
        (doc.status === 'rejected' || (doc.status === 'approved' && !doc.is_current))
    )
    .sort(newestFirst);

/** Documentos partilhados que não são de registo nem recibos (comunicados, contrato…). */
export const sharedDocuments = (docs: EmployeeDocument[]): EmployeeDocument[] =>
  docs
    .filter(
      doc =>
        !REGISTRATION_CATEGORIES.includes(doc.category ?? '') &&
        doc.category !== PAYSLIP_CATEGORY &&
        doc.status !== 'rejected'
    )
    .sort(newestFirst);

/** Recibos de vencimento em vigor por mês (AAAA-MM → recibos, um mês pode ter vários). */
export const payslipsByMonth = (docs: EmployeeDocument[]): Map<string, EmployeeDocument[]> => {
  const months = new Map<string, EmployeeDocument[]>();
  const current = docs.filter(
    d =>
      d.category === PAYSLIP_CATEGORY && d.period_month && d.is_current && d.status === 'approved'
  );
  for (const doc of current.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const month = doc.period_month!.slice(0, 7);
    months.set(month, [...(months.get(month) ?? []), doc]);
  }
  return months;
};
