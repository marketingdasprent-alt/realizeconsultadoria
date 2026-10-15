import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAttachmentUrl } from '../../hooks/useAttachmentUrl';
import { formatDuration } from '../../lib/format';
import type { ChatMessage } from '../../types';

// Barras da onda (desenho fixo; acendem-se à medida que o áudio avança).
const WAVE = [6, 10, 16, 12, 20, 14, 8, 18, 22, 12, 9, 16, 20, 11, 7, 14, 18, 10, 6, 12, 15, 9];

/** Mensagem de voz: tocar/pausar, progresso na onda e duração. */
export const AudioAttachment: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const url = useAttachmentUrl(message);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const mine = message.isMine;
  const duration = message.durationSec ?? 0;
  // A carregar o URL temporário (sem caminho, como nos exemplos, fica só desativado).
  const isWaiting = !url && (!!message.attachment?.path || !!message.pending);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    const onEnd = () => {
      setIsPlaying(false);
      setProgress(0);
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, [url]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  return (
    <span className="flex items-center gap-3">
      {url && <audio ref={audioRef} src={url} preload="metadata" />}
      <button
        type="button"
        onClick={toggle}
        disabled={!url || message.pending}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 disabled:opacity-60',
          mine ? 'bg-white text-rz-primary' : 'bg-rz-primary text-white'
        )}
        aria-label={isPlaying ? 'Pausar' : 'Ouvir'}
      >
        {isWaiting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        )}
      </button>
      <span className="flex h-6 items-center gap-[3px]" aria-hidden>
        {WAVE.map((height, index) => (
          <span
            key={index}
            className={cn(
              'w-[3px] rounded-full transition-colors',
              index / WAVE.length < progress
                ? mine
                  ? 'bg-white'
                  : 'bg-rz-primary'
                : mine
                  ? 'bg-white/45'
                  : 'bg-rz-primary/35'
            )}
            style={{ height }}
          />
        ))}
      </span>
      <span className="text-xs tabular-nums opacity-80">{formatDuration(duration)}</span>
    </span>
  );
};
