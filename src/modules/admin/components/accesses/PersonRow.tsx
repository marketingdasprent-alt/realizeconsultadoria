import React from 'react';
import { cn } from '@/lib/utils';
import type { CredentialEmployee } from '../../lib/credentials';
import { PersonAvatar } from '../requests/requestStyles';

interface PersonRowProps {
  person: CredentialEmployee;
  avatarUrl: string | null;
  companyName: string;
  /** Etiqueta ao lado do nome (ex.: "Dono"). */
  badge?: React.ReactNode;
  /** Botões à direita. */
  children?: React.ReactNode;
  className?: string;
}

/** Uma pessoa: foto ou iniciais, nome, empresa e o aviso de quem não tem conta na app. */
export const PersonRow: React.FC<PersonRowProps> = ({
  person,
  avatarUrl,
  companyName,
  badge,
  children,
  className,
}) => (
  <div className={cn('flex items-center gap-3', className)}>
    <PersonAvatar name={person.name} url={avatarUrl} />
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5">
        <span className="truncate text-[14px] font-semibold text-rz-ink">{person.name}</span>
        {badge}
      </span>
      <span className="block truncate text-[12px] text-rz-muted">
        {companyName}
        {!person.user_id && ' · sem conta na app (não vê a caixa)'}
      </span>
    </span>
    {children}
  </div>
);
