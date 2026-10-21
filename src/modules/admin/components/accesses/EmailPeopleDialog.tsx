import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { matchesSearch } from '@/lib/utils';
import { useEmployeeAvatars } from '../../hooks/useEmployeeAvatars';
import type { Credential, CredentialCompany, CredentialEmployee } from '../../lib/credentials';
import { CandidateColumn, SelectedColumn } from './EmailPeopleColumns';

export interface EmailPeopleValue {
  /** Só no email pessoal: de quem é a caixa. */
  ownerId: string | null;
  people: string[];
}

/** department: várias pessoas; personal: dono + outras; credential: só o colaborador. */
export type PeopleMode = 'department' | 'personal' | 'credential';

interface EmailPeopleDialogProps {
  credential: Credential | null;
  mode: PeopleMode;
  shares: string[];
  employees: CredentialEmployee[];
  companies: CredentialCompany[];
  onClose: () => void;
  onSave: (credential: Credential, value: EmailPeopleValue) => Promise<void>;
}

/**
 * Quem vê a caixa no Webmail, numa janela de tamanho fixo: à esquerda quem tem acesso (no
 * email pessoal, um deles é o dono), à direita a pesquisa para juntar pessoas.
 */
export const EmailPeopleDialog: React.FC<EmailPeopleDialogProps> = ({
  credential,
  mode,
  shares,
  employees,
  companies,
  onClose,
  onSave,
}) => {
  const avatarFor = useEmployeeAvatars();
  const [selected, setSelected] = useState<string[]>([]);
  const [owner, setOwner] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!credential) return;
    const ownerId = mode === 'department' ? null : credential.employee_id;
    setOwner(ownerId);
    setSelected([
      ...new Set([...(ownerId ? [ownerId] : []), ...(mode === 'credential' ? [] : shares)]),
    ]);
    setSearch('');
    // Só ao abrir (a lista recarrega por trás depois de gravar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credential?.id]);

  const byId = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const companyName = (id: string) => companies.find(c => c.id === id)?.name ?? '';
  const candidates = useMemo(
    () =>
      employees
        .filter(e => e.is_active && !selected.includes(e.id) && matchesSearch(e.name, search))
        .sort(
          (a, b) =>
            Number(b.company_id === credential?.company_id) -
              Number(a.company_id === credential?.company_id) || a.name.localeCompare(b.name)
        ),
    [employees, selected, search, credential?.company_id]
  );

  const add = (id: string) => {
    // Nos outros acessos há só um colaborador: escolher outro troca.
    if (mode === 'credential') {
      setSelected([id]);
      setOwner(id);
      return;
    }
    setSelected(current => [...current, id]);
    // Email pessoal sem dono: o primeiro a entrar fica dono.
    if (mode === 'personal' && !owner) setOwner(id);
  };
  const remove = (id: string) => {
    setSelected(current => current.filter(v => v !== id));
    if (owner === id) setOwner(null);
  };

  const save = async () => {
    if (!credential) return;
    setBusy(true);
    try {
      await onSave(credential, {
        ownerId: mode === 'department' ? null : owner,
        people: mode === 'credential' ? [] : selected.filter(id => id !== owner),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!credential} onOpenChange={open => !open && !busy && onClose()}>
      <DialogContent className="flex h-[min(600px,90vh)] w-[min(780px,95vw)] max-w-none flex-col gap-0 overflow-hidden rounded-[28px] p-0 font-jakarta">
        <header className="flex shrink-0 items-center gap-3 border-b border-rz-line p-5 pr-12">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rz-primary-soft text-rz-primary">
            <Mail className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="truncate text-[17px] font-extrabold">
              {credential?.username}
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              {mode === 'credential'
                ? 'A que colaborador pertence este acesso'
                : `${mode === 'department' ? 'Email departamental' : 'Email pessoal'} · quem tem acesso vê a caixa no Webmail`}
            </DialogDescription>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1">
          <SelectedColumn
            title={mode === 'credential' ? 'Colaborador' : 'Com acesso'}
            people={selected.map(id => byId.get(id)).filter((p): p is CredentialEmployee => !!p)}
            owner={owner}
            canHaveOwner={mode === 'personal'}
            onMakeOwner={setOwner}
            onRemove={remove}
            avatarFor={avatarFor}
            companyName={companyName}
          />
          <CandidateColumn
            title={mode === 'credential' ? 'Escolher colaborador' : 'Juntar pessoas'}
            actionLabel={mode === 'credential' ? 'Escolher' : 'Juntar'}
            candidates={candidates}
            search={search}
            onSearch={setSearch}
            onAdd={add}
            avatarFor={avatarFor}
            companyName={companyName}
          />
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-rz-line p-4">
          <Button variant="outline" className="rounded-full" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button className="rounded-full" onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar e ligar
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
};
