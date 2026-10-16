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
