import React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Link2, Monitor, Pencil, Power, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { boxState, postoState } from '../../lib/mailPostos';
import type { MailPosto } from '../../services/mailPostosService';

interface MailPostoRowProps {
  posto: MailPosto;
  busy: boolean;
  onInvite: (posto: MailPosto) => void;
  onEdit: (posto: MailPosto) => void;
  onToggle: (posto: MailPosto) => void;
  onDelete: (posto: MailPosto) => void;
}

const TONE = {
  ok: 'bg-emerald-50 text-emerald-700',
  wait: 'bg-amber-50 text-amber-700',
  error: 'bg-rose-50 text-rose-700',
} as const;

const ACTION =
  'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold ring-1 disabled:opacity-40';

const stateText = (posto: MailPosto) => {
  switch (postoState(posto)) {
    case 'disabled':
      return 'Desligado: a app deste posto deixou de abrir.';
    case 'active':
      return `Último acesso ${formatDistanceToNowStrict(new Date(posto.lastLoginAt as string), { locale: pt, addSuffix: true })}`;
    case 'invited':
      return `À espera de instalar. Link válido até ${new Date(posto.inviteExpiresAt as string).toLocaleDateString('pt-PT')}`;
    default:
      return 'Sem link enviado. Gere um link para instalar.';
  }
};

/** Um posto de email: nome, estado, caixas e as ações (link, mudar, desligar, apagar). */
export const MailPostoRow: React.FC<MailPostoRowProps> = ({
  posto,
  busy,
  onInvite,
  onEdit,
  onToggle,
  onDelete,
}) => {
  const disabled = !!posto.disabledAt;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 border-b border-rz-line px-4 py-3 last:border-0',
        disabled && 'opacity-60'
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rz-canvas text-rz-muted">
        <Monitor className="h-5 w-5" />
      </span>
      <div className="min-w-[220px] flex-1">
        <p className="truncate text-[14.5px] font-bold">
          {posto.name}
          {disabled && (
            <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
              Desligado
            </span>
          )}
        </p>
        <p className="text-[12px] text-rz-muted">{stateText(posto)}</p>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {posto.boxes.map(box => {
            const state = boxState(box);
            return (
              <li
                key={box.accessId}
                title={box.lastError ?? undefined}
                className={cn(
                  'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
                  TONE[state.tone]
                )}
              >
                <span className="truncate">{box.email}</span>
                <span className="font-normal opacity-80">· {state.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => onInvite(posto)}
        disabled={busy || disabled}
        className={cn(ACTION, 'border-0 bg-rz-primary text-white ring-0')}
      >
        <Link2 className="h-4 w-4" />{' '}
        {posto.lastLoginAt || posto.inviteExpiresAt ? 'Novo link' : 'Gerar link'}
      </button>
      <button
        type="button"
        onClick={() => onEdit(posto)}
        disabled={busy}
        className={cn(ACTION, 'text-rz-muted ring-rz-line hover:bg-rz-canvas')}
      >
        <Pencil className="h-4 w-4" /> Caixas
      </button>
      <button
        type="button"
        onClick={() => onToggle(posto)}
        disabled={busy}
        className={cn(
          ACTION,
          disabled
            ? 'text-emerald-700 ring-emerald-200 hover:bg-emerald-50'
            : 'text-rose-600 ring-rose-200 hover:bg-rose-50'
        )}
      >
        <Power className="h-4 w-4" /> {disabled ? 'Religar' : 'Desligar'}
      </button>
      <button
        type="button"
        onClick={() => onDelete(posto)}
        disabled={busy}
        aria-label={`Apagar o posto ${posto.name}`}
        title="Apagar o posto"
        className={cn(ACTION, 'px-2.5 text-rose-600 ring-rose-200 hover:bg-rose-50')}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
};
