import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Briefcase, HardHat, KeyRound, Laptop, Loader2, UserRound, Wallet } from 'lucide-react';
import { FormProvider, useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ROUTES } from '@/lib/constants';
import { createEmployeeSchema, updateEmployeeSchema } from '@/lib/schemas';
import { formatIban } from '@/lib/utils';
import { employeeService } from '@/modules/admin/services/employeeService';
import { equipmentService } from '@/modules/admin/services/equipmentService';
import { DOCUMENT_CATEGORIES } from '@/lib/documents';
import { AdminUploadDocumentDialog } from '@/modules/documents/components/admin/AdminUploadDocumentDialog';
import { useDocumentDownload } from '@/modules/documents/hooks/useDocumentDownload';
import { useEmployeeDocuments } from '@/modules/documents/hooks/useEmployeeDocuments';
import { slotStates, type RegistrationSlot } from '../../lib/registrationSlots';
import { InlineDocumentSlot } from './files/InlineDocumentSlot';
import { FormSection } from './FormSection';
import { EmployeeAccessFields } from './sections/EmployeeAccessFields';
import { EmployeeEquipmentSection } from './sections/EmployeeEquipmentSection';
import { EmployeeFinancialSection } from './sections/EmployeeFinancialSection';
import { EmployeePersonalFields } from './sections/EmployeePersonalFields';
import { EmployeeSafetySection } from './sections/EmployeeSafetySection';
import { EmployeeWorkFields } from './sections/EmployeeWorkFields';

export interface EmployeeRecord {
  id: string;
  user_id: string | null;
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
  hire_date: string | null;
  notes: string | null;
  companies?: { name: string };
}

interface EmployeeGeneralTabProps {
  employee: EmployeeRecord | null;
  companies: { id: string; name: string }[];
  isEditMode: boolean;
  onSaved: () => void;
  onCreated: (employeeId: string) => void;
}

const toFormValues = (employee: EmployeeRecord | null) => ({
  name: employee?.name || '',
  email: employee?.email || '',
  phone: employee?.phone || '',
  position: employee?.position || '',
  department: employee?.department || '',
  company_id: employee?.company_id || '',
  nationality: employee?.nationality || '',
  document_number: employee?.document_number || '',
  hire_date: employee?.hire_date || '',
  notes: employee?.notes || '',
  password: '',
  confirmPassword: '',
  vacation_days: '22',
  self_schedulable_days: '',
  iban: formatIban(employee?.iban || ''),
  cartao_da: employee?.cartao_da || '',
  cartao_refeicao: employee?.cartao_refeicao || '',
  safety_checkup_date: employee?.safety_checkup_date
    ? new Date(employee.safety_checkup_date)
    : undefined,
  safety_checkup_renewal_months: employee?.safety_checkup_renewal_months?.toString() || '12',
  birth_date: employee?.birth_date ? new Date(employee.birth_date) : undefined,
});

type FormValues = ReturnType<typeof toFormValues>;

const isoDate = (date: Date | undefined) => (date ? format(date, 'yyyy-MM-dd') : null);

