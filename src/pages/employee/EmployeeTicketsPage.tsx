import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import {
  ArrowLeft,
  Plus,
  MessageSquare,
  Headset,
  LogOut,
  Paperclip,
  Download,
  FileText,
  Image,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-realize.png";
import NewTicketDialog from "@/components/employee/NewTicketDialog";
import TicketConversationDialog from "@/components/employee/TicketConversationDialog";

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

interface TicketAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  content_type: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  company_id: string;
  companies: { name: string };
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

const statusColors: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  open: "secondary",
  in_progress: "outline",
  resolved: "default",
  closed: "destructive",
};

const EmployeeTicketsPage = () => {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [ticketAttachments, setTicketAttachments] = useState<Record<string, TicketAttachment[]>>({});
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isConversationOpen, setIsConversationOpen] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const loadData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/colaborador/login");
      return;
    }

    const { data: employeeData } = await supabase
      .from("employees")
      .select("*, companies(name)")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!employeeData) {
      navigate("/colaborador/login");
      return;
    }

    setEmployee(employeeData);

    const { data: ticketsData } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("employee_id", employeeData.id)
      .order("created_at", { ascending: false });

    setTickets(ticketsData || []);

    // Load attachments counts for all tickets
    if (ticketsData && ticketsData.length > 0) {
      const ticketIds = ticketsData.map((t: any) => t.id);
      const { data: attachmentsData } = await supabase
        .from("support_ticket_attachments")
        .select("id, ticket_id, file_name, file_path, file_size, content_type")
        .in("ticket_id", ticketIds);

      if (attachmentsData) {
        const grouped: Record<string, TicketAttachment[]> = {};
        for (const att of attachmentsData) {
          if (!grouped[att.ticket_id]) grouped[att.ticket_id] = [];
          grouped[att.ticket_id].push(att);
        }
        setTicketAttachments(grouped);
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleDownloadAttachment = async (attachment: TicketAttachment) => {
    const { data, error } = await supabase.storage
      .from("ticket-attachments")
      .createSignedUrl(attachment.file_path, 300);
    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, "_blank");
  };

  const filteredTickets = tickets.filter((ticket) => {
    if (activeTab === "all") return true;
    if (activeTab === "open") return ticket.status === "open";
    if (activeTab === "in_progress") return ticket.status === "in_progress";
    if (activeTab === "resolved")
      return ticket.status === "resolved" || ticket.status === "closed";
    return true;
  });

  const ticketCounts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter(
      (t) => t.status === "resolved" || t.status === "closed"
    ).length,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto"></div>
          <p className="mt-4 text-muted-foreground">A carregar...</p>
        </div>
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header - Mobile First */}
      <header className="bg-background border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 lg:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 lg:gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 lg:h-10 lg:w-10"
                onClick={() => navigate("/colaborador")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <img
                src={logo}
                alt="Realize Consultadoria"
                className="h-8 lg:h-12 w-auto hidden sm:block"
              />
              <div>
                <h1 className="font-display text-base lg:text-xl font-semibold flex items-center gap-2">
                  <Headset className="h-4 w-4 lg:h-5 lg:w-5 text-gold" />
                  Meus Tickets
                </h1>
                <p className="text-xs lg:text-sm text-muted-foreground hidden sm:block">
                  Histórico de suporte
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-3">
              <Button 
                variant="gold" 
                size="sm"
                className="h-9 lg:h-10 text-xs lg:text-sm px-3 lg:px-4"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1 lg:mr-2" />
                <span className="hidden sm:inline">Novo Ticket</span>
                <span className="sm:hidden">Novo</span>
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 lg:h-10 lg:w-10" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 lg:py-6">
        {/* Tabs - Horizontal scroll on mobile */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4 lg:mb-6">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:max-w-md sm:grid-cols-4 h-10 lg:h-11">
              <TabsTrigger value="all" className="text-xs lg:text-sm px-3 lg:px-4">
                Todos ({ticketCounts.all})
              </TabsTrigger>
              <TabsTrigger value="open" className="text-xs lg:text-sm px-3 lg:px-4">
                Abertos ({ticketCounts.open})
              </TabsTrigger>
              <TabsTrigger value="in_progress" className="text-xs lg:text-sm px-3 lg:px-4">
                Progresso ({ticketCounts.in_progress})
              </TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs lg:text-sm px-3 lg:px-4">
                Resolvidos ({ticketCounts.resolved})
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" className="sm:hidden" />
          </ScrollArea>
        </Tabs>

        {/* Tickets List */}
        {filteredTickets.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-10 lg:py-12 text-center">
              <MessageSquare className="h-10 w-10 lg:h-12 lg:w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm lg:text-base">
                {activeTab === "all"
                  ? "Ainda não tem tickets de suporte."
                  : "Nenhum ticket encontrado nesta categoria."}
              </p>
              <Button
                variant="gold"
                className="mt-4 h-10 lg:h-11"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Ticket
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 lg:space-y-4">
            {filteredTickets.map((ticket) => (
              <Card key={ticket.id} className="shadow-card cursor-pointer hover:ring-1 hover:ring-gold/30 transition-all" onClick={() => {
                setSelectedTicket(ticket);
                setIsConversationOpen(true);
              }}>
                <CardContent className="p-3 lg:p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-2 lg:mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm lg:text-base line-clamp-2">
                        {ticket.subject}
                      </h3>
                      <p className="text-xs lg:text-sm text-muted-foreground mt-1">
                        {format(new Date(ticket.created_at), "dd MMM yyyy 'às' HH:mm", {
                          locale: pt,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] lg:text-xs px-2 py-0.5 lg:py-1 rounded-full ${
                          priorityColors[ticket.priority]
                        }`}
                      >
                        {priorityLabels[ticket.priority]}
                      </span>
                      <Badge variant={statusColors[ticket.status]} className="text-[10px] lg:text-xs">
                        {statusLabels[ticket.status]}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs lg:text-sm text-muted-foreground line-clamp-2 mb-2 lg:mb-3">
                    {ticket.message}
                  </p>

                  {/* Attachments */}
                  {ticketAttachments[ticket.id] && ticketAttachments[ticket.id].length > 0 && (
                    <div className="mb-2 lg:mb-3">
                      <p className="text-[10px] lg:text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        Anexos ({ticketAttachments[ticket.id].length})
                      </p>
                      <div className="space-y-1">
                        {ticketAttachments[ticket.id].map((att) => (
                          <button
                            key={att.id}
                            onClick={() => handleDownloadAttachment(att)}
                            className="flex items-center gap-2 p-1.5 border border-border rounded bg-muted/30 hover:bg-muted/60 transition-colors w-full text-left"
                          >
                            {att.content_type.startsWith("image/") ? (
                              <Image className="h-3 w-3 text-muted-foreground shrink-0" />
                            ) : (
                              <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-xs truncate flex-1">{att.file_name}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0">{formatFileSize(att.file_size)}</span>
                            <Download className="h-3 w-3 text-muted-foreground shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {ticket.admin_notes && (
                    <div className="mt-2 lg:mt-3 pt-2 lg:pt-3 border-t border-border bg-muted/50 -mx-3 lg:-mx-4 -mb-3 lg:-mb-4 px-3 lg:px-4 pb-3 lg:pb-4 rounded-b-lg">
                      <p className="text-[10px] lg:text-xs font-medium text-muted-foreground mb-1">
                        Resposta da equipa:
                      </p>
                      <p className="text-xs lg:text-sm">{ticket.admin_notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* New Ticket Dialog */}
      <NewTicketDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        employeeId={employee.id}
        companyId={employee.company_id}
        employeeName={employee.name}
        employeeEmail={employee.email}
        companyName={employee.companies?.name || ""}
        onSuccess={loadData}
      />

      {/* Conversation Dialog */}
      <TicketConversationDialog
        open={isConversationOpen}
        onOpenChange={setIsConversationOpen}
        ticket={selectedTicket}
        employeeId={employee.id}
        employeeName={employee.name}
        employeeEmail={employee.email}
        companyName={employee.companies?.name || ""}
        onReplySent={loadData}
      />
    </div>
  );
};

export default EmployeeTicketsPage;
