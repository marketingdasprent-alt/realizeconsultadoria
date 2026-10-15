import React from 'react';
import { Download, FileText, ImageIcon } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatBytes } from '@/modules/messenger/lib/files';
import type { TicketAttachment } from '../lib/ticketRules';
import { supportService } from '../services/supportService';

/** Anexo de um ticket: abre com um URL temporário (a janela abre logo, por causa do iPhone). */
export const TicketAttachmentChip: React.FC<{ attachment: TicketAttachment }> = ({
  attachment,
}) => {
  const open = async () => {
    if (!attachment.file_path) return;
    const tab = window.open('', '_blank');
    const url = await supportService.getAttachmentUrl(attachment.file_path);
    if (url && tab) tab.location.href = url;
    else {
      tab?.close();
      toast({ title: 'Não foi possível abrir o anexo', variant: 'destructive' });
    }
  };
  const Icon = attachment.content_type.startsWith('image/') ? ImageIcon : FileText;
  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-center gap-2.5 rounded-2xl bg-rz-canvas px-3 py-2 text-left transition-colors hover:bg-rz-primary-soft"
    >
      <Icon className="h-4 w-4 shrink-0 text-rz-muted" />
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
        {attachment.file_name}
      </span>
      <span className="shrink-0 text-[11.5px] text-rz-muted">
        {formatBytes(attachment.file_size)}
      </span>
      <Download className="h-3.5 w-3.5 shrink-0 text-rz-muted" />
    </button>
  );
};
