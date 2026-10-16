import React from 'react';
import { AlertTriangle, FileClock } from 'lucide-react';
import {
  getDocumentCategoryLabel,
  getExpiryInfo,
  PAYSLIP_CATEGORY,
  type EmployeeDocument,
} from '@/lib/documents';

interface EmployeeDocumentAlertsProps {
  documents: EmployeeDocument[];
  onShowDocuments: () => void;
}

/**
 * Avisos no topo da ficha: que documento está a expirar (ou expirou) e quantos o colaborador
 * enviou à espera de aprovação. "Ver documentos" abre o separador Documentos.
 */
export const EmployeeDocumentAlerts: React.FC<EmployeeDocumentAlertsProps> = ({
  documents,
  onShowDocuments,
}) => {
  const expiring = documents
    .filter(doc => doc.status === 'approved' && doc.is_current && doc.category !== PAYSLIP_CATEGORY)
    .map(doc => ({ doc, info: getExpiryInfo(doc.expiry_date) }))
    .filter(({ info }) => info.state === 'expiring' || info.state === 'expired')
    .sort((a, b) => (a.info.daysLeft ?? 0) - (b.info.daysLeft ?? 0));
  const pendingDocs = documents.filter(doc => doc.status === 'pending');
  const pending = pendingDocs.length;

  if (expiring.length === 0 && pending === 0) return null;

  return (
    <div className="space-y-2">
      {expiring.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[20px] bg-red-50 px-4 py-3 ring-1 ring-red-200">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <ul className="min-w-0 flex-1 text-[13.5px] text-red-800">
            {expiring.map(({ doc, info }) => (
              <li key={doc.id}>
                <span className="font-bold">{getDocumentCategoryLabel(doc.category)}</span> ·{' '}
                {info.label.toLowerCase()}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onShowDocuments}
            className="h-9 shrink-0 rounded-full bg-white px-4 text-[13px] font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
          >
            Ver documentos
          </button>
        </div>
      )}
      {pending > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[20px] bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <FileClock className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1 text-[13.5px] text-amber-800">
            <p className="font-semibold">
              {pending === 1
                ? 'Enviou 1 documento para aprovar:'
                : `Enviou ${pending} documentos para aprovar:`}
            </p>
            <ul>
              {pendingDocs.map(doc => (
                <li key={doc.id} className="truncate">
                  <span className="font-bold">{getDocumentCategoryLabel(doc.category)}</span> ·{' '}
                  {doc.file_name}
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={onShowDocuments}
            className="h-9 shrink-0 rounded-full bg-white px-4 text-[13px] font-bold text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
          >
            Ver e aprovar
          </button>
        </div>
      )}
    </div>
  );
};
