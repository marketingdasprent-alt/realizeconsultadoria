import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Loader2, Pencil, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SupportSubject {
  id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
  default_priority: string;
  department_id: string | null;
}

interface SupportDepartment {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const priorityColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const SupportSubjectsManager = () => {
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<SupportSubject[]>([]);
  const [departments, setDepartments] = useState<SupportDepartment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newSubjectLabel, setNewSubjectLabel] = useState("");
  const [newSubjectPriority, setNewSubjectPriority] = useState("medium");
  const [newSubjectDepartment, setNewSubjectDepartment] = useState<string>("none");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingPriority, setEditingPriority] = useState("medium");
  const [editingDepartment, setEditingDepartment] = useState<string>("none");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    const [subjectsRes, departmentsRes] = await Promise.all([
      supabase
        .from("support_ticket_subjects")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("support_departments")
        .select("id, name, is_active, sort_order")
        .order("sort_order", { ascending: true })
    ]);

    if (subjectsRes.error) {
      console.error("Error loading subjects:", subjectsRes.error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os assuntos.",
        variant: "destructive",
      });
    } else {
      setSubjects(subjectsRes.data || []);
    }

    if (departmentsRes.error) {
      console.error("Error loading departments:", departmentsRes.error);
    } else {
      setDepartments(departmentsRes.data || []);
      // Initialize all sections as open
      const initialOpen: Record<string, boolean> = { none: true };
      (departmentsRes.data || []).forEach(dept => {
        initialOpen[dept.id] = true;
      });
      setOpenSections(initialOpen);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Group subjects by department
  const subjectsByDepartment = useMemo(() => {
    const grouped: Record<string, SupportSubject[]> = {};
    
    // Initialize groups for all departments
    departments.forEach(dept => {
      grouped[dept.id] = [];
    });
    grouped['none'] = []; // Sem departamento
    
    // Distribute subjects
    subjects.forEach(subject => {
      const key = subject.department_id || 'none';
      if (grouped[key]) {
        grouped[key].push(subject);
      } else {
        grouped['none'].push(subject);
      }
    });
    
    return grouped;
  }, [subjects, departments]);

  const handleAddSubject = async () => {
    if (!newSubjectLabel.trim()) {
      toast({
        title: "Erro",
        description: "Por favor introduza o nome do assunto.",
        variant: "destructive",
      });
      return;
    }

    setIsAdding(true);
    try {
      const deptId = newSubjectDepartment === "none" ? null : newSubjectDepartment;
      const deptSubjects = subjects.filter(s => s.department_id === deptId);
      const maxSortOrder = deptSubjects.length > 0 
        ? Math.max(...deptSubjects.map(s => s.sort_order)) 
        : 0;

      const { error } = await supabase
        .from("support_ticket_subjects")
        .insert({
          label: newSubjectLabel.trim(),
          sort_order: maxSortOrder + 1,
          default_priority: newSubjectPriority,
          department_id: deptId,
        });

      if (error) throw error;

      toast({ title: "Assunto adicionado com sucesso!" });
      setNewSubjectLabel("");
      setNewSubjectPriority("medium");
      setNewSubjectDepartment("none");
      loadData();
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

  const handleToggleActive = async (subject: SupportSubject) => {
    try {
      const { error } = await supabase
        .from("support_ticket_subjects")
        .update({ is_active: !subject.is_active })
        .eq("id", subject.id);

      if (error) throw error;

      setSubjects(subjects.map(s => 
        s.id === subject.id ? { ...s, is_active: !s.is_active } : s
      ));
      toast({ title: subject.is_active ? "Assunto desativado" : "Assunto ativado" });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStartEdit = (subject: SupportSubject) => {
    setEditingId(subject.id);
    setEditingLabel(subject.label);
    setEditingPriority(subject.default_priority);
    setEditingDepartment(subject.department_id || "none");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingLabel("");
    setEditingPriority("medium");
    setEditingDepartment("none");
  };

  const handleSaveEdit = async () => {
    if (!editingLabel.trim() || !editingId) return;

    try {
      const { error } = await supabase
        .from("support_ticket_subjects")
        .update({ 
          label: editingLabel.trim(), 
          default_priority: editingPriority,
          department_id: editingDepartment === "none" ? null : editingDepartment,
        })
        .eq("id", editingId);

      if (error) throw error;

      setSubjects(subjects.map(s => 
        s.id === editingId 
          ? { 
              ...s, 
              label: editingLabel.trim(), 
              default_priority: editingPriority,
              department_id: editingDepartment === "none" ? null : editingDepartment,
            } 
          : s
      ));
      toast({ title: "Assunto atualizado!" });
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
        .from("support_ticket_subjects")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSubjects(subjects.filter(s => s.id !== id));
      toast({ title: "Assunto eliminado!" });
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

  const handleMoveUp = async (deptSubjects: SupportSubject[], index: number) => {
    if (index === 0) return;
    const currentSubject = deptSubjects[index];
    const prevSubject = deptSubjects[index - 1];
    const currentSortOrder = currentSubject.sort_order;
    const prevSortOrder = prevSubject.sort_order;

    try {
      await Promise.all([
        supabase.from("support_ticket_subjects").update({ sort_order: prevSortOrder }).eq("id", currentSubject.id),
        supabase.from("support_ticket_subjects").update({ sort_order: currentSortOrder }).eq("id", prevSubject.id),
      ]);

      setSubjects(subjects.map(s => {
        if (s.id === currentSubject.id) return { ...s, sort_order: prevSortOrder };
        if (s.id === prevSubject.id) return { ...s, sort_order: currentSortOrder };
        return s;
      }));
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMoveDown = async (deptSubjects: SupportSubject[], index: number) => {
    if (index === deptSubjects.length - 1) return;
    const currentSubject = deptSubjects[index];
    const nextSubject = deptSubjects[index + 1];
    const currentSortOrder = currentSubject.sort_order;
    const nextSortOrder = nextSubject.sort_order;

    try {
      await Promise.all([
        supabase.from("support_ticket_subjects").update({ sort_order: nextSortOrder }).eq("id", currentSubject.id),
        supabase.from("support_ticket_subjects").update({ sort_order: currentSortOrder }).eq("id", nextSubject.id),
      ]);

      setSubjects(subjects.map(s => {
        if (s.id === currentSubject.id) return { ...s, sort_order: nextSortOrder };
        if (s.id === nextSubject.id) return { ...s, sort_order: currentSortOrder };
        return s;
      }));
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderSubjectsTable = (deptSubjects: SupportSubject[], deptKey: string) => {
    const sortedSubjects = [...deptSubjects].sort((a, b) => a.sort_order - b.sort_order);
    
    if (sortedSubjects.length === 0) {
      return (
        <p className="text-muted-foreground text-sm py-4 px-2">
          Nenhum assunto neste departamento.
        </p>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">Ordem</TableHead>
            <TableHead>Assunto</TableHead>
            <TableHead className="w-[100px]">Prioridade</TableHead>
            <TableHead className="w-[80px] text-center">Ativo</TableHead>
            <TableHead className="w-[120px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedSubjects.map((subject, index) => (
            <TableRow key={subject.id}>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-full p-0"
                    onClick={() => handleMoveUp(sortedSubjects, index)}
                    disabled={index === 0}
                  >
                    ▲
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-full p-0"
                    onClick={() => handleMoveDown(sortedSubjects, index)}
                    disabled={index === sortedSubjects.length - 1}
                  >
                    ▼
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                {editingId === subject.id ? (
                  <div className="flex gap-2">
                    <Input
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                      className="h-8 flex-1"
                      autoFocus
                    />
                    <Select value={editingDepartment} onValueChange={setEditingDepartment}>
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem dept.</SelectItem>
                        {departments.filter(d => d.is_active).map(dept => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className={!subject.is_active ? "text-muted-foreground" : ""}>
                    {subject.label}
                  </span>
                )}
              </TableCell>
              <TableCell>
                {editingId === subject.id ? (
                  <Select value={editingPriority} onValueChange={setEditingPriority}>
                    <SelectTrigger className="h-8 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={priorityColors[subject.default_priority] || priorityColors.medium}>
                    {priorityLabels[subject.default_priority] || "Média"}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-center">
                <Switch
                  checked={subject.is_active}
                  onCheckedChange={() => handleToggleActive(subject)}
                />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {editingId === subject.id ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={handleSaveEdit}>
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(subject)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={deletingId === subject.id}
                          >
                            {deletingId === subject.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar Assunto</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem a certeza que deseja eliminar o assunto <strong>"{subject.label}"</strong>?
                              Esta ação não pode ser revertida.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(subject.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl">Assuntos de Suporte</CardTitle>
        <CardDescription>
          Gerir os assuntos disponíveis para tickets de suporte
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new subject */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Novo assunto..."
            value={newSubjectLabel}
            onChange={(e) => setNewSubjectLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
            disabled={isAdding}
            className="flex-1"
          />
          <Select value={newSubjectDepartment} onValueChange={setNewSubjectDepartment}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem departamento</SelectItem>
              {departments.filter(d => d.is_active).map(dept => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newSubjectPriority} onValueChange={setNewSubjectPriority}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Baixa</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="urgent">Urgente</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="gold" onClick={handleAddSubject} disabled={isAdding || !newSubjectLabel.trim()}>
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        {departments.length === 0 && (
          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            💡 Crie departamentos de suporte primeiro para poder associar assuntos a departamentos específicos.
          </p>
        )}

        {/* Subjects grouped by department */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : subjects.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhum assunto cadastrado.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Departments with subjects */}
            {departments
              .filter(dept => dept.is_active)
              .map(dept => (
                <Collapsible
                  key={dept.id}
                  open={openSections[dept.id]}
                  onOpenChange={() => toggleSection(dept.id)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/50 hover:bg-muted transition-colors text-left">
                      {openSections[dept.id] ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{dept.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {subjectsByDepartment[dept.id]?.length || 0}
                      </Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t">
                        {renderSubjectsTable(subjectsByDepartment[dept.id] || [], dept.id)}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}

            {/* Subjects without department */}
            {subjectsByDepartment['none']?.length > 0 && (
              <Collapsible
                open={openSections['none']}
                onOpenChange={() => toggleSection('none')}
              >
                <div className="border rounded-lg overflow-hidden border-dashed">
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left">
                    {openSections['none'] ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium text-muted-foreground">Sem Departamento</span>
                    <Badge variant="outline" className="ml-auto">
                      {subjectsByDepartment['none'].length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-dashed">
                      {renderSubjectsTable(subjectsByDepartment['none'], 'none')}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SupportSubjectsManager;
