import React from 'react';
import { cn } from '@/lib/utils';
import { labelStyle } from '../lib/labelColors';
import type { MailLabel } from '../types';

interface LabelChipsProps {
  labelIds?: string[];
  byId: Map<string, MailLabel>;
  /** Quantos mostrar; os restantes ficam num "+n". */
  max?: number;
  className?: string;
}

/** Marcadores de um email, como etiquetas coloridas (na lista e no leitor). */
export const LabelChips: React.FC<LabelChipsProps> = ({ labelIds, byId, max = 3, className }) => {
  const labels = (labelIds ?? [])
    .map(id => byId.get(id))
    .filter((label): label is MailLabel => !!label);
  if (!labels.length) return null;
  const shown = labels.slice(0, max);
  const extra = labels.length - shown.length;
  return (
    <span className={cn('flex min-w-0 flex-wrap items-center gap-1', className)}>
      {shown.map(label => (
        <span
          key={label.id}
          title={label.name}
          className={cn(
            'inline-flex max-w-[8rem] items-center gap-1 truncate rounded-full px-2 py-[1px] text-[11px] font-bold leading-4',
            labelStyle(label.color).chip
          )}
        >
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', labelStyle(label.color).dot)} />
          <span className="truncate">{label.name}</span>
        </span>
      ))}
      {extra > 0 && (
        <span className="rounded-full bg-rz-canvas px-1.5 text-[11px] font-bold text-rz-muted">
          +{extra}
        </span>
      )}
    </span>
  );
};
