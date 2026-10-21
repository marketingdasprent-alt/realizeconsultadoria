import { format, addMonths } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Control, useWatch, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Field } from '../FormSection';

interface EmployeeSafetySectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
}

/** Próxima consulta de higiene e segurança e a periodicidade (o colaborador é avisado). */
export const EmployeeSafetySection = ({ control }: EmployeeSafetySectionProps) => {
  const safetyCheckupDate = useWatch({ control, name: 'safety_checkup_date' });
  const renewalMonths = useWatch({ control, name: 'safety_checkup_renewal_months' });

  const nextRenewalDate =
    safetyCheckupDate && renewalMonths
      ? addMonths(safetyCheckupDate, parseInt(renewalMonths) || 12)
      : null;

  return (
    <div className="space-y-4">
      <Field label="Próxima consulta">
        <Controller
          control={control}
          name="safety_checkup_date"
          render={({ field }) => (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !field.value && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value ? (
                    format(field.value, 'dd/MM/yyyy', { locale: pt })
                  ) : (
                    <span>Selecionar data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        />
      </Field>
      <Field label="Renovação (meses)">
        <Controller
          control={control}
          name="safety_checkup_renewal_months"
          render={({ field }) => (
            <Input type="number" min={1} max={60} {...field} placeholder="12" />
          )}
        />
      </Field>
      {nextRenewalDate && (
        <p className="rounded-2xl bg-rz-canvas px-3 py-2 text-[12.5px] text-rz-muted">
          Renovação seguinte:{' '}
          <span className="font-semibold text-rz-ink">
            {format(nextRenewalDate, 'dd/MM/yyyy', { locale: pt })}
          </span>{' '}
          (lembrete 7 dias antes)
        </p>
      )}
    </div>
  );
};
