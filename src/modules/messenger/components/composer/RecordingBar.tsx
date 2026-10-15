import React from 'react';
import { SendHorizontal, Trash2 } from 'lucide-react';
import { formatDuration } from '../../lib/format';

interface RecordingBarProps {
  seconds: number;
  onCancel: () => void;
  onSend: () => void;
}

/** A gravar uma mensagem de voz: cronómetro, descartar e enviar. */
export const RecordingBar: React.FC<RecordingBarProps> = ({ seconds, onCancel, onSend }) => (
  <div className="flex flex-1 items-center gap-3 px-1">
    <button
      type="button"
      onClick={onCancel}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rose-500 transition-colors hover:bg-rose-50"
      aria-label="Descartar gravação"
    >
      <Trash2 className="h-5 w-5" />
    </button>
    <span className="relative flex h-3 w-3">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
    </span>
    <span className="flex-1 text-[14.5px] font-semibold tabular-nums">
      A gravar… {formatDuration(seconds)}
    </span>
    <button
      type="button"
      onClick={onSend}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rz-primary text-white shadow-[0_8px_18px_-8px_hsl(var(--rz-primary))] transition-transform hover:scale-105"
      aria-label="Enviar mensagem de voz"
    >
      <SendHorizontal className="h-[18px] w-[18px]" />
    </button>
  </div>
);
