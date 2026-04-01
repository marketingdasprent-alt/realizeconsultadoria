import { useState, useEffect } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Headset, Plus, MessageSquare, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  priority: string;
  status: string;
  created_at: string;
  admin_notes: string | null;
  department_id: string | null;
}

interface SupportSubject {
  id: string;
  label: string;
  default_priority: string;
  department_id: string | null;
}

interface SupportDepartment {
  id: string;
  name: string;
}

interface SupportSectionProps {
  employeeId: string;
  companyId: string;
  employeeName: string;
  employeeEmail: string;
  companyName: string;
}

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  urgent: "bg-destructive/10 text-destructive",
};

const statusLabels: Record<string, string> = {
  open: "Em Aberto",
  in_progress: "Em Progresso",
  resolved: "Resolvido",
  closed: "Fechado",
};

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "secondary",
  in_progress: "outline",
  resolved: "default",
  closed: "destructive",
};

const SupportSection = ({ 
  employeeId, 
  companyId, 
  employeeName, 
  employeeEmail, 
  companyName 
}: SupportSectionProps) => {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subjects, setSubjects] = useState<SupportSubject[]>([]);
  const [departments, setDepartments] = useState<SupportDepartment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});

  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const loadTickets = async () => {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading tickets:", error);
    } else {
      setTickets(data || []);
      // Load attachment counts
      if (data && data.length > 0) {
        const ticketIds = data.map((t: any) => t.id);
        const { data: attData } = await supabase
          .from("support_ticket_attachments")
          .select("ticket_id")
          .in("ticket_id", ticketIds);
        if (attData) {
          const counts: Record<string, number> = {};
          for (const a of attData) {
            counts[a.ticket_id] = (counts[a.ticket_id] || 0) + 1;
          }
          setAttachmentCounts(counts);
        }
      }
    }
    setIsLoading(false);
  };

  const loadSubjects = async () => {
    setIsLoadingSubjects(true);
    const { data, error } = await supabase
      .from("support_ticket_subjects")
      .select("id, label, default_priority, department_id")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error loading subjects:", error);
    } else {
      setSubjects(data || []);
    }
    setIsLoadingSubjects(false);
  };

  const loadDepartments = async () => {
    setIsLoadingDepartments(true);
    const { data, error } = await supabase
      .from("support_departments")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error loading departments:", error);
    } else {
      setDepartments(data || []);
    }
    setIsLoadingDepartments(false);
  };

  useEffect(() => {
    loadTickets();
    loadSubjects();
    loadDepartments();
  }, [employeeId]);

  // Filter subjects by selected department
  const filteredSubjects = subjects.filter(
    (s) => s.department_id === selectedDepartment
  );

  // Reset subject when department changes
  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value);
    setSubject("");
  };

  const handleSubmit = async () => {
    if (!selectedDepartment) {
      toast({
        title: "Erro",
        description: "Por favor selecione o departamento.",
        variant: "destructive",
      });
      return;
    }

    if (!subject.trim()) {
      toast({
        title: "Erro",
        description: "Por favor indique o assunto.",
        variant: "destructive",
      });
      return;
    }

    if (!message.trim()) {
      toast({
        title: "Erro",
        description: "Por favor descreva o seu problema.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Get priority from selected subject
    const selectedSubject = subjects.find(s => s.label === subject);
    const priority = selectedSubject?.default_priority || "medium";

    try {
      const { error } = await supabase.from("support_tickets").insert({
        employee_id: employeeId,
        company_id: companyId,
        subject: subject.trim(),
        message: message.trim(),
        priority,
        department_id: selectedDepartment,
      });

      if (error) throw error;

      // Send notification email (fire and forget)
      supabase.functions.invoke("send-ticket-notification", {
        body: {
          employeeName,
          employeeEmail,
          companyName,
          subject: subject.trim(),
          priority,
          message: message.trim(),
          departmentId: selectedDepartment,
        },
      }).catch((err) => console.error("Failed to send ticket notification:", err));

      toast({ title: "Ticket criado com sucesso!" });
      setIsDialogOpen(false);
      setSelectedDepartment("");
      setSubject("");
      setMessage("");
      loadTickets();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="font-display text-xl flex items-center gap-2">
          <Headset className="h-5 w-5 text-gold" />
          Suporte
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gold" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                Novo Ticket de Suporte
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-2">Departamento *</label>
                {isLoadingDepartments ? (
                  <div className="flex items-center gap-2 h-10 px-3 border border-input rounded-md bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">A carregar departamentos...</span>
                  </div>
                ) : departments.length === 0 ? (
                  <div className="h-10 px-3 border border-input rounded-md bg-muted flex items-center">
                    <span className="text-sm text-muted-foreground">
                      Nenhum departamento disponível. Contacte o administrador.
                    </span>
                  </div>
                ) : (
                  <Select value={selectedDepartment} onValueChange={handleDepartmentChange} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Assunto *</label>
                {!selectedDepartment ? (
                  <div className="h-10 px-3 border border-input rounded-md bg-muted flex items-center">
                    <span className="text-sm text-muted-foreground">
                      Selecione primeiro um departamento
                    </span>
                  </div>
                ) : isLoadingSubjects ? (
                  <div className="flex items-center gap-2 h-10 px-3 border border-input rounded-md bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">A carregar assuntos...</span>
                  </div>
                ) : filteredSubjects.length === 0 ? (
                  <div className="h-10 px-3 border border-input rounded-md bg-muted flex items-center">
                    <span className="text-sm text-muted-foreground">
                      Nenhum assunto disponível para este departamento.
                    </span>
                  </div>
                ) : (
                  <Select value={subject} onValueChange={setSubject} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um assunto" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSubjects.map((s) => (
                        <SelectItem key={s.id} value={s.label}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>


              <div>
                <label className="block text-sm font-medium mb-2">Descrição *</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Descreva o problema em detalhe..."
                  rows={5}
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)} 
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button variant="gold" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "A enviar..." : "Enviar Ticket"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground">A carregar...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              Ainda não tem tickets de suporte.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.slice(0, 5).map((ticket) => (
              <div
                key={ticket.id}
                className="p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-medium text-sm line-clamp-1">{ticket.subject}</p>
                  <Badge variant={statusColors[ticket.status]} className="shrink-0 text-xs">
                    {statusLabels[ticket.status]}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[ticket.priority]}`}>
                      {priorityLabels[ticket.priority]}
                    </span>
                    {attachmentCounts[ticket.id] > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Paperclip className="h-3 w-3" />
                        {attachmentCounts[ticket.id]}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(ticket.created_at), "dd MMM yyyy", { locale: pt })}
                  </span>
                </div>
                {ticket.admin_notes && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      <strong>Resposta:</strong> {ticket.admin_notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
            {tickets.length > 5 && (
              <p className="text-center text-xs text-muted-foreground pt-2">
                A mostrar os 5 tickets mais recentes de {tickets.length}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SupportSection;
