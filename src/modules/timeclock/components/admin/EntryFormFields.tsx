import React from 'react';
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { TimeEntryInput } from '@/lib/schemas';

interface EntryFormFieldsProps {
  register: UseFormRegister<TimeEntryInput>;
  control: Control<TimeEntryInput>;
  errors: FieldErrors<TimeEntryInput>;
}

/** Tipo, data/hora, notas e motivo de um registo de ponto. */
export const EntryFormFields: React.FC<EntryFormFieldsProps> = ({ register, control, errors }) => (
  <>
    <div className="grid grid-cols-3 gap-3">
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Controller
          control={control}
          name="entry_type"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Entrada</SelectItem>
                <SelectItem value="out">Saída</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="entry-date">Data</Label>
        <Input id="entry-date" type="date" {...register('date')} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="entry-time">Hora</Label>
        <Input id="entry-time" type="time" {...register('time')} />
      </div>
    </div>
    {(errors.date || errors.time) && (
      <p className="text-sm text-destructive">{errors.date?.message ?? errors.time?.message}</p>
    )}
    <div className="space-y-2">
      <Label htmlFor="entry-notes">Notas</Label>
      <Input id="entry-notes" {...register('notes')} />
    </div>
    <div className="space-y-2">
      <Label htmlFor="entry-reason">Motivo da alteração *</Label>
      <Textarea
        id="entry-reason"
        rows={2}
        placeholder="Ex.: colaborador esqueceu-se de picar a saída"
        {...register('reason')}
      />
      {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
    </div>
  </>
);
