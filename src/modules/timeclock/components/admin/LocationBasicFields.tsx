import React from 'react';
import {
  Controller,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TimeClockLocationInput } from '@/lib/schemas';
import { LocationCoordinatesField } from './LocationCoordinatesField';

interface LocationBasicFieldsProps {
  companies: Array<{ id: string; name: string }>;
  register: UseFormRegister<TimeClockLocationInput>;
  control: Control<TimeClockLocationInput>;
  errors: FieldErrors<TimeClockLocationInput>;
  setValue: UseFormSetValue<TimeClockLocationInput>;
}

/** Empresa, nome, morada e localização do local de ponto. */
export const LocationBasicFields: React.FC<LocationBasicFieldsProps> = ({
  companies,
  register,
  control,
  errors,
  setValue,
}) => (
  <>
    <div className="space-y-1">
      <Label>Empresa *</Label>
      <Controller
        control={control}
        name="company_id"
        render={({ field }) => (
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {errors.company_id && <p className="text-xs text-destructive">{errors.company_id.message}</p>}
    </div>
    <div className="space-y-1">
      <Label htmlFor="loc-name">Nome *</Label>
      <Input id="loc-name" placeholder="Ex.: Escritório Lisboa" {...register('name')} />
      {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
    </div>
    <div className="space-y-1">
      <Label htmlFor="loc-address">Morada</Label>
      <Input id="loc-address" {...register('address')} />
    </div>
    <LocationCoordinatesField
      register={register}
      control={control}
      errors={errors}
      setValue={setValue}
    />
  </>
);
