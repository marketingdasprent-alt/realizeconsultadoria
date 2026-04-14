import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Search, 
  Copy, 
  Check, 
  MoreHorizontal, 
  Pencil, 
  Trash2,
  Phone,
  User,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import DeleteConfirmDialog from "@/components/admin/DeleteConfirmDialog";
import { supabase } from "@/integrations/supabase/client";

interface PhoneRecord {
  id: string;
  phone_number: string;
  pin: string | null;
  puk: string | null;
  operator: string | null;
  label: string | null;
  notes: string | null;
  company_id: string;
  employee_id: string | null;
  created_at: string;
  updated_at: string;
  companies?: { name: string };
  employees?: { name: string } | null;
}

interface Company {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  name: string;
  company_id: string;
  is_active: boolean;
}

const OPERATORS = ["VODAFONE", "MEO", "NOS", "NOWO", "Outro"];

interface PhonesTabProps {
  canManage: boolean;
  companies: Company[];
  companyFilter: string;
  setCompanyFilter: (value: string) => void;
}

const PhonesTab = ({ canManage, companies, companyFilter, setCompanyFilter }: PhonesTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [searchTerm, setSearchTerm] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPhone, setEditingPhone] = useState<PhoneRecord | null>(null);
  const [deletePhone, setDeletePhone] = useState<PhoneRecord | null>(null);
  
  const [formData, setFormData] = useState({
    phone_number: "",
    pin: "",
    puk: "",
    operator: "",
    label: "",
    notes: "",
    company_id: "",
    employee_id: "",
  });

  // Fetch phones
  const { data: phones = [], isLoading } = useQuery({
    queryKey: ["phones", companyFilter],
    queryFn: async () => {
      let query = supabase
        .from("phones")
        .select(`
          *,
          companies(name),
          employees(name)
        `)
        .order("phone_number");

      if (companyFilter !== "all") {
        query = query.eq("company_id", companyFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PhoneRecord[];
    },
  });

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, company_id, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        phone_number: data.phone_number,
        pin: data.pin || null,
        puk: data.puk || null,
        operator: data.operator || null,
        label: data.label || null,
        notes: data.notes || null,
        company_id: data.company_id,
        employee_id: data.employee_id || null,
      };

      if (editingPhone) {
        const { error } = await supabase
          .from("phones")
          .update(payload)
          .eq("id", editingPhone.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("phones").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phones"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingPhone ? "Cartão SIM atualizado" : "Cartão SIM criado",
        description: editingPhone 
          ? "O cartão SIM foi atualizado com sucesso."
          : "O novo cartão SIM foi criado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao guardar o telefone.",
        variant: "destructive",
      });
      console.error("Save error:", error);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("phones").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["phones"] });
      setDeletePhone(null);
      toast({
        title: "Cartão SIM eliminado",
        description: "O cartão SIM foi eliminado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao eliminar o telefone.",
        variant: "destructive",
      });
      console.error("Delete error:", error);
    },
  });

  const resetForm = () => {
    setFormData({
      phone_number: "",
      pin: "",
      puk: "",
      operator: "",
      label: "",
      notes: "",
      company_id: companyFilter !== "all" ? companyFilter : "",
      employee_id: "",
    });
    setEditingPhone(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (phone: PhoneRecord) => {
    setEditingPhone(phone);
    setFormData({
      phone_number: phone.phone_number,
      pin: phone.pin || "",
      puk: phone.puk || "",
      operator: phone.operator || "",
      label: phone.label || "",
      notes: phone.notes || "",
      company_id: phone.company_id,
      employee_id: phone.employee_id || "",
    });
    setIsDialogOpen(true);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phone_number || !formData.company_id) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o número de telemóvel e selecione uma empresa.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(formData);
  };

  const filteredPhones = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return phones.filter((phone) => {
      const employeeName = phone.employees?.name?.toLowerCase() || "";
      const label = phone.label?.toLowerCase() || "";
      const phoneNumber = phone.phone_number.toLowerCase();
      return (
        employeeName.includes(searchLower) ||
        label.includes(searchLower) ||
        phoneNumber.includes(searchLower)
      );
    });
  }, [phones, searchTerm]);

  // Renderização de ações
  const renderPhoneActions = (phone: PhoneRecord) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openEditDialog(phone)}>
          <Pencil className="h-4 w-4 mr-2" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setDeletePhone(phone)}
          className="text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // Renderização de campo com copy
  const renderCopyableField = (value: string | null, fieldId: string) => {
    if (!value) return <span className="text-muted-foreground">-</span>;
    
    return (
      <div className="flex items-center gap-1">
        <span className="text-sm bg-muted px-2 py-1 rounded font-mono">
          {value}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => copyToClipboard(value, fieldId)}
        >
          {copiedField === fieldId ? (
            <Check className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    );
  };

  // Helper para badge de status
  const getStatusBadge = (phone: PhoneRecord) => {
    if (phone.employee_id || phone.label) {
      return <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-primary/20">Atribuído</Badge>;
    }
    return <Badge variant="secondary">Disponível</Badge>;
  };

  // Tabela desktop
  const renderDesktopTable = () => (
    <div className="overflow-x-auto -mx-4 px-4">
      <Table className="min-w-[700px]">
        <TableHeader>
          <TableRow>
            <TableHead>Telefone</TableHead>
            <TableHead>PIN</TableHead>
            <TableHead>PUK</TableHead>
            <TableHead>Operadora</TableHead>
            {companyFilter === "all" && <TableHead>Empresa</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Atribuído</TableHead>
            {canManage && <TableHead className="w-12"></TableHead>}
          </TableRow>
      </TableHeader>
      <TableBody>
        {filteredPhones.map((phone) => (
          <TableRow key={phone.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span className="text-sm bg-muted px-2 py-1 rounded font-mono">
                  {phone.phone_number}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyToClipboard(phone.phone_number, `phone-${phone.id}`)}
                >
                  {copiedField === `phone-${phone.id}` ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </TableCell>
            <TableCell>{renderCopyableField(phone.pin, `pin-${phone.id}`)}</TableCell>
            <TableCell>{renderCopyableField(phone.puk, `puk-${phone.id}`)}</TableCell>
            <TableCell>
              {phone.operator ? (
                <Badge variant="outline">{phone.operator}</Badge>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            {companyFilter === "all" && (
              <TableCell>{phone.companies?.name}</TableCell>
            )}
            <TableCell>{getStatusBadge(phone)}</TableCell>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                {phone.employees ? (
                  <>
                    <User className="h-4 w-4 text-muted-foreground" />
                    {phone.employees.name}
                  </>
                ) : (
                  <span className="text-muted-foreground">{phone.label || "-"}</span>
                )}
              </div>
            </TableCell>
            {canManage && (
              <TableCell>{renderPhoneActions(phone)}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );

  // Cards mobile
  const renderMobileCards = () => (
    <div className="space-y-3">
      {filteredPhones.map((phone) => (
        <Card key={phone.id} className="p-4 min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm flex items-center gap-2 truncate">
                {phone.employees ? (
                  <>
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">{phone.employees.name}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground truncate">{phone.label || "Sem nome"}</span>
                )}
              </h4>
              {companyFilter === "all" && (
                <p className="text-xs text-muted-foreground truncate">
                  {phone.companies?.name}
                </p>
              )}
            </div>
            <div className="shrink-0">
              {canManage && renderPhoneActions(phone)}
            </div>
          </div>
          
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16">Nº:</span>
              <span className="text-xs bg-muted px-2 py-1 rounded font-mono flex-1">
                {phone.phone_number}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => copyToClipboard(phone.phone_number, `phone-${phone.id}`)}
              >
                {copiedField === `phone-${phone.id}` ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            
            {phone.pin && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">PIN:</span>
                {renderCopyableField(phone.pin, `pin-${phone.id}`)}
              </div>
            )}
            
            {phone.puk && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">PUK:</span>
                {renderCopyableField(phone.puk, `puk-${phone.id}`)}
              </div>
            )}
            
            {phone.operator && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">Oper.:</span>
                <Badge variant="outline" className="text-xs">{phone.operator}</Badge>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Lista de Cartões SIM
          </CardTitle>
          {canManage && (
            <Button onClick={openCreateDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Cartão SIM
            </Button>
          )}
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
                name="search-phones"
                placeholder="Pesquisar por atribuição ou telefone..."
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
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredPhones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || companyFilter !== "all"
                ? "Nenhum cartão SIM encontrado com os filtros aplicados."
                : "Ainda não existem cartões SIM registados."}
            </div>
          ) : (
            isMobile ? renderMobileCards() : renderDesktopTable()
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPhone ? "Editar Cartão SIM" : "Novo Cartão SIM"}
            </DialogTitle>
            <DialogDescription>
              {editingPhone
                ? "Atualize os dados do cartão SIM."
                : "Preencha os dados para adicionar um novo cartão SIM."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="company_id">Empresa *</Label>
                <Select
                  value={formData.company_id}
                  onValueChange={(value) => setFormData({ ...formData, company_id: value, employee_id: "" })}
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
                <Label htmlFor="employee_id">Colaborador (opcional)</Label>
                <Select
                  value={formData.employee_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, employee_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (usar label)</SelectItem>
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

              {!formData.employee_id && (
                <div className="space-y-2">
                  <Label htmlFor="label">Label (ex: SINISTRO, DISPONÍVEL)</Label>
                  <Input
                    id="label"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="Ex: SINISTRO"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="phone_number">Telefone *</Label>
                <Input
                  id="phone_number"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="Ex: 910 123 456"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pin">PIN</Label>
                  <Input
                    id="pin"
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    placeholder="Ex: 1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="puk">PUK</Label>
                  <Input
                    id="puk"
                    value={formData.puk}
                    onChange={(e) => setFormData({ ...formData, puk: e.target.value })}
                    placeholder="Ex: 12345678"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="operator">Operadora</Label>
                <Select
                  value={formData.operator || "none"}
                  onValueChange={(value) => setFormData({ ...formData, operator: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a operadora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não especificada</SelectItem>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas adicionais..."
                  rows={2}
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={!!deletePhone}
        onOpenChange={(open) => !open && setDeletePhone(null)}
        onConfirm={async () => {
          if (deletePhone) {
            await deleteMutation.mutateAsync(deletePhone.id);
          }
        }}
        title="Eliminar Cartão SIM"
        description="Tem a certeza que deseja eliminar este cartão SIM?"
        itemName={deletePhone?.phone_number}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
};

export default PhonesTab;
