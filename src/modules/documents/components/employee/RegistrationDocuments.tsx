import React from 'react';
import {
  AlertCircle,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { getDocumentCategoryLabel, type EmployeeDocument } from '@/lib/documents';
import { cn } from '@/lib/utils';
import { useDocumentDownload } from '../../hooks/useDocumentDownload';
import { buildRegistration } from '../../lib/registration';
import { ExpiryBadge } from '../DocumentBadges';

interface RegistrationDocumentsProps {
  documents: EmployeeDocument[];
  /** Enviar/substituir: abre o envio já com o tipo escolhido (null = escolher). */
  onSubmit: (category: string | null) => void;
}

const PILL = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold';

/**
 * Documentos de registo: tocar abre o ficheiro; "Substituir" envia um novo, que fica à
 * espera de aprovação no admin (o atual continua válido até lá).
 */
export const RegistrationDocuments: React.FC<RegistrationDocumentsProps> = ({
  documents,
  onSubmit,
}) => {
  const { openingId, open } = useDocumentDownload();
  const { rows, missing, others } = buildRegistration(documents);

  const fileRow = (doc: EmployeeDocument, extra?: React.ReactNode) => (
    <div
      key={doc.id}
      role="button"
      tabIndex={0}
      onClick={() => open(doc)}
      onKeyDown={event => event.key === 'Enter' && open(doc)}
      className="flex cursor-pointer items-center gap-3 rounded-2xl bg-rz-canvas/70 p-3 transition-colors hover:bg-rz-primary-soft"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-rz-primary ring-1 ring-rz-line">
        {openingId === doc.id ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <FileText className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14.5px] font-bold">{getDocumentCategoryLabel(doc.category)}</p>
        <p className="truncate text-[12.5px] text-rz-muted">
          {doc.document_number ? `Nº ${doc.document_number} · ` : ''}
          {doc.file_name}
        </p>
        {extra && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{extra}</div>}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {rows.map(({ doc, pendingReplacement }) =>
        fileRow(
          doc,
          <>
            <ExpiryBadge expiryDate={doc.expiry_date} />
            {pendingReplacement ? (
              <span className={cn(PILL, 'bg-amber-100 text-amber-800')}>
                <Clock className="h-3.5 w-3.5" /> Substituição a aguardar aprovação
              </span>
            ) : (
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  onSubmit(doc.category);
                }}
                className={cn(
                  PILL,
                  'bg-white text-rz-primary ring-1 ring-rz-line hover:ring-rz-primary'
                )}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Substituir
              </button>
            )}
          </>
        )
      )}

      {missing.map(item => (
        <div
          key={item.key}
          className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-rz-line p-3"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <AlertCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-bold">{item.label}</p>
            <p className="text-[12.5px] text-rz-muted">{item.hint}</p>
          </div>
          {item.pending ? (
            <span className={cn(PILL, 'bg-amber-100 text-amber-800')}>
              <Clock className="h-3.5 w-3.5" /> Enviado, a aguardar
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onSubmit(item.category)}
              className={cn(PILL, 'bg-rz-primary px-3.5 py-2 text-white')}
            >
              <Upload className="h-3.5 w-3.5" /> Enviar
            </button>
          )}
        </div>
      ))}

      {rows.length === 0 && missing.length === 0 && (
        <p className="py-6 text-center text-sm text-rz-muted">Sem documentos de registo.</p>
      )}

      {others.length > 0 && (
        <details className="group rounded-2xl ring-1 ring-rz-line">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13.5px] font-semibold text-rz-muted">
            Comunicados e outros ficheiros da empresa ({others.length})
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2 px-3 pb-3">{others.map(doc => fileRow(doc))}</div>
        </details>
      )}
    </div>
  );
};
