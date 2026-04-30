import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Edit, Trash2, MoreHorizontal, AlertTriangle, Key, ArrowUp, ArrowDown, ArrowUpDown, Upload, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import EmployeeAvisoDialog from "@/components/admin/EmployeeAvisoDialog";
import DeleteConfirmDialog from "@/components/admin/DeleteConfirmDialog";
import ChangeEmployeePasswordDialog from "@/components/admin/ChangeEmployeePasswordDialog";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import BulkDocumentUploadDialog from "@/components/admin/BulkDocumentUploadDialog";
import ResendInviteSuccessDialog from "@/components/admin/ResendInviteSuccessDialog";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  position: string | null;
  department: string | null;
  company_id: string;
  is_active: boolean;
  created_at: string;
  companies?: { name: string };
}

const EmployeesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canExecuteTopic } = useAdminPermissions();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [avisoDialogEmployee, setAvisoDialogEmployee] = useState<Employee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [passwordDialogEmployee, setPasswordDialogEmployee] = useState<Employee | null>(null);
  const [bulkDocDialogOpen, setBulkDocDialogOpen] = useState(false);
  const [isResending, setIsResending] = useState<string | null>(null);
  const [resendSuccessData, setResendSuccessData] = useState<{ name: string; password: string } | null>(null);
  
  // Sorting state
  type SortField = 'name' | 'email' | 'company' | 'position' | 'status';
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3" /> 
      : <ArrowDown className="h-3 w-3" />;
  };
  
  // Permission checks
  const canCreate = canExecuteTopic('employees', 'create');
  const canEdit = canExecuteTopic('employees', 'edit');
  const canDelete = canExecuteTopic('employees', 'delete');
  const canNotifications = canExecuteTopic('employees', 'notifications');
  const canResetPassword = canExecuteTopic('employees', 'reset_password');

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*, companies(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openDeleteDialog = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!employeeToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', employeeToDelete.id);

      if (error) throw error;
      toast({ title: "Colaborador eliminado com sucesso!" });
      fetchData();
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResendInvite = async (employee: Employee) => {
    setIsResending(employee.id);
    try {
      // Local password generation
      const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
      let newPassword = "";
      for (let i = 0; i < 12; i++) {
        newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const { data: sessionData } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke('change-employee-password', {
        body: { 
          employee_id: employee.id,
          new_password: newPassword,
          send_email: true
        },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (error) throw error;
      
      if (data?.success) {
        setResendSuccessData({
          name: employee.name,
          password: newPassword
        });
        
        if (data?.email_success) {
          toast({ title: "Convite re-enviado com sucesso!" });
        } else {
          toast({
            title: "Convite Enviado (SEM EMAIL)",
            description: `A senha foi alterada, mas o email falhou: ${data?.email_error || "Erro na Brevo"}`,
            variant: "destructive",
          });
        }
      } else {
        throw new Error(data?.error || "Erro ao re-enviar convite");
      }
    } catch (error: any) {
      console.error('Error resending invite:', error);
      toast({
        title: "Erro ao re-enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsResending(null);
    }
  };

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.companies?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'name':
        comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        break;
      case 'email':
        comparison = a.email.toLowerCase().localeCompare(b.email.toLowerCase());
        break;
      case 'company':
        comparison = (a.companies?.name || '').toLowerCase().localeCompare((b.companies?.name || '').toLowerCase());
        break;
      case 'position':
        comparison = (a.position || '').toLowerCase().localeCompare((b.position || '').toLowerCase());
        break;
      case 'status':
        comparison = a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1;
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Colaboradores</h1>
            <p className="text-muted-foreground mt-1">
              Gerir colaboradores das empresas
            </p>
          </div>

          <div className="flex gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => setBulkDocDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Enviar Documento</span>
                <span className="sm:hidden">Doc. Empresa</span>
              </Button>
            )}
            {canCreate && (
              <Button variant="gold" onClick={() => navigate('/admin/colaboradores/novo')}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Colaborador
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="search"
                name="search-employees"
                placeholder="Pesquisar por nome, email ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="shadow-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="h-8 py-1 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Nome
                      <SortIcon field="name" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="hidden md:table-cell h-8 py-1 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center gap-1">
                      Email
                      <SortIcon field="email" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="h-8 py-1 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort('company')}
                  >
                    <div className="flex items-center gap-1">
                      Empresa
                      <SortIcon field="company" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="hidden md:table-cell h-8 py-1 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort('position')}
                  >
                    <div className="flex items-center gap-1">
                      Cargo
                      <SortIcon field="position" />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="h-8 py-1 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Estado
                      <SortIcon field="status" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[40px] h-8 py-1 px-2"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-sm">
                      A carregar...
                    </TableCell>
                  </TableRow>
                ) : sortedEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-sm text-muted-foreground">
                      Nenhum colaborador encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedEmployees.map((employee) => (
                    <TableRow 
                      key={employee.id} 
                      className={`h-8 ${canEdit ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                      onClick={() => canEdit && navigate(`/admin/colaboradores/${employee.id}`)}
                    >
                      <TableCell className="py-1 px-2">
                        <span className="font-medium">{employee.name}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-1 px-2 text-sm">{employee.email}</TableCell>
                      <TableCell className="py-1 px-2 text-sm">{employee.companies?.name}</TableCell>
                      <TableCell className="hidden md:table-cell py-1 px-2 text-sm">{employee.position || "-"}</TableCell>
                      <TableCell className="py-1 px-2">
                        <Badge variant={employee.is_active ? "default" : "secondary"} className="text-xs py-0">
                          {employee.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1 px-2" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canEdit && (
                              <DropdownMenuItem onClick={() => navigate(`/admin/colaboradores/${employee.id}`)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {canNotifications && (
                              <DropdownMenuItem onClick={() => setAvisoDialogEmployee(employee)}>
                                <AlertTriangle className="h-4 w-4 mr-2" />
                                Avisos
                              </DropdownMenuItem>
                            )}
                            {canResetPassword && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => setPasswordDialogEmployee(employee)}
                                >
                                  <Key className="h-4 w-4 mr-2" />
                                  Definir Nova Senha
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleResendInvite(employee)}
                                  disabled={!!isResending}
                                >
                                  {isResending === employee.id ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                  )}
                                  Re-enviar Convite
                                </DropdownMenuItem>
                              </>
                            )}
                            {canDelete && (
                              <DropdownMenuItem 
                                onClick={() => openDeleteDialog(employee)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Employee Aviso Dialog */}
        <EmployeeAvisoDialog
          open={!!avisoDialogEmployee}
          onOpenChange={(open) => !open && setAvisoDialogEmployee(null)}
          employeeId={avisoDialogEmployee?.id || ""}
          employeeName={avisoDialogEmployee?.name || ""}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setEmployeeToDelete(null);
          }}
          title="Eliminar Colaborador"
          description="Tem a certeza que deseja eliminar este colaborador?"
          itemName={employeeToDelete?.name}
          onConfirm={handleDelete}
          isLoading={isDeleting}
        />

        {/* Change Employee Password Dialog */}
        <ChangeEmployeePasswordDialog
          open={!!passwordDialogEmployee}
          onOpenChange={(open) => !open && setPasswordDialogEmployee(null)}
          employeeId={passwordDialogEmployee?.id || ""}
          employeeName={passwordDialogEmployee?.name || ""}
        />

        {/* Bulk Document Upload Dialog */}
        <BulkDocumentUploadDialog
          open={bulkDocDialogOpen}
          onOpenChange={setBulkDocDialogOpen}
        />

        {/* Resend Success Dialog */}
        <ResendInviteSuccessDialog
          open={!!resendSuccessData}
          onOpenChange={(open) => !open && setResendSuccessData(null)}
          employeeName={resendSuccessData?.name || ""}
          newPassword={resendSuccessData?.password || ""}
        />
      </div>
    </>
  );
};

export default EmployeesPage;
