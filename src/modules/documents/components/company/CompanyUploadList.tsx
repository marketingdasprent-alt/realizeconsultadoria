import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import type { CompanyUpload } from '../../hooks/useCompanyUploads';

interface CompanyUploadListProps {
  items: CompanyUpload[];
  onDismiss: (id: string) => void;
}

/** Ficheiros a carregar na pasta aberta: progresso, concluídos e erros. */
export const CompanyUploadList: React.FC<CompanyUploadListProps> = ({ items, onDismiss }) => {
  if (!items.length) return null;
  return (
    <ul aria-label="Ficheiros a carregar" className="mb-3 space-y-1.5 rounded-2xl bg-rz-canvas p-2">
      {items.map(item => (
        <li
          key={item.id}
          className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 text-[13px]"
        >
          {item.error ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          ) : item.done ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-rz-primary" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{item.name}</p>
            {item.error ? (
              <p className="text-rose-600">{item.error}</p>
            ) : (
              !item.done && (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-rz-canvas">
                  <div
                    className="h-full rounded-full bg-rz-primary transition-[width]"
                    style={{ width: `${Math.round(item.progress * 100)}%` }}
                  />
                </div>
              )
            )}
          </div>
          {item.error && (
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label={`Fechar ${item.name}`}
              className="rounded-full p-1 text-rz-muted hover:bg-rz-canvas"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};
