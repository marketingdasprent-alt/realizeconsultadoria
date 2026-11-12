import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Headset, PenLine, Power } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';
import { RzSelect } from '@/modules/workspace/components/RzSelect';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import type { MailClient } from '../../services/mailClientsService';

interface MailClientRowProps {
  client: MailClient;
  companies: { id: string; name: string }[];
  onCompany: (client: MailClient, companyId: string | null) => void;
  onSignatures: (client: MailClient) => void;
  onToggle: (client: MailClient) => void;
}

const ago = (iso: string | null) =>
  iso ? formatDistanceToNowStrict(new Date(iso), { locale: pt, addSuffix: true }) : 'nunca';

/** Um cliente da Realize Mail: quem é, a empresa, as caixas, os tickets e as ações. */
export const MailClientRow: React.FC<MailClientRowProps> = ({
  client,
  companies,
  onCompany,
  onSignatures,
  onToggle,
}) => {
  const disabled = !!client.disabledAt;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 border-b border-rz-line px-4 py-3 last:border-0',
        disabled && 'opacity-60'
      )}
    >
      <UserAvatar name={client.name} userId={null} size="md" />
      <div className="min-w-[200px] flex-1">
        <p className="truncate text-[14.5px] font-bold">
          {client.name}
          {disabled && (
            <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
              Desligado
            </span>
          )}
        </p>
        <p className="truncate text-[12.5px] text-rz-muted">
          {client.accounts.map(a => a.email).join(' · ') || client.mailbox}
        </p>
        <p className="text-[12px] text-rz-muted">
          Último acesso {ago(client.lastLoginAt)} · desde{' '}
          {new Date(client.createdAt).toLocaleDateString('pt-PT')}
        </p>
      </div>
      <div className="w-56">
        <RzSelect
          value={client.companyId ?? ''}
          placeholder="Sem empresa"
          options={companies.map(c => ({ value: c.id, label: c.name }))}
          onChange={id => onCompany(client, id || null)}
        />
        {client.companyFromTicket && (
          <p className="mt-0.5 text-[11px] text-rz-muted">Pela escolha no último ticket</p>
        )}
      </div>
      <Link
        to={`${ROUTES.ADMIN.SUPPORT}?q=${encodeURIComponent(client.mailbox)}`}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-rz-muted ring-1 ring-rz-line hover:bg-rz-canvas"
        title="Tickets deste cliente"
      >
        <Headset className="h-4 w-4" /> {client.ticketsOpen}/{client.ticketsTotal}
      </Link>
      <button
        type="button"
        onClick={() => onSignatures(client)}
        disabled={!client.accounts.length}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-rz-primary px-3.5 text-[12.5px] font-semibold text-white disabled:opacity-40"
      >
        <PenLine className="h-4 w-4" /> Assinaturas
      </button>
      <button
        type="button"
        onClick={() => onToggle(client)}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold ring-1',
          disabled
            ? 'text-emerald-700 ring-emerald-200 hover:bg-emerald-50'
            : 'text-rose-600 ring-rose-200 hover:bg-rose-50'
        )}
      >
        <Power className="h-4 w-4" /> {disabled ? 'Religar' : 'Desligar'}
      </button>
    </div>
  );
};
