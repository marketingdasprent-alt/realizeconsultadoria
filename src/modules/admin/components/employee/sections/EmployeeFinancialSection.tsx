import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { formatIban } from '@/lib/utils';
import { Field } from '../FormSection';

interface EmployeeFinancialSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  errors: FieldErrors;
}

/** IBAN (formatado ao escrever) e cartões. */
export const EmployeeFinancialSection = ({ register, errors }: EmployeeFinancialSectionProps) => {
  const ibanField = register('iban');

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field
        label="IBAN"
        error={errors.iban?.message as string | undefined}
        className="md:col-span-2"
      >
        <Input
          {...ibanField}
          onChange={e => {
            e.target.value = formatIban(e.target.value);
            ibanField.onChange(e);
          }}
          onBlur={e => {
            e.target.value = formatIban(e.target.value);
            ibanField.onBlur(e);
          }}
          placeholder="PT50 0000 0000 0000 0000 0000 0"
          maxLength={42}
          autoCapitalize="characters"
          spellCheck={false}
          className="font-mono tracking-wide"
        />
      </Field>
      <Field label="Nº Cartão Dá">
        <Input {...register('cartao_da')} />
      </Field>
      <Field label="Cartão Refeição">
        <Input {...register('cartao_refeicao')} />
      </Field>
    </div>
  );
};
