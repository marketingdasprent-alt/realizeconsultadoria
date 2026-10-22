import React, { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarPlus,
  Forward,
  ListChecks,
  Loader2,
  MailOpen,
  Printer,
  Reply,
  ReplyAll,
  Star,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { formatAddressList, nameOf, readerDocument } from '../lib/mailFormat';
import { printMail } from '../lib/printMail';
import type { MailAttachmentInfo, MailMessage, MailSummary } from '../types';
import { AttachmentThumb } from './AttachmentThumb';

export type ReaderAction =
  | 'reply'
  | 'replyAll'
  | 'forward'
  | 'star'
  | 'trash'
  | 'unread'
  | 'task'
  | 'event'
  | 'print';

const TOOLBAR: { action: ReaderAction; label: string; icon: LucideIcon }[] = [
  { action: 'reply', label: 'Responder', icon: Reply },
  { action: 'replyAll', label: 'Responder a todos', icon: ReplyAll },
  { action: 'forward', label: 'Reencaminhar', icon: Forward },
  { action: 'task', label: 'Criar tarefa', icon: ListChecks },
  { action: 'event', label: 'Criar evento', icon: CalendarPlus },
  { action: 'unread', label: 'Marcar como não lido', icon: MailOpen },
  { action: 'print', label: 'Imprimir', icon: Printer },
  { action: 'trash', label: 'Lixo', icon: Trash2 },
];

interface MailReaderProps {
  summary: MailSummary;
  message: MailMessage | null;
  isLoading: boolean;
  onBack: () => void;
  onAction: (action: ReaderAction) => void;
  onDownload: (attachmentId: string) => void;
  /** Abrir o anexo dentro do Realize (pré-visualização). */
  onOpenAttachment: (attachment: MailAttachmentInfo) => void;
}

/** Ler um email: cabeçalho, ações (incl. tarefa/evento), corpo isolado num iframe e anexos. */
export const MailReader: React.FC<MailReaderProps> = ({
  summary,
  message,
  isLoading,
  onBack,
  onAction,
  onDownload,
  onOpenAttachment,
}) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(320);
  // A altura acompanha o conteúdo (imagens que chegam depois, coluna mais estreita) e os emails
  // mais largos do que a coluna (ex.: tabelas de 600 px) encolhem para caber, sem barras.
  const fit = () => {
    const iframe = frame.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc?.body) return;
    const body = doc.body as HTMLElement & { style: CSSStyleDeclaration & { zoom: string } };
    body.style.zoom = '1';
    const available = iframe.clientWidth;
    const wide = doc.documentElement.scrollWidth;
    body.style.zoom = String(wide > available + 2 ? Math.max(0.45, available / wide) : 1);
    setHeight(Math.max(160, Math.ceil(doc.documentElement.scrollHeight) + 8));
  };
  const onFrameLoad = () => {
    fit();
    const doc = frame.current?.contentDocument;
    doc?.querySelectorAll('img').forEach(img => img.addEventListener('load', fit, { once: true }));
  };
  useEffect(() => {
    const iframe = frame.current;
    if (!iframe || typeof ResizeObserver === 'undefined') return;
    let last = iframe.clientWidth;
    const observer = new ResizeObserver(() => {
      if (iframe.clientWidth === last) return;
      last = iframe.clientWidth;
      fit();
    });
    observer.observe(iframe);
    return () => observer.disconnect();
  }, [message]);

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
              onClick={() =>
                // Imprimir trata-se aqui (só precisa do email aberto).
                action === 'print' ? message && printMail(message) : onAction(action)
              }
              disabled={action === 'print' && !message}
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
              onLoad={onFrameLoad}
              style={{ height }}
              className="mt-5 w-full border-0"
            />
            {message.attachments.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {message.attachments.map((attachment, index) => (
                  <li key={attachment.id}>
                    <AttachmentThumb
                      accountId={message.accountId}
                      messageId={message.id}
                      attachment={attachment}
                      withPreview={index < 6}
                      onOpen={() => onOpenAttachment(attachment)}
                      onDownload={() => onDownload(attachment.id)}
                    />
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
