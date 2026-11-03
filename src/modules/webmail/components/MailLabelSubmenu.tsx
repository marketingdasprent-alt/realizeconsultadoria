import React from 'react';
import { Settings2, Tag } from 'lucide-react';
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { labelStyle } from '../lib/labelColors';
import type { MailLabel, MailSummary } from '../types';

interface MailLabelSubmenuProps {
  targets: MailSummary[];
  labels: MailLabel[];
  onToggle: (mails: MailSummary[], label: MailLabel) => void;
  onManage: () => void;
}

/** "Marcador ▸": as cores da caixa, com visto nas que o email já tem (várias ao mesmo tempo). */
export const MailLabelSubmenu: React.FC<MailLabelSubmenuProps> = ({
  targets,
  labels,
  onToggle,
  onManage,
}) => (
  <ContextMenuSub>
    <ContextMenuSubTrigger className="gap-2">
      <Tag className="mr-2 h-4 w-4" /> Marcador
    </ContextMenuSubTrigger>
    <ContextMenuSubContent className="max-h-72 w-56 overflow-y-auto rounded-xl">
      {labels.length === 0 && (
        <p className="px-2 py-1.5 text-[13px] text-rz-muted">Ainda não há marcadores.</p>
      )}
      {labels.map(label => (
        <ContextMenuCheckboxItem
          key={label.id}
          checked={targets.every(mail => mail.labelIds?.includes(label.id))}
          onSelect={() => onToggle(targets, label)}
          className="gap-2"
        >
          <span className={cn('h-3 w-3 shrink-0 rounded-full', labelStyle(label.color).dot)} />
          <span className="truncate">{label.name}</span>
        </ContextMenuCheckboxItem>
      ))}
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={onManage} className="gap-2 font-bold text-rz-primary">
        <Settings2 className="h-4 w-4" /> Gerir marcadores…
      </ContextMenuItem>
    </ContextMenuSubContent>
  </ContextMenuSub>
);
