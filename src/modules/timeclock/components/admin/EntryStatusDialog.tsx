import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
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
import { useToast } from '@/hooks/use-toast';
import {
  ENTRY_TYPE_LABELS,
  getErrorMessage,
  type TimeClockEntryWithRelations,
} from '@/lib/timeclock';
import { timeClockReasonSchema, type TimeClockReasonInput } from '@/lib/schemas';
import { timeClockService } from '../../services/timeClockService';

type StatusMode = 'void' | 'restore' | 'review';

interface EntryStatusDialogProps {
  entry: TimeClockEntryWithRelations;
  mode: StatusMode;
  onClose: () => void;
  onSaved: () => void;
}

const COPY: Record<StatusMode, { title: string; action: string; description: string }> = {
  void: {
    title: 'Anular registo',
    action: 'Anular',
    description: 'O registo deixa de contar para as horas, mas fica visível e no histórico.',
  },
  restore: {
    title: 'Restaurar registo',
    action: 'Restaurar',
    description: 'O registo volta a contar.',
  },
  review: {
    title: 'Marcar como revisto',
    action: 'Confirmar',
    description: 'Confirma que os alertas deste registo foram verificados e o registo é válido.',
  },
};

export const EntryStatusDialog: React.FC<EntryStatusDialogProps> = ({
  entry,
  mode,
  onClose,
  onSaved,
}) => {
  const { toast } = useToast();
  const copy = COPY[mode];
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TimeClockReasonInput>({
    resolver: zodResolver(timeClockReasonSchema),
    defaultValues: { reason: '' },
  });

  useEffect(() => reset({ reason: '' }), [entry.id, mode, reset]);

  const onSubmit = async ({ reason }: TimeClockReasonInput) => {
    const status = mode === 'void' ? 'voided' : 'valid';
    const { error } = await timeClockService.setStatus(entry.id, status, reason);
    if (error) {
      toast({
        title: 'Erro',
        description: getErrorMessage(error, 'Não foi possível atualizar o registo'),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Registo atualizado' });
    onSaved();
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {entry.employee?.name} · {ENTRY_TYPE_LABELS[entry.entry_type]}{' '}
            {format(new Date(entry.punched_at), 'dd/MM/yyyy HH:mm')}. {copy.description}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status-reason">Motivo *</Label>
            <Textarea id="status-reason" rows={3} {...register('reason')} />
            {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={mode === 'void' ? 'destructive' : 'default'}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {copy.action}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
