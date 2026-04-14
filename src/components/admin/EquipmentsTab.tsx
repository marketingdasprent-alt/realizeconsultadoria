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
  User,
  Monitor,
  Laptop,
  Tablet,
  Smartphone,
  Package,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import DeleteConfirmDialog from "@/components/admin/DeleteConfirmDialog";
import { supabase } from "@/integrations/supabase/client";

interface EquipmentCategory {
  id: string;
  name: string;
  icon: string | null;
}

interface Equipment {
  id: string;
  category_id: string | null;
  company_id: string;
  employee_id: string | null;
  brand: string;
  model: string | null;
  serial_number: string | null;
  color: string | null;
  pass_year: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  companies?: { name: string };
  employees?: { name: string } | null;
  equipment_categories?: { name: string; icon: string | null } | null;
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

interface EquipmentsTabProps {
  canManage: boolean;
  companies: Company[];
  companyFilter: string;
  setCompanyFilter: (value: string) => void;
}

// Mapeamento de ícones por categoria
const getCategoryIcon = (categoryName: string | null | undefined) => {
  if (!categoryName) return Package;
  const name = categoryName.toLowerCase();
  if (name.includes('monitor')) return Monitor;
  if (name.includes('portátil') || name.includes('laptop')) return Laptop;
  if (name.includes('tablet')) return Tablet;
  if (name.includes('telemóvel') || name.includes('smartphone')) return Smartphone;
  return Package;
};

const EquipmentsTab = ({ canManage, companies, companyFilter, setCompanyFilter }: EquipmentsTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [searchTerm, setSearchTerm] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [deleteEquipment, setDeleteEquipment] = useState<Equipment | null>(null);
  
  const [formData, setFormData] = useState({
    category_id: "",
    company_id: "",
    employee_id: "",
    brand: "",
    model: "",
    serial_number: "",
    color: "",
    pass_year: "",
    notes: "",
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["equipment-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_categories")
        .select("id, name, icon")
        .order("name");
      if (error) throw error;
      return data as EquipmentCategory[];
    },
  });

