import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface MailPostoInviteDialogProps {
  /** Link novo (só se vê aqui, uma vez) e quando deixa de valer. */
  invite: { postoName: string; link: string; expiresAt: string } | null;
  onClose: () => void;
}

/** O link do posto, para copiar e enviar a quem vai instalar a app. */
export const MailPostoInviteDialog: React.FC<MailPostoInviteDialogProps> = ({
  invite,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sem acesso à área de transferência: o campo fica selecionável para copiar à mão.
    }
  };

  return (
    <Dialog
      open={!!invite}
      onOpenChange={open => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent className="rounded-[28px] sm:max-w-lg">
        <DialogTitle className="text-xl font-extrabold">Link de {invite?.postoName}</DialogTitle>
        <DialogDescription className="text-[13px]">
          Envie este link a quem vai instalar a Realize Mail. Ao abri-lo, a pessoa entra com as
          caixas do posto. Serve uma só vez e deixa de valer em{' '}
          {invite ? new Date(invite.expiresAt).toLocaleDateString('pt-PT') : ''}. Não o mostramos
          outra vez: se o perder, gere um novo.
        </DialogDescription>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={invite?.link ?? ''}
            onFocus={event => event.currentTarget.select()}
            aria-label="Link do posto"
            className="h-10 min-w-0 flex-1 rounded-xl border border-rz-line bg-rz-canvas px-3 font-mono text-[12.5px] outline-none"
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-rz-primary px-4 text-sm font-semibold text-white"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
        <p className="text-[12px] text-rz-muted">
          Quem recebe o link fica com acesso a estas caixas: envie-o só à pessoa certa.
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full px-4 text-sm font-semibold text-rz-muted hover:bg-rz-canvas"
          >
            Fechar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
