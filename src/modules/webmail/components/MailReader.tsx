import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  ArrowLeft,
  Forward,
  Loader2,
  Reply,
  ReplyAll,
  Star,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { useMailThread } from '../hooks/useMailbox';
import { nameOf } from '../lib/mailFormat';
import { printMail } from '../lib/printMail';
import type { MailAddress, MailAttachmentInfo, MailMessage, MailSummary } from '../types';
import type { MoveTarget } from '../hooks/useFolderActions';
import type { MailAccount, MailLabel } from '../types';
import { MailBody } from './MailBody';
import { LabelChips } from './LabelChips';
import { LabelPicker } from './LabelPicker';
import { MoveToFolder } from './MoveToFolder';
import { ReaderMoreMenu } from './ReaderMoreMenu';
import { AddressChip, MailRecipients } from './MailRecipients';
import { ThreadItem } from './ThreadItem';

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
  { action: 'trash', label: 'Lixo', icon: Trash2 },
];

interface MailReaderProps {
  summary: MailSummary;
  message: MailMessage | null;
  isLoading: boolean;
  /** Não abriu (rede, servidor de email lento): mostra o aviso e o botão para repetir. */
  isError?: boolean;
  onRetry?: () => void;
  onBack: () => void;
  onAction: (action: ReaderAction) => void;
  onDownload: (message: MailMessage, attachmentId: string) => void;
  /** Abrir o anexo dentro do Realize (pré-visualização). */
  onOpenAttachment: (message: MailMessage, attachment: MailAttachmentInfo) => void;
  /** Carregar numa pessoa do cabeçalho: email novo para ela. */
  onWrite?: (address: MailAddress) => void;
  /** Caixas (para a janela "Nova pasta" do Mover para) e a ação de mover. */
  accounts: MailAccount[];
  onMove: (mails: MailSummary[], target: MoveTarget) => void;
  /** Marcadores: todos por id, os desta caixa e as ações. */
  labelsById?: Map<string, MailLabel>;
  labels?: MailLabel[];
  onLabel?: (mails: MailSummary[], label: MailLabel) => void;
  onManageLabels?: (accountId: string) => void;
}

/** Ler um email: cabeçalho, ações (incl. tarefa/evento), corpo isolado num iframe e anexos. */
export const MailReader: React.FC<MailReaderProps> = ({
  summary,
  message,
  isLoading,
  isError = false,
  onRetry,
  onBack,
  onAction,
  onDownload,
  onOpenAttachment,
  onWrite,
  accounts,
  onMove,
  labelsById,
  labels = [],
  onLabel,
  onManageLabels,
}) => {
  const thread = useMailThread(summary);
  // A conversa, a resposta mais recente em cima; sem outras mensagens, só o email aberto.
  const conversation = thread.some(m => m.id === summary.id) ? [...thread].reverse() : [];
  const others = conversation.filter(m => m.id !== summary.id).length;
  // Se o email aberto não for o mais recente, a vista vai até ele.
  const currentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (others > 0) currentRef.current?.scrollIntoView({ block: 'start' });
  }, [summary.id, others]);

  const current = (
    <>
      <div className="mt-4 flex items-start gap-3">
        <UserAvatar name={nameOf(summary.from)} size="md" />
        <div className="min-w-0 flex-1 text-[13px]">
          <p className="truncate">
            {summary.from ? (
              <AddressChip
                address={summary.from}
                onWrite={onWrite}
                className="text-[14px] font-bold"
              />
            ) : (
              <b className="text-[14px]">{nameOf(summary.from)}</b>
            )}{' '}
            <span className="text-rz-muted">{summary.from?.email}</span>
          </p>
          <MailRecipients to={message?.to ?? summary.to} cc={message?.cc ?? []} onWrite={onWrite} />
        </div>
        <time className="shrink-0 text-[12px] text-rz-muted">
          {format(new Date(summary.date), 'd MMM yyyy, HH:mm', { locale: pt })}
        </time>
      </div>

      {isError && !message ? (
        <div className="mt-5 space-y-3">
          {summary.snippet && (
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-rz-ink/80">
              {summary.snippet}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
            <span className="flex-1">
              Não foi possível abrir este email (o servidor de email está lento a responder).
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="h-9 rounded-full bg-rz-primary px-4 text-[13px] font-bold text-white"
              >
                Tentar outra vez
              </button>
            )}
          </div>
        </div>
      ) : isLoading || !message ? (
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
        <MailBody message={message} onDownload={onDownload} onOpenAttachment={onOpenAttachment} />
      )}
    </>
  );

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
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
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
          {onLabel && (
            <LabelPicker
              mails={[summary]}
              labels={labels}
              onToggle={onLabel}
              onManage={id => onManageLabels?.(id)}
              withLabel
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
            />
          )}
          <MoveToFolder
            mails={[summary]}
            accounts={accounts}
            onMove={onMove}
            withLabel
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
          />
          <ReaderMoreMenu
            canPrint={!!message}
            // Imprimir trata-se aqui (só precisa do email aberto).
            onAction={action =>
              action === 'print' ? message && printMail(message) : onAction(action)
            }
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-rz-muted outline-none hover:bg-rz-canvas hover:text-rz-ink"
          />
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
        {summary.forwarded && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-rz-primary">
            <Forward className="h-3.5 w-3.5" /> Reencaminhado
          </p>
        )}
        {labelsById && (
          <LabelChips labelIds={summary.labelIds} byId={labelsById} max={8} className="mt-2" />
        )}
        {others > 0 && (
          <p className="mt-2 text-[12.5px] font-semibold text-rz-muted">
            Conversa com {others + 1} mensagens · abra as anteriores para as ler
          </p>
        )}
        {conversation.length > 1 ? (
          <div className="mt-4 space-y-2">
            {conversation.map(mail =>
              mail.id === summary.id ? (
                <div
                  key={mail.id}
                  ref={currentRef}
                  className="scroll-mt-4 rounded-2xl px-4 pb-4 pt-3 ring-2 ring-rz-primary/25"
                >
                  {current}
                </div>
              ) : (
                <ThreadItem
                  key={mail.id}
                  mail={mail}
                  onDownload={onDownload}
                  onOpenAttachment={onOpenAttachment}
                  onWrite={onWrite}
                />
              )
            )}
          </div>
        ) : (
          current
        )}
      </div>
    </article>
  );
};
