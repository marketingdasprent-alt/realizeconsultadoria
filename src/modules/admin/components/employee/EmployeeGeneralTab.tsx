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
import { supabase } from '@/integrations/supabase/client';
import { employeeService } from '@/modules/admin/services/employeeService';
import { equipmentService } from '@/modules/admin/services/equipmentService';
import { DOCUMENT_CATEGORIES } from '@/lib/documents';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { AdminUploadDocumentDialog } from '@/modules/documents/components/admin/AdminUploadDocumentDialog';
import { useDocumentDownload } from '@/modules/documents/hooks/useDocumentDownload';
import { useEmployeeDocuments } from '@/modules/documents/hooks/useEmployeeDocuments';
import { slotStates, type RegistrationSlot } from '../../lib/registrationSlots';
import { buildEmployeeDetails } from '../../lib/employeeDetails';
import { useMoveAccess } from '../../hooks/useCompanyMembership';
import { MoveEmployeesDialog } from '../employees/MoveEmployeesDialog';
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
  /** Conta de administrador da mesma pessoa (login à parte). */
  admin_user_id?: string | null;
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
  /** Responsável direto (outro colaborador da mesma empresa). */
  manager_id?: string | null;
  companies?: { name: string };
}

/** Limite do responsável direto quando quem edita só gere a sua equipa. */
export interface ManagerScope {
  /** Quem pode ser escolhido (a própria pessoa e a sua equipa). */
  allowedIds: ReadonlySet<string>;
  /** Fichas de quem está a editar: o colaborador novo fica na sua equipa. */
  ownEmployeeIds: readonly string[];
}

interface EmployeeGeneralTabProps {
  employee: EmployeeRecord | null;
  /** Colaborador novo: a empresa que já vem escolhida (a do filtro da lista). */
  defaultCompanyId?: string;
  companies: { id: string; name: string }[];
  isEditMode: boolean;
  onSaved: () => void;
  /** Depois de mover o colaborador de empresa (para voltar a ler a ficha). */
  onMoved?: () => void;
  onCreated: (employeeId: string) => void;
  /** Só com alcance de equipa (criar ou editar limitado a "Só a minha equipa"). */
  managerScope?: ManagerScope | null;
}

