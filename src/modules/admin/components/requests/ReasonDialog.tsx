import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description: string;
  label: string;
  confirmLabel: string;
  onClose: () => void;
  /** Recebe o texto (pode vir vazio); a janela fecha quando termina. */
  onConfirm: (reason: string) => Promise<void>;
}

/** Confirmar uma decisão com um motivo opcional (rejeitar, desaprovar). */
export const ReasonDialog: React.FC<ReasonDialogProps> = ({
  open,
  title,
  description,
  label,
  confirmLabel,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(reason);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => !next && !busy && onClose()}>
      <DialogContent className="max-w-md font-jakarta">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label className="space-y-1.5 text-[13.5px] font-semibold">
          <span>{label}</span>
          <Textarea
            value={reason}
            onChange={event => setReason(event.target.value)}
            rows={3}
            autoFocus
            className="font-normal"
          />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
