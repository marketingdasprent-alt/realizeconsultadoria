import { Input } from '@/components/ui/input';
import { formatIban } from '@/lib/utils';
import { UseFormRegister } from 'react-hook-form';

interface EmployeeFinancialSectionProps {
  register: UseFormRegister<any>;
  errors: any;
}

export const EmployeeFinancialSection = ({ register, errors }: EmployeeFinancialSectionProps) => {
  const ibanField = register('iban');

  return (
    <div className="space-y-4">
      <div className="pt-4 border-t">
        <h3 className="text-sm font-semibold text-muted-foreground">Dados Financeiros</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">IBAN</label>
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
          />
          {errors.iban && <p className="text-red-500 text-xs mt-1">{errors.iban.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nº Cartão Dá</label>
          <Input {...register('cartao_da')} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Cartão Refeição</label>
          <Input {...register('cartao_refeicao')} />
        </div>
      </div>
    </div>
  );
};
