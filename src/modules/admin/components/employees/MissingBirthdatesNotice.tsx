import React from 'react';
import { Cake } from 'lucide-react';

interface MissingBirthdatesNoticeProps {
  /** Colaboradores ativos sem data de nascimento na ficha. */
  count: number;
  /** A lista está a mostrar só esses. */
  isFiltering: boolean;
  onToggle: () => void;
}

/** Aviso: quem não tem data de nascimento não entra nos aniversários (Feed, avisos, email). */
export const MissingBirthdatesNotice: React.FC<MissingBirthdatesNoticeProps> = ({
  count,
  isFiltering,
  onToggle,
}) => {
  if (count === 0 && !isFiltering) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[22px] bg-pink-50 px-4 py-3 text-[13.5px] ring-1 ring-pink-200">
      <Cake className="h-4 w-4 shrink-0 text-pink-600" />
      <p className="min-w-0 flex-1">
        <b>
          {count} colaborador{count === 1 ? '' : 'es'} ativo{count === 1 ? '' : 's'} sem data de
          nascimento
        </b>{' '}
        — não aparece{count === 1 ? '' : 'm'} nos aniversários do Feed nem nos avisos.
      </p>
      <button
        type="button"
        onClick={onToggle}
        className="rounded-full bg-white px-3 py-1 text-[13px] font-semibold text-pink-700 ring-1 ring-pink-200 hover:bg-pink-100"
      >
        {isFiltering ? 'Mostrar todos' : 'Ver quem'}
      </button>
    </div>
  );
};
