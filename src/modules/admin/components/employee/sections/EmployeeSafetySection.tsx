import { format, addMonths } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Control, useWatch, Controller } from 'react-hook-form';

interface EmployeeSafetySectionProps {
  control: Control<any>;
}

export const EmployeeSafetySection = ({ control }: EmployeeSafetySectionProps) => {
  const safetyCheckupDate = useWatch({ control, name: 'safety_checkup_date' });
  const renewalMonths = useWatch({ control, name: 'safety_checkup_renewal_months' });

  const nextRenewalDate =
    safetyCheckupDate && renewalMonths
      ? addMonths(safetyCheckupDate, parseInt(renewalMonths) || 12)
      : null;

  return (
    <div className="space-y-4">
      <div className="pt-4 border-t">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Higiene e Segurança no Trabalho
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Próxima Consulta</label>
          <Controller
            control={control}
            name="safety_checkup_date"
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
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
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Renovação (meses)</label>
          <Controller
            control={control}
            name="safety_checkup_renewal_months"
            render={({ field }) => (
              <Input type="number" min={1} max={60} {...field} placeholder="12" />
            )}
          />
        </div>

        {nextRenewalDate && (
          <div className="md:col-span-2">
            <p className="text-sm text-muted-foreground">
              Próxima Renovação:{' '}
              <span className="font-medium text-foreground">
                {format(nextRenewalDate, 'dd/MM/yyyy', { locale: pt })}
              </span>
              <span className="ml-1">(lembrete 7 dias antes)</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
