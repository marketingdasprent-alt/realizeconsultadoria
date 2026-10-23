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
import {
  APPRECIATION_DAILY_LIMIT,
  APPRECIATION_MAX_MESSAGE,
  APPRECIATION_MIN_MESSAGE,
  messageShortfall,
} from '../lib/appreciationRules';
import type { AppreciationKind, NewAppreciationInput } from '../types';
import { ColleaguePicker } from './ColleaguePicker';

interface SendAppreciationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Colega já escolhido (a partir do perfil); senão escolhe-se na lista. */
  recipientId?: string;
  onSend: (input: NewAppreciationInput) => Promise<boolean>;
}

/** Enviar uma apreciação: colega, tipo, motivo (obrigatório) e pública/privada. */
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

  const shortfall = messageShortfall(message);

  const send = async () => {
    if (!recipient || !kind || shortfall > 0) return;
    setIsSending(true);
    const ok = await onSend({ recipientId: recipient, kind, message, isPublic });
    setIsSending(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[28px] sm:max-w-lg sm:rounded-[28px]">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-extrabold">Reconhecer trabalho</DialogTitle>
          <DialogDescription>
            {recipientId
              ? `Descreva o trabalho de ${byId.get(recipientId)?.name ?? 'um colega'} que quer reconhecer.`
              : 'Descreva o trabalho de um colega que quer reconhecer.'}
            {` Fica registado com o seu nome (máx. ${APPRECIATION_DAILY_LIMIT} por dia).`}
          </DialogDescription>
        </DialogHeader>

        {!recipientId && (
          <ColleaguePicker people={colleagues} value={recipient} onChange={setRecipient} />
        )}

        <div lang="pt" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {APPRECIATION_TYPES.map(type => (
            <button
              key={type.key}
              type="button"
              onClick={() => setKind(type.key as AppreciationKind)}
              className={cn(
                'flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-2 py-2.5 text-center text-[12.5px] font-semibold ring-1 transition-all',
                kind === type.key
                  ? 'bg-rz-primary-soft ring-2 ring-rz-primary'
                  : 'ring-rz-line hover:bg-rz-canvas'
              )}
            >
              <ModuleIcon module={type} size="sm" />
              <span className="w-full min-w-0 hyphens-auto break-words leading-tight">
                {type.label}
              </span>
            </button>
          ))}
        </div>

        <textarea
          value={message}
          onChange={event => setMessage(event.target.value.slice(0, APPRECIATION_MAX_MESSAGE))}
          rows={3}
          required
          aria-label="Motivo do reconhecimento"
          placeholder="Que trabalho está a reconhecer? Diga o que fez a diferença."
          className="w-full resize-none rounded-2xl bg-rz-canvas px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40"
        />
        <p className="-mt-2 px-1 text-[12px] text-rz-muted">
          {shortfall > 0
            ? `Obrigatório: explique o trabalho reconhecido (faltam ${shortfall} caracteres, mínimo ${APPRECIATION_MIN_MESSAGE}).`
            : 'Motivo ok.'}
        </p>

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
          disabled={!recipient || !kind || shortfall > 0 || isSending}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rz-primary text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {isSending && <Loader2 className="h-4 w-4 animate-spin" />} Reconhecer
        </button>
      </DialogContent>
    </Dialog>
  );
};
