import { useState } from 'react';
import { PAYSLIP_CATEGORY, getDocumentCategory, toPeriodMonth } from '@/lib/documents';

export interface DocumentMetadata {
  category: string;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  /** yyyy-MM (só recibos). */
  periodMonth: string;
}

export const emptyMetadata = (overrides: Partial<DocumentMetadata> = {}): DocumentMetadata => ({
  category: '',
  documentNumber: '',
  issueDate: '',
  expiryDate: '',
  periodMonth: '',
  ...overrides,
});

/** Só os campos que fazem sentido para o tipo escolhido, prontos para o serviço. */
export const toServiceFields = (m: DocumentMetadata) => {
  const info = getDocumentCategory(m.category);
  return {
    category: m.category,
    documentNumber: info?.hasNumber ? m.documentNumber || null : null,
    issueDate: m.issueDate || null,
    expiryDate: info?.hasExpiry ? m.expiryDate || null : null,
    periodMonth:
      m.category === PAYSLIP_CATEGORY && m.periodMonth ? toPeriodMonth(m.periodMonth) : null,
  };
};

/** Estado dos metadados de um documento (tipo, nº, datas, mês). */
export const useDocumentMetadata = (initial: Partial<DocumentMetadata> = {}) => {
  const [metadata, setMetadata] = useState(() => emptyMetadata(initial));
  const update = (patch: Partial<DocumentMetadata>) => setMetadata(m => ({ ...m, ...patch }));
  const reset = (next: Partial<DocumentMetadata> = initial) => setMetadata(emptyMetadata(next));
  return { metadata, update, reset };
};
