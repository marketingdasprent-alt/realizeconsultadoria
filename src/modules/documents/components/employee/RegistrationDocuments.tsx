import React from 'react';
import { ChevronDown, Clock, FileText, Loader2, RefreshCw, Upload } from 'lucide-react';
import { getDocumentCategoryLabel, type EmployeeDocument } from '@/lib/documents';
import { cn } from '@/lib/utils';
import { useDocumentDownload } from '../../hooks/useDocumentDownload';
import { buildRegistration, slotStates, type RegistrationSlot } from '../../lib/registration';
import { ExpiryBadge } from '../DocumentBadges';

interface RegistrationDocumentsProps {
  documents: EmployeeDocument[];
  /** Enviar / substituir o documento de um lugar (o envio só aceita os tipos desse lugar). */
  onSubmit: (slot: RegistrationSlot) => void;
}

const PILL = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold';

/**
 * Os documentos de registo, um cartão cada (identificação, IBAN, NIF, NISS, morada, carta):
 * o atual (tocar abre), "Enviar" se falta ou "Substituir". O que se envia fica à espera de
 * aprovação dos RH; o atual continua válido até lá.
 */
export const RegistrationDocuments: React.FC<RegistrationDocumentsProps> = ({
  documents,
  onSubmit,
}) => {
  const { openingId, open } = useDocumentDownload();
  const states = slotStates(documents);
  const { others } = buildRegistration(documents);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {states.map(({ slot, current, pending }) => {
          const waiting = pending.length > 0;
          return (
            <section
              key={slot.key}
              className={cn(
                'flex flex-col rounded-2xl p-3.5 ring-1',
                current
                  ? 'bg-rz-canvas/70 ring-transparent'
                  : slot.required
                    ? 'border-2 border-dashed border-amber-300 bg-amber-50/40 ring-transparent'
                    : 'border-2 border-dashed border-rz-line ring-transparent'
              )}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold">{slot.label}</p>
                  <p className="text-[12.5px] text-rz-muted">
                    {slot.hint}
                    {!slot.required && ' · opcional'}
                  </p>
                </div>
                {current && <ExpiryBadge expiryDate={current.expiry_date} />}
              </div>

              {current && (
                <button
                  type="button"
                  onClick={() => open(current)}
                  className="mt-2 flex items-center gap-2.5 rounded-xl bg-white p-2 text-left ring-1 ring-rz-line hover:ring-rz-primary/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rz-primary-soft text-rz-primary">
                    {openingId === current.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">
                      {getDocumentCategoryLabel(current.category)}
                    </span>
                    <span className="block truncate text-[12px] text-rz-muted">
                      {current.document_number ? `Nº ${current.document_number} · ` : ''}
                      {current.file_name}
                    </span>
                  </span>
                </button>
              )}

              <div className="mt-auto pt-2.5">
                {waiting ? (
                  <span className={cn(PILL, 'bg-amber-100 text-amber-800')}>
                    <Clock className="h-3.5 w-3.5" />
                    {current
                      ? 'Substituição a aguardar aprovação'
                      : 'Enviado, a aguardar aprovação'}
                  </span>
                ) : current ? (
                  <button
                    type="button"
                    onClick={() => onSubmit(slot)}
                    className={cn(
                      PILL,
                      'bg-white text-rz-primary ring-1 ring-rz-line hover:ring-rz-primary'
                    )}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Substituir
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSubmit(slot)}
                    className={cn(PILL, 'bg-rz-primary px-3.5 py-2 text-white')}
                  >
                    <Upload className="h-3.5 w-3.5" /> Enviar
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {others.length > 0 && (
        <details className="group rounded-2xl ring-1 ring-rz-line">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13.5px] font-semibold text-rz-muted">
            Comunicados e outros ficheiros da empresa ({others.length})
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-2 px-3 pb-3">
            {others.map(doc => (
              <button
                key={doc.id}
                type="button"
                onClick={() => open(doc)}
                className="flex w-full items-center gap-3 rounded-2xl bg-rz-canvas/70 p-3 text-left hover:bg-rz-primary-soft"
              >
                <FileText className="h-5 w-5 shrink-0 text-rz-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">
                    {getDocumentCategoryLabel(doc.category)}
                  </span>
                  <span className="block truncate text-[12.5px] text-rz-muted">
                    {doc.file_name}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};
