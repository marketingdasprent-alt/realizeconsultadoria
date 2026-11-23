import React, { useEffect, useId } from 'react';
import {
  useForm,
  type FieldError,
  type FieldErrors,
  type Resolver,
  type UseFormRegisterReturn,
} from 'react-hook-form';
import type { ZodType } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createCompanySchema,
  createCompanyWithAdminSchema,
  type CreateCompanyWithAdminInput,
} from '@/lib/schemas';
import { useAllGroups } from '../hooks/useSharing';
import type { Company } from '@/modules/admin/services/companyService';

interface CompanyFormProps {
  initialData?: Company | null;
  /** Na criação traz também o primeiro administrador e o grupo (campos admin_* e group_*). */
  onSubmit: (data: CreateCompanyWithAdminInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

interface FieldProps {
  label: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
  type?: string;
  /** Ocupa a linha toda a partir de `sm`. */
  wide?: boolean;
}

/** Rótulo ligado ao campo (htmlFor/id) e erro anunciado (aria-invalid/aria-describedby). */
const Field: React.FC<FieldProps> = ({ label, registration, error, type, wide }) => {
  const id = useId();
  const errorId = `${id}-erro`;
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <label htmlFor={id} className="block text-sm font-medium mb-1">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...registration}
      />
      {error && (
        <p id={errorId} className="text-red-500 text-xs mt-1">
          {error.message}
        </p>
      )}
    </div>
  );
};

/**
 * Resolver com safeParse: o @hookform/resolvers 3.x não trata os erros do zod 4 (lança em vez de os
 * devolver ao formulário quando há mais do que um erro).
 */
const safeZodResolver =
  (schema: ZodType): Resolver<CreateCompanyWithAdminInput> =>
  async values => {
    const result = schema.safeParse(values);
    if (result.success) {
      return { values: result.data as CreateCompanyWithAdminInput, errors: {} };
    }
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      if (!errors[key]) errors[key] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors: errors as FieldErrors<CreateCompanyWithAdminInput> };
  };

const NO_GROUP = '__nenhum__';
const NEW_GROUP = '__novo__';

/** Primeiro administrador e grupo opcional da empresa nova (só o super admin cria empresas). */
const NewCompanyAdminFields: React.FC<{
  register: ReturnType<typeof useForm<CreateCompanyWithAdminInput>>['register'];
  errors: ReturnType<typeof useForm<CreateCompanyWithAdminInput>>['formState']['errors'];
  groupId: string;
  onGroupChange: (value: string) => void;
}> = ({ register, errors, groupId, onGroupChange }) => {
  const groups = useAllGroups(true);
  const selectId = useId();
  // A lista vem com uma linha por (grupo, empresa): um grupo só aparece uma vez.
  const uniqueGroups = [
    ...new Map(
      (groups.data ?? []).map(row => [row.group_id, { id: row.group_id, name: row.group_name }])
    ).values(),
  ];
  const selectValue = groupId === NEW_GROUP ? NEW_GROUP : groupId || NO_GROUP;
  return (
    <>
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold">Primeiro administrador</h3>
        <p className="text-xs text-muted-foreground">
          Cria a conta de quem vai gerir esta empresa. Gere só esta empresa e recebe os dados de
          acesso por email.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Nome do administrador *"
          registration={register('admin_name')}
          error={errors.admin_name}
        />
        <Field
          label="Email do administrador *"
          type="email"
          registration={register('admin_email')}
          error={errors.admin_email}
        />
        <Field
          label="Palavra-passe inicial * (mínimo 8 caracteres)"
          type="password"
          registration={register('admin_password')}
          error={errors.admin_password}
          wide
        />
      </div>
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold">Grupo de empresas (opcional)</h3>
        <p className="text-xs text-muted-foreground">
          Empresas do mesmo grupo partilham o Feed (só leitura). Sem grupo, a empresa tem o seu
          próprio Feed e organograma.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={selectId} className="block text-sm font-medium mb-1">
            Grupo
          </label>
          <select
            id={selectId}
            value={selectValue}
            onChange={e => onGroupChange(e.target.value === NO_GROUP ? '' : e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value={NO_GROUP}>Sem grupo</option>
            {uniqueGroups.map(group => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
            <option value={NEW_GROUP}>Criar um grupo novo…</option>
          </select>
        </div>
        {groupId === NEW_GROUP && (
          <Field label="Nome do grupo novo *" registration={register('group_name')} />
        )}
      </div>
    </>
  );
};

export const CompanyForm: React.FC<CompanyFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateCompanyWithAdminInput>({
    resolver: safeZodResolver(initialData ? createCompanySchema : createCompanyWithAdminSchema),
    defaultValues: {
      name: '',
      nif: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      postal_code: '',
      notes: '',
      is_active: true,
      admin_name: '',
      admin_email: '',
      admin_password: '',
      group_id: '',
      group_name: '',
    },
  });

  // Quem usa o formulário dá-lhe uma `key` por empresa (ou "nova"), por isso a criação nasce vazia.
  // Aqui só se repõem os valores quando a empresa em edição é atualizada.
  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        nif: initialData.nif,
        email: initialData.email,
        phone: initialData.phone || '',
        address: initialData.address || '',
        city: initialData.city || '',
        postal_code: initialData.postal_code || '',
        notes: initialData.notes || '',
        is_active: initialData.is_active,
      });
    }
  }, [initialData, reset]);

  return (
    <form
      onSubmit={handleSubmit(data =>
        onSubmit({
          ...data,
          group_id: data.group_id === NEW_GROUP ? '' : data.group_id,
          group_name: data.group_id === NEW_GROUP ? (data.group_name ?? '').trim() : '',
        })
      )}
      className="space-y-4 mt-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome da Empresa *" registration={register('name')} error={errors.name} wide />
        <Field label="NIF *" registration={register('nif')} error={errors.nif} />
        <Field label="Telefone" registration={register('phone')} error={errors.phone} />
        <Field
          label="Email *"
          type="email"
          registration={register('email')}
          error={errors.email}
          wide
        />
        <Field label="Morada" registration={register('address')} error={errors.address} wide />
        <Field label="Cidade" registration={register('city')} error={errors.city} />
        <Field
          label="Código Postal"
          registration={register('postal_code')}
          error={errors.postal_code}
        />
      </div>
      {!initialData && (
        <NewCompanyAdminFields
          register={register}
          errors={errors}
          groupId={watch('group_id') ?? ''}
          onGroupChange={value => setValue('group_id', value)}
        />
      )}
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" variant="gold" disabled={isLoading}>
          {isLoading ? 'A guardar...' : initialData ? 'Guardar Alterações' : 'Criar Empresa'}
        </Button>
      </div>
    </form>
  );
};
