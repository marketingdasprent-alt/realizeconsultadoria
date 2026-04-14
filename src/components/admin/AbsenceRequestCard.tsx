import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Calendar, Clock, User, Building2, Check, X, Edit, Paperclip, Printer, Undo2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  total_business_days?: number;
  document_count?: number;
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

interface AbsenceRequestCardProps {
  request: AbsenceRequest;
  onApproveAll: () => void;
  onApprovePartially: () => void;
  onReject: () => void;
  onViewDocuments?: () => void;
  onEdit?: () => void;
  onPrint?: () => void;
  onUnapprove?: () => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  partially_approved: { label: "Parcialmente Aprovado", variant: "outline" },
};

const calculateWorkingHours = (startTime: string, endTime: string): number => {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  let totalMinutes = endMinutes - startMinutes;
  
  // Hora de almoço: 13:00 (780 min) às 14:00 (840 min)
  const lunchStart = 13 * 60;
  const lunchEnd = 14 * 60;
  
  // Calcular sobreposição com hora de almoço
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
    return `${hours}h`;
  }
  const days = Number(period.business_days);
  if (days % 1 === 0) {
    return `${days} dia${days !== 1 ? 's' : ''} útil`;
  }
  return `${days.toFixed(2)} dias úteis`;
};

const formatTotalDuration = (periods: AbsencePeriod[]): string => {
  const allPartial = periods.every(p => p.period_type === 'partial');
  
  // Se todos os períodos são parciais, mostrar em horas
  if (allPartial && periods[0]?.start_time && periods[0]?.end_time) {
    const totalHours = periods.reduce((sum, p) => {
      if (p.start_time && p.end_time) {
        return sum + calculateWorkingHours(p.start_time, p.end_time);
      }
      return sum;
    }, 0);
    return `${totalHours} Horas Não Trabalhadas`;
  }
  
  // Se não, mostrar em dias úteis
  const total = periods.reduce((sum, p) => sum + Number(p.business_days), 0);
  const label = total === 1 ? 'Dia Útil Não Trabalhado' : 'Dias Úteis Não Trabalhados';
  return `${total % 1 === 0 ? total : total.toFixed(2)} ${label}`;
};


