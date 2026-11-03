import React, { useState } from 'react';
import { Check, Settings2, Tag } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { labelStyle } from '../lib/labelColors';
import type { MailLabel, MailSummary } from '../types';

interface LabelPickerProps {
  /** Emails a marcar (todos da mesma caixa). */
  mails: MailSummary[];
  /** Marcadores da caixa desses emails. */
  labels: MailLabel[];
  onToggle: (mails: MailSummary[], label: MailLabel) => void;
  onManage: (accountId: string) => void;
  className?: string;
  withLabel?: boolean;
}

/** Botão "Marcador": escolher (várias) cores para o email ou para os selecionados. */
export const LabelPicker: React.FC<LabelPickerProps> = ({
  mails,
  labels,
  onToggle,
  onManage,
  className,
  withLabel,
}) => {
  const { isPreview } = useWorkspace();
  const [open, setOpen] = useState(false);
  const accountId = mails[0]?.accountId;
  if (isPreview || !accountId) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" title="Marcador" aria-label="Marcador" className={className}>
          <Tag className="h-4 w-4" />
          {withLabel && <span className="hidden 2xl:inline">Marcador</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 rounded-2xl p-1.5">
        <p className="px-2.5 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-rz-muted">
          Marcadores
        </p>
        <div className="rz-scroll max-h-64 overflow-y-auto">
          {labels.length === 0 && (
            <p className="px-2.5 py-2 text-[13px] text-rz-muted">Ainda não há marcadores.</p>
          )}
          {labels.map(label => {
            const all = mails.every(mail => mail.labelIds?.includes(label.id));
            const some = !all && mails.some(mail => mail.labelIds?.includes(label.id));
            return (
              <button
                key={label.id}
                type="button"
                onClick={() => onToggle(mails, label)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-semibold hover:bg-rz-canvas"
              >
                <span
                  className={cn('h-3 w-3 shrink-0 rounded-full', labelStyle(label.color).dot)}
                />
                <span className="min-w-0 flex-1 truncate">{label.name}</span>
                {all && <Check className="h-4 w-4 shrink-0 text-rz-primary" />}
                {some && <span className="text-[11px] text-rz-muted">alguns</span>}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onManage(accountId);
          }}
          className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-rz-line px-2.5 py-2 text-left text-[13.5px] font-bold text-rz-primary hover:bg-rz-canvas"
        >
          <Settings2 className="h-4 w-4 shrink-0" /> Gerir marcadores…
        </button>
      </PopoverContent>
    </Popover>
  );
};
