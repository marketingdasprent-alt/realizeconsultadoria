import React, { useRef, useState } from 'react';
import { Loader2, Paperclip, SendHorizontal } from 'lucide-react';
import { TicketFileChips } from '@/modules/support/components/TicketFileChips';
import type { useTicketFiles } from '@/modules/support/hooks/useTicketFiles';
import { TICKET_FILE_ACCEPT } from '@/modules/support/lib/ticketFiles';
import { filesFromPaste } from '@/modules/workspace/hooks/useFileDrop';

interface TicketReplyComposerProps {
  employeeName: string;
  /** Escolhidos aqui ou largados em qualquer parte do ticket. */
  files: ReturnType<typeof useTicketFiles>;
  onReply: (message: string, files: File[]) => Promise<boolean>;
  disabled?: boolean;
}

/** Caixa de resposta do suporte: texto e anexos (clipe ou colar; arrastar é no ticket todo). */
export const TicketReplyComposer: React.FC<TicketReplyComposerProps> = ({
  employeeName,
  files,
  onReply,
  disabled,
}) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const canSend = (text.trim().length > 0 || files.files.length > 0) && !sending && !disabled;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    if (await onReply(text.trim(), files.files)) {
      setText('');
      files.clear();
    }
    setSending(false);
  };

  return (
    <div className="rounded-[22px] bg-white p-1.5 ring-1 ring-rz-line focus-within:ring-rz-primary/40">
      {files.files.length > 0 && (
        <div className="px-2 pt-1.5">
          <TicketFileChips files={files.files} onRemove={files.remove} />
        </div>
      )}
      <textarea
        value={text}
        onChange={event => setText(event.target.value)}
        onPaste={event => {
          const pasted = filesFromPaste(event);
          if (!pasted.length) return;
          event.preventDefault();
          files.add(pasted);
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void send();
          }
        }}
        disabled={disabled}
        rows={3}
        placeholder={`Responder a ${employeeName.split(' ')[0]}… (Ctrl+Enter envia)`}
        className="w-full resize-none bg-transparent px-3 py-2 text-[14px] outline-none placeholder:text-rz-muted"
      />
      <div className="flex items-center gap-2 px-1 pb-1">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-primary"
          aria-label="Anexar ficheiros"
          title="Anexar ficheiros (imagens ou PDF, até 10 MB)"
        >
          <Paperclip className="h-[18px] w-[18px]" />
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={TICKET_FILE_ACCEPT}
          className="hidden"
          onChange={event => {
            files.add(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
        <p className="min-w-0 flex-1 text-[11.5px] text-rz-muted">
          O colaborador recebe a resposta na app e por email.
        </p>
        <button
          type="button"
          onClick={() => void send()}
          disabled={!canSend}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-rz-primary px-4 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
          Responder
        </button>
      </div>
    </div>
  );
};
