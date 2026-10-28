import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CheckCircle2, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RichText } from '../RichText';
import type { Notice } from '../../types';

interface NoticeCardProps {
  notice: Notice;
  onConfirm: (notice: Notice) => void;
}

/** Comunicado dos RH no Feed, com confirmação de leitura (briefing §12). */
export const NoticeCard: React.FC<NoticeCardProps> = ({ notice, onConfirm }) => (
  <article
    className={cn(
      'rz-rise relative overflow-hidden rounded-[28px] p-5 ring-1',
      notice.read
        ? 'bg-white shadow-rz-soft ring-rz-line'
        : 'bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-rz-soft ring-amber-200'
    )}
  >
    <header className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
        <Megaphone className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
          Comunicado dos RH
        </p>
        <p className="text-[12.5px] text-rz-muted">
          {format(new Date(notice.createdAt), "d 'de' MMMM 'às' HH:mm", { locale: pt })}
        </p>
      </div>
    </header>
    <h3 className="mt-3 text-[17px] font-bold">{notice.title}</h3>
    <RichText
      text={notice.message}
      className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-rz-ink/90"
    />
    <div className="mt-4">
      {notice.read ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> Leitura confirmada
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onConfirm(notice)}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-amber-500 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600"
        >
          <CheckCircle2 className="h-4 w-4" /> Confirmar leitura
        </button>
      )}
    </div>
  </article>
);
