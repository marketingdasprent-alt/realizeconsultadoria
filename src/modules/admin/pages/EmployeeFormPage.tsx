import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { ROUTES } from '@/lib/constants';
import EmployeeGeneralTab, { type EmployeeRecord } from '../components/employee/EmployeeGeneralTab';
import EmployeeVacationTab from '../components/employee/EmployeeVacationTab';
import EmployeeDocumentsTab from '../components/employee/EmployeeDocumentsTab';
import EmployeeAttachmentsTab from '../components/employee/EmployeeAttachmentsTab';
import EmployeeEmailsTab from '../components/employee/EmployeeEmailsTab';
import EmployeeFoldersTab from '../components/employee/EmployeeFoldersTab';
import EmployeePayslipsTab from '../components/employee/EmployeePayslipsTab';
import EmployeeFinanceHistoryTab from '../components/employee/EmployeeFinanceHistoryTab';
import { EmployeeProfileHeader } from '../components/employee/EmployeeProfileHeader';
import { EmployeeDocumentAlerts } from '../components/employee/EmployeeDocumentAlerts';
import { EmployeeAdminAccountCard } from '../components/employee/EmployeeAdminAccountCard';
import { useEmployeeDocuments } from '@/modules/documents/hooks/useEmployeeDocuments';
import { useEmployeeAvatars } from '../hooks/useEmployeeAvatars';

interface Company {
  id: string;
  name: string;
}

/**
 * Ficha do colaborador: cabeçalho com a fotografia, contactos e ações; separadores Perfil,
 * Férias, Documentos (identificação e registo), Recibos e Anexos. Sem id é a criação de um colaborador novo.
 */
const EmployeeFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canExecuteTopic } = useAdminPermissions();
  const avatarOf = useEmployeeAvatars();

  const isEditMode = !!id;
  const [isLoading, setIsLoading] = useState(true);
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeTab, setActiveTab] = useState('perfil');
  // Validades e documentos por aprovar (aviso no topo); volta a ler ao mudar de separador.
  const documents = useEmployeeDocuments(id ?? null);

  const canEdit = canExecuteTopic('employees', 'edit');
  const canVacation = canExecuteTopic('employees', 'vacation');

  const fetchData = useCallback(async () => {
    try {
      const [companiesRes, employeeRes] = await Promise.all([
        supabase.from('companies').select('id, name').eq('is_active', true).order('name'),
        id
          ? supabase.from('employees').select('*, companies(name)').eq('id', id).single()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (companiesRes.error) throw companiesRes.error;
      if (employeeRes.error) throw employeeRes.error;
      setCompanies(companiesRes.data || []);
      setEmployee(employeeRes.data as EmployeeRecord | null);
    } catch (error: unknown) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível carregar a ficha.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  // Guardar fica na ficha (atualizada), em vez de voltar à lista.
  const handleSaved = () => {
    toast({ title: 'Alterações guardadas' });
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-rz-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isEditMode && employee ? (
        <>
          <EmployeeProfileHeader
            employee={employee}
            avatarUrl={avatarOf(employee.user_id)}
            onChanged={fetchData}
          />
          {canEdit && (
            <EmployeeDocumentAlerts
              documents={documents.all}
              onShowDocuments={() => setActiveTab('documentos')}
            />
          )}
        </>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(ROUTES.ADMIN.EMPLOYEES)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-rz-muted hover:bg-white hover:text-rz-ink"
            aria-label="Voltar aos colaboradores"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">
              Novo colaborador
            </h1>
            <p className="text-[14px] text-rz-muted">
              Depois de criar, a ficha abre com as férias, documentos e anexos.
            </p>
          </div>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={tab => {
          setActiveTab(tab);
          documents.refetch();
        }}
        className="w-full"
      >
        {isEditMode && (
          <TabsList className="mb-4 h-auto flex-wrap justify-start">
            <TabsTrigger value="perfil">Perfil</TabsTrigger>
            {canVacation && <TabsTrigger value="ferias">Férias</TabsTrigger>}
            {canEdit && <TabsTrigger value="documentos">Documentos</TabsTrigger>}
            {canEdit && <TabsTrigger value="recibos">Recibos</TabsTrigger>}
            {canEdit && <TabsTrigger value="financeiro">Financeiro</TabsTrigger>}
            {canEdit && <TabsTrigger value="anexos">Anexos</TabsTrigger>}
            {canEdit && <TabsTrigger value="emails">Emails</TabsTrigger>}
            {canEdit && <TabsTrigger value="pastas">Pastas</TabsTrigger>}
          </TabsList>
        )}

        <TabsContent value="perfil" className="mt-0">
          <EmployeeGeneralTab
            employee={employee}
            companies={companies}
            isEditMode={isEditMode}
            onSaved={handleSaved}
            onCreated={newId => navigate(`${ROUTES.ADMIN.EMPLOYEES}/${newId}`)}
          />
          {isEditMode && employee && canEdit && (
            <EmployeeAdminAccountCard employee={employee} onChanged={fetchData} />
          )}
        </TabsContent>

        {isEditMode && employee && canVacation && (
          <TabsContent value="ferias" className="mt-0">
            <EmployeeVacationTab employeeId={employee.id} employeeName={employee.name} />
          </TabsContent>
        )}
        {isEditMode && employee && canEdit && (
          <>
            <TabsContent value="documentos" className="mt-0">
              <EmployeeDocumentsTab employeeId={employee.id} />
            </TabsContent>
            <TabsContent value="recibos" className="mt-0">
              <EmployeePayslipsTab employeeId={employee.id} />
            </TabsContent>
            <TabsContent value="financeiro" className="mt-0">
              <EmployeeFinanceHistoryTab employeeId={employee.id} />
            </TabsContent>
            <TabsContent value="anexos" className="mt-0">
              <EmployeeAttachmentsTab employeeId={employee.id} />
            </TabsContent>
            <TabsContent value="emails" className="mt-0">
              <EmployeeEmailsTab employeeId={employee.id} />
            </TabsContent>
            <TabsContent value="pastas" className="mt-0">
              <EmployeeFoldersTab employeeId={employee.id} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};

export default EmployeeFormPage;
