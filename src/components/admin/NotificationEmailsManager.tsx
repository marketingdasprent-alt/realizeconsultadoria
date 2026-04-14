import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Mail, Plus, Trash2, ChevronDown, Building2 } from "lucide-react";

interface EmailEntry {
  id: string;
  email: string;
  is_active: boolean;
}

interface SupportDepartment {
  id: string;
  name: string;
}

interface DepartmentEmails {
  [departmentId: string]: EmailEntry[];
}

export function NotificationEmailsManager() {
  const [isLoading, setIsLoading] = useState(true);
  const [absenceEmails, setAbsenceEmails] = useState<EmailEntry[]>([]);
  const [departments, setDepartments] = useState<SupportDepartment[]>([]);
  const [supportEmails, setSupportEmails] = useState<DepartmentEmails>({});
  const [newAbsenceEmail, setNewAbsenceEmail] = useState("");
  const [newSupportEmails, setNewSupportEmails] = useState<{ [deptId: string]: string }>({});
  const [openDepartments, setOpenDepartments] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch absence notification emails
      const { data: absenceData, error: absenceError } = await supabase
        .from("notification_emails_absences")
        .select("id, email, is_active")
        .order("created_at");

      if (absenceError) throw absenceError;
      setAbsenceEmails(absenceData || []);

      // Fetch departments
      const { data: deptData, error: deptError } = await supabase
        .from("support_departments")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order");

      if (deptError) throw deptError;
      setDepartments(deptData || []);

      // Fetch support notification emails
      const { data: supportData, error: supportError } = await supabase
        .from("notification_emails_support")
        .select("id, department_id, email, is_active")
        .order("created_at");

      if (supportError) throw supportError;

      // Group by department
      const grouped: DepartmentEmails = {};
      (deptData || []).forEach(dept => {
        grouped[dept.id] = (supportData || [])
          .filter(e => e.department_id === dept.id)
          .map(e => ({ id: e.id, email: e.email, is_active: e.is_active }));
      });
      setSupportEmails(grouped);

      // Open all departments by default if they have emails
      const deptWithEmails = (deptData || [])
        .filter(d => grouped[d.id]?.length > 0)
        .map(d => d.id);
      setOpenDepartments(deptWithEmails);

    } catch (error: any) {
      console.error("Error fetching notification emails:", error);
      toast.error("Erro ao carregar configurações de notificação");
    } finally {
      setIsLoading(false);
    }
  };

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Absence email handlers
  const handleAddAbsenceEmail = async () => {
    const email = newAbsenceEmail.trim().toLowerCase();
    if (!email) return;

    if (!validateEmail(email)) {
      toast.error("Email inválido");
      return;
    }

    if (absenceEmails.some(e => e.email.toLowerCase() === email)) {
      toast.error("Este email já está configurado");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notification_emails_absences")
        .insert({ email })
        .select()
        .single();

      if (error) throw error;

      setAbsenceEmails([...absenceEmails, data]);
      setNewAbsenceEmail("");
      toast.success("Email adicionado com sucesso");
    } catch (error: any) {
      console.error("Error adding absence email:", error);
      toast.error("Erro ao adicionar email");
    }
  };

  const handleToggleAbsenceEmail = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("notification_emails_absences")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;

      setAbsenceEmails(absenceEmails.map(e => 
        e.id === id ? { ...e, is_active: isActive } : e
      ));
    } catch (error: any) {
      console.error("Error toggling absence email:", error);
      toast.error("Erro ao atualizar email");
    }
  };

  const handleDeleteAbsenceEmail = async (id: string) => {
    try {
      const { error } = await supabase
        .from("notification_emails_absences")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setAbsenceEmails(absenceEmails.filter(e => e.id !== id));
      toast.success("Email removido");
    } catch (error: any) {
      console.error("Error deleting absence email:", error);
      toast.error("Erro ao remover email");
    }
  };

  // Support email handlers
  const handleAddSupportEmail = async (departmentId: string) => {
    const email = (newSupportEmails[departmentId] || "").trim().toLowerCase();
    if (!email) return;

    if (!validateEmail(email)) {
      toast.error("Email inválido");
      return;
    }

    const deptEmails = supportEmails[departmentId] || [];
    if (deptEmails.some(e => e.email.toLowerCase() === email)) {
      toast.error("Este email já está configurado para este departamento");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notification_emails_support")
        .insert({ department_id: departmentId, email })
        .select()
        .single();

      if (error) throw error;

      setSupportEmails({
        ...supportEmails,
        [departmentId]: [...deptEmails, { id: data.id, email: data.email, is_active: data.is_active }]
      });
      setNewSupportEmails({ ...newSupportEmails, [departmentId]: "" });
      toast.success("Email adicionado com sucesso");
    } catch (error: any) {
      console.error("Error adding support email:", error);
      toast.error("Erro ao adicionar email");
    }
  };

  const handleToggleSupportEmail = async (departmentId: string, id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("notification_emails_support")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;

      setSupportEmails({
        ...supportEmails,
        [departmentId]: (supportEmails[departmentId] || []).map(e =>
          e.id === id ? { ...e, is_active: isActive } : e
        )
      });
    } catch (error: any) {
      console.error("Error toggling support email:", error);
      toast.error("Erro ao atualizar email");
    }
  };

  const handleDeleteSupportEmail = async (departmentId: string, id: string) => {
    try {
      const { error } = await supabase
        .from("notification_emails_support")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setSupportEmails({
        ...supportEmails,
        [departmentId]: (supportEmails[departmentId] || []).filter(e => e.id !== id)
      });
      toast.success("Email removido");
    } catch (error: any) {
      console.error("Error deleting support email:", error);
      toast.error("Erro ao remover email");
    }
  };

  const toggleDepartment = (deptId: string) => {
    setOpenDepartments(prev =>
      prev.includes(deptId)
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId]
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Absence Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5" />
            Notificações de Ausências
          </CardTitle>
          <CardDescription>
            Emails que receberão notificações quando colaboradores submetem pedidos de ausência
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {absenceEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum email configurado</p>
          ) : (
            <div className="space-y-2">
              {absenceEmails.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-4 rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className={entry.is_active ? "" : "text-muted-foreground line-through"}>
                      {entry.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={entry.is_active}
                      onCheckedChange={(checked) => handleToggleAbsenceEmail(entry.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteAbsenceEmail(entry.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="Adicionar email..."
              type="email"
              value={newAbsenceEmail}
              onChange={(e) => setNewAbsenceEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddAbsenceEmail()}
            />
            <Button onClick={handleAddAbsenceEmail} disabled={!newAbsenceEmail.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Support Notifications by Department */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Notificações de Suporte
          </CardTitle>
          <CardDescription>
            Emails que receberão notificações de tickets de suporte, organizados por departamento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum departamento configurado</p>
          ) : (
            departments.map((dept) => {
              const deptEmailsList = supportEmails[dept.id] || [];
              const isOpen = openDepartments.includes(dept.id);

              return (
                <Collapsible
                  key={dept.id}
                  open={isOpen}
                  onOpenChange={() => toggleDepartment(dept.id)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="flex w-full items-center justify-between rounded-lg border p-3 hover:bg-accent transition-colors">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span className="font-medium">{dept.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({deptEmailsList.length} email{deptEmailsList.length !== 1 ? "s" : ""})
                        </span>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 pt-2 space-y-2">
                    {deptEmailsList.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">
                        Nenhum email configurado para este departamento
                      </p>
                    ) : (
                      deptEmailsList.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between gap-4 rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className={entry.is_active ? "" : "text-muted-foreground line-through"}>
                              {entry.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={entry.is_active}
                              onCheckedChange={(checked) =>
                                handleToggleSupportEmail(dept.id, entry.id, checked)
                              }
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSupportEmail(dept.id, entry.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}

                    <div className="flex gap-2">
                      <Input
                        placeholder="Adicionar email..."
                        type="email"
                        value={newSupportEmails[dept.id] || ""}
                        onChange={(e) =>
                          setNewSupportEmails({ ...newSupportEmails, [dept.id]: e.target.value })
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleAddSupportEmail(dept.id)}
                      />
                      <Button
                        onClick={() => handleAddSupportEmail(dept.id)}
                        disabled={!(newSupportEmails[dept.id] || "").trim()}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
