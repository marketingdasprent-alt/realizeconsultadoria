import React from 'react';
import { ExternalLink, FileText, Loader2, Paperclip } from 'lucide-react';
import { getExpiryInfo, type EmployeeDocument } from '@/lib/documents';
import { cn } from '@/lib/utils';
import type { SlotState } from '../../../lib/registrationSlots';

interface InlineDocumentSlotProps {
  state: SlotState | undefined;
  onAttach: () => void;
  onOpen: (doc: EmployeeDocument) => void;
  openingId: string | null;
}

/**
 * O documento ao lado do campo a que diz respeito (ex.: identificação junto ao nº do
 * documento): ver o atual, anexar se falta ou substituir.
 */
export const InlineDocumentSlot: React.FC<InlineDocumentSlotProps> = ({
  state,
  onAttach,
  onOpen,
  openingId,
}) => {
  if (!state) return null;
  const { slot, current, pending } = state;
  const expiry = current ? getExpiryInfo(current.expiry_date) : null;
  const status = current
    ? expiry && expiry.state !== 'none'
      ? expiry.label
      : current.file_name
    : pending.length > 0
      ? 'Enviado pelo colaborador · aprovar em Documentos'
      : 'Em falta';

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-rz-canvas px-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rz-primary ring-1 ring-rz-line">
        <FileText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">{slot.label}</p>
        <p
          className={cn(
            'truncate text-[12px]',
            !current && pending.length === 0 && slot.required
              ? 'font-semibold text-red-600'
              : expiry?.state === 'expired' || expiry?.state === 'expiring'
                ? 'font-semibold text-amber-700'
                : pending.length > 0 && !current
                  ? 'font-semibold text-amber-700'
                  : 'text-rz-muted'
          )}
        >
          {status}
        </p>
      </div>
      {current && (
        <button
          type="button"
          onClick={() => onOpen(current)}
          disabled={openingId === current.id}
          className="flex h-8 items-center gap-1 rounded-full bg-white px-2.5 text-[12.5px] font-semibold ring-1 ring-rz-line hover:text-rz-primary"
        >
          {openingId === current.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ExternalLink className="h-3.5 w-3.5" />
          )}
          Ver
        </button>
      )}
      <button
        type="button"
        onClick={onAttach}
        className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-semibold text-rz-primary hover:bg-white"
      >
        <Paperclip className="h-3.5 w-3.5" />
        {current ? 'Substituir' : 'Anexar'}
      </button>
    </div>
  );
};
