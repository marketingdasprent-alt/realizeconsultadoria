import React from 'react';
import { SquarePen } from 'lucide-react';

interface MessengerEmptyStateProps {
  onNewConversation: () => void;
  /** Aviso enquanto o Messenger não tem servidor (Fase 2). */
  notice?: string;
}

/** Ilustração de balões de conversa (só SVG, sem imagens externas); aparece uma vez por página. */
const Illustration: React.FC = () => (
  <svg viewBox="0 0 260 190" className="h-44 w-auto" aria-hidden>
    <defs>
      <linearGradient id="rz-empty-violet" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8B5CF6" />
        <stop offset="1" stopColor="#4F46E5" />
      </linearGradient>
      <linearGradient id="rz-empty-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FCD34D" />
        <stop offset="1" stopColor="#F59E0B" />
      </linearGradient>
      <linearGradient id="rz-empty-sky" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7DD3FC" />
        <stop offset="1" stopColor="#3B82F6" />
      </linearGradient>
    </defs>
    <circle cx="130" cy="98" r="84" fill="#EDE9FE" opacity="0.7" />
    <rect x="34" y="34" width="132" height="62" rx="24" fill="url(#rz-empty-violet)" />
    <path d="M58 92 L52 112 L78 94 Z" fill="#5B4BE8" />
    <rect x="56" y="54" width="70" height="9" rx="4.5" fill="#fff" opacity="0.9" />
    <rect x="56" y="70" width="46" height="9" rx="4.5" fill="#fff" opacity="0.55" />
    <rect
      x="104"
      y="104"
      width="122"
      height="56"
      rx="22"
      fill="#fff"
      stroke="#E4E1F5"
      strokeWidth="2"
    />
    <path d="M200 156 L210 174 L184 158 Z" fill="#fff" stroke="#E4E1F5" strokeWidth="2" />
    <circle cx="136" cy="132" r="7" fill="url(#rz-empty-sky)" />
    <circle cx="160" cy="132" r="7" fill="url(#rz-empty-violet)" />
    <circle cx="184" cy="132" r="7" fill="url(#rz-empty-gold)" />
    <circle cx="208" cy="46" r="16" fill="url(#rz-empty-gold)" />
    <path
      d="M208 38 l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"
      fill="#fff"
    />
    <circle cx="36" cy="138" r="10" fill="url(#rz-empty-sky)" opacity="0.85" />
    <circle cx="232" cy="96" r="5" fill="#C4B5FD" />
    <circle cx="20" cy="74" r="4" fill="#FCD34D" />
  </svg>
);

/** Área de conversa sem nada selecionado (briefing §5: estado vazio elegante e funcional). */
export const MessengerEmptyState: React.FC<MessengerEmptyStateProps> = ({
  onNewConversation,
  notice,
}) => (
  <div className="rz-rise flex flex-1 flex-col items-center justify-center px-6 text-center">
    <Illustration />
    <h2 className="mt-6 text-xl font-extrabold">Selecione uma conversa</h2>
    <p className="mt-1.5 max-w-sm text-sm text-rz-muted">
      Fale com colegas, grupos e canais da organização — tudo em tempo real.
    </p>
    <button
      type="button"
      onClick={onNewConversation}
      className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-semibold text-white shadow-[0_12px_24px_-12px_hsl(var(--rz-primary))] transition-transform hover:scale-[1.03]"
    >
      <SquarePen className="h-4 w-4" /> Nova conversa
    </button>
    {notice && (
      <p className="mt-6 max-w-sm rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
        {notice}
      </p>
    )}
  </div>
);
