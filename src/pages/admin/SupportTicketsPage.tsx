import { useEffect, useState } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { 
  Headset, 
  Filter, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Building2,
  Paperclip,
  Download,
  FileText,
  Image,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { getLogoBase64, getLogoHeaderHtml } from "@/lib/logo-utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSupportDepartments } from "@/hooks/useSupportDepartments";
import TicketConversationDialog from "@/components/admin/TicketConversationDialog";

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  admin_notes: string | null;
  employee_id: string;
  company_id: string;
  department_id: string | null;
  employees: {
    name: string;
    email: string;
  };
  companies: {
    name: string;
  };
}

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const priorityOrder: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
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

interface TicketAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const SupportTicketsPage = () => {
  const { toast } = useToast();
  const { departments, userDepartmentIds, isLoading: isLoadingDepartments, isSuperAdmin, canAccessDepartment } = useSupportDepartments();
  
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(new Set());
  const [ticketAttachments, setTicketAttachments] = useState<Record<string, TicketAttachment[]>>({});
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
  const [showPrintModeDialog, setShowPrintModeDialog] = useState(false);
  const [pendingPrintTickets, setPendingPrintTickets] = useState<SupportTicket[]>([]);

  const toggleSelectTicket = (ticketId: string) => {
    setSelectedTicketIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTicketIds.size === filteredAndSortedTickets.length) {
      setSelectedTicketIds(new Set());
    } else {
      setSelectedTicketIds(new Set(filteredAndSortedTickets.map((t) => t.id)));
    }
  };

  const handlePrint = async (ticketsToPrint: SupportTicket[], onePerPage = false) => {
    const logoBase64 = await getLogoBase64();
    const ticketsHtml = ticketsToPrint.map((ticket, index) => {
      const deptName = getDepartmentName(ticket.department_id);
      const separator = index > 0
        ? (onePerPage
          ? '<div style="page-break-before:always;"></div>'
          : '<hr style="border:none;border-top:2px solid #ccc;margin:30px 0;" />')
        : '';
      return `
        ${separator}
        <div style="margin-bottom:20px;">
          <h2 style="margin:0 0 4px 0;font-size:18px;">${ticket.subject}</h2>
          <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;">
            <tr><td style="padding:4px 8px;font-weight:600;width:140px;border:1px solid #ddd;background:#f5f5f5;">Colaborador</td><td style="padding:4px 8px;border:1px solid #ddd;">${ticket.employees?.name || '-'}</td></tr>
            <tr><td style="padding:4px 8px;font-weight:600;border:1px solid #ddd;background:#f5f5f5;">Empresa</td><td style="padding:4px 8px;border:1px solid #ddd;">${ticket.companies?.name || '-'}</td></tr>
            ${deptName ? `<tr><td style="padding:4px 8px;font-weight:600;border:1px solid #ddd;background:#f5f5f5;">Departamento</td><td style="padding:4px 8px;border:1px solid #ddd;">${deptName}</td></tr>` : ''}
            <tr><td style="padding:4px 8px;font-weight:600;border:1px solid #ddd;background:#f5f5f5;">Prioridade</td><td style="padding:4px 8px;border:1px solid #ddd;">${priorityLabels[ticket.priority] || ticket.priority}</td></tr>
            <tr><td style="padding:4px 8px;font-weight:600;border:1px solid #ddd;background:#f5f5f5;">Status</td><td style="padding:4px 8px;border:1px solid #ddd;">${statusLabels[ticket.status] || ticket.status}</td></tr>
            <tr><td style="padding:4px 8px;font-weight:600;border:1px solid #ddd;background:#f5f5f5;">Data</td><td style="padding:4px 8px;border:1px solid #ddd;">${format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}</td></tr>
          </table>
          <div style="margin-top:12px;">
            <p style="font-weight:600;font-size:13px;margin:0 0 4px 0;">Mensagem:</p>
            <p style="font-size:13px;white-space:pre-wrap;margin:0;padding:8px;background:#f9f9f9;border:1px solid #eee;border-radius:4px;">${ticket.message}</p>
          </div>
          ${ticket.admin_notes ? `
          <div style="margin-top:12px;">
            <p style="font-weight:600;font-size:13px;margin:0 0 4px 0;">Notas do Admin:</p>
            <p style="font-size:13px;white-space:pre-wrap;margin:0;padding:8px;background:#fff8e1;border:1px solid #ffe082;border-radius:4px;">${ticket.admin_notes}</p>
          </div>` : ''}
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html><head><title>Tickets de Suporte</title>
      <style>
        @page { size: A4 portrait; margin: 1.5cm; }
        body { font-family: Arial, sans-serif; color: #000; margin: 0; padding: 0; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
      </head><body>
        ${getLogoHeaderHtml(logoBase64, `Tickets de Suporte — ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: pt })}`)}
        ${ticketsHtml}
      </body></html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
    }
  };

  const handlePrintSelected = () => {
    const selected = filteredAndSortedTickets.filter((t) => selectedTicketIds.has(t.id));
    if (selected.length === 0) return;
    if (selected.length === 1) {
      handlePrint(selected);
      return;
    }
    setPendingPrintTickets(selected);
    setShowPrintModeDialog(true);
  };

  const loadTickets = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select(`
        *,
        employees(name, email),
        companies(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading tickets:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os tickets.",
        variant: "destructive",
      });
    } else {
      setTickets(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  // Filter tickets by user's department access
  const accessibleTickets = tickets.filter(ticket => canAccessDepartment(ticket.department_id));

  const filteredAndSortedTickets = accessibleTickets
    .filter((ticket) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
      if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false;
      if (subjectFilter !== "all" && ticket.subject !== subjectFilter) return false;
      if (departmentFilter !== "all") {
        if (departmentFilter === "none" && ticket.department_id !== null) return false;
        if (departmentFilter !== "none" && ticket.department_id !== departmentFilter) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "date_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "priority":
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case "date_desc":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const stats = {
    open: accessibleTickets.filter((t) => t.status === "open").length,
    in_progress: accessibleTickets.filter((t) => t.status === "in_progress").length,
    resolved: accessibleTickets.filter((t) => t.status === "resolved").length,
    total: accessibleTickets.length,
  };

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return null;
    return departments.find(d => d.id === departmentId)?.name || null;
  };

  const sendStatusNotification = async (
    ticket: SupportTicket,
    newStatus: string,
    notes: string | null,
    notificationType: 'status_change' | 'notes_added'
  ) => {
    try {
      await supabase.functions.invoke('send-ticket-status-notification', {
        body: {
          ticketId: ticket.id,
          employeeEmail: ticket.employees.email,
          employeeName: ticket.employees.name,
          ticketSubject: ticket.subject,
          oldStatus: ticket.status,
          newStatus: newStatus,
          adminNotes: notes,
          notificationType,
        }
      });
      console.log("Status notification sent successfully");
    } catch (error) {
      console.error('Failed to send status notification:', error);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setIsUpdating(true);
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      const oldStatus = ticket?.status;
      
      const updateData: Record<string, any> = {
        status: newStatus,
      };

      if (newStatus === "resolved" || newStatus === "closed") {
        updateData.resolved_at = new Date().toISOString();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) updateData.resolved_by = user.id;
      }

      const { error } = await supabase
        .from("support_tickets")
        .update(updateData)
        .eq("id", ticketId);

      if (error) throw error;

      // Send notification to employee if status actually changed
      if (ticket && oldStatus !== newStatus) {
        const { data: updatedTicket } = await supabase
          .from("support_tickets")
          .select("admin_notes")
          .eq("id", ticketId)
          .single();

        await sendStatusNotification(
          ticket,
          newStatus,
          updatedTicket?.admin_notes || null,
          'status_change'
        );
      }

      toast({ title: "Status atualizado!" });
      loadTickets();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedTicket) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ admin_notes: adminNotes })
        .eq("id", selectedTicket.id);

      if (error) throw error;

      // Send notification to employee about new notes
      await sendStatusNotification(
        selectedTicket,
        selectedTicket.status,
        adminNotes,
        'notes_added'
      );

      toast({ title: "Notas guardadas!" });
      setIsDetailOpen(false);
      loadTickets();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const openDetail = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setAdminNotes(ticket.admin_notes || "");
    setIsDetailOpen(true);
  };

  const loadAttachments = async (ticketId: string) => {
    if (ticketAttachments[ticketId]) return;
    const { data } = await supabase
      .from("support_ticket_attachments")
      .select("id, file_name, file_path, file_size, content_type")
      .eq("ticket_id", ticketId);
    setTicketAttachments((prev) => ({ ...prev, [ticketId]: data || [] }));
  };

  const handleDownloadAttachment = async (attachment: TicketAttachment) => {
    const { data, error } = await supabase.storage
      .from("ticket-attachments")
      .createSignedUrl(attachment.file_path, 300);
    if (error || !data?.signedUrl) {
      toast({ title: "Erro", description: "Não foi possível gerar o link de download.", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const toggleExpand = (ticketId: string) => {
    setExpandedTickets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
        loadAttachments(ticketId);
      }
      return newSet;
    });
  };

  // Get departments accessible to user for the filter
  const accessibleDepartments = departments.filter(d => 
    isSuperAdmin || userDepartmentIds.includes(d.id)
  );

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-semibold flex items-center gap-3">
            <Headset className="h-8 w-8 text-gold" />
            Tickets de Suporte
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerir pedidos de suporte dos colaboradores
            {!isSuperAdmin && userDepartmentIds.length > 0 && (
              <span className="ml-2 text-xs">
                ({accessibleDepartments.length} departamento{accessibleDepartments.length !== 1 ? 's' : ''})
              </span>
            )}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.open}</p>
                  <p className="text-xs text-muted-foreground">Em Aberto</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.in_progress}</p>
                  <p className="text-xs text-muted-foreground">Em Progresso</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.resolved}</p>
                  <p className="text-xs text-muted-foreground">Resolvidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Headset className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros:</span>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="open">Em Aberto</SelectItem>
                  <SelectItem value="in_progress">Em Progresso</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Prioridades</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
              {accessibleDepartments.length > 0 && (
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Departamentos</SelectItem>
                    <SelectItem value="none">Sem Departamento</SelectItem>
                    {accessibleDepartments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {(() => {
                const uniqueSubjects = Array.from(new Set(accessibleTickets.map(t => t.subject))).sort();
                return uniqueSubjects.length > 0 ? (
                  <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Assunto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Assuntos</SelectItem>
                      {uniqueSubjects.map(subject => (
                        <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null;
              })()}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Mais Recente</SelectItem>
                  <SelectItem value="date_asc">Mais Antigo</SelectItem>
                  <SelectItem value="priority">Prioridade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-xl">
              Tickets ({filteredAndSortedTickets.length})
            </CardTitle>
            <div className="flex items-center gap-3">
              {filteredAndSortedTickets.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
                  <Checkbox
                    checked={selectedTicketIds.size === filteredAndSortedTickets.length && filteredAndSortedTickets.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  Selecionar Todos
                </label>
              )}
              {selectedTicketIds.size > 0 && (
                <Button size="sm" variant="outline" onClick={handlePrintSelected}>
                  <Printer className="h-4 w-4 mr-1" />
                  Imprimir ({selectedTicketIds.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading || isLoadingDepartments ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold mx-auto"></div>
                <p className="mt-4 text-muted-foreground">A carregar...</p>
              </div>
            ) : filteredAndSortedTickets.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum ticket encontrado.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredAndSortedTickets.map((ticket) => {
                  const isExpanded = expandedTickets.has(ticket.id);
                  const deptName = getDepartmentName(ticket.department_id);
                  return (
                    <div
                      key={ticket.id}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      <div 
                        className="p-4 bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => toggleExpand(ticket.id)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Checkbox
                              checked={selectedTicketIds.has(ticket.id)}
                              onCheckedChange={() => toggleSelectTicket(ticket.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {ticket.priority === "urgent" && (
                              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                            )}
                            {ticket.priority === "high" && (
                              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                            )}
                            <p className="font-medium truncate">{ticket.subject}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {deptName && (
                              <Badge variant="outline" className="gap-1">
                                <Building2 className="h-3 w-3" />
                                {deptName}
                              </Badge>
                            )}
                            <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[ticket.priority]}`}>
                              {priorityLabels[ticket.priority]}
                            </span>
                            <Badge variant={statusColors[ticket.status]}>
                              {statusLabels[ticket.status]}
                            </Badge>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <span>{ticket.employees?.name}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{ticket.companies?.name}</span>
                          <span className="hidden sm:inline">•</span>
                          <span>{format(new Date(ticket.created_at), "dd MMM yyyy 'às' HH:mm", { locale: pt })}</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border p-4 bg-muted/20 space-y-4">
                          <div>
                            <p className="text-sm font-medium mb-1">Mensagem:</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {ticket.message}
                            </p>
                          </div>
                          
                          {ticket.admin_notes && (
                            <div className="p-3 bg-gold/10 rounded-lg">
                              <p className="text-sm font-medium mb-1">Notas do Admin:</p>
                              <p className="text-sm text-muted-foreground">
                                {ticket.admin_notes}
                              </p>
                            </div>
                          )}

                          {/* Attachments */}
                          {ticketAttachments[ticket.id] && ticketAttachments[ticket.id].length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                                <Paperclip className="h-4 w-4" />
                                Anexos ({ticketAttachments[ticket.id].length})
                              </p>
                              <div className="space-y-1">
                                {ticketAttachments[ticket.id].map((att) => (
                                  <button
                                    key={att.id}
                                    onClick={(e) => { e.stopPropagation(); handleDownloadAttachment(att); }}
                                    className="flex items-center gap-2 p-2 border border-border rounded-md bg-background hover:bg-muted/50 transition-colors w-full text-left"
                                  >
                                    {att.content_type.startsWith("image/") ? (
                                      <Image className="h-4 w-4 text-muted-foreground shrink-0" />
                                    ) : (
                                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                    )}
                                    <span className="text-sm truncate flex-1">{att.file_name}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(att.file_size)}</span>
                                    <Download className="h-3 w-3 text-muted-foreground shrink-0" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 pt-2">
                            {ticket.status === "open" && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(ticket.id, "in_progress");
                                }}
                                disabled={isUpdating}
                              >
                                Marcar Em Progresso
                              </Button>
                            )}
                            {(ticket.status === "open" || ticket.status === "in_progress") && (
                              <Button 
                                size="sm" 
                                variant="default"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(ticket.id, "resolved");
                                }}
                                disabled={isUpdating}
                              >
                                Marcar Resolvido
                              </Button>
                            )}
                            {ticket.status === "resolved" && (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(ticket.id, "closed");
                                }}
                                disabled={isUpdating}
                              >
                                Fechar Ticket
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="gold"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetail(ticket);
                              }}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Conversa
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrint([ticket]);
                              }}
                            >
                              <Printer className="h-4 w-4 mr-1" />
                              Imprimir
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversation Dialog */}
      <TicketConversationDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        ticket={selectedTicket}
        onReplySent={loadTickets}
      />

      {/* Print Mode Dialog */}
      <AlertDialog open={showPrintModeDialog} onOpenChange={setShowPrintModeDialog}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Modo de Impressão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Como pretende imprimir os {pendingPrintTickets.length} tickets selecionados?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <Button
              onClick={() => {
                setShowPrintModeDialog(false);
                handlePrint(pendingPrintTickets, true);
              }}
            >
              Um ticket por folha
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowPrintModeDialog(false);
                handlePrint(pendingPrintTickets, false);
              }}
            >
              Todos juntos
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SupportTicketsPage;
