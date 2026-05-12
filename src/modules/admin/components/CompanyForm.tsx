import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
    } else {
      reset();
    }
  }, [initialData, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Nome da Empresa *</label>
          <Input {...register('name')} />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">NIF *</label>
          <Input {...register('nif')} />
          {errors.nif && <p className="text-red-500 text-xs mt-1">{errors.nif.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Telefone</label>
          <Input {...register('phone')} />
          {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Email *</label>
          <Input type="email" {...register('email')} />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Morada</label>
          <Input {...register('address')} />
          {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cidade</label>
          <Input {...register('city')} />
          {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Código Postal</label>
          <Input {...register('postal_code')} />
          {errors.postal_code && (
            <p className="text-red-500 text-xs mt-1">{errors.postal_code.message}</p>
          )}
        </div>
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
