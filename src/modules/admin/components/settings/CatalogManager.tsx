import { useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X, type LucideIcon } from 'lucide-react';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useCatalog, useCatalogUsage } from '../../hooks/useCatalog';
import type { CatalogItem, CatalogKind } from '../../services/catalogService';

interface CatalogManagerProps {
  kind: CatalogKind;
  title: string;
  icon: LucideIcon;
  /** Ex.: "Nova função". */
  addPlaceholder: string;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Erro inesperado.');

/** Lista gerida (funções ou departamentos): acrescentar, mudar o nome e apagar. */
export const CatalogManager = ({
  kind,
  title,
  icon: Icon,
  addPlaceholder,
}: CatalogManagerProps) => {
  const { toast } = useToast();
  const { items, isLoading, create, rename, remove } = useCatalog(kind);
  const { data: usage } = useCatalogUsage(kind);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<CatalogItem | null>(null);

  const add = async () => {
    if (!newName.trim()) return;
    try {
      await create.mutateAsync(newName);
      setNewName('');
    } catch (error: unknown) {
      toast({
        title: 'Não foi possível acrescentar',
        description: errorText(error),
        variant: 'destructive',
      });
    }
  };

  const saveRename = async () => {
    if (!editing?.name.trim()) return;
    try {
      await rename.mutateAsync(editing);
      setEditing(null);
      toast({
        title: 'Nome atualizado',
        description: 'As fichas com o nome antigo também mudaram.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Não foi possível mudar o nome',
        description: errorText(error),
        variant: 'destructive',
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch (error: unknown) {
      toast({
        title: 'Não foi possível apagar',
        description: errorText(error),
        variant: 'destructive',
      });
    }
  };

  const inUse = (name: string) => usage?.get(name) ?? 0;

  return (
    <section className="rounded-[24px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line">
      <header className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rz-primary-soft text-rz-primary">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <h3 className="flex-1 text-[16px] font-extrabold">{title}</h3>
        <span className="text-[12.5px] font-semibold text-rz-muted">{items.length}</span>
      </header>

      <form
        className="mb-3 flex gap-2"
        onSubmit={event => {
          event.preventDefault();
          add();
        }}
      >
        <Input
          value={newName}
          onChange={event => setNewName(event.target.value)}
          placeholder={addPlaceholder}
        />
        <button
          type="submit"
          disabled={!newName.trim() || create.isPending}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-rz-primary px-4 text-[13.5px] font-bold text-white disabled:opacity-50"
        >
          {create.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Acrescentar
        </button>
      </form>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(key => (
            <div key={key} className="h-10 animate-pulse rounded-xl bg-rz-canvas" />
          ))}
        </div>
      ) : (
        <ul className="rz-scroll max-h-[420px] divide-y divide-rz-line overflow-y-auto">
          {items.map(item => (
            <li key={item.id} className="group flex items-center gap-2 py-2">
              {editing?.id === item.id ? (
                <>
                  <Input
                    autoFocus
                    value={editing.name}
                    onChange={event => setEditing({ id: item.id, name: event.target.value })}
                    onKeyDown={event => {
                      if (event.key === 'Enter') saveRename();
                      if (event.key === 'Escape') setEditing(null);
                    }}
                    className="h-9"
                  />
                  <button
                    type="button"
                    onClick={saveRename}
                    className="rounded-full p-2 text-emerald-600 hover:bg-emerald-50"
                    aria-label="Guardar"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-full p-2 text-rz-muted hover:bg-rz-canvas"
                    aria-label="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                    {item.name}
                  </span>
                  {inUse(item.name) > 0 && (
                    <span className="shrink-0 rounded-full bg-rz-canvas px-2 py-0.5 text-[11.5px] font-semibold text-rz-muted">
                      {inUse(item.name)} {inUse(item.name) === 1 ? 'pessoa' : 'pessoas'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing({ id: item.id, name: item.name })}
                    className="rounded-full p-2 text-rz-muted opacity-0 transition-opacity hover:bg-rz-canvas hover:text-rz-ink focus:opacity-100 group-hover:opacity-100"
                    aria-label={`Mudar o nome de ${item.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(item)}
                    className="rounded-full p-2 text-rz-muted opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                    aria-label={`Apagar ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <DeleteConfirmDialog
        open={!!deleting}
        onOpenChange={open => !open && setDeleting(null)}
        title={`Apagar da lista`}
        description={
          deleting && inUse(deleting.name) > 0
            ? `${inUse(deleting.name)} colaborador(es) têm este nome na ficha: mantêm-no até escolher outro.`
            : 'Deixa de aparecer para escolher nas fichas.'
        }
        itemName={deleting?.name}
        onConfirm={confirmDelete}
        isLoading={remove.isPending}
      />
    </section>
  );
};
