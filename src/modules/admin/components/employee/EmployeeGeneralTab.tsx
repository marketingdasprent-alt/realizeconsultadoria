import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Loader2, RefreshCw, CalendarIcon } from 'lucide-react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { createEmployeeSchema, updateEmployeeSchema } from '@/lib/schemas';
import { employeeService } from '@/modules/admin/services/employeeService';
import { equipmentService } from '@/modules/admin/services/equipmentService';
import ChangeEmployeePasswordDialog from '@/components/admin/ChangeEmployeePasswordDialog';
import ResendInviteSuccessDialog from '@/components/admin/ResendInviteSuccessDialog';
import { EmployeeFinancialSection } from './sections/EmployeeFinancialSection';
import { EmployeeSafetySection } from './sections/EmployeeSafetySection';
import { EmployeeEquipmentSection } from './sections/EmployeeEquipmentSection';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  department: string | null;
  company_id: string;
  is_active: boolean;
  nationality: string | null;
  document_number: string | null;
  iban: string | null;
  cartao_da: string | null;
  cartao_refeicao: string | null;
  safety_checkup_date: string | null;
  safety_checkup_renewal_months: number | null;
  birth_date: string | null;
}

interface Company {
  id: string;
  name: string;
}

interface EmployeeGeneralTabProps {
  employee: Employee | null;
  companies: Company[];
  isEditMode: boolean;
  onSaved: () => void;
  onCreated: (employeeId: string) => void;
}

