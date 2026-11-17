import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { cn } from '@/lib/utils';
import { CODE_LENGTH, cleanCode, isValidCode } from '../lib/mfa';

interface MfaCodeFormProps {
  /** Devolve a mensagem de erro para mostrar, ou null se correu bem. */
  onSubmit: (code: string) => Promise<string | null>;
  submitLabel: string;
  /** Aspeto do botão: principal ou de perigo (desativar). */
  tone?: 'primary' | 'danger';
  autoFocus?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** Os 6 dígitos da app de autenticação: escreve-se, cola-se (preenche tudo) e confirma-se. */
export const MfaCodeForm: React.FC<MfaCodeFormProps> = ({
  onSubmit,
  submitLabel,
  tone = 'primary',
  autoFocus = true,
  className,
  children,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // O campo fica bloqueado enquanto verifica: depois de um erro o foco volta a ele (teclado).
  useEffect(() => {
    if (!busy && error) input.current?.focus();
  }, [busy, error]);

  const submit = async (value: string) => {
    if (busy || !isValidCode(value)) return;
    setBusy(true);
    setError(null);
    const message = await onSubmit(value);
    setBusy(false);
    if (message) {
      setError(message);
      setCode('');
    }
  };

  return (
    <form
      className={cn('space-y-3', className)}
      onSubmit={event => {
        event.preventDefault();
        void submit(code);
      }}
    >
      <InputOTP
        ref={input}
        maxLength={CODE_LENGTH}
        // Colar "123 456" (com espaço) também preenche os 6 dígitos
        pasteTransformer={cleanCode}
        value={code}
        onChange={value => {
          setCode(value);
          setError(null);
        }}
        onComplete={value => void submit(value)}
        autoFocus={autoFocus}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="^[0-9]*$"
        disabled={busy}
        aria-label="Código de 6 dígitos"
        aria-invalid={!!error}
        aria-describedby={error ? 'mfa-error' : undefined}
      >
        <InputOTPGroup>
          {Array.from({ length: CODE_LENGTH }, (_, index) => (
            <InputOTPSlot key={index} index={index} className="h-12 w-11 text-lg font-bold" />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error && (
        <p id="mfa-error" role="alert" className="text-[13px] font-semibold text-rose-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy || !isValidCode(code)}
          className={cn(
            'inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[14px] font-bold text-white disabled:opacity-50',
            tone === 'danger' ? 'bg-rose-600' : 'bg-rz-primary'
          )}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
        {children}
      </div>
    </form>
  );
};
