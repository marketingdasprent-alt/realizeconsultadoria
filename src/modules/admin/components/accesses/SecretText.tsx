import React, { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_BUTTON =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink';

/** Botão de copiar com o ✓ durante 2 s. */
export const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  const copy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem acesso à área de transferência (browser antigo / sem permissão).
    }
  };
  return (
    <button type="button" onClick={copy} className={ICON_BUTTON} aria-label={label} title={label}>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
};

/** Texto copiável (ex.: o utilizador). */
export const CopyText: React.FC<{ value: string; className?: string }> = ({ value, className }) => (
  <span className={cn('flex min-w-0 items-center gap-1', className)}>
    <span className="truncate font-mono text-[12.5px]">{value}</span>
    <CopyButton value={value} label="Copiar" />
  </span>
);

/** Palavra-passe escondida, com mostrar e copiar. */
export const SecretText: React.FC<{ value: string; className?: string }> = ({
  value,
  className,
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <span className={cn('flex min-w-0 items-center gap-1', className)}>
      <span className="truncate font-mono text-[12.5px]">{visible ? value : '••••••••'}</span>
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          setVisible(current => !current);
        }}
        className={ICON_BUTTON}
        aria-label={visible ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <CopyButton value={value} label="Copiar palavra-passe" />
    </span>
  );
};
