import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Clock, Check, X, Filter, RefreshCw, Search } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import AdminLayout from "@/components/layout/AdminLayout";
import { getLogoBase64 } from "@/lib/logo-utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AbsenceRequestCard from "@/components/admin/AbsenceRequestCard";
import AbsenceApprovalDialog from "@/components/admin/AbsenceApprovalDialog";
import AbsenceDocumentsDialog from "@/components/admin/AbsenceDocumentsDialog";
import AbsenceEditDialog from "@/components/admin/AbsenceEditDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { Holiday, countBusinessDays } from "@/lib/vacation-utils";
import { absenceTypeLabels, trainingModeLabels } from "@/lib/absence-types";

interface AbsencePeriod {
  id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  status?: string;
  period_type?: string;
  start_time?: string | null;
  end_time?: string | null;
}

interface AbsenceRequest {
  id: string;
  status: string;
  absence_type: string;
  notes: string | null;
  rejection_reason?: string | null;
  created_at: string;
  start_date: string;
  end_date: string;
  employee_id: string;
  total_business_days?: number;
  document_count?: number;
  approved_by?: string | null;
  approver_name?: string | null;
  employee: {
    id: string;
    name: string;
    email: string;
  };
  company: {
    id: string;
    name: string;
  };
  periods: AbsencePeriod[];
}

const statusOptions = [
  { value: "all", label: "Todos os Estados" },
  { value: "pending", label: "Pendentes" },
  { value: "approved", label: "Aprovados" },
  { value: "rejected", label: "Rejeitados" },
];

const AbsenceRequestsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [requests, setRequests] = useState<AbsenceRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"approve" | "partial" | "reject">("approve");
  const [selectedRequest, setSelectedRequest] = useState<AbsenceRequest | null>(null);
  const [docsDialogOpen, setDocsDialogOpen] = useState(false);
  const [selectedAbsenceId, setSelectedAbsenceId] = useState<string | null>(null);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editRequest, setEditRequest] = useState<AbsenceRequest | null>(null);
  const [unapproveDialogOpen, setUnapproveDialogOpen] = useState(false);
  const [unapproveRequest, setUnapproveRequest] = useState<AbsenceRequest | null>(null);
  const [isUnapproving, setIsUnapproving] = useState(false);
  const [unapproveNote, setUnapproveNote] = useState("");

  useEffect(() => {
    fetchHolidays();
  }, []);

  useEffect(() => {
    if (holidays.length >= 0) {
      fetchRequests();
    }
  }, [statusFilter, holidays]);

  const fetchHolidays = async () => {
    const currentYear = new Date().getFullYear();
    const { data } = await supabase
      .from("holidays")
      .select("*")
      .in("year", [currentYear, currentYear + 1]);
    setHolidays(data || []);
  };

  const fetchRequests = async (retryCount = 0) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("absences")
        .select(`
          id,
          status,
          absence_type,
          notes,
          rejection_reason,
          created_at,
          start_date,
          end_date,
          employee_id,
          approved_by,
          employees!inner (
            id,
            name,
            email,
            companies!inner (
              id,
              name
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        if (statusFilter === "approved") {
          query = query.in("status", ["approved", "partially_approved"]);
        } else {
          query = query.eq("status", statusFilter);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch periods for each absence
      const absenceIds = data?.map((a) => a.id) || [];
      const approverIds = data?.map((a) => a.approved_by).filter(Boolean) as string[];
      
      // Fetch periods, document counts, and approver names in parallel
      const [periodsResult, docsResult, approversResult] = await Promise.all([
        supabase
          .from("absence_periods")
          .select("*")
          .in("absence_id", absenceIds),
        supabase
          .from("absence_documents")
          .select("absence_id")
          .in("absence_id", absenceIds),
        approverIds.length > 0 
          ? supabase.from("profiles").select("user_id, name").in("user_id", approverIds)
          : Promise.resolve({ data: [] }),
      ]);

      if (periodsResult.error) throw periodsResult.error;

      const periodsData = periodsResult.data;
      const docsData = docsResult.data || [];
      const approversData = approversResult.data || [];

      // Build document count map
      const docCountMap = docsData.reduce((acc, doc) => {
        acc[doc.absence_id] = (acc[doc.absence_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Build approver name map
      const approverNameMap = approversData.reduce((acc, profile) => {
        acc[profile.user_id] = profile.name;
        return acc;
      }, {} as Record<string, string>);

      const formattedRequests: AbsenceRequest[] = (data || []).map((absence) => {
        const absencePeriods = (periodsData || []).filter((p) => p.absence_id === absence.id);
        const hasPeriods = absencePeriods.length > 0;
        
        // Calculate business days from main absence dates if no periods exist
        const totalBusinessDays = hasPeriods 
          ? absencePeriods.reduce((sum, p) => sum + Number(p.business_days), 0)
          : countBusinessDays(new Date(absence.start_date), new Date(absence.end_date), holidays);

        return {
          id: absence.id,
          status: absence.status,
          absence_type: absence.absence_type,
          notes: absence.notes,
          rejection_reason: (absence as any).rejection_reason || null,
          created_at: absence.created_at,
          start_date: absence.start_date,
          end_date: absence.end_date,
          employee_id: absence.employee_id,
          total_business_days: totalBusinessDays,
          document_count: docCountMap[absence.id] || 0,
          approved_by: absence.approved_by,
          approver_name: absence.approved_by ? approverNameMap[absence.approved_by] || null : null,
          employee: {
            id: absence.employees.id,
            name: absence.employees.name,
            email: absence.employees.email,
          },
          company: {
            id: absence.employees.companies.id,
            name: absence.employees.companies.name,
          },
          periods: absencePeriods,
        };
      });

      setRequests(formattedRequests);
    } catch (error: any) {
      console.error("Error fetching requests:", error);
      
      // Retry once on network failure
      const isNetworkError = error?.message?.includes("Failed to fetch") || 
                             error?.message?.includes("NetworkError") ||
                             error?.name === "TypeError";
      
      if (isNetworkError && retryCount < 1) {
        setTimeout(() => fetchRequests(retryCount + 1), 1000);
        return;
      }
      
      toast({
        title: "Erro ao carregar pedidos",
        description: isNetworkError 
          ? "Falha de ligação ao servidor. Recarregue a página ou volte a iniciar sessão."
          : "Não foi possível carregar os pedidos de ausência.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    if (value === "all") {
      searchParams.delete("status");
    } else {
      searchParams.set("status", value);
    }
    setSearchParams(searchParams);
  };

  const openDialog = (request: AbsenceRequest, mode: "approve" | "partial" | "reject") => {
    setSelectedRequest(request);
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const handlePrintAbsence = async (request: AbsenceRequest) => {
    const logoBase64 = await getLogoBase64();
    // Filter only approved periods (for partially_approved) or all periods (for approved)
    const approvedPeriods = request.periods.filter(
      (p) => p.status === "approved" || request.status === "approved"
    );

    // Calculate total approved business days
    const totalApprovedDays = approvedPeriods.reduce(
      (sum, p) => sum + Number(p.business_days),
      0
    );

    const statusLabels: Record<string, string> = {
      approved: "Aprovado",
      partially_approved: "Parcialmente Aprovado",
    };

    const calculateWorkingHours = (startTime: string, endTime: string): number => {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      
      let totalMinutes = endMinutes - startMinutes;
      
      // Hora de almoço: 13:00 às 14:00
      const lunchStart = 13 * 60;
      const lunchEnd = 14 * 60;
      
      if (startMinutes < lunchEnd && endMinutes > lunchStart) {
        const overlapStart = Math.max(startMinutes, lunchStart);
        const overlapEnd = Math.min(endMinutes, lunchEnd);
        const lunchOverlap = Math.max(0, overlapEnd - overlapStart);
        totalMinutes -= lunchOverlap;
      }
      
      return totalMinutes / 60;
    };

    const formatPeriodDuration = (period: AbsencePeriod): string => {
      if (period.period_type === 'partial' && period.start_time && period.end_time) {
        const hours = calculateWorkingHours(period.start_time, period.end_time);
        return `${hours}h (${period.start_time.slice(0, 5)}-${period.end_time.slice(0, 5)})`;
      }
      const days = Number(period.business_days);
      if (days % 1 === 0) {
        return `${days} dia${days !== 1 ? 's' : ''} útil`;
      }
      return `${days.toFixed(2)} dias úteis`;
    };

    const formatTotal = (): string => {
      const allPartial = approvedPeriods.every(p => p.period_type === 'partial');
      const singleDay = approvedPeriods.length === 1 || 
        approvedPeriods.every(p => p.start_date === approvedPeriods[0].start_date);
      
      if (allPartial && singleDay && approvedPeriods[0]?.start_time && approvedPeriods[0]?.end_time) {
        const totalHours = approvedPeriods.reduce((sum, p) => {
          if (p.start_time && p.end_time) {
            return sum + calculateWorkingHours(p.start_time, p.end_time);
          }
          return sum;
        }, 0);
        return `${totalHours} Horas Não Trabalhadas`;
      }
      
      const days = totalApprovedDays % 1 === 0 ? totalApprovedDays : totalApprovedDays.toFixed(2);
      const label = totalApprovedDays === 1 ? 'Dia Útil Não Trabalhado' : 'Dias Úteis Não Trabalhados';
      return `${days} ${label}`;
    };

    const formatPeriodDates = (period: AbsencePeriod) => {
      if (period.start_date === period.end_date) {
        return format(new Date(period.start_date), "dd MMM yyyy", { locale: pt });
      }
      return `${format(new Date(period.start_date), "dd MMM", { locale: pt })} a ${format(new Date(period.end_date), "dd MMM yyyy", { locale: pt })}`;
    };

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprovativo de Ausência - ${request.employee.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
          .container { max-width: 700px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 3px solid #d4a853; padding-bottom: 25px; margin-bottom: 30px; }
          .header h1 { font-size: 24px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px; letter-spacing: 1px; }
          .header .company { font-size: 16px; color: #666; }
          .section { margin-bottom: 25px; padding: 20px; background: #fafafa; border-radius: 8px; border: 1px solid #e5e5e5; }
          .section h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
          .field { margin-bottom: 10px; }
          .field .label { font-weight: 600; color: #555; display: inline-block; width: 100px; }
          .field .value { color: #1a1a1a; }
          .period { padding: 12px 15px; margin: 8px 0; background: #fff; border-radius: 6px; border: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; }
          .period .dates { font-weight: 500; }
          .period .days { color: #666; font-size: 14px; }
          .total { font-size: 18px; font-weight: 600; color: #1a1a1a; margin-top: 15px; padding-top: 15px; border-top: 2px solid #d4a853; }
          .footer { margin-top: 50px; padding-top: 30px; border-top: 1px dashed #ccc; }
          .signature-area { display: flex; justify-content: space-between; margin-top: 60px; }
          .signature-box { text-align: center; width: 45%; }
          .signature-line { border-top: 1px solid #333; padding-top: 10px; margin-top: 50px; font-size: 14px; color: #666; }
          .date-info { font-size: 13px; color: #888; margin-top: 20px; }
          @media print { 
            body { padding: 20px; } 
            .section { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoBase64}" alt="Realize" style="height:60px;margin-bottom:8px;" />
            <h1>COMPROVATIVO DE AUSÊNCIA</h1>
            <p class="company">${request.company.name}</p>
          </div>
          
          <div class="section">
            <h3>Colaborador</h3>
            <div class="field">
              <span class="label">Nome:</span>
              <span class="value">${request.employee.name}</span>
            </div>
            <div class="field">
              <span class="label">Email:</span>
              <span class="value">${request.employee.email}</span>
            </div>
          </div>
          
          <div class="section">
            <h3>Detalhes da Ausência</h3>
            <div class="field">
              <span class="label">Tipo:</span>
              <span class="value">${absenceTypeLabels[request.absence_type] || request.absence_type}${request.absence_type === 'training' && (request as any).training_mode ? ` (${trainingModeLabels[(request as any).training_mode] || (request as any).training_mode})` : ''}</span>
            </div>
            <div class="field">
              <span class="label">Estado:</span>
              <span class="value">${statusLabels[request.status] || request.status}</span>
            </div>
            <div class="field">
              <span class="label">Aprovado Por:</span>
              <span class="value">${request.approver_name || 'N/A'}</span>
            </div>
            <div class="field">
              <span class="label">Justificativa:</span>
              <span class="value">${request.document_count && request.document_count > 0 ? 'Sim (com documentos anexados)' : 'Não apresentada'}</span>
            </div>
            
            <h3 style="margin-top: 20px;">Períodos Aprovados</h3>
            ${approvedPeriods.map((p) => `
              <div class="period">
                <span class="dates">${formatPeriodDates(p)}</span>
                <span class="days">${formatPeriodDuration(p)}</span>
              </div>
            `).join("")}
            
            <div class="total">
              Total: ${formatTotal()}
            </div>
          </div>
          
          <div class="date-info">
            <p>Data do pedido: ${format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}</p>
          </div>
          
          <div class="footer">
            <div class="signature-area">
              <div class="signature-box">
                <div class="signature-line">Colaborador</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">Responsável</div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleUnapprove = async () => {
    if (!unapproveRequest) return;
    setIsUnapproving(true);
    try {
      // Update absence status to pending and clear approval fields
      const { error: absenceError } = await supabase
        .from("absences")
        .update({
          status: "pending",
          approved_by: null,
          approved_at: null,
          rejection_reason: unapproveNote.trim() || null,
        })
        .eq("id", unapproveRequest.id);

      if (absenceError) throw absenceError;

      // Update all periods to pending
      const { error: periodsError } = await supabase
        .from("absence_periods")
        .update({ status: "pending" })
        .eq("absence_id", unapproveRequest.id);

      if (periodsError) throw periodsError;

      toast({
        title: "Pedido desaprovado",
        description: `O pedido de ${unapproveRequest.employee.name} voltou ao estado pendente. O saldo de férias foi devolvido.`,
      });

      setUnapproveDialogOpen(false);
      setUnapproveRequest(null);
      setUnapproveNote("");
      fetchRequests();
    } catch (error) {
      console.error("Error unapproving request:", error);
      toast({
        title: "Erro ao desaprovar",
        description: "Não foi possível desaprovar o pedido.",
        variant: "destructive",
      });
    } finally {
      setIsUnapproving(false);
    }
  };

  const filteredRequests = requests.filter((request) =>
    request.employee.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = filteredRequests.filter((r) => r.status === "pending").length;
  const approvedCount = filteredRequests.filter((r) => r.status === "approved" || r.status === "partially_approved").length;
  const rejectedCount = filteredRequests.filter((r) => r.status === "rejected").length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Pedidos de Ausência</h1>
            <p className="text-muted-foreground mt-1">
              Gerir pedidos de férias e ausências dos colaboradores
            </p>
          </div>
          <Button variant="outline" onClick={() => fetchRequests()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg p-4 border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-lg p-4 border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedCount}</p>
                <p className="text-sm text-muted-foreground">Aprovados</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-lg p-4 border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <X className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rejectedCount}</p>
                <p className="text-sm text-muted-foreground">Rejeitados</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="search"
              name="search-absences"
              placeholder="Pesquisar por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Nenhum pedido encontrado</h3>
            <p className="text-muted-foreground">
              {searchTerm
                ? "Nenhum pedido corresponde à pesquisa."
                : statusFilter === "pending"
                ? "Não existem pedidos pendentes de aprovação."
                : "Não existem pedidos com o filtro selecionado."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredRequests.map((request) => (
              <AbsenceRequestCard
                key={request.id}
                request={request}
                onApproveAll={() => openDialog(request, "approve")}
                onApprovePartially={() => openDialog(request, "partial")}
                onReject={() => openDialog(request, "reject")}
                onViewDocuments={() => {
                  setSelectedAbsenceId(request.id);
                  setSelectedEmployeeName(request.employee.name);
                  setDocsDialogOpen(true);
                }}
                onEdit={() => {
                  setEditRequest(request);
                  setEditDialogOpen(true);
                }}
                onPrint={() => handlePrintAbsence(request)}
                onUnapprove={() => {
                  setUnapproveRequest(request);
                  setUnapproveDialogOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <AbsenceApprovalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        request={selectedRequest}
        mode={dialogMode}
        onSuccess={fetchRequests}
      />

      <AbsenceDocumentsDialog
        open={docsDialogOpen}
        onOpenChange={setDocsDialogOpen}
        absenceId={selectedAbsenceId}
        employeeName={selectedEmployeeName}
      />

      <AbsenceEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        request={editRequest}
        onSuccess={fetchRequests}
      />

      <Dialog open={unapproveDialogOpen} onOpenChange={(open) => {
        setUnapproveDialogOpen(open);
        if (!open) {
          setUnapproveNote("");
          setUnapproveRequest(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Desaprovar Pedido</DialogTitle>
            <DialogDescription>
              O pedido de {unapproveRequest?.employee.name} voltará ao estado "Pendente" e os dias de férias serão devolvidos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Nota de desaprovação (opcional)</label>
            <Textarea
              value={unapproveNote}
              onChange={(e) => setUnapproveNote(e.target.value)}
              placeholder="Indique o motivo da desaprovação..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnapproveDialogOpen(false)} disabled={isUnapproving}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnapprove}
              disabled={isUnapproving}
            >
              {isUnapproving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A desaprovar...
                </>
              ) : (
                "Confirmar Desaprovação"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AbsenceRequestsPage;
