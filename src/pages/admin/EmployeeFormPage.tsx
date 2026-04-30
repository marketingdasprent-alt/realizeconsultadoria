import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import EmployeeGeneralTab from "@/components/admin/employee/EmployeeGeneralTab";
import EmployeeVacationTab from "@/components/admin/employee/EmployeeVacationTab";
import EmployeeDocumentsTab from "@/components/admin/employee/EmployeeDocumentsTab";
import EmployeeAttachmentsTab from "@/components/admin/employee/EmployeeAttachmentsTab";

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
  companies?: { name: string };
}

interface Company {
  id: string;
  name: string;
}

const EmployeeFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canExecuteTopic } = useAdminPermissions();
  
  const isEditMode = !!id;
  const [isLoading, setIsLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeTab, setActiveTab] = useState("geral");

  const canEdit = canExecuteTopic('employees', 'edit');
  const canVacation = canExecuteTopic('employees', 'vacation');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      // If editing, fetch employee data
      if (id) {
        const { data: employeeData, error: employeeError } = await supabase
          .from('employees')
          .select('*, companies(name)')
          .eq('id', id)
          .single();

        if (employeeError) throw employeeError;
        setEmployee(employeeData);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaved = () => {
    toast({ title: "Colaborador guardado com sucesso!" });
    navigate('/admin/colaboradores');
  };

  const handleEmployeeCreated = (newEmployeeId: string) => {
    // After creating, navigate to edit page for the new employee
    navigate(`/admin/colaboradores/${newEmployeeId}`);
  };

  if (isLoading) {
    return (
      <>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-gold" />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/admin/colaboradores')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold">
              {isEditMode ? employee?.name || "Editar Colaborador" : "Novo Colaborador"}
            </h1>
            {isEditMode && employee?.companies?.name && (
              <p className="text-muted-foreground mt-1">
                {employee.companies.name}
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            {isEditMode && canVacation && (
              <TabsTrigger value="ferias">Férias</TabsTrigger>
            )}
            {isEditMode && canEdit && (
              <>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                <TabsTrigger value="anexos">Anexos</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="geral" className="mt-6">
            <EmployeeGeneralTab
              employee={employee}
              companies={companies}
              isEditMode={isEditMode}
              onSaved={handleSaved}
              onCreated={handleEmployeeCreated}
            />
          </TabsContent>

          {isEditMode && canVacation && (
            <TabsContent value="ferias" className="mt-6">
              <EmployeeVacationTab
                employeeId={employee?.id || ""}
                employeeName={employee?.name || ""}
              />
            </TabsContent>
          )}

          {isEditMode && canEdit && (
            <>
              <TabsContent value="documentos" className="mt-6">
                <EmployeeDocumentsTab employeeId={employee?.id || ""} />
              </TabsContent>

              <TabsContent value="anexos" className="mt-6">
                <EmployeeAttachmentsTab employeeId={employee?.id || ""} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </>
  );
};

export default EmployeeFormPage;