  // Fetch equipments (sem filtro de categoria na query)
  const { data: equipments = [], isLoading } = useQuery({
    queryKey: ["equipments", companyFilter],
    queryFn: async () => {
      let query = supabase
        .from("equipments")
        .select(`
          *,
          companies(name),
          employees(name),
          equipment_categories(name, icon)
        `)
        .order("brand");

      if (companyFilter !== "all") {
        query = query.eq("company_id", companyFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Equipment[];
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
        category_id: data.category_id || null,
        company_id: data.company_id,
        employee_id: data.employee_id || null,
        brand: data.brand,
        model: data.model || null,
        serial_number: data.serial_number || null,
        color: data.color || null,
        pass_year: data.pass_year || null,
        notes: data.notes || null,
      };

      if (editingEquipment) {
        const { error } = await supabase
          .from("equipments")
          .update(payload)
          .eq("id", editingEquipment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("equipments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipments"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingEquipment ? "Equipamento atualizado" : "Equipamento criado",
        description: editingEquipment 
          ? "O equipamento foi atualizado com sucesso."
          : "O novo equipamento foi criado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao guardar o equipamento.",
        variant: "destructive",
      });
      console.error("Save error:", error);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipments"] });
      setDeleteEquipment(null);
      toast({
        title: "Equipamento eliminado",
        description: "O equipamento foi eliminado com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao eliminar o equipamento.",
        variant: "destructive",
      });
      console.error("Delete error:", error);
    },
  });

  const resetForm = () => {
    setFormData({
      category_id: "",
      company_id: companyFilter !== "all" ? companyFilter : "",
      employee_id: "",
      brand: "",
      model: "",
      serial_number: "",
      color: "",
      pass_year: "",
      notes: "",
    });
    setEditingEquipment(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (equipment: Equipment) => {
    setEditingEquipment(equipment);
    setFormData({
      category_id: equipment.category_id || "",
      company_id: equipment.company_id,
      employee_id: equipment.employee_id || "",
      brand: equipment.brand,
      model: equipment.model || "",
      serial_number: equipment.serial_number || "",
      color: equipment.color || "",
      pass_year: equipment.pass_year || "",
      notes: equipment.notes || "",
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
    if (!formData.brand || !formData.company_id) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a marca e selecione uma empresa.",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate(formData);
  };

  const filteredEquipments = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    return equipments.filter((equipment) => {
      const employeeName = equipment.employees?.name?.toLowerCase() || "";
      const brand = equipment.brand.toLowerCase();
      const model = equipment.model?.toLowerCase() || "";
      const serialNumber = equipment.serial_number?.toLowerCase() || "";
      return (
        employeeName.includes(searchLower) ||
        brand.includes(searchLower) ||
        model.includes(searchLower) ||
        serialNumber.includes(searchLower)
      );
    });
  }, [equipments, searchTerm]);

  // Agrupamento por categoria
  const groupedEquipments = useMemo(() => {
    const groups: Record<string, { category: EquipmentCategory | null; equipments: Equipment[] }> = {};
    
    groups["uncategorized"] = { category: null, equipments: [] };
    
    categories.forEach(cat => {
      groups[cat.id] = { category: cat, equipments: [] };
    });
    
    filteredEquipments.forEach(equipment => {
      const categoryId = equipment.category_id || "uncategorized";
      if (groups[categoryId]) {
        groups[categoryId].equipments.push(equipment);
      } else {
        groups["uncategorized"].equipments.push(equipment);
      }
    });
    
    return Object.entries(groups)
      .filter(([_, group]) => group.equipments.length > 0)
      .sort(([keyA, groupA], [keyB, groupB]) => {
        if (keyA === "uncategorized") return 1;
        if (keyB === "uncategorized") return -1;
        return (groupA.category?.name || "").localeCompare(groupB.category?.name || "");
      });
  }, [filteredEquipments, categories]);

  // Renderização de ações
  const renderEquipmentActions = (equipment: Equipment) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openEditDialog(equipment)}>
          <Pencil className="h-4 w-4 mr-2" />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setDeleteEquipment(equipment)}
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
  const getStatusBadge = (equipment: Equipment) => {
    if (equipment.employee_id) {
      return <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-primary/20">Atribuído</Badge>;
    }
    return <Badge variant="secondary">Disponível</Badge>;
  };

  // Tabela desktop (recebe equipamentos como parâmetro)
  const renderDesktopTable = (categoryEquipments: Equipment[]) => (
    <div className="overflow-x-auto -mx-4 px-4">
      <Table className="min-w-[800px]">
        <TableHeader>
          <TableRow>
            <TableHead>Marca</TableHead>
            <TableHead>Modelo</TableHead>
            <TableHead>Nº Série</TableHead>
            <TableHead>Cor</TableHead>
            <TableHead>Passe</TableHead>
            {companyFilter === "all" && <TableHead>Empresa</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Atribuído</TableHead>
            {canManage && <TableHead className="w-12"></TableHead>}
          </TableRow>
      </TableHeader>
      <TableBody>
        {categoryEquipments.map((equipment) => (
          <TableRow key={equipment.id}>
            <TableCell className="font-medium">{equipment.brand}</TableCell>
            <TableCell>{equipment.model || "-"}</TableCell>
            <TableCell>{renderCopyableField(equipment.serial_number, `serial-${equipment.id}`)}</TableCell>
            <TableCell>{equipment.color || "-"}</TableCell>
            <TableCell>
              {equipment.pass_year ? (
                <Badge variant="outline">{equipment.pass_year}</Badge>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            {companyFilter === "all" && (
              <TableCell>{equipment.companies?.name}</TableCell>
            )}
            <TableCell>{getStatusBadge(equipment)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {equipment.employees ? (
                  <>
                    <User className="h-4 w-4 text-muted-foreground" />
                    {equipment.employees.name}
                  </>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </TableCell>
            {canManage && (
              <TableCell>{renderEquipmentActions(equipment)}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );

  // Cards mobile (recebe equipamentos como parâmetro)
  const renderMobileCards = (categoryEquipments: Equipment[]) => (
    <div className="space-y-3">
      {categoryEquipments.map((equipment) => (
        <Card key={equipment.id} className="p-4 min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">
                {equipment.brand} {equipment.model}
              </h4>
              {companyFilter === "all" && (
                <p className="text-xs text-muted-foreground truncate">
                  {equipment.companies?.name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {getStatusBadge(equipment)}
              {canManage && renderEquipmentActions(equipment)}
            </div>
          </div>
          
          <div className="mt-3 space-y-2">
            {equipment.serial_number && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">Nº Série:</span>
                {renderCopyableField(equipment.serial_number, `serial-${equipment.id}`)}
              </div>
            )}
            
            {equipment.color && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">Cor:</span>
                <span className="text-xs">{equipment.color}</span>
              </div>
            )}
            
            {equipment.pass_year && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">Passe:</span>
                <Badge variant="outline" className="text-xs">{equipment.pass_year}</Badge>
              </div>
            )}
            
            {equipment.employees && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-16">Atribuído:</span>
                <span className="text-xs flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {equipment.employees.name}
                </span>
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
            <Package className="h-5 w-5" />
            Lista de Equipamentos
          </CardTitle>
          {canManage && (
            <Button onClick={openCreateDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Equipamento
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
                name="search-equipments"
                placeholder="Pesquisar por marca, modelo, nº série ou colaborador..."
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
          ) : groupedEquipments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || companyFilter !== "all"
                ? "Nenhum equipamento encontrado com os filtros aplicados."
                : "Ainda não existem equipamentos registados."}
            </div>
          ) : (
            <Accordion 
              type="multiple" 
              defaultValue={groupedEquipments.map(([key]) => key)} 
              className="space-y-2"
            >
              {groupedEquipments.map(([categoryId, group]) => {
                const CategoryIcon = getCategoryIcon(group.category?.name);
                const categoryName = group.category?.name || "Sem Categoria";
                const count = group.equipments.length;
                
                return (
                  <AccordionItem 
                    key={categoryId} 
                    value={categoryId} 
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                        <span className="font-display text-lg font-semibold">{categoryName}</span>
                        <Badge variant="secondary" className="ml-2">
                          {count} {count === 1 ? "equipamento" : "equipamentos"}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      {isMobile 
                        ? renderMobileCards(group.equipments)
                        : renderDesktopTable(group.equipments)
                      }
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEquipment ? "Editar Equipamento" : "Novo Equipamento"}
            </DialogTitle>
            <DialogDescription>
              {editingEquipment
                ? "Atualize os dados do equipamento."
                : "Preencha os dados para adicionar um novo equipamento."}
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
                <Label htmlFor="category_id">Categoria</Label>
                <Select
                  value={formData.category_id || "none"}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
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
                    <SelectItem value="none">Nenhum (disponível)</SelectItem>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brand">Marca *</Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Ex: HP, Lenovo, Apple"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Ex: ProBook 450"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serial_number">Nº Série</Label>
                <Input
                  id="serial_number"
                  value={formData.serial_number}
                  onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                  placeholder="Ex: ABC123XYZ"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="color">Cor</Label>
                  <Input
                    id="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="Ex: Preto, Prata"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pass_year">Passe do Dispositivo</Label>
                  <Input
                    id="pass_year"
                    value={formData.pass_year}
                    onChange={(e) => setFormData({ ...formData, pass_year: e.target.value })}
                    placeholder="Ex: 2025"
                  />
                </div>
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
        open={!!deleteEquipment}
        onOpenChange={(open) => !open && setDeleteEquipment(null)}
        onConfirm={async () => {
          if (deleteEquipment) {
            await deleteMutation.mutateAsync(deleteEquipment.id);
          }
        }}
        title="Eliminar Equipamento"
        description="Tem a certeza que deseja eliminar este equipamento?"
        itemName={`${deleteEquipment?.brand} ${deleteEquipment?.model || ""}`}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
};

export default EquipmentsTab;