const AbsenceRequestCard = ({ 
  request, 
  onApproveAll, 
  onApprovePartially, 
  onReject,
  onViewDocuments,
  onEdit,
  onPrint,
  onUnapprove,
}: AbsenceRequestCardProps) => {
  const hasPeriods = request.periods && request.periods.length > 0;
  const documentCount = Number(request.document_count ?? 0);
  const hasDocuments = documentCount > 0;
  const totalBusinessDays = hasPeriods 
    ? request.periods.reduce((sum, p) => sum + Number(p.business_days), 0)
    : Number(request.total_business_days) || 0;
  const status = statusConfig[request.status] || statusConfig.pending;
  const isPending = request.status === "pending";
  const canEdit = ["pending", "approved", "partially_approved"].includes(request.status);
  const canPrint = ["approved", "partially_approved"].includes(request.status);
  const canUnapprove = ["approved", "partially_approved"].includes(request.status);

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{request.employee.name}</h3>
              <p className="text-sm text-muted-foreground">{request.employee.email}</p>
            </div>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{request.company.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>
              {absenceTypeLabels[request.absence_type] || request.absence_type}
              {request.absence_type === 'training' && (request as any).training_mode && (
                <span className="ml-1 text-muted-foreground">({trainingModeLabels[(request as any).training_mode] || (request as any).training_mode})</span>
              )}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Períodos Solicitados:</p>
            {request.status === "partially_approved" && (
              <div className="flex gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700" />
                  <span>Aprovado</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700" />
                  <span>Rejeitado</span>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1">
            {hasPeriods ? (
              request.periods.map((period) => {
                const isApproved = period.status === "approved";
                const isRejected = period.status === "rejected";
                
                const bgClass = isApproved 
                  ? "bg-green-100 dark:bg-green-900/30" 
                  : isRejected 
                    ? "bg-red-100 dark:bg-red-900/30" 
                    : "bg-secondary";
                
                const textClass = isApproved 
                  ? "text-green-700 dark:text-green-400" 
                  : isRejected 
                    ? "text-red-700 dark:text-red-400" 
                    : "";

                return (
                  <div 
                    key={period.id} 
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${bgClass} ${textClass}`}
                  >
                    <div className="flex items-center gap-2">
                      {isApproved && <Check className="h-3 w-3" />}
                      {isRejected && <X className="h-3 w-3" />}
                      <span>
                        {period.start_date === period.end_date ? (
                          format(new Date(period.start_date), "dd MMM yyyy", { locale: pt })
                        ) : (
                          <>{format(new Date(period.start_date), "dd MMM", { locale: pt })} - {format(new Date(period.end_date), "dd MMM yyyy", { locale: pt })}</>
                        )}
                        {period.period_type === 'partial' && period.start_time && period.end_time && (
                          <span className="opacity-70 ml-1">({period.start_time}-{period.end_time})</span>
                        )}
                      </span>
                    </div>
                    <span className={isRejected ? "line-through opacity-70 text-muted-foreground" : "text-muted-foreground"}>
                      {formatPeriodDuration(period)}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2 text-sm">
                <span>
                  {format(new Date(request.start_date), "dd MMM", { locale: pt })} - {format(new Date(request.end_date), "dd MMM yyyy", { locale: pt })}
                </span>
                <span className="text-muted-foreground">
                  {totalBusinessDays} dia{totalBusinessDays !== 1 ? "s" : ""} útil
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Total: {hasPeriods ? formatTotalDuration(request.periods) : `${totalBusinessDays} dias úteis`}</span>
            </div>
            {hasDocuments && onViewDocuments && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                onClick={onViewDocuments}
              >
                <Paperclip className="h-3.5 w-3.5 mr-1" />
                {documentCount} doc{documentCount !== 1 ? "s" : ""}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Pedido em {format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
          </p>
        </div>

        {request.notes && (
          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Notas:</span> {request.notes}
            </p>
          </div>
        )}

        {request.rejection_reason && (
          <div className={`rounded-lg p-3 ${request.status === "rejected" ? "bg-destructive/10" : "bg-orange-50 dark:bg-orange-900/20"}`}>
            <p className={`text-sm ${request.status === "rejected" ? "text-destructive" : "text-orange-700 dark:text-orange-400"}`}>
              <span className="font-medium">
                {request.status === "rejected" ? "Motivo da rejeição:" : "Nota de desaprovação:"}
              </span>{" "}
              {request.rejection_reason}
            </p>
          </div>
        )}

        {isPending && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button size="sm" onClick={onApproveAll} className="flex-1">
              <Check className="h-4 w-4 mr-1" />
              Aprovar Tudo
            </Button>
            <Button size="sm" variant="outline" onClick={onApprovePartially} className="flex-1">
              <Edit className="h-4 w-4 mr-1" />
              Parcialmente
            </Button>
            <Button size="sm" variant="destructive" onClick={onReject} className="flex-1">
              <X className="h-4 w-4 mr-1" />
              Rejeitar
            </Button>
          </div>
        )}

        {/* Edit, Print and Unapprove buttons for non-rejected requests */}
        {(canEdit || canPrint || canUnapprove) && (
          <div className="flex flex-wrap gap-2 pt-2">
            {canUnapprove && onUnapprove && (
              <Button size="sm" variant="outline" onClick={onUnapprove} className="flex-1 text-orange-600 border-orange-300 hover:bg-orange-50 hover:text-orange-700">
                <Undo2 className="h-4 w-4 mr-1" />
                Desaprovar
              </Button>
            )}
            {canEdit && onEdit && (
              <Button size="sm" variant="outline" onClick={onEdit} className="flex-1">
                <Edit className="h-4 w-4 mr-1" />
                Editar
              </Button>
            )}
            {canPrint && onPrint && (
              <Button size="sm" variant="outline" onClick={onPrint} className="flex-1">
                <Printer className="h-4 w-4 mr-1" />
                Imprimir
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AbsenceRequestCard;
