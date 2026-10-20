import React, { useMemo, useState } from 'react';
import { Link2, Loader2, Plus, Search } from 'lucide-react';
import {
  isDepartmentCategory,
  type Credential,
  type CredentialEmployee,
} from '../../lib/credentials';
import { emailCandidates } from '../../lib/emailRows';
import type { CredentialsData } from '../../services/credentialService';

interface EmployeeEmailPickerProps {
  employee: CredentialEmployee;
  data: CredentialsData;
  busy: string | null;
  onAdd: (credential: Credential) => void;
  onCreate: () => void;
}

const actionOf = (credential: Credential) =>
  !isDepartmentCategory(credential.access_categories?.name) && !credential.employee_id
    ? 'Tornar dele'
    : 'Partilhar com ele';

/** Ligar um email: os que parecem ser dele (pelo nome), pesquisa nos Acessos ou criar um. */
export const EmployeeEmailPicker: React.FC<EmployeeEmailPickerProps> = ({
  employee,
  data,
  busy,
  onAdd,
  onCreate,
}) => {
  const [search, setSearch] = useState('');
  const candidates = useMemo(
    () => emailCandidates(employee, data, search),
    [employee, data, search]
  );

  return (
    <div className="space-y-2 rounded-2xl bg-rz-canvas p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-rz-muted" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Procurar um email nos Acessos (endereço ou nome)"
            className="h-10 w-full rounded-full bg-white pl-10 pr-4 text-[13.5px] outline-none ring-1 ring-rz-line focus:ring-2 focus:ring-rz-primary"
          />
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold ring-1 ring-rz-line hover:bg-rz-primary-soft"
        >
          <Plus className="h-4 w-4 text-rz-primary" /> Criar email novo
        </button>
      </div>
      {!search.trim() && candidates.length > 0 && (
        <p className="px-1 text-[12px] font-semibold text-rz-muted">
          Parecem ser dele (sem dono nos Acessos):
        </p>
      )}
      {search.trim() && candidates.length === 0 && (
        <p className="px-1 py-2 text-[13px] text-rz-muted">Nenhum email com isso nos Acessos.</p>
      )}
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {candidates.map(credential => (
          <li key={credential.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold">
                {credential.username}
              </span>
              <span className="block truncate text-[12px] text-rz-muted">
                {isDepartmentCategory(credential.access_categories?.name)
                  ? 'Departamental'
                  : 'Pessoal'}
                {isDepartmentCategory(credential.access_categories?.name)
                  ? ''
                  : credential.employees?.name
                    ? ` · de ${credential.employees.name}`
                    : ' · sem dono'}
                {credential.companies?.name ? ` · ${credential.companies.name}` : ''}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onAdd(credential)}
              disabled={!!busy}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-rz-primary-soft px-3 text-[12.5px] font-semibold text-rz-primary disabled:opacity-50"
            >
              {busy === credential.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              {actionOf(credential)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
