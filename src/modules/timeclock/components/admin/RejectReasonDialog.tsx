import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { timeClockReasonSchema, type TimeClockReasonInput } from '@/lib/schemas';

interface RejectReasonDialogProps {
  count: number;
  title: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

/** Pede o motivo para rejeitar / anular um ou vários registos. */
export const RejectReasonDialog: React.FC<RejectReasonDialogProps> = ({
  count,
  title,
  onClose,
  onConfirm,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TimeClockReasonInput>({
    resolver: zodResolver(timeClockReasonSchema),
    defaultValues: { reason: '' },
  });

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {count === 1 ? '1 registo' : `${count} registos`} deixam de contar para as horas. Ficam
            visíveis e no histórico, e podem ser restaurados.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(({ reason }) => onConfirm(reason))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Motivo *</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              placeholder="Ex.: teletrabalho não autorizado neste dia"
              {...register('reason')}
            />
            {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Rejeitar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
