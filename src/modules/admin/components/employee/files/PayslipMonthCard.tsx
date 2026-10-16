import React, { useRef, useState } from 'react';
import { ExternalLink, Loader2, Plus, Trash2, UploadCloud } from 'lucide-react';
import type { EmployeeDocument } from '@/lib/documents';
import { cn } from '@/lib/utils';

interface PayslipMonthCardProps {
  label: string;
  payslips: EmployeeDocument[];
  future: boolean;
  uploading: boolean;
  onFiles: (files: File[]) => void;
  onOpen: (doc: EmployeeDocument) => void;
  openingId: string | null;
  onDelete: (doc: EmployeeDocument) => void;
}

/** Um mês dos recibos: os ficheiros do mês, "Carregar" (vários) ou arrastar e largar aqui. */
export const PayslipMonthCard: React.FC<PayslipMonthCardProps> = ({
  label,
  payslips,
  future,
  uploading,
  onFiles,
  onOpen,
  openingId,
  onDelete,
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const has = payslips.length > 0;

  const drop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length && !future) onFiles(files);
  };

  return (
    <li
      onDragOver={event => {
        if (future) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
      className={cn(
        'relative flex min-h-[104px] flex-col rounded-2xl p-3 ring-1 transition-colors',
        has ? 'bg-emerald-50 ring-emerald-200' : 'bg-rz-canvas ring-transparent',
        dragging && 'bg-rz-primary-soft ring-2 ring-rz-primary',
        future && 'opacity-40'
      )}
    >
      <span className="text-[13.5px] font-bold capitalize">{label}</span>
      {has ? (
        <ul className="mt-1 space-y-1">
          {payslips.map(doc => (
            <li key={doc.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onOpen(doc)}
                disabled={openingId === doc.id}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12.5px] font-semibold hover:text-rz-primary"
                title={doc.file_name}
              >
                {openingId === doc.id ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{doc.file_name}</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(doc)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-red-50 hover:text-red-600"
                aria-label={`Apagar ${doc.file_name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-[12px] text-rz-muted">{future ? '—' : 'Sem recibo'}</span>
      )}
      {!future && (
        <div className="mt-auto pt-2">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-rz-primary" />
          ) : (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex h-8 items-center gap-1 rounded-full bg-white px-2.5 text-[12.5px] font-semibold text-rz-primary ring-1 ring-rz-line"
            >
              <Plus className="h-3.5 w-3.5" /> {has ? 'Mais' : 'Carregar'}
            </button>
          )}
          <input
            ref={input}
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="hidden"
            onChange={event => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = '';
              if (files.length) onFiles(files);
            }}
          />
        </div>
      )}
      {dragging && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 rounded-2xl text-[13px] font-bold text-rz-primary">
          <UploadCloud className="h-5 w-5" /> Largar aqui
        </span>
      )}
    </li>
  );
};
