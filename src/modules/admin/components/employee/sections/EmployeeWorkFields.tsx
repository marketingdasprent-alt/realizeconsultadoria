import { Link } from 'react-router-dom';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CompanySelect } from '@/components/admin/CompanySelect';
import type { FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ROUTES } from '@/lib/constants';
import { CatalogCombobox } from '../CatalogCombobox';
import { Field } from '../FormSection';
import { ManagerSelect } from './ManagerSelect';

interface EmployeeWorkFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: UseFormSetValue<any>;
  errors: FieldErrors;
  companyId: string;
  companies: { id: string; name: string }[];
  /**
   * Ficha existente: a empresa só se mostra (a troca faz-se com "Mover para empresa…"). Sem isto
   * (colaborador novo) há o seletor de empresa.
   */
  currentCompany?: { name: string; onMove?: () => void };
  position: string;
  department: string;
  /** Ficha aberta (null ao criar). */
  employeeId: string | null;
  managerId: string;
  /** Alcance de equipa: só estas pessoas podem ser responsáveis. */
  managerAllowedIds?: ReadonlySet<string> | null;
}

/** Empresa, função e departamento (das listas geridas), data de admissão e notas internas. */
export const EmployeeWorkFields = ({
  register,
  setValue,
  errors,
  companyId,
  companies,
  currentCompany,
  position,
  department,
  employeeId,
  managerId,
  managerAllowedIds,
}: EmployeeWorkFieldsProps) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    {currentCompany ? (
      <Field
        label="Empresa"
        hint="Para mudar de empresa use «Mover para empresa…»: valida os dados e fica registado."
        className="md:col-span-2"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
            {currentCompany.name || '—'}
          </span>
          {currentCompany.onMove && (
            <Button type="button" variant="outline" size="sm" onClick={currentCompany.onMove}>
              <ArrowRightLeft className="mr-1.5 h-4 w-4" /> Mover para empresa…
            </Button>
          )}
        </div>
      </Field>
    ) : (
      <Field
        label="Empresa *"
        error={errors.company_id?.message as string | undefined}
        className="md:col-span-2"
      >
        <CompanySelect
          companies={companies}
          value={companyId}
          onChange={value => setValue('company_id', value, { shouldDirty: true })}
          placeholder="Selecione uma empresa"
        />
      </Field>
    )}
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
    <Field
      label="Responsável direto"
      htmlFor="employee-manager"
      hint="Quem chefia esta pessoa. Define a equipa de cada chefe e o organograma."
      error={errors.manager_id?.message as string | undefined}
      className="md:col-span-2"
    >
      <ManagerSelect
        id="employee-manager"
        companyId={companyId}
        employeeId={employeeId}
        value={managerId}
        onChange={value => setValue('manager_id', value, { shouldDirty: true })}
        allowedIds={managerAllowedIds}
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
    <Field label="Data de admissão" error={errors.hire_date?.message as string | undefined}>
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
