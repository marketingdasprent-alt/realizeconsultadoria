import React, { useEffect, useId } from 'react';
import { useForm, type FieldError, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createCompanySchema, type CreateCompanyInput } from '@/lib/schemas';
import type { Company } from '@/modules/admin/services/companyService';

interface CompanyFormProps {
  initialData?: Company | null;
  onSubmit: (data: CreateCompanyInput) => Promise<void>;
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
  } = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
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
