import React, { useState } from 'react';
import { Plus, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { newSignature } from '../lib/signatures';
import type { MailSignature } from '../types';
import { SignatureEditor } from './SignatureEditor';

interface SignaturesManagerProps {
  value: MailSignature[];
  onChange: (next: MailSignature[]) => void;
}

const CHIP = 'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold';

/** Várias assinaturas por caixa (como no Outlook): nome, texto/imagens e qual é a predefinida. */
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map(signature => (
          <button
            key={signature.id}
            type="button"
            onClick={() => setActiveId(signature.id)}
            className={cn(
              CHIP,
              active?.id === signature.id
                ? 'bg-rz-primary-soft text-rz-primary ring-1 ring-rz-primary/30'
                : 'bg-rz-canvas text-rz-ink hover:bg-rz-primary-soft'
            )}
          >
            {signature.isDefault && (
              <Star className="h-3.5 w-3.5 fill-current" aria-label="Predefinida" />
            )}
            <span className="max-w-[10rem] truncate">{signature.name || 'Sem nome'}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={add}
          className={cn(CHIP, 'text-rz-primary hover:bg-rz-primary-soft')}
        >
          <Plus className="h-4 w-4" /> Nova assinatura
        </button>
      </div>

      {active ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={active.name}
              onChange={event => patch(active.id, { name: event.target.value.slice(0, 60) })}
              placeholder="Nome da assinatura (ex.: Completa, Curta)"
              aria-label="Nome da assinatura"
              className="h-10 min-w-0 flex-1 rounded-2xl bg-rz-canvas px-4 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40"
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
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" /> Eliminar
            </button>
          </div>
          <SignatureEditor
            key={active.id}
            initial={active.html}
            onChange={html => patch(active.id, { html })}
          />
        </div>
      ) : (
        <p className="rounded-2xl bg-rz-canvas px-4 py-3 text-[13px] text-rz-muted">
          Ainda não tem assinaturas nesta caixa. Crie uma e escolha-a ao escrever cada email.
        </p>
      )}
    </div>
  );
};
