import React, { useEffect, useState } from 'react';
import { Globe2, Loader2, Lock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';
import { APPRECIATION_TYPES } from '@/modules/workspace/lib/appreciations';
import { useDirectory } from '../hooks/useDirectory';
import type { AppreciationKind, NewAppreciationInput } from '../types';

interface SendAppreciationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Colega já escolhido (a partir do perfil); senão escolhe-se na lista. */
  recipientId?: string;
  onSend: (input: NewAppreciationInput) => Promise<boolean>;
}

/** Enviar uma apreciação: colega, tipo, mensagem opcional e pública/privada. */
export const SendAppreciationDialog: React.FC<SendAppreciationDialogProps> = ({
  open,
  onOpenChange,
  recipientId,
  onSend,
}) => {
  const { colleagues, byId } = useDirectory();
  const [recipient, setRecipient] = useState(recipientId ?? '');
  const [kind, setKind] = useState<AppreciationKind | null>(null);
  const [message, setMessage] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (open) {
      setRecipient(recipientId ?? '');
      setKind(null);
      setMessage('');
      setIsPublic(true);
    }
  }, [open, recipientId]);

  const send = async () => {
    if (!recipient || !kind) return;
    setIsSending(true);
    const ok = await onSend({ recipientId: recipient, kind, message, isPublic });
    setIsSending(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[28px] sm:max-w-lg sm:rounded-[28px]">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-extrabold">Enviar apreciação</DialogTitle>
          <DialogDescription>
            {recipientId
              ? `Reconheça o trabalho de ${byId.get(recipientId)?.name ?? 'um colega'}.`
              : 'Reconheça o bom trabalho de um colega.'}
          </DialogDescription>
        </DialogHeader>

        {!recipientId && (
          <select
            value={recipient}
            onChange={event => setRecipient(event.target.value)}
            className="h-11 w-full rounded-2xl bg-rz-canvas px-3 text-sm outline-none ring-1 ring-transparent focus:ring-rz-primary/40"
          >
            <option value="">Escolha um colega…</option>
            {colleagues.map(person => (
              <option key={person.userId} value={person.userId}>
                {person.name}
                {person.department ? ` — ${person.department}` : ''}
              </option>
            ))}
          </select>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {APPRECIATION_TYPES.map(type => (
            <button
              key={type.key}
              type="button"
              onClick={() => setKind(type.key as AppreciationKind)}
              className={cn(
                'flex items-center gap-2.5 rounded-2xl p-2.5 text-left text-[13px] font-semibold ring-1 transition-all',
                kind === type.key
                  ? 'bg-rz-primary-soft ring-2 ring-rz-primary'
                  : 'ring-rz-line hover:bg-rz-canvas'
              )}
            >
              <ModuleIcon module={type} size="sm" />
              <span className="leading-tight">{type.label}</span>
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={event => setMessage(event.target.value.slice(0, 500))}
          rows={3}
          placeholder="Mensagem (opcional) — o que fez a diferença?"
          className="w-full resize-none rounded-2xl bg-rz-canvas px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40"
        />

        <div className="flex rounded-full bg-rz-canvas p-1">
          {[true, false].map(value => {
            const Icon = value ? Globe2 : Lock;
            return (
              <button
                key={String(value)}
                type="button"
                onClick={() => setIsPublic(value)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-semibold',
                  isPublic === value ? 'bg-white shadow-sm' : 'text-rz-muted'
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {value ? 'Pública (no Feed)' : 'Privada'}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={send}
          disabled={!recipient || !kind || isSending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {isSending && <Loader2 className="h-4 w-4 animate-spin" />} Enviar apreciação
        </button>
      </DialogContent>
    </Dialog>
  );
};
