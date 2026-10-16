import React, { useRef, useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarPlus,
  Forward,
  ListChecks,
  Loader2,
  MailOpen,
  Paperclip,
  Reply,
  ReplyAll,
  Star,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { formatAddressList, nameOf, readerDocument } from '../lib/mailFormat';
import type { MailMessage, MailSummary } from '../types';

export type ReaderAction =
  'reply' | 'replyAll' | 'forward' | 'star' | 'trash' | 'unread' | 'task' | 'event';

const TOOLBAR: { action: ReaderAction; label: string; icon: LucideIcon }[] = [
  { action: 'reply', label: 'Responder', icon: Reply },
  { action: 'replyAll', label: 'Responder a todos', icon: ReplyAll },
  { action: 'forward', label: 'Reencaminhar', icon: Forward },
  { action: 'task', label: 'Criar tarefa', icon: ListChecks },
  { action: 'event', label: 'Criar evento', icon: CalendarPlus },
  { action: 'unread', label: 'Marcar como não lido', icon: MailOpen },
  { action: 'trash', label: 'Lixo', icon: Trash2 },
];

const kb = (size: number) =>
  size > 1_000_000 ? `${(size / 1_000_000).toFixed(1)} MB` : `${Math.ceil(size / 1000)} KB`;

interface MailReaderProps {
  summary: MailSummary;
  message: MailMessage | null;
  isLoading: boolean;
  onBack: () => void;
  onAction: (action: ReaderAction) => void;
  onDownload: (attachmentId: string) => void;
}

/** Ler um email: cabeçalho, ações (incl. tarefa/evento), corpo isolado num iframe e anexos. */
export const MailReader: React.FC<MailReaderProps> = ({
  summary,
  message,
  isLoading,
  onBack,
  onAction,
  onDownload,
}) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(320);
  const fit = () => {
    const doc = frame.current?.contentDocument;
    if (doc) setHeight(Math.max(160, doc.documentElement.scrollHeight + 8));
  };

  return (
    <article className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <div className="flex items-center gap-1 border-b border-rz-line px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-rz-canvas md:hidden"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="scrollbar-hide flex flex-1 items-center gap-0.5 overflow-x-auto">
          {TOOLBAR.map(({ action, label, icon: Icon }) => (
            <button
              key={action}
              type="button"
              onClick={() => onAction(action)}
              title={label}
              aria-label={label}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden 2xl:inline">{label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onAction('star')}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-rz-canvas"
          aria-label={summary.starred ? 'Tirar estrela' : 'Pôr estrela'}
        >
          <Star
            className={cn(
              'h-5 w-5',
              summary.starred ? 'fill-amber-400 text-amber-400' : 'text-rz-muted'
            )}
          />
        </button>
      </div>

      <div className="rz-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-28 pt-5 md:px-8 md:pb-8">
        <h2 className="text-[21px] font-extrabold leading-tight">
          {summary.subject || '(sem assunto)'}
        </h2>
        <div className="mt-4 flex items-start gap-3">
          <UserAvatar name={nameOf(summary.from)} size="md" />
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="truncate">
              <b className="text-[14px]">{nameOf(summary.from)}</b>{' '}
              <span className="text-rz-muted">{summary.from?.email}</span>
            </p>
            <p className="truncate text-rz-muted">
              Para {formatAddressList(message?.to ?? summary.to) || '—'}
              {message?.cc.length ? ` · Cc ${formatAddressList(message.cc)}` : ''}
            </p>
          </div>
          <time className="shrink-0 text-[12px] text-rz-muted">
            {format(new Date(summary.date), 'd MMM yyyy, HH:mm', { locale: pt })}
          </time>
        </div>

        {isLoading || !message ? (
          // Enquanto o corpo chega, o início do email (já conhecido da lista) e um indicador.
          <div className="mt-5 space-y-3">
            {summary.snippet && (
              <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-rz-ink/80">
                {summary.snippet}
              </p>
            )}
            <p className="flex items-center gap-2 text-[12.5px] text-rz-muted">
              <Loader2 className="h-4 w-4 animate-spin text-rz-primary" /> A abrir o email…
            </p>
          </div>
        ) : (
          <>
            <iframe
              ref={frame}
              title="Conteúdo do email"
              // Sem allow-scripts: o HTML do email nunca corre código.
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              srcDoc={readerDocument(message)}
              onLoad={fit}
              style={{ height }}
              className="mt-5 w-full border-0"
            />
            {message.attachments.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {message.attachments.map(attachment => (
                  <li key={attachment.id}>
                    <button
                      type="button"
                      onClick={() => onDownload(attachment.id)}
                      className="flex items-center gap-2 rounded-2xl bg-rz-canvas px-3 py-2 text-left text-[13px] font-semibold hover:bg-rz-primary-soft"
                    >
                      <Paperclip className="h-4 w-4 text-rz-primary" />
                      <span className="max-w-[220px] truncate">{attachment.filename}</span>
                      <span className="text-[11.5px] font-normal text-rz-muted">
                        {kb(attachment.size)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </article>
  );
};
