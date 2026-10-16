// Documentos de registo na ficha do colaborador (BackOffice): um lugar por documento, com o
// atual aprovado, o que o colaborador enviou e ainda espera aprovação, ou "em falta".
import { PAYSLIP_CATEGORY, type EmployeeDocument } from '@/lib/documents';
import { REGISTRATION_CATEGORIES } from '@/modules/documents/lib/registration';

// Os lugares (identificação, IBAN, NIF…) são os mesmos da app do colaborador.
export {
  REGISTRATION_SLOTS,
  slotStates,
  type RegistrationSlot,
  type SlotState,
} from '@/modules/documents/lib/registration';

const newestFirst = (a: EmployeeDocument, b: EmployeeDocument) =>
  b.created_at.localeCompare(a.created_at);

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
