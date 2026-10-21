import React, { useMemo, useState } from 'react';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { useCredentials } from '../../hooks/useCredentials';
import { groupCredentials, withoutMainAccess } from '../../lib/credentialGroups';
import { isEmailCategory, type Credential } from '../../lib/credentials';
import { credentialService } from '../../services/credentialService';
import { CredentialRow } from './CredentialRow';
import { EmailPeopleDialog } from './EmailPeopleDialog';
import { MissingPeopleNotice } from './MissingPeopleNotice';
import { AccessPanel } from './panel/AccessPanel';
import type { AccessPanelTarget } from './panel/useAccessForm';

const SELECT = 'h-9 rounded-full border-rz-line text-[13px] sm:w-[200px]';

/** Acessos → Acessos: sites, sistemas, servidores, bases de dados… (os emails têm aba própria). */
export const CredentialsTab: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const { toast } = useToast();
  const data = useCredentials();
  const [filters, setFilters] = useState({ search: '', companyId: 'all', categoryId: 'all' });
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<AccessPanelTarget | null>(null);
  const [toDelete, setToDelete] = useState<Credential | null>(null);
  const [peopleOf, setPeopleOf] = useState<Credential | null>(null);

  const saveOwner = async (credential: Credential, ownerId: string | null) => {
    const { ok } = await credentialService.setOwner(credential.id, ownerId);
    toast(
      ok ? { title: 'Colaborador guardado' } : { title: 'Erro ao guardar', variant: 'destructive' }
    );
    void data.refresh();
  };

  const groups = useMemo(
    () => groupCredentials(data.credentials, filters),
    [data.credentials, filters]
  );
  const main = withoutMainAccess(
    data.credentials,
    data.categories,
    data.employees,
    filters.companyId
  );
  const toggle = (key: string) =>
    setClosed(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-4">
      <MissingPeopleNotice
        people={main.people}
        what={`sem "${main.category?.name ?? 'Acesso Principal'}"`}
        canManage={canManage}
        onCreate={employee =>
          setPanel({
            kind: 'other',
            companyId: employee.company_id,
            employeeId: employee.id,
            categoryId: main.category?.id,
            title: `Acesso ${employee.name}`,
          })
        }
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rz-muted" />
          <Input
            type="search"
            placeholder="Pesquisar nome, utilizador ou empresa…"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="h-9 rounded-full border-rz-line pl-9 text-[13px]"
          />
        </div>
        <Select
          value={filters.companyId}
          onValueChange={companyId => setFilters(f => ({ ...f, companyId }))}
        >
          <SelectTrigger className={SELECT} aria-label="Empresa">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {data.companies.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.categoryId}
          onValueChange={categoryId => setFilters(f => ({ ...f, categoryId }))}
        >
          <SelectTrigger className={SELECT} aria-label="Categoria">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {data.categories
              .filter(c => !isEmailCategory(c.name))
              .map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {canManage && (
          <Button
            variant="gold"
            className="rounded-full sm:ml-auto"
            onClick={() => setPanel({ kind: 'site' })}
          >
            <Plus className="h-4 w-4" /> Novo acesso
          </Button>
        )}
      </div>

      {data.isLoading ? (
        <div className="h-48 animate-pulse rounded-[28px] bg-white/70 ring-1 ring-rz-line" />
      ) : groups.length === 0 ? (
        <p className="rounded-[28px] bg-white px-6 py-12 text-center text-[14px] text-rz-muted ring-1 ring-rz-line">
          Sem acessos com estes filtros.
        </p>
      ) : (
        groups.map(group => (
          <section
            key={group.key}
            className="overflow-hidden rounded-[24px] bg-white shadow-rz-soft ring-1 ring-rz-line"
          >
            <button
              type="button"
              onClick={() => toggle(group.key)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span className="text-[15px] font-bold text-rz-ink">{group.name}</span>
              <span className="rounded-full bg-rz-canvas px-2 text-[12px] font-semibold text-rz-muted">
                {group.credentials.length}
              </span>
              <ChevronDown
                className={`ml-auto h-4 w-4 text-rz-muted transition-transform ${closed.has(group.key) ? '-rotate-90' : ''}`}
              />
            </button>
            {!closed.has(group.key) && (
              <ul className="divide-y divide-rz-line border-t border-rz-line">
                {group.credentials.map(credential => (
                  <CredentialRow
                    key={credential.id}
                    credential={credential}
                    showCompany={filters.companyId === 'all'}
                    canManage={canManage}
                    onPeople={() => setPeopleOf(credential)}
                    onEdit={() => setPanel({ credential })}
                    onDelete={() => setToDelete(credential)}
                  />
                ))}
              </ul>
            )}
          </section>
        ))
      )}

      <AccessPanel
        target={panel}
        data={data}
        onClose={() => setPanel(null)}
        onSaved={() => void data.refresh()}
      />
      <EmailPeopleDialog
        credential={peopleOf}
        mode="credential"
        shares={[]}
        employees={data.employees}
        companies={data.companies}
        onClose={() => setPeopleOf(null)}
        onSave={(credential, value) => saveOwner(credential, value.ownerId)}
      />
      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={open => !open && setToDelete(null)}
        title="Eliminar acesso"
        description="O acesso sai da lista para sempre."
        itemName={toDelete?.title}
        onConfirm={async () => {
          if (!toDelete) return;
          const { ok } = await credentialService.remove(toDelete.id);
          toast(
            ok
              ? { title: 'Acesso eliminado' }
              : { title: 'Erro ao eliminar', variant: 'destructive' }
          );
          setToDelete(null);
          void data.refresh();
        }}
      />
    </div>
  );
};
