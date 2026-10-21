import React, { useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, Loader2 } from 'lucide-react';
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

/**
 * Palavra-passe escondida, com mostrar e copiar. Está cifrada na BD: só se vai buscar (load)
 * ao clicar, e fica em memória enquanto a linha estiver aberta.
 */
export const SecretText: React.FC<{
  load: () => Promise<string | null>;
  className?: string;
  /** O que é (para os botões): palavra-passe, PIN, PUK. */
  what?: string;
}> = ({ load, className, what = 'palavra-passe' }) => {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const pending = useRef<Promise<string | null> | null>(null);

  const fetchValue = () => {
    if (value !== null) return Promise.resolve(value);
    pending.current ??= load().then(result => {
      pending.current = null;
      setValue(result);
      return result;
    });
    return pending.current;
  };

  const toggle = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (visible) return setVisible(false);
    setBusy(true);
    await fetchValue();
    setBusy(false);
    setVisible(true);
  };

  const copy = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      // Safari só deixa copiar no próprio clique: passa-se a promessa ao ClipboardItem.
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
        const text = fetchValue().then(result => new Blob([result ?? ''], { type: 'text/plain' }));
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': text })]);
      } else {
        await navigator.clipboard.writeText((await fetchValue()) ?? '');
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem acesso à área de transferência (browser antigo / sem permissão).
    }
  };

  return (
    <span className={cn('flex min-w-0 items-center gap-1', className)}>
      <span className="truncate font-mono text-[12.5px]">
        {visible ? (value ?? '—') : '••••••••'}
      </span>
      <button
        type="button"
        onClick={toggle}
        className={ICON_BUTTON}
        aria-label={visible ? `Esconder ${what}` : `Mostrar ${what}`}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : visible ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        type="button"
        onClick={copy}
        className={ICON_BUTTON}
        aria-label={`Copiar ${what}`}
        title={`Copiar ${what}`}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </span>
  );
};
