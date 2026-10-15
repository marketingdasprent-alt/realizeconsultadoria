import React, { useRef, useState } from 'react';
import { Loader2, Paperclip, SendHorizontal } from 'lucide-react';
import { filesFromPaste } from '@/modules/workspace/hooks/useFileDrop';
import { TICKET_FILE_ACCEPT } from '../lib/ticketFiles';
import { TicketFileChips } from './TicketFileChips';

interface TicketReplyBoxProps {
  files: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  isSending: boolean;
  onSend: (text: string) => Promise<boolean>;
}

/** Resposta ao ticket: texto, clipe (ou arrastar/colar) e enviar; só ficheiros também serve. */
export const TicketReplyBox: React.FC<TicketReplyBoxProps> = ({
  files,
  onAddFiles,
  onRemoveFile,
  isSending,
  onSend,
}) => {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const canSend = (text.trim().length > 0 || files.length > 0) && !isSending;

  const send = async () => {
    if (!canSend) return;
    if (await onSend(text)) setText('');
  };

  return (
    <div className="space-y-2 rounded-[24px] bg-white p-1.5 shadow-rz-soft ring-1 ring-rz-line focus-within:ring-rz-primary/40">
      {files.length > 0 && (
        <div className="px-2 pt-1.5">
          <TicketFileChips files={files} onRemove={onRemoveFile} />
        </div>
      )}
      <div className="flex items-end gap-1">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rz-muted transition-colors hover:bg-rz-canvas hover:text-rz-primary"
          aria-label="Anexar ficheiros"
          title="Anexar ficheiros (imagens ou PDF)"
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
            onAddFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
        <textarea
          value={text}
          onChange={event => setText(event.target.value)}
          onPaste={event => {
            const pasted = filesFromPaste(event);
            if (!pasted.length) return;
            event.preventDefault();
            onAddFiles(pasted);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          rows={Math.min(5, Math.max(1, text.split('\n').length))}
          placeholder="Escreva a sua resposta…"
          className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-[14.5px] outline-none placeholder:text-rz-muted"
          aria-label="Resposta"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!canSend}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rz-primary text-white disabled:opacity-40"
          aria-label="Enviar resposta"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
    </div>
  );
};
