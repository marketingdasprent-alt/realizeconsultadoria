import React from 'react';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import type { Credential } from '../../lib/credentials';
import { CopyText, SecretText } from './SecretText';

interface CredentialRowProps {
  credential: Credential;
  showCompany: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const ACTION =
  'flex h-8 w-8 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink';

const href = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

/** Um acesso: nome, de quem, utilizador e palavra-passe (copiáveis) e o site. */
export const CredentialRow: React.FC<CredentialRowProps> = ({
  credential,
  showCompany,
  canManage,
  onEdit,
  onDelete,
}) => {
  const detail = [showCompany ? credential.companies?.name : null, credential.employees?.name]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 lg:flex-nowrap">
      <span className="min-w-0 flex-1 basis-48">
        <span className="block truncate text-[14px] font-semibold text-rz-ink">
          {credential.title}
        </span>
        {detail && <span className="block truncate text-[12.5px] text-rz-muted">{detail}</span>}
      </span>
      <CopyText value={credential.username} className="w-[230px] max-w-full shrink-0" />
      <SecretText value={credential.password} className="w-[150px] shrink-0" />
      <span className="flex shrink-0 items-center gap-0.5">
        {credential.url && (
          <a
            href={href(credential.url)}
            target="_blank"
            rel="noreferrer"
            className={ACTION}
            aria-label="Abrir o site"
            title={credential.url}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {canManage && (
          <>
            <button type="button" onClick={onEdit} className={ACTION} aria-label="Editar">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className={`${ACTION} hover:bg-rose-50 hover:text-rose-600`}
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </span>
    </li>
  );
};
