import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Folder, FolderPlus, Loader2, Mail, PenLine, Search, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { PermissionToggle } from '@/modules/admin/components/employee/folders/PermissionToggle';
import { ServerFolderPicker } from '@/modules/admin/components/employee/folders/ServerFolderPicker';
import { matchesText } from '@/lib/text';
import { accessKey, fetchAccess } from '../lib/personAccessQuery';
import { PersonSignaturesTab } from './PersonSignaturesTab';
import {
  personAccessService,
  type AccessPermission,
  type PersonAccess,
} from '../services/personAccessService';

export type PersonAccessTab = 'folders' | 'mail' | 'signatures';

interface PersonAccessDialogProps {
  /** A pessoa (conta de colaborador); null = fechado. */
  person: { userId: string; name: string } | null;
  tab: PersonAccessTab;
  onClose: () => void;
}

const fail = (description: string) =>
  toast({ title: 'Não foi possível', description, variant: 'destructive' });

/** Pasta: o nome em destaque e o caminho até ela por baixo. */
const splitPath = (path: string) => {
  const cut = path.lastIndexOf('/');
  return cut < 0
    ? { name: path, parent: '' }
    : { name: path.slice(cut + 1), parent: path.slice(0, cut) };
};

/** Dar acesso a pastas da empresa e a caixas de email a uma pessoa (só administradores). */
export const PersonAccessDialog: React.FC<PersonAccessDialogProps> = ({
  person,
  tab: initialTab,
  onClose,
}) => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<PersonAccessTab>(initialTab);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const key = accessKey(person?.userId);

  useEffect(() => {
    if (!person) return;
    setTab(initialTab);
    setSearch('');
  }, [person, initialTab]);

  const access = useQuery({
    queryKey: key,
    enabled: !!person,
    queryFn: () => fetchAccess(person?.userId ?? ''),
    staleTime: 30_000,
  });
  const patch = (change: (current: PersonAccess) => PersonAccess) =>
    qc.setQueryData<PersonAccess>(key, current => (current ? change(current) : current));
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  if (!person) return null;
  const data = access.data;
  const mailboxes = (data?.mailboxes ?? []).filter(box =>
    matchesText(search, box.email, box.name ?? '')
  );

  const setPermission = async (path: string, permission: AccessPermission) => {
    patch(current => ({
      ...current,
      folders: current.folders.map(folder =>
        folder.path === path ? { ...folder, permission } : folder
      ),
    }));
    const { error } = await personAccessService.setFolder(person.userId, path, permission);
    if (error) {
      fail(error);
      void refresh();
    }
  };
  const removeFolder = async (id: string) => {
    patch(current => ({ ...current, folders: current.folders.filter(folder => folder.id !== id) }));
    const { error } = await personAccessService.removeFolder(person.userId, id);
    if (error) {
      fail(error);
      void refresh();
    }
  };
  const toggleMailbox = async (accessId: string, on: boolean) => {
    patch(current => ({
      ...current,
      mailboxes: current.mailboxes.map(box =>
        box.accessId === accessId ? { ...box, assigned: on } : box
      ),
    }));
    const { error } = await personAccessService.setMailbox(person.userId, accessId, on);
    if (error) {
      fail(error);
      void refresh();
    }
  };

  return (
    <Dialog open onOpenChange={next => !next && onClose()}>
      <DialogContent
        className={cn(
          'max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-[28px] sm:rounded-[28px] [&>*]:min-w-0',
          // O editor de assinaturas precisa de mais espaço
          tab === 'signatures' ? 'sm:max-w-4xl' : 'sm:max-w-2xl'
        )}
      >
        <DialogTitle className="text-[18px] font-extrabold">Acessos de {person.name}</DialogTitle>
        <DialogDescription className="text-[13px]">
          Só administradores. As alterações aplicam-se logo.
        </DialogDescription>
        <div className="flex gap-1.5" role="tablist">
          {(
            [
              ['folders', 'Pastas', Folder],
              ['mail', 'Caixas de email', Mail],
              ['signatures', 'Assinaturas', PenLine],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold',
                tab === value ? 'bg-rz-ink text-white' : 'bg-rz-canvas text-rz-muted'
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        {access.isLoading && tab !== 'signatures' && (
          <Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-rz-primary" />
        )}
        {access.error && tab !== 'signatures' && (
          <p className="text-[13.5px] text-rose-600">
            {access.error.message || 'Não foi possível ler os acessos.'}
          </p>
        )}

        {data && tab === 'folders' && (
          <div className="space-y-2">
            {data.folders.length === 0 && (
              <p className="rounded-2xl bg-rz-canvas px-4 py-5 text-center text-[13.5px] text-rz-muted">
                Ainda sem pastas.
              </p>
            )}
            <ul className="space-y-1">
              {data.folders.map(folder => (
                <li
                  key={folder.id}
                  className="flex items-center gap-2 rounded-2xl p-2 hover:bg-rz-canvas"
                >
                  <Folder className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="min-w-0 flex-1" title={folder.path}>
                    <span className="block truncate text-[14px] font-semibold">
                      {splitPath(folder.path).name}
                    </span>
                    {splitPath(folder.path).parent && (
                      <span className="block truncate text-[12px] text-rz-muted">
                        {splitPath(folder.path).parent}
                      </span>
                    )}
                  </span>
                  <PermissionToggle
                    size="sm"
                    value={folder.permission}
                    onChange={value => void setPermission(folder.path, value)}
                  />
                  <button
                    type="button"
                    onClick={() => void removeFolder(folder.id)}
                    aria-label={`Retirar acesso a ${folder.path}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-bold text-white"
            >
              <FolderPlus className="h-4 w-4" /> Dar acesso a uma pasta
            </button>
          </div>
        )}

        {tab === 'signatures' && <PersonSignaturesTab userId={person.userId} />}

        {data && tab === 'mail' && (
          <div className="space-y-2">
            <label className="flex h-10 items-center gap-2 rounded-2xl bg-rz-canvas px-3 text-rz-muted">
              <Search className="h-4 w-4 shrink-0" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Procurar caixa de email"
                className="w-full bg-transparent text-sm text-rz-ink outline-none"
              />
            </label>
            <ul className="rz-scroll max-h-72 space-y-0.5 overflow-y-auto">
              {mailboxes.map(box => (
                <li key={box.accessId}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl p-2 hover:bg-rz-canvas">
                    <input
                      type="checkbox"
                      checked={box.assigned}
                      onChange={event => void toggleMailbox(box.accessId, event.target.checked)}
                      className="h-4 w-4 accent-[hsl(var(--rz-primary))]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold">
                        {box.email}
                      </span>
                      {box.name && box.name !== box.email && (
                        <span className="block truncate text-[12px] text-rz-muted">{box.name}</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
              {mailboxes.length === 0 && (
                <li className="px-3 py-6 text-center text-[13.5px] text-rz-muted">
                  Nenhuma caixa encontrada.
                </li>
              )}
            </ul>
            <p className="text-[12px] text-rz-muted">
              Só aparecem as caixas já ligadas ao Webmail. Para ligar outras: Admin → Acessos.
            </p>
          </div>
        )}
      </DialogContent>
      <ServerFolderPicker
        open={picking}
        onClose={() => setPicking(false)}
        assigned={data?.folders.map(folder => folder.path) ?? []}
        onPick={async (path, permission) => {
          const { error } = await personAccessService.setFolder(person.userId, path, permission);
          if (error) return error;
          await refresh();
          toast({ title: 'Acesso dado', description: path });
          return null;
        }}
      />
    </Dialog>
  );
};
