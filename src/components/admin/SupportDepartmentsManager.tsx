import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, GripVertical, Pencil, X, Check, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SupportDepartment {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

const SupportDepartmentsManager = () => {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<SupportDepartment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDepartments = async () => {
    const { data, error } = await supabase
      .from("support_departments")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error loading departments:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os departamentos",
        variant: "destructive",
      });
    } else {
      setDepartments(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleAddDepartment = async () => {
    if (!newName.trim()) {
      toast({
        title: "Erro",
        description: "O nome do departamento é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      const maxSortOrder = departments.length > 0 
        ? Math.max(...departments.map(d => d.sort_order)) + 1 
        : 0;

      const { error } = await supabase.from("support_departments").insert({
        name: newName.trim(),
        description: newDescription.trim() || null,
        sort_order: maxSortOrder,
      });

      if (error) throw error;

      toast({ title: "Departamento criado com sucesso!" });
      setNewName("");
      setNewDescription("");
      loadDepartments();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleActive = async (department: SupportDepartment) => {
    try {
      const { error } = await supabase
        .from("support_departments")
        .update({ is_active: !department.is_active })
        .eq("id", department.id);

      if (error) throw error;

      setDepartments(departments.map(d =>
        d.id === department.id ? { ...d, is_active: !d.is_active } : d
      ));

      toast({ 
        title: department.is_active ? "Departamento desativado" : "Departamento ativado" 
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStartEdit = (department: SupportDepartment) => {
    setEditingId(department.id);
    setEditName(department.name);
    setEditDescription(department.description || "");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDescription("");
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      toast({
        title: "Erro",
        description: "O nome do departamento é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("support_departments")
        .update({ 
          name: editName.trim(),
          description: editDescription.trim() || null,
        })
        .eq("id", editingId);

      if (error) throw error;

      setDepartments(departments.map(d =>
        d.id === editingId 
          ? { ...d, name: editName.trim(), description: editDescription.trim() || null } 
          : d
      ));

      toast({ title: "Departamento atualizado!" });
      handleCancelEdit();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("support_departments")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setDepartments(departments.filter(d => d.id !== id));
      toast({ title: "Departamento eliminado!" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    
    const current = departments[index];
    const previous = departments[index - 1];
    
    try {
      await Promise.all([
        supabase.from("support_departments").update({ sort_order: previous.sort_order }).eq("id", current.id),
        supabase.from("support_departments").update({ sort_order: current.sort_order }).eq("id", previous.id),
      ]);
      
      const newDepartments = [...departments];
      newDepartments[index] = { ...previous, sort_order: current.sort_order };
      newDepartments[index - 1] = { ...current, sort_order: previous.sort_order };
      setDepartments(newDepartments);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível reordenar",
        variant: "destructive",
      });
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === departments.length - 1) return;
    
    const current = departments[index];
    const next = departments[index + 1];
    
    try {
      await Promise.all([
        supabase.from("support_departments").update({ sort_order: next.sort_order }).eq("id", current.id),
        supabase.from("support_departments").update({ sort_order: current.sort_order }).eq("id", next.id),
      ]);
      
      const newDepartments = [...departments];
      newDepartments[index] = { ...next, sort_order: current.sort_order };
      newDepartments[index + 1] = { ...current, sort_order: next.sort_order };
      setDepartments(newDepartments);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível reordenar",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl">Departamentos de Suporte</CardTitle>
        <CardDescription>
          Organize os tickets por departamentos para segmentar o acesso
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new department */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 space-y-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do departamento (ex: RH, TI)"
              disabled={isAdding}
            />
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Descrição (opcional)"
              disabled={isAdding}
            />
          </div>
          <Button
            variant="gold"
            onClick={handleAddDepartment}
            disabled={isAdding || !newName.trim()}
            className="shrink-0"
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Adicionar
          </Button>
        </div>

        {/* Departments list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : departments.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum departamento criado. Crie o primeiro acima.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-center w-20">Ativo</TableHead>
                <TableHead className="text-right w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((department, index) => (
                <TableRow key={department.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === departments.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {editingId === department.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8"
                      />
                    ) : (
                      <span className="font-medium">{department.name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === department.id ? (
                      <Input
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Descrição"
                        className="h-8"
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        {department.description || "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={department.is_active}
                      onCheckedChange={() => handleToggleActive(department)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === department.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleSaveEdit}
                          className="h-8 w-8"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCancelEdit}
                          className="h-8 w-8"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEdit(department)}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(department.id)}
                          disabled={deletingId === department.id}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          {deletingId === department.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default SupportDepartmentsManager;