const EmployeeGeneralTab = ({
  employee,
  companies,
  isEditMode,
  onSaved,
  onCreated,
}: EmployeeGeneralTabProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccessData, setResendSuccessData] = useState<{
    name: string;
    password: string;
  } | null>(null);

  const methods = useForm({
    resolver: zodResolver(isEditMode ? updateEmployeeSchema : createEmployeeSchema),
    defaultValues: {
      name: employee?.name || '',
      email: employee?.email || '',
      phone: employee?.phone || '',
      position: employee?.position || '',
      department: employee?.department || '',
      company_id: employee?.company_id || '',
      nationality: employee?.nationality || '',
      document_number: employee?.document_number || '',
      password: '',
      confirmPassword: '',
      vacation_days: '22',
      self_schedulable_days: '',
      iban: employee?.iban || '',
      cartao_da: employee?.cartao_da || '',
      cartao_refeicao: employee?.cartao_refeicao || '',
      safety_checkup_date: employee?.safety_checkup_date
        ? new Date(employee.safety_checkup_date)
        : undefined,
      safety_checkup_renewal_months: employee?.safety_checkup_renewal_months?.toString() || '12',
      birth_date: employee?.birth_date ? new Date(employee.birth_date) : undefined,
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    watch,
  } = methods;

  useEffect(() => {
    if (employee) {
      reset({
        name: employee.name,
        email: employee.email,
        phone: employee.phone || '',
        position: employee.position || '',
        department: employee.department || '',
        company_id: employee.company_id,
        nationality: employee.nationality || '',
        document_number: employee.document_number || '',
        iban: employee.iban || '',
        cartao_da: employee.cartao_da || '',
        cartao_refeicao: employee.cartao_refeicao || '',
        safety_checkup_date: employee.safety_checkup_date
          ? new Date(employee.safety_checkup_date)
          : undefined,
        safety_checkup_renewal_months: employee.safety_checkup_renewal_months?.toString() || '12',
        birth_date: employee.birth_date ? new Date(employee.birth_date) : undefined,
      });
    }
  }, [employee, reset]);

  const { data: assignedEquipments = [] } = useQuery({
    queryKey: ['employee-equipments', employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data } = await equipmentService.getByEmployeeId(employee.id);
      return data || [];
    },
    enabled: !!employee?.id,
  });

  const handleResendInvite = async () => {
    if (!employee) return;
    setIsResending(true);
    try {
      const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
      let newPassword = '';
      for (let i = 0; i < 12; i++) {
        newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const { data, error } = await employeeService.resendInvite(employee.id, newPassword);

      if (error) throw error;

      if (data?.success) {
        setResendSuccessData({ name: employee.name, password: newPassword });
        toast({
          title: data.email_success
            ? 'Convite re-enviado com sucesso!'
            : 'Convite Enviado (SEM EMAIL)',
          variant: data.email_success ? 'default' : 'destructive',
        });
      } else {
        throw new Error(data?.error || 'Erro ao re-enviar convite');
      }
    } catch (error: any) {
      toast({ title: 'Erro ao re-enviar', description: error.message, variant: 'destructive' });
    } finally {
      setIsResending(false);
    }
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      if (isEditMode && employee) {
        if (data.email.toLowerCase().trim() !== employee.email.toLowerCase().trim()) {
          const { error: emailError } = await employeeService.updateEmail(
            employee.id,
            data.email.toLowerCase().trim()
          );
          if (emailError) throw emailError;
        }

        const { error } = await employeeService.update(employee.id, {
          name: data.name,
          phone: data.phone || null,
          position: data.position || null,
          department: data.department || null,
          company_id: data.company_id,
          nationality: data.nationality || null,
          document_number: data.document_number || null,
          iban: data.iban || null,
          cartao_da: data.cartao_da || null,
          cartao_refeicao: data.cartao_refeicao || null,
          safety_checkup_date: data.safety_checkup_date
            ? format(data.safety_checkup_date, 'yyyy-MM-dd')
            : null,
          safety_checkup_renewal_months: data.safety_checkup_renewal_months
            ? parseInt(data.safety_checkup_renewal_months)
            : null,
          birth_date: data.birth_date ? format(data.birth_date, 'yyyy-MM-dd') : null,
        });

        if (error) throw error;
        onSaved();
      } else {
        const { data: createData, error } = await employeeService.createWithPassword({
          ...data,
          vacation_days: parseFloat(data.vacation_days) || 22,
          self_schedulable_days: data.self_schedulable_days
            ? parseFloat(data.self_schedulable_days)
            : null,
          safety_checkup_date: data.safety_checkup_date
            ? format(data.safety_checkup_date, 'yyyy-MM-dd')
            : null,
          birth_date: data.birth_date ? format(data.birth_date, 'yyyy-MM-dd') : null,
        });

        if (error) throw error;
        if (createData?.error) throw new Error(createData.error);

        toast({
          title: 'Colaborador criado com sucesso!',
          description: createData?.emailSent
            ? `Email com credenciais enviado para ${data.email}.`
            : 'Colaborador criado, mas o email de boas-vindas não foi enviado.',
          variant: createData?.emailSent ? 'default' : 'destructive',
        });
        if (createData?.employeeId) onCreated(createData.employeeId);
        else navigate('/admin/colaboradores');
      }
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Empresa *</label>
                <Select
                  value={watch('company_id')}
                  onValueChange={value => methods.setValue('company_id', value)}
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
                {errors.company_id && (
                  <p className="text-red-500 text-xs mt-1">{errors.company_id.message as string}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Nome Completo *</label>
                <Input {...register('name')} />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Email *</label>
                <Input type="email" {...register('email')} />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email.message as string}</p>
                )}
              </div>

              {!isEditMode && (
                <>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Senha Inicial *</label>
                    <Input
                      type="password"
                      {...register('password')}
                      placeholder="Mínimo 8 caracteres"
                    />
                    {errors.password && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.password.message as string}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Confirmar Senha *</label>
                    <Input
                      type="password"
                      {...register('confirmPassword')}
                      placeholder="Repita a senha"
                    />
                    {errors.confirmPassword && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.confirmPassword.message as string}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Dias de férias</label>
                    <Input type="number" {...register('vacation_days')} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Dias que pode marcar</label>
                    <Input type="number" {...register('self_schedulable_days')} />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">Telefone</label>
                <Input {...register('phone')} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Cargo</label>
                <Input {...register('position')} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Departamento</label>
                <Input {...register('department')} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nacionalidade</label>
                <Input {...register('nationality')} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nº Documento</label>
                <Input {...register('document_number')} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Data de Nascimento</label>
                <Controller
                  control={control}
                  name="birth_date"
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
                          locale={pt}
                          captionLayout="dropdown-buttons"
                          fromYear={1940}
                          toYear={new Date().getFullYear()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
              </div>
            </div>

            <EmployeeFinancialSection register={register} errors={errors} />

            {isEditMode && <EmployeeEquipmentSection equipments={assignedEquipments} />}

            <EmployeeSafetySection control={control} />

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/colaboradores')}
              >
                Cancelar
              </Button>
              {isEditMode && employee && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendInvite}
                  disabled={isResending}
                >
                  {isResending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Re-enviar Convite
                </Button>
              )}
              <Button type="submit" variant="gold" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : isEditMode ? (
                  'Guardar Alterações'
                ) : (
                  'Criar Colaborador'
                )}
              </Button>
            </div>
          </form>
        </FormProvider>
      </CardContent>

      {employee && (
        <ChangeEmployeePasswordDialog
          open={passwordDialogOpen}
          onOpenChange={setPasswordDialogOpen}
          employeeId={employee.id}
          employeeName={employee.name}
        />
      )}
      {employee && (
        <ResendInviteSuccessDialog
          open={!!resendSuccessData}
          onOpenChange={open => !open && setResendSuccessData(null)}
          employeeName={resendSuccessData?.name || ''}
          newPassword={resendSuccessData?.password || ''}
        />
      )}
    </Card>
  );
};

export default EmployeeGeneralTab;
