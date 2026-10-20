import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Credential, MailboxState, MailboxStatus } from '../../lib/credentials';
import { CopyButton, SecretText } from './SecretText';

interface EmailRowProps {
  credential: Credential;
  department: boolean;
  people: string[];
  mailbox: MailboxStatus | undefined;
  state: MailboxState;
  linking: boolean;
  canManage: boolean;
  onLink: () => void;
  onPeople: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const STATE: Record<MailboxState, { label: string; icon: typeof CheckCircle2; className: string }> =
  {
    linked: { label: 'Ligada', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700' },
    error: { label: 'Com erro', icon: AlertTriangle, className: 'bg-rose-50 text-rose-700' },
    pending: { label: 'Por ligar', icon: CircleDashed, className: 'bg-amber-50 text-amber-800' },
    nobody: { label: 'Sem pessoas', icon: CircleDashed, className: 'bg-rz-canvas text-rz-muted' },
  };

const ACTION =
  'flex h-8 w-8 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink';

/** Uma caixa de email: endereço, de quem é, estado no Webmail e ações. */
export const EmailRow: React.FC<EmailRowProps> = ({
  credential,
  department,
  people,
  mailbox,
  state,
  linking,
  canManage,
  onLink,
  onPeople,
  onEdit,
  onDelete,
}) => {
  const badge = STATE[state];
  const Icon = badge.icon;
  const shown = people.slice(0, 3).join(', ');
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:flex-nowrap">
      <span className="min-w-0 flex-1 basis-56">
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate text-[14px] font-semibold text-rz-ink">
            {credential.username}
          </span>
          <CopyButton value={credential.username} label="Copiar endereço" />
        </span>
        <span className="block truncate text-[12.5px] text-rz-muted">
          {department ? 'Departamental' : 'Pessoal'} · {credential.companies?.name ?? '—'}
        </span>
      </span>

      <span className="min-w-0 basis-44 text-[13px]">
        {people.length === 0 ? (
          <span className="text-rz-muted">Ninguém</span>
        ) : (
          <span className="block truncate" title={people.join(', ')}>
            {shown}
            {people.length > 3 ? ` +${people.length - 3}` : ''}
          </span>
        )}
      </span>

      <SecretText value={credential.password} className="w-[150px] shrink-0" />

      <span className="flex w-[150px] shrink-0 flex-col">
        <span
          className={cn(
            'inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
            badge.className
          )}
          title={mailbox?.last_error ?? undefined}
        >
          <Icon className="h-3.5 w-3.5" /> {badge.label}
        </span>
        {state === 'linked' && mailbox && (
          <span className="mt-0.5 text-[11.5px] text-rz-muted">
            no Webmail de {mailbox.members.length}{' '}
            {mailbox.members.length === 1 ? 'pessoa' : 'pessoas'}
          </span>
        )}
        {state === 'error' && mailbox?.last_error && (
          <span className="mt-0.5 line-clamp-2 text-[11.5px] text-rose-700">
            {mailbox.last_error}
          </span>
        )}
      </span>

      {canManage && (
        <span className="flex shrink-0 items-center gap-0.5">
          {state !== 'nobody' && (
            <button
              type="button"
              onClick={onLink}
              disabled={linking}
              className="mr-1 inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[12.5px] font-semibold ring-1 ring-rz-line hover:bg-rz-canvas disabled:opacity-50"
            >
              {linking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {state === 'linked' ? 'Testar' : state === 'error' ? 'Reparar' : 'Ligar'}
            </button>
          )}
          {department && (
            <button
              type="button"
              onClick={onPeople}
              className={ACTION}
              aria-label="Pessoas"
              title="Pessoas"
            >
              <Users className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className={ACTION}
            aria-label="Editar"
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={cn(ACTION, 'hover:bg-rose-50 hover:text-rose-600')}
            aria-label="Eliminar"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
      )}
    </li>
  );
};