/**
 * Perfil do colaborador: Dados pessoais, Trabalho e Financeiro à esquerda; Higiene e
 * segurança e Equipamentos à direita; a barra de guardar acompanha o fim do ecrã.
 */
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
  const [attachFor, setAttachFor] = useState<RegistrationSlot | null>(null);

  // Documentos de registo ao lado dos campos (identificação, IBAN): ver, anexar, substituir.
  const documents = useEmployeeDocuments(isEditMode ? (employee?.id ?? null) : null);
  const download = useDocumentDownload();
  const slots = useMemo(() => slotStates(documents.all), [documents.all]);
  const docSlot = (key: string) =>
    isEditMode ? (
      <InlineDocumentSlot
        state={slots.find(state => state.slot.key === key)}
        onAttach={() => setAttachFor(slots.find(state => state.slot.key === key)?.slot ?? null)}
        onOpen={download.open}
        openingId={download.openingId}
      />
    ) : null;

  const methods = useForm<FormValues>({
    resolver: zodResolver(isEditMode ? updateEmployeeSchema : createEmployeeSchema),
    defaultValues: toFormValues(employee),
  });
  const { register, handleSubmit, formState, reset, control, watch, setValue } = methods;
  const errors = formState.errors as FieldErrors;

  useEffect(() => {
    if (employee) reset(toFormValues(employee));
  }, [employee, reset]);

  const { data: equipments = [] } = useQuery({
    queryKey: ['employee-equipments', employee?.id],
    queryFn: async () => (await equipmentService.getByEmployeeId(employee!.id)).data || [],
    enabled: !!employee?.id,
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const details = {
        name: data.name,
        phone: data.phone || null,
        position: data.position || null,
        department: data.department?.trim() || null,
        company_id: data.company_id,
        nationality: data.nationality || null,
        document_number: data.document_number || null,
        iban: data.iban || null,
        cartao_da: data.cartao_da || null,
        cartao_refeicao: data.cartao_refeicao || null,
        safety_checkup_date: isoDate(data.safety_checkup_date),
        safety_checkup_renewal_months: data.safety_checkup_renewal_months
          ? parseInt(data.safety_checkup_renewal_months)
          : null,
        birth_date: isoDate(data.birth_date),
        hire_date: data.hire_date || null,
        notes: data.notes?.trim() || null,
      };

      if (isEditMode && employee) {
        const email = data.email.toLowerCase().trim();
        if (email !== employee.email.toLowerCase().trim()) {
          const { error } = await employeeService.updateEmail(employee.id, email);
          if (error) throw error;
        }
        const { error } = await employeeService.update(employee.id, details);
        if (error) throw error;
        onSaved();
        return;
      }

      const { data: created, error } = await employeeService.createWithPassword({
        ...data,
        vacation_days: parseFloat(data.vacation_days) || 22,
        self_schedulable_days: data.self_schedulable_days
          ? parseFloat(data.self_schedulable_days)
          : null,
        safety_checkup_date: details.safety_checkup_date,
        birth_date: details.birth_date,
      });
      if (error) throw error;
      if (created?.error) throw new Error(created.error);
      // A criação (função do servidor) não guarda a admissão nem as notas: completam-se já.
      if (created?.employeeId && (details.hire_date || details.notes)) {
        await employeeService.update(created.employeeId, {
          hire_date: details.hire_date,
          notes: details.notes,
        });
      }
      toast({
        title: 'Colaborador criado',
        description: created?.emailSent
          ? `Email com as credenciais enviado para ${data.email}.`
          : 'Criado, mas o email de boas-vindas não foi enviado.',
        variant: created?.emailSent ? 'default' : 'destructive',
      });
      if (created?.employeeId) onCreated(created.employeeId);
      else navigate(ROUTES.ADMIN.EMPLOYEES);
    } catch (error: unknown) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sem isto, uma validação falhada só marcava o campo e não se percebia porque não guardava.
  const onInvalid = (formErrors: FieldErrors) => {
    const first = Object.values(formErrors).find(error => typeof error?.message === 'string');
    toast({
      title: 'Não foi possível guardar',
      description: (first?.message as string) || 'Verifique os campos assinalados a vermelho.',
      variant: 'destructive',
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <FormSection title="Dados pessoais" icon={UserRound}>
              <EmployeePersonalFields
                register={register}
                control={control}
                errors={errors}
                idDocument={docSlot('id')}
              />
            </FormSection>
            <FormSection title="Trabalho" icon={Briefcase}>
              <EmployeeWorkFields
                register={register}
                setValue={setValue}
                errors={errors}
                companyId={watch('company_id')}
                companies={companies}
                position={watch('position') ?? ''}
                department={watch('department') ?? ''}
              />
            </FormSection>
            {!isEditMode && (
              <FormSection
                title="Acesso à app e férias"
                icon={KeyRound}
                description="O colaborador recebe as credenciais por email."
              >
                <EmployeeAccessFields
                  register={register}
                  errors={errors}
                  password={watch('password') ?? ''}
                />
              </FormSection>
            )}
            <FormSection title="Dados financeiros" icon={Wallet}>
              <EmployeeFinancialSection
                register={register}
                errors={errors}
                ibanDocument={docSlot('iban')}
              />
            </FormSection>
          </div>

          <div className="space-y-4">
            <FormSection title="Higiene e segurança" icon={HardHat}>
              <EmployeeSafetySection control={control} />
            </FormSection>
            {isEditMode && (
              <FormSection
                title="Equipamentos"
                icon={Laptop}
                description="Atribuídos em Acessos → Atribuições"
              >
                <EmployeeEquipmentSection equipments={equipments} />
              </FormSection>
            )}
          </div>
        </div>

        <div className="sticky bottom-3 z-10 mt-4 flex items-center gap-2 rounded-[22px] bg-white/95 p-2.5 pl-4 shadow-rz-pop ring-1 ring-rz-line backdrop-blur">
          <p className="min-w-0 flex-1 truncate text-[13px] text-rz-muted">
            {formState.isDirty ? 'Tem alterações por guardar.' : 'Sem alterações.'}
          </p>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => navigate(ROUTES.ADMIN.EMPLOYEES)}
          >
            {isEditMode ? 'Voltar' : 'Cancelar'}
          </Button>
          <Button type="submit" className="rounded-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEditMode ? 'Guardar alterações' : 'Criar colaborador'}
          </Button>
        </div>
      </form>

      {employee && (
        <AdminUploadDocumentDialog
          open={!!attachFor}
          onOpenChange={value => !value && setAttachFor(null)}
          employeeId={employee.id}
          onUploaded={documents.refetch}
          categories={DOCUMENT_CATEGORIES.filter(c => attachFor?.categories.includes(c.value))}
          initialCategory={attachFor?.categories.length === 1 ? attachFor.categories[0] : undefined}
        />
      )}
    </FormProvider>
  );
};

export default EmployeeGeneralTab;
