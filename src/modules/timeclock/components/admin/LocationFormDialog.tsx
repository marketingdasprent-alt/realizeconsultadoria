import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { timeClockLocationSchema, type TimeClockLocationInput } from '@/lib/schemas';
import { getErrorMessage, type TimeClockLocation } from '@/lib/timeclock';
import { timeClockLocationService } from '../../services/timeClockLocationService';
import { LocationBasicFields } from './LocationBasicFields';
import { LocationFormFields } from './LocationFormFields';

interface LocationFormDialogProps {
  location?: TimeClockLocation | null;
  companies: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}

/** Aceita IPs separados por linha, espaço, vírgula ou ponto e vírgula. */
const parseIpList = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(/[\s,;]+/)
    .map(ip => ip.trim())
    .filter(Boolean);

export const LocationFormDialog: React.FC<LocationFormDialogProps> = ({
  location,
  companies,
  onClose,
  onSaved,
}) => {
  const { toast } = useToast();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TimeClockLocationInput>({
    resolver: zodResolver(timeClockLocationSchema),
    defaultValues: {
      company_id: location?.company_id ?? '',
      name: location?.name ?? '',
      address: location?.address ?? '',
      latitude: location?.latitude,
      longitude: location?.longitude,
      radius_m: location?.radius_m ?? 50,
      max_accuracy_m: location?.max_accuracy_m ?? 100,
      allow_manual: location?.allow_manual ?? true,
      block_vpn: location?.block_vpn ?? false,
      trusted_ips: (location?.trusted_ips ?? []).join('\n'),
      is_active: location?.is_active ?? true,
    },
  });

  const onSubmit = async (values: TimeClockLocationInput) => {
    const payload = {
      ...values,
      address: values.address || null,
      trusted_ips: parseIpList(values.trusted_ips),
    };
    const { error } = location
      ? await timeClockLocationService.update(location.id, payload)
      : await timeClockLocationService.create(payload);
    if (error) {
      const description = getErrorMessage(error, 'Não foi possível guardar');
      toast({ title: 'Erro', description, variant: 'destructive' });
      return;
    }
    toast({ title: location ? 'Local atualizado' : 'Local criado' });
    onSaved();
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{location ? 'Editar local' : 'Novo local de ponto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <LocationBasicFields
            companies={companies}
            register={register}
            control={control}
            errors={errors}
            setValue={setValue}
          />
          <LocationFormFields register={register} control={control} errors={errors} />
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
