import React from 'react';
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { TimeClockLocationInput } from '@/lib/schemas';

interface LocationFormFieldsProps {
  register: UseFormRegister<TimeClockLocationInput>;
  control: Control<TimeClockLocationInput>;
  errors: FieldErrors<TimeClockLocationInput>;
}

const SWITCHES: Array<{
  name: 'allow_manual' | 'block_vpn' | 'is_active';
  label: string;
  hint: string;
}> = [
  {
    name: 'allow_manual',
    label: 'Permitir registo só com GPS',
    hint: 'Sem encostar à tag, desde que dentro do raio. Desligado = só NFC.',
  },
  {
    name: 'block_vpn',
    label: 'Bloquear VPN / proxy',
    hint: 'Recusa em vez de só sinalizar. Atenção: o iCloud Private Relay do iPhone conta como VPN.',
  },
  { name: 'is_active', label: 'Local ativo', hint: 'Locais inativos não aceitam registos.' },
];

/** Campos numéricos, IPs de confiança e opções de um local de ponto. */
export const LocationFormFields: React.FC<LocationFormFieldsProps> = ({
  register,
  control,
  errors,
}) => (
  <>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label htmlFor="loc-radius">Raio (m)</Label>
        <Input id="loc-radius" type="number" {...register('radius_m', { valueAsNumber: true })} />
        {errors.radius_m && <p className="text-xs text-destructive">{errors.radius_m.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="loc-accuracy">Precisão GPS máx. (m)</Label>
        <Input
          id="loc-accuracy"
          type="number"
          {...register('max_accuracy_m', { valueAsNumber: true })}
        />
        {errors.max_accuracy_m && (
          <p className="text-xs text-destructive">{errors.max_accuracy_m.message}</p>
        )}
      </div>
    </div>

    <div className="space-y-1">
      <Label htmlFor="loc-ips">IPs da rede do local (opcional)</Label>
      <Textarea
        id="loc-ips"
        rows={2}
        placeholder={'Um por linha, ex.: 85.240.10.20 ou 85.240.10.0/24'}
        {...register('trusted_ips')}
      />
      <p className="text-xs text-muted-foreground">
        IP público do Wi-Fi do escritório. Registos a partir desta rede não são sinalizados por IP.
      </p>
    </div>

    <div className="space-y-3">
      {SWITCHES.map(item => (
        <div key={item.name} className="flex items-start justify-between gap-3">
          <div>
            <Label>{item.label}</Label>
            <p className="text-xs text-muted-foreground">{item.hint}</p>
          </div>
          <Controller
            control={control}
            name={item.name}
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
      ))}
    </div>
  </>
);
