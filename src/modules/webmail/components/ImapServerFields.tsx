import React from 'react';
import { AlertTriangle, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import type { Discovery } from '../lib/autodiscover';
import { SUPPORTED_SMTP_PORT } from '../lib/providers';

export type ImapForm = Record<
  'email' | 'password' | 'imapHost' | 'imapPort' | 'smtpHost' | 'smtpPort',
  string
>;

export const FIELD =
  'h-11 w-full rounded-2xl bg-rz-canvas px-4 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40';

const SOURCE_TEXT: Record<Discovery['source'], string | null> = {
  known: 'Servidores preenchidos automaticamente.',
  ispdb: 'Servidores encontrados automaticamente.',
  mx: 'Servidores encontrados pelo alojamento do domínio.',
  guess: null,
};

interface ImapServerFieldsProps {
  form: ImapForm;
  onChange: (key: keyof ImapForm, value: string) => void;
  open: boolean;
  onToggle: () => void;
  isSearching: boolean;
  /** De onde vieram os servidores (descoberta automática), se vieram. */
  source: Discovery['source'] | null;
}

/** Servidores IMAP/SMTP (escondidos por omissão quando a descoberta os encontra). */
export const ImapServerFields: React.FC<ImapServerFieldsProps> = ({
  form,
  onChange,
  open,
  onToggle,
  isSearching,
  source,
}) => {
  const smtpBlocked = Number(form.smtpPort) !== SUPPORTED_SMTP_PORT;
  const field = (key: keyof ImapForm, placeholder: string, numeric = false) => (
    <input
      value={form[key]}
      onChange={e => onChange(key, e.target.value)}
      placeholder={placeholder}
      inputMode={numeric ? 'numeric' : undefined}
      aria-label={placeholder}
      className={FIELD}
    />
  );

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-1 text-[13px] font-bold text-rz-primary"
        >
          Servidores <ChevronDown className={`h-4 w-4 ${open ? 'rotate-180' : ''}`} />
        </button>
        {isSearching ? (
          <span className="flex items-center gap-1.5 text-[12px] text-rz-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> A procurar os servidores…
          </span>
        ) : (
          source &&
          SOURCE_TEXT[source] && (
            <span className="flex items-center gap-1.5 text-right text-[12px] text-rz-muted">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-500" /> {SOURCE_TEXT[source]}
            </span>
          )
        )}
      </div>
      {open && (
        <div className="grid grid-cols-[1fr_88px] gap-2">
          {field('imapHost', 'Servidor IMAP')}
          {field('imapPort', 'Porta IMAP', true)}
          {field('smtpHost', 'Servidor SMTP')}
          {field('smtpPort', 'Porta SMTP', true)}
        </div>
      )}
      {smtpBlocked && (
        <p className="flex gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />O envio só funciona por SMTP com SSL
          na porta {SUPPORTED_SMTP_PORT}. Se o seu fornecedor só aceita a porta {form.smtpPort},
          ainda não é possível ligar esta caixa.
        </p>
      )}
    </>
  );
};
