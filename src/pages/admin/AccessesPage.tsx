import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  MoreHorizontal, 
  Pencil, 
  Trash2,
  ExternalLink,
  Lock,
  Mail,
  Monitor,
  Share2,
  Wifi,
  User,
  Database,
  Server,
  Key,
  Users,
  AlertTriangle,
  Phone,
  Package,
  ClipboardList,
  Info,
} from "lucide-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import DeleteConfirmDialog from "@/components/admin/DeleteConfirmDialog";
import PhonesTab from "@/components/admin/PhonesTab";
import EquipmentsTab from "@/components/admin/EquipmentsTab";
import AssignmentsTab from "@/components/admin/AssignmentsTab";
import { supabase } from "@/integrations/supabase/client";

interface Access {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string | null;
  notes: string | null;
  company_id: string;
  category_id: string | null;
  employee_id: string | null;
  created_at: string;
  updated_at: string;
  companies?: { name: string };
  access_categories?: { name: string; icon: string | null };
  employees?: { name: string } | null;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  company_id: string;
  is_active: boolean;
}

interface EmployeeDepartmentEmail {
  id: string;
  access_id: string;
  employee_id: string;
}

// Mapeamento de ícones por nome da categoria
const getCategoryIcon = (iconName: string | null | undefined) => {
  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    mail: Mail,
    email: Mail,
    monitor: Monitor,
    sistema: Monitor,
    system: Monitor,
    share: Share2,
    share2: Share2,
    partilha: Share2,
    network: Wifi,
    rede: Wifi,
    wifi: Wifi,
    user: User,
    utilizador: User,
    database: Database,
    "base dados": Database,
    db: Database,
    server: Server,
    servidor: Server,
    key: Key,
  };

  if (!iconName) return Key;
  
  const normalizedName = iconName.toLowerCase().trim();
  return iconMap[normalizedName] || Key;
};

const AccessesPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canExecuteTopic, isSuperAdmin, isLoading: isLoadingPermissions } = useAdminPermissions();
  const canManage = canExecuteTopic("accesses", "manage");
  const isMobile = useIsMobile();

  // Redirecionar se não for super admin
  useEffect(() => {
    if (!isLoadingPermissions && !isSuperAdmin) {
      navigate('/admin');
      toast({
        title: "Acesso negado",
        description: "Esta página é exclusiva para Super Administradores.",
        variant: "destructive",
      });
    }
  }, [isLoadingPermissions, isSuperAdmin, navigate, toast]);

  const [searchTerm, setSearchTerm] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccess, setEditingAccess] = useState<Access | null>(null);
  const [deleteAccess, setDeleteAccess] = useState<Access | null>(null);
  
  // Estados para modal de colaboradores
  const [viewEmployeesAccessId, setViewEmployeesAccessId] = useState<string | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeToAdd, setEmployeeToAdd] = useState<string>("");
  
  // Estado para validação de username duplicado
  const [usernameError, setUsernameError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    username: "",
    password: "",
    url: "",
    notes: "",
    company_id: "",
    category_id: "",
    employee_id: "",
  });

  // Fetch accesses
  const { data: accesses = [], isLoading } = useQuery({
    queryKey: ["accesses", companyFilter, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("accesses")
        .select(`
          *,
          companies(name),
          access_categories(name, icon),
          employees(name)
        `)
        .order("title");

      if (companyFilter !== "all") {
        query = query.eq("company_id", companyFilter);
      }
      if (categoryFilter !== "all") {
        query = query.eq("category_id", categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Access[];
    },
  });

  // Fetch companies with domain
  const { data: companies = [] } = useQuery({
    queryKey: ["companies-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, domain")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Company[];
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["access-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_categories")
        .select("id, name, icon")
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  // Fetch all employees (including inactive for modal display)
  const { data: allEmployees = [] } = useQuery({
    queryKey: ["employees-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, email, company_id, is_active")
        .order("name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Filter active employees for form select
  const employees = allEmployees.filter(emp => emp.is_active);

  // Fetch employee_department_emails para o acesso selecionado
  const { data: departmentEmails = [] } = useQuery({
    queryKey: ["employee-department-emails", viewEmployeesAccessId],
    queryFn: async () => {
      if (!viewEmployeesAccessId) return [];
      const { data, error } = await supabase
        .from("employee_department_emails")
        .select("id, access_id, employee_id")
        .eq("access_id", viewEmployeesAccessId);
      if (error) throw error;
      return data as EmployeeDepartmentEmail[];
    },
    enabled: !!viewEmployeesAccessId,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingAccess) {
        const { error } = await supabase
          .from("accesses")
          .update({
            title: data.title,
            username: data.username,
            password: data.password,
            url: data.url || null,
            notes: data.notes || null,
            company_id: data.company_id,
            category_id: data.category_id || null,
            employee_id: data.employee_id || null,
          })
          .eq("id", editingAccess.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("accesses").insert({
          title: data.title,
          username: data.username,
          password: data.password,
          url: data.url || null,
          notes: data.notes || null,
          company_id: data.company_id,
          category_id: data.category_id || null,
          employee_id: data.employee_id || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accesses"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingAccess ? "Acesso atualizado" : "Acesso criado",
        description: editingAccess 
          ? "O acesso foi atualizado com sucesso."
          : "O novo acesso foi criado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao guardar o acesso.",
        variant: "destructive",
      });
      console.error("Save error:", error);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accesses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accesses"] });
      setDeleteAccess(null);
      toast({
        title: "Acesso eliminado",
        description: "O acesso foi eliminado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao eliminar o acesso.",
        variant: "destructive",
      });
      console.error("Delete error:", error);
    },
  });

  // Mutation para atualizar colaboradores de um email departamental
  const updateDepartmentEmailsMutation = useMutation({
    mutationFn: async ({ accessId, employeeIds }: { accessId: string; employeeIds: string[] }) => {
      // Eliminar registos antigos
      const { error: deleteError } = await supabase
        .from("employee_department_emails")
        .delete()
        .eq("access_id", accessId);
      if (deleteError) throw deleteError;

      // Inserir novos registos
      if (employeeIds.length > 0) {
        const inserts = employeeIds.map(empId => ({
          access_id: accessId,
          employee_id: empId,
        }));
        const { error: insertError } = await supabase
          .from("employee_department_emails")
          .insert(inserts);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-department-emails"] });
      setViewEmployeesAccessId(null);
      setSelectedEmployeeIds([]);
      toast({
        title: "Colaboradores atualizados",
        description: "Os colaboradores com acesso foram atualizados com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao atualizar os colaboradores.",
        variant: "destructive",
      });
      console.error("Update department emails error:", error);
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      username: "",
      password: "",
      url: "",
      notes: "",
      company_id: "",
      category_id: "",
      employee_id: "",
    });
    setEditingAccess(null);
    setUsernameError(null);
  };

  // Helper functions para categorias de email
  const isEmailCategory = (categoryId: string | null | undefined) => {
    if (!categoryId) return false;
    const category = categories.find(c => c.id === categoryId);
    return category?.name?.toLowerCase().includes("email") || false;
  };

  const isDepartmentalEmail = (categoryId: string | null | undefined) => {
    if (!categoryId) return false;
    const category = categories.find(c => c.id === categoryId);
    return category?.name?.toLowerCase().includes("departamental") || false;
  };

  const getCompanyDomain = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.domain || null;
  };

  // Check se deve mostrar sufixo de domínio
  const showDomainSuffix = formData.company_id && 
    isEmailCategory(formData.category_id) && 
    getCompanyDomain(formData.company_id);

  const currentDomain = formData.company_id ? getCompanyDomain(formData.company_id) : null;

  // Verificar se é email departamental no form
  const isFormDepartmental = isDepartmentalEmail(formData.category_id);

  // Encontrar categoria "Acesso Principal"
  const mainAccessCategory = categories.find(c => 
    c.name.toLowerCase().includes("acesso principal") || 
    c.name.toLowerCase().includes("principal")
  );

  // Colaboradores sem acesso principal
  const employeesWithoutMainAccess = useMemo(() => {
    if (companyFilter === "all" || !mainAccessCategory) return [];
    
    const companyEmployees = employees.filter(emp => emp.company_id === companyFilter);
    const employeesWithAccess = accesses
      .filter(acc => acc.category_id === mainAccessCategory.id && acc.employee_id)
      .map(acc => acc.employee_id);
    
    return companyEmployees.filter(emp => !employeesWithAccess.includes(emp.id));
  }, [companyFilter, mainAccessCategory, employees, accesses]);

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (access: Access) => {
    setEditingAccess(access);
    // Se for email com domínio, extrair apenas a parte antes do @
    let username = access.username;
    const accessCompany = companies.find(c => c.id === access.company_id);
    const accessIsEmail = isEmailCategory(access.category_id);
    if (accessIsEmail && accessCompany?.domain && username.endsWith(`@${accessCompany.domain}`)) {
      username = username.replace(`@${accessCompany.domain}`, "");
    }
    setFormData({
      title: access.title,
      username: username,
      password: access.password,
      url: access.url || "",
      notes: access.notes || "",
      company_id: access.company_id,
      category_id: access.category_id || "",
      employee_id: access.employee_id || "",
    });
    setUsernameError(null);
    setIsDialogOpen(true);
  };

  const openEmployeesDialog = (access: Access) => {
    setViewEmployeesAccessId(access.id);
    // Os employeeIds serão carregados pelo useEffect
  };

  // Abrir dialog pré-preenchido para criar acesso principal
  const openCreateMainAccessDialog = (employee: Employee) => {
    resetForm();
    setFormData({
      title: `Acesso ${employee.name}`,
      username: "",
      password: "",
      url: "",
      notes: "",
      company_id: employee.company_id,
      category_id: mainAccessCategory?.id || "",
      employee_id: employee.id,
    });
    setIsDialogOpen(true);
  };

  // Atualizar selectedEmployeeIds quando os dados chegarem
  useEffect(() => {
    if (viewEmployeesAccessId && departmentEmails.length >= 0) {
      setSelectedEmployeeIds(departmentEmails.map(de => de.employee_id));
    }
  }, [viewEmployeesAccessId, departmentEmails]);

  const togglePasswordVisibility = (id: string) => {
    setVisiblePasswords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text: string, fieldId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Verificar username duplicado
  const checkDuplicateUsername = async (username: string, companyId: string, excludeId?: string): Promise<boolean> => {
    let query = supabase
      .from("accesses")
      .select("id")
      .eq("company_id", companyId)
      .eq("username", username);
    
    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    
    const { data, error } = await query;
    if (error) return false;
    return (data?.length || 0) > 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.username || !formData.password || !formData.company_id) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Construir username final com domínio se aplicável
    let finalUsername = formData.username;
    if (showDomainSuffix && currentDomain) {
      finalUsername = `${formData.username}@${currentDomain}`;
    }

    // Verificar duplicação
    const isDuplicate = await checkDuplicateUsername(
      finalUsername, 
      formData.company_id, 
      editingAccess?.id
    );
    
    if (isDuplicate) {
      setUsernameError("Já existe um acesso com este username nesta empresa.");
      toast({
        title: "Username duplicado",
        description: "Já existe um acesso com este username nesta empresa.",
        variant: "destructive",
      });
      return;
    }

    setUsernameError(null);

    // Se for email departamental, forçar employee_id = null
    const dataToSave = {
      ...formData,
      username: finalUsername,
      employee_id: isFormDepartmental ? "" : formData.employee_id,
    };

    saveMutation.mutate(dataToSave);
  };

  const handleSaveEmployees = async () => {
    if (viewEmployeesAccessId) {
      await updateDepartmentEmailsMutation.mutateAsync({
        accessId: viewEmployeesAccessId,
        employeeIds: selectedEmployeeIds,
      });
    }
  };

  const handleAddEmployee = () => {
    if (employeeToAdd && !selectedEmployeeIds.includes(employeeToAdd)) {
      setSelectedEmployeeIds(prev => [...prev, employeeToAdd]);
      setEmployeeToAdd("");
    }
  };

  const handleRemoveEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => prev.filter(empId => empId !== id));
  };

  const handleCloseAndSave = async () => {
    await handleSaveEmployees();
  };

  const filteredAccesses = accesses.filter((access) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      access.title.toLowerCase().includes(searchLower) ||
      access.username.toLowerCase().includes(searchLower) ||
      access.companies?.name.toLowerCase().includes(searchLower)
    );
  });

  // Agrupar acessos por categoria
  const groupedAccesses = useMemo(() => {
    const groups: Record<string, { category: Category | null; accesses: Access[] }> = {};
    
    // Criar grupo para "Sem Categoria"
    groups["uncategorized"] = { category: null, accesses: [] };
    
    // Criar grupos para cada categoria
    categories.forEach(cat => {
      groups[cat.id] = { category: cat, accesses: [] };
    });
    
    // Distribuir acessos pelos grupos
    filteredAccesses.forEach(access => {
      const categoryId = access.category_id || "uncategorized";
      if (groups[categoryId]) {
        groups[categoryId].accesses.push(access);
      } else {
        groups["uncategorized"].accesses.push(access);
      }
    });
    
    // Filtrar grupos vazios e ordenar
    return Object.entries(groups)
      .filter(([_, group]) => group.accesses.length > 0)
      .sort(([keyA, groupA], [keyB, groupB]) => {
        // "Sem Categoria" sempre no final
        if (keyA === "uncategorized") return 1;
        if (keyB === "uncategorized") return -1;
        return (groupA.category?.name || "").localeCompare(groupB.category?.name || "");
      });
  }, [filteredAccesses, categories]);

  // Obter o acesso selecionado para o modal de colaboradores
  const selectedAccessForEmployees = viewEmployeesAccessId 
    ? accesses.find(a => a.id === viewEmployeesAccessId) 
    : null;

  // Colaboradores disponíveis para adicionar (não associados)
  const availableEmployees = useMemo(() => {
    return allEmployees
      .filter(emp => emp.is_active && !selectedEmployeeIds.includes(emp.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allEmployees, selectedEmployeeIds]);

  // Colaboradores associados (para mostrar na lista)
  const associatedEmployees = useMemo(() => {
    return allEmployees
      .filter(emp => selectedEmployeeIds.includes(emp.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allEmployees, selectedEmployeeIds]);

  // Renderização de um acesso (reutilizado em table e cards)
  const renderAccessActions = (access: Access) => {
    const accessIsEmail = isEmailCategory(access.category_id);
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openEditDialog(access)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
          {accessIsEmail && (
            <DropdownMenuItem onClick={() => openEmployeesDialog(access)}>
              <Users className="h-4 w-4 mr-2" />
              Colaboradores
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setDeleteAccess(access)}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Renderização da tabela (desktop)
  const renderDesktopTable = (categoryAccesses: Access[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          {companyFilter === "all" && <TableHead>Empresa</TableHead>}
          <TableHead>Username</TableHead>
          <TableHead>Senha</TableHead>
          
          {canManage && <TableHead className="w-12"></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {categoryAccesses.map((access) => (
          <TableRow key={access.id}>
            <TableCell className="font-medium py-2">
              {access.title}
            </TableCell>
            {companyFilter === "all" && (
              <TableCell>{access.companies?.name}</TableCell>
            )}
            <TableCell>
              <div className="flex items-center gap-2">
              <span className="text-sm bg-muted px-2 py-1 rounded font-medium">
                  {access.username}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(access.username, `user-${access.id}`)}
                >
                  {copiedField === `user-${access.id}` ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
              <span className="text-sm bg-muted px-2 py-1 rounded font-medium">
                  {visiblePasswords.has(access.id)
                    ? access.password
                    : "••••••••"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => togglePasswordVisibility(access.id)}
                >
                  {visiblePasswords.has(access.id) ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(access.password, `pass-${access.id}`)}
                >
                  {copiedField === `pass-${access.id}` ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </TableCell>
            {canManage && (
              <TableCell>
                {renderAccessActions(access)}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  // Renderização de cards (mobile)
  const renderMobileCards = (categoryAccesses: Access[]) => (
    <div className="space-y-3">
      {categoryAccesses.map((access) => (
        <Card key={access.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{access.title}</h4>
              {companyFilter === "all" && (
                <p className="text-xs text-muted-foreground truncate">
                  {access.companies?.name}
                </p>
              )}
            </div>
            {canManage && renderAccessActions(access)}
          </div>
          
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">User:</span>
              <span className="text-xs bg-muted px-2 py-1 rounded font-medium flex-1 truncate">
                {access.username}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => copyToClipboard(access.username, `user-${access.id}`)}
              >
                {copiedField === `user-${access.id}` ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">Senha:</span>
              <span className="text-xs bg-muted px-2 py-1 rounded font-medium flex-1 truncate">
                {visiblePasswords.has(access.id)
                  ? access.password
                  : "••••••••"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => togglePasswordVisibility(access.id)}
              >
                {visiblePasswords.has(access.id) ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => copyToClipboard(access.password, `pass-${access.id}`)}
              >
                {copiedField === `pass-${access.id}` ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Acessos</h1>
            <p className="text-muted-foreground">
              Gestão de credenciais e acessos
            </p>
          </div>
        </div>

        <Tabs defaultValue="accesses" className="w-full">
          <ScrollArea className="w-full whitespace-nowrap pb-2">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:max-w-2xl sm:grid-cols-4 h-10">
              <TabsTrigger value="accesses" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4">
                <Lock className="h-4 w-4 hidden sm:inline" />
                Acessos
              </TabsTrigger>
              <TabsTrigger value="phones" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4">
                <Phone className="h-4 w-4 hidden sm:inline" />
                <span className="sm:hidden">SIM</span>
                <span className="hidden sm:inline">Cartão SIM</span>
              </TabsTrigger>
              <TabsTrigger value="equipments" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4">
                <Package className="h-4 w-4 hidden sm:inline" />
                <span className="sm:hidden">Equipam.</span>
                <span className="hidden sm:inline">Equipamentos</span>
              </TabsTrigger>
              <TabsTrigger value="assignments" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4">
                <ClipboardList className="h-4 w-4 hidden sm:inline" />
                <span className="sm:hidden">Atrib.</span>
                <span className="hidden sm:inline">Atribuições</span>
              </TabsTrigger>
            </TabsList>
          </ScrollArea>

          <TabsContent value="accesses" className="mt-6">
            {canManage && (
              <div className="flex justify-end mb-4">
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Acesso
                </Button>
              </div>
            )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Lista de Acessos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode="search"
                  name="search-accesses"
                  placeholder="Pesquisar por título, utilizador ou empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Alerta de colaboradores sem acesso principal */}
            {employeesWithoutMainAccess.length > 0 && (
              <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-200">
                  Colaboradores sem Acesso Principal
                </AlertTitle>
                <AlertDescription>
                  <p className="text-yellow-700 dark:text-yellow-300 mb-3">
                    Os seguintes colaboradores não têm acesso principal configurado:
                  </p>
                  <div className="space-y-2">
                    {employeesWithoutMainAccess.map((emp) => (
                      <div key={emp.id} className="flex items-center justify-between gap-2 py-1">
                        <span className="text-sm text-yellow-800 dark:text-yellow-200">
                          • {emp.name}
                        </span>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-7 text-xs border-yellow-500 text-yellow-700 hover:bg-yellow-100"
                          onClick={() => openCreateMainAccessDialog(emp)}
                        >
                          Criar Acesso
                        </Button>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : groupedAccesses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || companyFilter !== "all" || categoryFilter !== "all"
                  ? "Nenhum acesso encontrado com os filtros aplicados."
                  : "Ainda não existem acessos registados."}
              </div>
            ) : (
              <Accordion type="multiple" defaultValue={groupedAccesses.map(([key]) => key)} className="space-y-2">
                {groupedAccesses.map(([categoryId, group]) => {
                  const CategoryIcon = getCategoryIcon(group.category?.icon || group.category?.name);
                  const categoryName = group.category?.name || "Sem Categoria";
                  const count = group.accesses.length;
                  
                  return (
                    <AccordionItem key={categoryId} value={categoryId} className="border rounded-lg px-4">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                          <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                          <span className="font-display text-lg font-semibold">{categoryName}</span>
                          <Badge variant="secondary" className="ml-2">
                            {count} {count === 1 ? "acesso" : "acessos"}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
                        {isMobile 
                          ? renderMobileCards(group.accesses)
                          : renderDesktopTable(group.accesses)
                        }
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="phones" className="mt-6">
            <PhonesTab 
              canManage={canManage} 
              companies={companies} 
              companyFilter={companyFilter}
              setCompanyFilter={setCompanyFilter}
            />
          </TabsContent>

          <TabsContent value="equipments" className="mt-6">
            <EquipmentsTab 
              canManage={canManage} 
              companies={companies} 
              companyFilter={companyFilter}
              setCompanyFilter={setCompanyFilter}
            />
          </TabsContent>

          <TabsContent value="assignments" className="mt-6">
            <AssignmentsTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccess ? "Editar Acesso" : "Novo Acesso"}
            </DialogTitle>
            <DialogDescription>
              {editingAccess
                ? "Atualize os dados do acesso."
                : "Preencha os dados para criar um novo acesso."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* Aviso para Acesso Principal / Login */}
              {(formData.category_id === mainAccessCategory?.id || formData.employee_id) && (
                <Alert className="mb-4 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-800 dark:text-blue-300 text-sm font-semibold">
                    Aviso de Credenciais
                  </AlertTitle>
                  <AlertDescription className="text-blue-700 dark:text-blue-400 text-xs mt-1 leading-relaxed">
                    Esta senha é apenas informativa para este registo de acesso. 
                    <strong> Alterar a senha aqui NÃO altera a senha de login do colaborador no Portal. </strong> 
                    Para repor a senha de login, vá ao menu <strong className="underline">Colaboradores</strong> e selecione "Definir Nova Senha".
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Email principal"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_id">Empresa *</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(value) => setFormData({ ...formData, company_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category_id">Categoria</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Campo Colaborador - escondido para emails departamentais */}
              {!isFormDepartmental && (
                <div className="space-y-2">
                  <Label htmlFor="employee_id">Colaborador (opcional)</Label>
                  <Select
                    value={formData.employee_id || "none"}
                    onValueChange={(value) => setFormData({ ...formData, employee_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um colaborador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (acesso geral)</SelectItem>
                      {employees
                        .filter(emp => !formData.company_id || emp.company_id === formData.company_id)
                        .map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Aviso para emails departamentais */}
              {isFormDepartmental && editingAccess && (
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                  <p>Este é um email departamental. Após guardar, use o botão "Colaboradores" no menu de ações para gerir quem tem acesso.</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">Username *</Label>
                {showDomainSuffix && currentDomain ? (
                  <div className="flex items-center gap-0">
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => {
                        setFormData({ ...formData, username: e.target.value });
                        setUsernameError(null);
                      }}
                      placeholder="Ex: joao.silva"
                      className={`rounded-r-none border-r-0 ${usernameError ? "border-destructive" : ""}`}
                    />
                    <div className="h-10 px-3 flex items-center bg-muted border border-input rounded-r-md text-sm text-muted-foreground">
                      @{currentDomain}
                    </div>
                  </div>
                ) : (
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => {
                      setFormData({ ...formData, username: e.target.value });
                      setUsernameError(null);
                    }}
                    placeholder="Ex: admin@empresa.pt"
                    className={usernameError ? "border-destructive" : ""}
                  />
                )}
                {usernameError && (
                  <p className="text-sm text-destructive">{usernameError}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Insira a password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas adicionais..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "A guardar..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Employees Modal - Novo Layout */}
      <Dialog open={!!viewEmployeesAccessId} onOpenChange={(open) => !open && handleCloseAndSave()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Colaboradores com Acesso
            </DialogTitle>
          </DialogHeader>
          
          {/* Info do Email */}
          {selectedAccessForEmployees && (
            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center gap-2 font-semibold">
                <Mail className="h-4 w-4" />
                {selectedAccessForEmployees.title}
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedAccessForEmployees.username}
              </p>
            </div>
          )}
          
          {/* Adicionar Colaborador */}
          <div className="space-y-2">
            <Label>Adicionar Colaborador:</Label>
            <div className="flex gap-2">
              <Select value={employeeToAdd} onValueChange={setEmployeeToAdd}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecionar colaborador..." />
                </SelectTrigger>
                <SelectContent>
                  {availableEmployees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddEmployee} disabled={!employeeToAdd}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Lista de Colaboradores Associados */}
          <div className="space-y-2">
            <Label>Colaboradores ({associatedEmployees.length}):</Label>
            <ScrollArea className="max-h-[200px]">
              {associatedEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum colaborador associado.
                </p>
              ) : (
                <div className="space-y-1">
                  {associatedEmployees.map(emp => (
                    <div key={emp.id} className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm truncate">{emp.name}</span>
                        <Badge 
                          variant={emp.is_active ? "default" : "secondary"}
                          className="shrink-0"
                        >
                          {emp.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 shrink-0"
                        onClick={() => handleRemoveEmployee(emp.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          
          <DialogFooter>
            <Button 
              onClick={handleCloseAndSave}
              disabled={updateDepartmentEmailsMutation.isPending}
            >
              {updateDepartmentEmailsMutation.isPending ? "A guardar..." : "Fechar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={!!deleteAccess}
        onOpenChange={(open) => !open && setDeleteAccess(null)}
        onConfirm={async () => {
          if (deleteAccess) {
            await deleteMutation.mutateAsync(deleteAccess.id);
          }
        }}
        title="Eliminar Acesso"
        description="Tem a certeza que deseja eliminar este acesso?"
        itemName={deleteAccess?.title}
        isLoading={deleteMutation.isPending}
      />
    </AdminLayout>
  );
};

export default AccessesPage;
