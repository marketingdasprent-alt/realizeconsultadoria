import React, { useState } from 'react';
import { Captions, ChevronDown, ChevronUp, Copy, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTranscripts } from '../../hooks/useTranscripts';
import type { ChatMessage } from '../../types';

/** Botão "Transcrever" de uma mensagem de voz e o texto, partilhado por quem está na conversa. */
export const AudioTranscript: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const [open, setOpen] = useState(true);
  const { transcripts, isLoading, transcribe } = useTranscripts(
    message.conversationId,
    !!message.attachment?.path
  );
  const mine = message.isMine;
  if (!message.attachment?.path || message.pending || message.deleted) return null;

  const text = transcripts[message.id];
  const busy = transcribe.isPending && transcribe.variables === message.id;
  const muted = mine ? 'text-white/80 hover:text-white' : 'text-rz-muted hover:text-rz-ink';

  if (text === undefined) {
    return (
      <button
        type="button"
        onClick={() => transcribe.mutate(message.id)}
        disabled={busy || isLoading}
        className={cn(
          'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold',
          mine ? 'bg-white/15 hover:bg-white/25' : 'bg-rz-canvas hover:bg-rz-line/60',
          'disabled:opacity-60'
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Captions className="h-3.5 w-3.5" />
        )}
        {busy ? 'A transcrever… (pode demorar)' : 'Transcrever'}
      </button>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Texto copiado' });
    } catch {
      toast({ title: 'Não foi possível copiar', variant: 'destructive' });
    }
  };

  return (
    <span className="mt-2 block">
      <span className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.08em] opacity-80">
        <Captions className="h-3.5 w-3.5" /> Transcrição
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          aria-label={open ? 'Ocultar a transcrição' : 'Mostrar a transcrição'}
          className={cn('ml-auto flex h-6 w-6 items-center justify-center rounded-full', muted)}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {text && (
          <button
            type="button"
            onClick={() => void copy()}
            aria-label="Copiar a transcrição"
            title="Copiar"
            className={cn('flex h-6 w-6 items-center justify-center rounded-full', muted)}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
      {open && (
        <span className="mt-1 block whitespace-pre-wrap break-words text-[14px] leading-snug">
          {text || 'Não se percebeu fala neste áudio.'}
        </span>
      )}
    </span>
  );
};
