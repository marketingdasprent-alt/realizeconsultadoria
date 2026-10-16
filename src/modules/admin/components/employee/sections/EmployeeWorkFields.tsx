import { Link } from 'react-router-dom';
import type { FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ROUTES } from '@/lib/constants';
import { CatalogCombobox } from '../CatalogCombobox';
import { Field } from '../FormSection';

interface EmployeeWorkFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: UseFormSetValue<any>;
  errors: FieldErrors;
  companyId: string;
  companies: { id: string; name: string }[];
  position: string;
  department: string;
}

/** Empresa, função e departamento (das listas geridas), data de admissão e notas internas. */
export const EmployeeWorkFields = ({
  register,
  setValue,
  errors,
  companyId,
  companies,
  position,
  department,
}: EmployeeWorkFieldsProps) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <Field
      label="Empresa *"
      error={errors.company_id?.message as string | undefined}
      className="md:col-span-2"
    >
      <Select
        value={companyId}
        onValueChange={value => setValue('company_id', value, { shouldDirty: true })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione uma empresa" />
        </SelectTrigger>
        <SelectContent>
          {companies.map(company => (
            <SelectItem key={company.id} value={company.id}>
              {company.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
    <Field label="Função">
      <CatalogCombobox
        kind="job_positions"
        noun="função"
        placeholder="Escolher função"
        value={position}
        onChange={value => setValue('position', value, { shouldDirty: true })}
      />
    </Field>
    <Field label="Departamento">
      <CatalogCombobox
        kind="departments"
        noun="departamento"
        placeholder="Escolher departamento"
        value={department}
        onChange={value => setValue('department', value, { shouldDirty: true })}
      />
    </Field>
    <p className="-mt-2 text-xs text-rz-muted md:col-span-2">
      As listas de funções e departamentos gerem-se em{' '}
      <Link
        to={`${ROUTES.ADMIN.SETTINGS}?tab=equipa`}
        className="font-semibold text-rz-primary hover:underline"
      >
        Configurações → Equipa
      </Link>
      .
    </p>
    <Field label="Data de admissão">
      <Input type="date" {...register('hire_date')} />
    </Field>
    <Field
      label="Notas internas"
      hint="Só os administradores veem estas notas."
      className="md:col-span-2"
    >
      <Textarea {...register('notes')} rows={3} placeholder="Observações sobre o colaborador" />
    </Field>
  </div>
);
