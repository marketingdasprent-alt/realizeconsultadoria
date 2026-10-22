import React, { useState } from 'react';
import { PenLine, Plus, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { newSignature } from '../lib/signatures';
import type { MailSignature } from '../types';
import { SignatureEditor } from './SignatureEditor';

interface SignaturesManagerProps {
  value: MailSignature[];
  onChange: (next: MailSignature[]) => void;
}

const ITEM =
  'flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-[13.5px] font-semibold';

/**
 * Várias assinaturas por caixa (como no Outlook): à esquerda a lista, à direita o nome, se é a
 * predefinida e o editor.
 */
export const SignaturesManager: React.FC<SignaturesManagerProps> = ({ value, onChange }) => {
  const [activeId, setActiveId] = useState<string | null>(value[0]?.id ?? null);
  const active = value.find(signature => signature.id === activeId) ?? value[0] ?? null;

  const patch = (id: string, change: Partial<MailSignature>) =>
    onChange(
      value.map(signature => {
        if (signature.id === id) return { ...signature, ...change };
        // Só há uma predefinida.
        return change.isDefault ? { ...signature, isDefault: false } : signature;
      })
    );
  const add = () => {
    const created = newSignature(value);
    onChange([...value, created]);
    setActiveId(created.id);
  };
  const remove = (id: string) => {
    const rest = value.filter(signature => signature.id !== id);
    // Se saiu a predefinida, a primeira que ficar assume.
    onChange(
      rest.map((s, index) =>
        index === 0 && !rest.some(r => r.isDefault) ? { ...s, isDefault: true } : s
      )
    );
    setActiveId(rest[0]?.id ?? null);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[14rem_1fr]">
      <aside className="space-y-1">
        {value.map(signature => (
          <button
            key={signature.id}
            type="button"
            onClick={() => setActiveId(signature.id)}
            className={cn(
              ITEM,
              active?.id === signature.id
                ? 'bg-rz-primary-soft text-rz-primary'
                : 'text-rz-ink hover:bg-rz-canvas'
            )}
          >
            <PenLine className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{signature.name || 'Sem nome'}</span>
            {signature.isDefault && (
              <Star className="h-3.5 w-3.5 shrink-0 fill-current" aria-label="Predefinida" />
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={add}
          className={cn(ITEM, 'text-rz-primary hover:bg-rz-canvas')}
        >
          <Plus className="h-4 w-4" /> Nova assinatura
        </button>
        <p className="px-3 pt-2 text-[12px] text-rz-muted">
          A <Star className="inline h-3 w-3 fill-current align-[-1px]" /> predefinida entra sozinha
          ao escrever; as outras escolhem-se no email.
        </p>
      </aside>

      {active ? (
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={active.name}
              onChange={event => patch(active.id, { name: event.target.value.slice(0, 60) })}
              placeholder="Nome da assinatura (ex.: Completa, Curta)"
              aria-label="Nome da assinatura"
              className="h-11 min-w-[12rem] flex-1 rounded-2xl bg-rz-canvas px-4 text-sm font-semibold outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40"
            />
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              <input
                type="checkbox"
                checked={active.isDefault}
                disabled={active.isDefault}
                onChange={() => patch(active.id, { isDefault: true })}
                className="h-4 w-4 accent-violet-600"
              />
              Predefinida
            </label>
            <button
              type="button"
              onClick={() => remove(active.id)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          </div>
          <SignatureEditor
            key={active.id}
            initial={active.html}
            onChange={html => patch(active.id, { html })}
          />
        </section>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl bg-rz-canvas px-6 py-16 text-center">
          <PenLine className="h-8 w-8 text-rz-muted/60" />
          <p className="mt-3 max-w-sm text-[14px] text-rz-muted">
            Ainda não tem assinaturas nesta caixa. Crie uma e escolha-a ao escrever cada email.
          </p>
          <button
            type="button"
            onClick={add}
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-rz-primary px-5 text-[13.5px] font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Criar assinatura
          </button>
        </div>
      )}
    </div>
  );
};
