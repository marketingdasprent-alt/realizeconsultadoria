import React from 'react';
import { Globe, KeyRound, Mail, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AccessKind } from '../../../lib/credentials';

const KINDS: { kind: AccessKind; label: string; hint: string; icon: typeof Mail }[] = [
  { kind: 'email_personal', label: 'Email pessoal', hint: 'De um colaborador', icon: Mail },
  {
    kind: 'email_department',
    label: 'Email departamental',
    hint: 'Partilhado por várias pessoas',
    icon: UsersRound,
  },
  { kind: 'site', label: 'Site ou sistema', hint: 'Login de um site ou programa', icon: Globe },
  { kind: 'other', label: 'Outro', hint: 'Servidor, base de dados, VPN…', icon: KeyRound },
];

/** Primeiro passo do painel: o tipo de acesso (os campos mudam conforme o tipo). */
export const KindPicker: React.FC<{ value: AccessKind; onChange: (kind: AccessKind) => void }> = ({
  value,
  onChange,
}) => (
  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de acesso">
    {KINDS.map(({ kind, label, hint, icon: Icon }) => (
      <button
        key={kind}
        type="button"
        role="radio"
        aria-checked={value === kind}
        onClick={() => onChange(kind)}
        className={cn(
          'flex items-start gap-2 rounded-2xl p-3 text-left ring-1 transition-colors',
          value === kind
            ? 'bg-rz-primary-soft ring-rz-primary'
            : 'bg-white ring-rz-line hover:bg-rz-canvas'
        )}
      >
        <Icon
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0',
            value === kind ? 'text-rz-primary' : 'text-rz-muted'
          )}
        />
        <span>
          <span className="block text-[13.5px] font-semibold text-rz-ink">{label}</span>
          <span className="block text-[12px] text-rz-muted">{hint}</span>
        </span>
      </button>
    ))}
  </div>
);
