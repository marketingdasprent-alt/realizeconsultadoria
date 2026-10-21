import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Field } from '../FormSection';

interface EmployeePersonalFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any>;
  errors: FieldErrors;
  /** Documento de identificação (ver / anexar), ao lado do número. */
  idDocument?: ReactNode;
}

const message = (errors: FieldErrors, name: string) => errors[name]?.message as string | undefined;

/** Nome, email, telefone, nascimento, nacionalidade e documento. */
export const EmployeePersonalFields = ({
  register,
  control,
  errors,
  idDocument,
}: EmployeePersonalFieldsProps) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <Field label="Nome completo *" error={message(errors, 'name')} className="md:col-span-2">
      <Input {...register('name')} />
    </Field>
    <Field
      label="Email *"
      error={message(errors, 'email')}
      hint="É também o utilizador para entrar na app."
    >
      <Input type="email" {...register('email')} />
    </Field>
    <Field label="Telefone">
      <Input {...register('phone')} />
    </Field>
    <Field label="Data de nascimento">
      <Controller
        control={control}
        name="birth_date"
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
                {field.value
                  ? format(field.value, 'dd/MM/yyyy', { locale: pt })
                  : 'Selecionar data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={field.value}
                onSelect={field.onChange}
                locale={pt}
                captionLayout="dropdown"
                fromYear={1940}
                toYear={new Date().getFullYear()}
                labels={{ labelMonthDropdown: () => '', labelYearDropdown: () => '' }}
                classNames={{
                  caption_label: 'hidden',
                  caption_dropdowns: 'flex items-center gap-1',
                  dropdown:
                    'text-sm font-medium bg-transparent border-0 cursor-pointer focus:outline-none capitalize',
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )}
      />
    </Field>
    <Field label="Nacionalidade">
      <Input {...register('nationality')} />
    </Field>
    <Field label="Nº documento de identificação">
      <Input {...register('document_number')} />
    </Field>
    {idDocument && <div className="self-end">{idDocument}</div>}
  </div>
);
