import React from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { timeEntrySchema, type TimeEntryInput } from '@/lib/schemas';
import { getErrorMessage, type TimeClockEntryWithRelations } from '@/lib/timeclock';
import { timeClockService } from '../../services/timeClockService';
import { EntryFormFields } from './EntryFormFields';

interface EntryFormDialogProps {
  /** Sem entry → criação manual. */
  entry?: TimeClockEntryWithRelations | null;
  employees: Array<{ id: string; name: string }>;
  defaultEmployeeId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export const EntryFormDialog: React.FC<EntryFormDialogProps> = ({
  entry,
  employees,
  defaultEmployeeId,
  onClose,
  onSaved,
}) => {
  const { toast } = useToast();
  const isEdit = !!entry;
  const base = entry ? new Date(entry.punched_at) : new Date();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TimeEntryInput>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      employee_id: entry?.employee_id ?? defaultEmployeeId ?? '',
      entry_type: (entry?.entry_type as 'in' | 'out') ?? 'in',
      date: format(base, 'yyyy-MM-dd'),
      time: format(base, 'HH:mm'),
      notes: entry?.notes ?? '',
      reason: '',
    },
  });

  const onSubmit = async (values: TimeEntryInput) => {
    const punchedAtIso = new Date(`${values.date}T${values.time}:00`).toISOString();
    const common = {
      entryType: values.entry_type,
      punchedAtIso,
      reason: values.reason,
      notes: values.notes || null,
    };
    const { error } = entry
      ? await timeClockService.updateEntry({ entryId: entry.id, ...common })
      : await timeClockService.createEntry({ employeeId: values.employee_id, ...common });
    if (error) {
      toast({
        title: 'Erro',
        description: getErrorMessage(error, 'Não foi possível guardar'),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: isEdit ? 'Registo atualizado' : 'Registo criado' });
    onSaved();
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar registo' : 'Novo registo manual'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `${entry?.employee?.name ?? ''} · a alteração fica gravada no histórico.`
              : 'Registo inserido por administrador (fica identificado como tal).'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!isEdit && (
            <div className="space-y-2">
              <Label>Colaborador *</Label>
              <Controller
                control={control}
                name="employee_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.employee_id && (
                <p className="text-sm text-destructive">{errors.employee_id.message}</p>
              )}
            </div>
          )}
          <EntryFormFields register={register} control={control} errors={errors} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
