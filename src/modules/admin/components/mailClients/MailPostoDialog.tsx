import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { MailPosto, PostoAccess } from '../../services/mailPostosService';

export const POSTO_NAME_MAX = 80;

interface MailPostoDialogProps {
  open: boolean;
  /** Posto a mudar; sem ele cria-se um novo. */
  posto: MailPosto | null;
  accesses: PostoAccess[];
  accessesLoading: boolean;
  onClose: () => void;
  /** Devolve a mensagem de erro, ou null se gravou. */
  onSave: (name: string, accessIds: string[]) => Promise<string | null>;
}

/** Criar ou mudar um posto: o nome e as caixas (acessos de email) que ele vai ter. */
export const MailPostoDialog: React.FC<MailPostoDialogProps> = ({
  open,
  posto,
  accesses,
  accessesLoading,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(posto?.name ?? '');
    setChosen(new Set(posto?.boxes.map(box => box.accessId) ?? []));
    setSearch('');
    setError(null);
  }, [open, posto]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accesses.filter(
      access =>
        !term ||
        [access.email, access.title, access.companyName ?? ''].some(value =>
          value.toLowerCase().includes(term)
        )
    );
  }, [accesses, search]);

  const toggle = (accessId: string) =>
    setChosen(current => {
      const next = new Set(current);
      if (!next.delete(accessId)) next.add(accessId);
      return next;
    });

  const trimmed = name.replace(/\s+/g, ' ').trim();
  const valid = trimmed.length > 0 && chosen.size > 0;

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    const message = await onSave(trimmed, [...chosen]);
    setSaving(false);
    if (message) setError(message);
  };

  return (
    <Dialog open={open} onOpenChange={value => !value && !saving && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto rounded-[28px] sm:max-w-xl">
        <DialogTitle className="text-xl font-extrabold">
          {posto ? 'Mudar o posto' : 'Ligar novo posto de email'}
        </DialogTitle>
        <DialogDescription className="text-[13px]">
          Escolha as caixas que este posto vai ter. Depois envia o link a quem vai instalar a app: a
          pessoa entra já com essas caixas, sem palavra-passe.
        </DialogDescription>

        <label className="block text-[13px] font-semibold">
          Nome do posto
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            maxLength={POSTO_NAME_MAX}
            placeholder="Ex.: Receção Lisboa"
            className="mt-1 h-10 w-full rounded-xl border border-rz-line bg-white px-3 text-sm font-normal outline-none focus:border-rz-primary"
          />
        </label>

        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-[13px] font-semibold">Caixas do posto</span>
            <span className="text-[12px] text-rz-muted">{chosen.size} escolhidas</span>
          </div>
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Procurar por endereço, nome ou empresa"
            className="mb-2 h-9 w-full rounded-xl border border-rz-line bg-white px-3 text-sm outline-none focus:border-rz-primary"
          />
          <div className="max-h-64 overflow-y-auto rounded-2xl ring-1 ring-rz-line">
            {accessesLoading ? (
              <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-rz-primary" />
            ) : accesses.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-rz-muted">
                Ainda não há acessos de email. Crie-os em Acessos → Emails.
              </p>
            ) : visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-rz-muted">
                Nenhuma caixa encontrada.
              </p>
            ) : (
              visible.map(access => (
                <label
                  key={access.accessId}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 border-b border-rz-line px-4 py-2.5 last:border-0 hover:bg-rz-canvas',
                    chosen.has(access.accessId) && 'bg-rz-canvas'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={chosen.has(access.accessId)}
                    onChange={() => toggle(access.accessId)}
                    className="h-4 w-4 accent-[var(--rz-primary,#B7933D)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">
                      {access.email}
                    </span>
                    <span className="block truncate text-[12px] text-rz-muted">
                      {[access.title, access.companyName].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {!access.connected && (
                    <span className="shrink-0 text-[11px] text-rz-muted">liga-se ao gravar</span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-full px-4 text-sm font-semibold text-rz-muted hover:bg-rz-canvas"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!valid || saving}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {posto ? 'Gravar' : 'Criar posto'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
