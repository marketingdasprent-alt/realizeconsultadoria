import React, { useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronDown, Loader2, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { useMailMessage } from '../hooks/useMailbox';
import { nameOf } from '../lib/mailFormat';
import type { MailAddress, MailAttachmentInfo, MailMessage, MailSummary } from '../types';
import { MailBody } from './MailBody';
import { MailRecipients } from './MailRecipients';

interface ThreadItemProps {
  mail: MailSummary;
  onDownload: (message: MailMessage, attachmentId: string) => void;
  onOpenAttachment: (message: MailMessage, attachment: MailAttachmentInfo) => void;
  onWrite?: (address: MailAddress) => void;
}

/** Outra mensagem da conversa: fechada mostra quem, quando e o início; aberta, o email todo. */
export const ThreadItem: React.FC<ThreadItemProps> = ({
  mail,
  onDownload,
  onOpenAttachment,
  onWrite,
}) => {
  const [open, setOpen] = useState(false);
  // Só carrega o corpo quando se abre.
  const { message, isLoading, isError, retry } = useMailMessage(open ? mail : null);

  return (
    <section className="rounded-2xl ring-1 ring-rz-line">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left hover:bg-rz-canvas"
      >
        <UserAvatar name={nameOf(mail.from)} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <b className="truncate text-[13.5px]">{nameOf(mail.from)}</b>
            {mail.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0 text-rz-muted" />}
            <time className="ml-auto shrink-0 text-[12px] text-rz-muted">
              {format(new Date(mail.date), 'd MMM, HH:mm', { locale: pt })}
            </time>
          </span>
          {!open && (
            <span className="mt-0.5 block truncate text-[12.5px] text-rz-muted">
              {mail.snippet || '(sem texto)'}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'mt-1 h-4 w-4 shrink-0 text-rz-muted transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div className="text-[12.5px]">
            <MailRecipients to={message?.to ?? mail.to} cc={message?.cc ?? []} onWrite={onWrite} />
          </div>
          {isError && !message ? (
            <div
              role="alert"
              className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200"
            >
              <span className="flex-1">
                Não foi possível carregar o email completo. Tente outra vez.
              </span>
              <button
                type="button"
                onClick={retry}
                className="h-9 rounded-full bg-rz-primary px-4 text-[13px] font-bold text-white"
              >
                Tentar outra vez
              </button>
            </div>
          ) : isLoading || !message ? (
            <p className="mt-3 flex items-center gap-2 text-[12.5px] text-rz-muted">
              <Loader2 className="h-4 w-4 animate-spin text-rz-primary" /> A abrir…
            </p>
          ) : (
            <MailBody
              message={message}
              onDownload={onDownload}
              onOpenAttachment={onOpenAttachment}
            />
          )}
        </div>
      )}
    </section>
  );
};
