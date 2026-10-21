import React from 'react';
import { LayoutGrid, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SwitchTarget } from '@/lib/account-switch';
import { useAccountSwitch } from '../hooks/useAccountSwitch';

const LABELS: Record<SwitchTarget, string> = {
  admin: 'Ir para admin',
  workspace: 'Ir para Workspace',
};

interface AccountSwitchButtonProps {
  /** Área onde o botão está (vai para a outra). */
  current: SwitchTarget;
  className?: string;
}

/** Canto superior: passa para a outra área sem voltar a pedir a palavra-passe. */
export const AccountSwitchButton: React.FC<AccountSwitchButtonProps> = ({ current, className }) => {
  const { other, canSwitch, isOpening, open } = useAccountSwitch(current);
  if (!canSwitch) return null;
  const Icon = isOpening ? Loader2 : other === 'admin' ? ShieldCheck : LayoutGrid;

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={isOpening}
      aria-label={LABELS[other]}
      title={LABELS[other]}
      className={cn(
        'flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-[13.5px] font-semibold transition-colors disabled:opacity-70',
        className
      )}
    >
      <Icon className={cn('h-[18px] w-[18px]', isOpening && 'animate-spin')} />
      <span className="hidden sm:inline">{LABELS[other]}</span>
    </button>
  );
};