const toFormValues = (
  employee: EmployeeRecord | null,
  defaultCompanyId = '',
  defaultManagerId = ''
) => ({
  name: employee?.name || '',
  email: employee?.email || '',
  phone: employee?.phone || '',
  position: employee?.position || '',
  department: employee?.department || '',
  company_id: employee?.company_id || defaultCompanyId,
  nationality: employee?.nationality || '',
  document_number: employee?.document_number || '',
  hire_date: employee?.hire_date || '',
  notes: employee?.notes || '',
  manager_id: employee ? employee.manager_id || '' : defaultManagerId,
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

/** Mensagem de um erro (também os da BD, que não são Error; ex.: ciclo na chefia). */
const errorMessage = (error: unknown, fallback: string) =>
  error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : fallback;

const isoDate = (date: Date | undefined) => (date ? format(date, 'yyyy-MM-dd') : null);

/**
 * Perfil do colaborador: Dados pessoais, Trabalho e Financeiro à esquerda; Higiene e
 * segurança e Equipamentos à direita; a barra de guardar acompanha o fim do ecrã.
 */
const EmployeeGeneralTab = ({
  employee,
  defaultCompanyId,
  companies,
  isEditMode,
  onSaved,
  onMoved,
  onCreated,
  managerScope,
}: EmployeeGeneralTabProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachFor, setAttachFor] = useState<RegistrationSlot | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const { canExecuteTopic } = useAdminPermissions();
  const moveAccess = useMoveAccess();
  // Em edição a empresa não se escolhe aqui: muda-se com "Mover para empresa…".
  const canMove =
    isEditMode &&
    !!employee &&
    employee.is_active &&
    canExecuteTopic('employees', 'edit') &&
    moveAccess.canOfferMove(employee);

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
    defaultValues: toFormValues(employee, defaultCompanyId),
  });
  const { register, handleSubmit, formState, reset, control, watch, setValue, getValues } = methods;
  const companyId = watch('company_id');

  // Criar com alcance de equipa: o colaborador novo fica abaixo de quem o cria (a ficha dessa
  // pessoa na empresa escolhida). Muda com a empresa, porque a chefia é dentro da mesma empresa.
  const ownIdsKey = managerScope?.ownEmployeeIds.join(',') ?? '';
  useEffect(() => {
    if (isEditMode || !managerScope || !companyId) return;
    let cancelled = false;
    const own = managerScope.ownEmployeeIds;
    (async () => {
      const { data } = own.length
        ? await supabase
            .from('employees')
            .select('id')
            .in('id', [...own])
            .eq('company_id', companyId)
        : { data: [] as { id: string }[] };
      if (cancelled) return;
      const current = getValues('manager_id');
      if (!current || !managerScope.allowedIds.has(current))
        setValue('manager_id', data?.[0]?.id ?? '', { shouldDirty: false });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ownIdsKey representa managerScope
  }, [isEditMode, companyId, ownIdsKey]);
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
      const details = buildEmployeeDetails(
        {
          ...data,
          // O formulário tem Date; buildEmployeeDetails só lê as versões *_iso (texto).
          safety_checkup_date: isoDate(data.safety_checkup_date),
          birth_date: isoDate(data.birth_date),
          safety_checkup_date_iso: isoDate(data.safety_checkup_date),
          birth_date_iso: isoDate(data.birth_date),
        },
        isEditMode ? 'edit' : 'create'
      );
      const managerId = data.manager_id || null;
      // Quem só gere a equipa não pode deixar a pessoa fora dela (sem responsável).
      if (managerScope && !managerId) {
        toast({
          title: 'Falta o responsável direto',
          description: 'Escolha alguém da sua equipa, ou a si, como responsável direto.',
          variant: 'destructive',
        });
        return;
      }
      // Só se grava quando muda: a ficha continua a gravar mesmo antes de a coluna existir.
      const managerChanged = managerId !== (employee?.manager_id ?? null);

      if (isEditMode && employee) {
        const email = data.email.toLowerCase().trim();
        if (email !== employee.email.toLowerCase().trim()) {
          const { error } = await employeeService.updateEmail(employee.id, email);
          if (error) throw error;
        }
        const { error } = await employeeService.update(
          employee.id,
          managerChanged ? { ...details, manager_id: managerId } : details
        );
        if (error) throw error;
        onSaved();
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- o responsável grava-se depois de criar
      const { manager_id: _manager, ...createData } = data;
      const { data: created, error } = await employeeService.createWithPassword({
        ...createData,
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
      if (created?.employeeId && (details.hire_date || details.notes || managerId)) {
        const { error: detailsError } = await employeeService.update(created.employeeId, {
          hire_date: details.hire_date,
          notes: details.notes,
          ...(managerId ? { manager_id: managerId } : {}),
        });
        if (detailsError) {
          toast({
            title: 'Colaborador criado, mas falta completar a ficha',
            description: 'Abra a ficha e preencha a admissão e o responsável direto.',
            variant: 'destructive',
          });
        }
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
        description: errorMessage(error, 'Ocorreu um erro inesperado.'),
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
                companyId={companyId}
                companies={companies}
                currentCompany={
                  isEditMode
                    ? {
                        name:
                          employee?.companies?.name ??
                          companies.find(company => company.id === employee?.company_id)?.name ??
                          '',
                        onMove: canMove ? () => setMoveOpen(true) : undefined,
                      }
                    : undefined
                }
                position={watch('position') ?? ''}
                department={watch('department') ?? ''}
                employeeId={employee?.id ?? null}
                managerId={watch('manager_id') ?? ''}
                managerAllowedIds={managerScope?.allowedIds ?? null}
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

      {employee && isEditMode && (
        <MoveEmployeesDialog
          employees={
            moveOpen
              ? [
                  {
                    id: employee.id,
                    name: employee.name,
                    company_id: employee.company_id,
                    user_id: employee.user_id,
                    is_active: employee.is_active,
                    companyName: employee.companies?.name,
                  },
                ]
              : null
          }
          onClose={() => setMoveOpen(false)}
          onMoved={() => onMoved?.()}
        />
      )}
    </FormProvider>
  );
};

export default EmployeeGeneralTab;
