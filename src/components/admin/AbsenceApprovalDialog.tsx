import { useState, useEffect } from 'react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Check, X, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isWeekend, isHoliday, Holiday } from '@/lib/vacation-utils';
import {
  findApprovedConflicts,
  describeConflicts,
  type OverlapPeriod,
} from '@/lib/absence-overlap';
import {
  absenceDecisionService,
  copyDocumentsToAttachments,
} from '@/modules/admin/services/absenceDecisionService';

interface AbsencePeriod {
  id: string;
  start_date: string;
  end_date: string;
  business_days: number;
}

interface AbsenceRequest {
  id: string;
  status: string;
  absence_type: string;
  notes: string | null;
  employee_id: string;
  start_date: string;
  end_date: string;
  total_business_days?: number;
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

interface AbsenceApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: AbsenceRequest | null;
  mode: 'approve' | 'partial' | 'reject';
  onSuccess: () => void;
}

const AbsenceApprovalDialog = ({
  open,
  onOpenChange,
  request,
  mode,
  onSuccess,
}: AbsenceApprovalDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [allRequestedDates, setAllRequestedDates] = useState<Date[]>([]);

  useEffect(() => {
    if (open && request) {
      fetchHolidays();
      calculateRequestedDates();
    }
  }, [open, request]);

  const fetchHolidays = async () => {
    const currentYear = new Date().getFullYear();
    const { data } = await supabase
      .from('holidays')
      .select('*')
      .in('year', [currentYear, currentYear + 1]);

    if (data) {
      setHolidays(data);
    }
  };

  const calculateRequestedDates = () => {
    if (!request) return;

    const dates: Date[] = [];
    const hasPeriods = request.periods && request.periods.length > 0;

    if (hasPeriods) {
      request.periods.forEach(period => {
        const days = eachDayOfInterval({
          start: parseISO(period.start_date),
          end: parseISO(period.end_date),
        });
        days.forEach(day => {
          if (!isWeekend(day) && !isHoliday(day, holidays)) {
            dates.push(day);
          }
        });
      });
    } else {
      // Use main absence dates as fallback
      const days = eachDayOfInterval({
        start: parseISO(request.start_date),
        end: parseISO(request.end_date),
      });
      days.forEach(day => {
        if (!isWeekend(day) && !isHoliday(day, holidays)) {
          dates.push(day);
        }
      });
    }

    setAllRequestedDates(dates);
    setSelectedDates(dates);
  };

  useEffect(() => {
    if (allRequestedDates.length > 0 && holidays.length >= 0) {
      const businessDays = allRequestedDates.filter(
        day => !isWeekend(day) && !isHoliday(day, holidays)
      );
      setSelectedDates(businessDays);
    }
  }, [allRequestedDates, holidays]);

  const showConflict = (target: AbsenceRequest, reason: string) =>
    toast({
      title: 'Conflito com ausência já aprovada',
      description: `${target.employee.name}: ${reason} Reprove um dos pedidos antes de aprovar este.`,
      variant: 'destructive',
    });

  // Aprovação parcial: os períodos são refeitos dia a dia (dias seguidos com a mesma decisão
  // ficam num só período, aprovado ou rejeitado).
  const approvePartially = async (target: AbsenceRequest): Promise<boolean> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Não autenticado');

    // Impedir dois pedidos aprovados no mesmo dia: só contam os dias aceites.
    const periodsBeingApproved: OverlapPeriod[] = selectedDates.map(d => ({
      start_date: format(d, 'yyyy-MM-dd'),
      end_date: format(d, 'yyyy-MM-dd'),
      period_type: 'full_day',
    }));
    const { data: conflicts, error: conflictError } = await findApprovedConflicts(
      target.employee_id,
      periodsBeingApproved,
      target.id
    );
    if (conflictError) throw conflictError;
    if (conflicts && conflicts.length > 0) {
      showConflict(target, describeConflicts(conflicts));
      return false;
    }

    const { error: absenceError } = await supabase
      .from('absences')
      .update({
        status: 'partially_approved',
        approved_by: session.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', target.id);
    if (absenceError) throw absenceError;

    const chosen = new Set(selectedDates.map(d => format(d, 'yyyy-MM-dd')));
    const newPeriods: { start: string; end: string; status: string; businessDays: number }[] = [];
    for (const day of allRequestedDates) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const status = chosen.has(dateStr) ? 'approved' : 'rejected';
      const last = newPeriods[newPeriods.length - 1];
      if (last && last.status === status) {
        last.end = dateStr;
        last.businessDays += 1;
      } else {
        newPeriods.push({ start: dateStr, end: dateStr, status, businessDays: 1 });
      }
    }

    const { error: deleteError } = await supabase
      .from('absence_periods')
      .delete()
      .eq('absence_id', target.id);
    if (deleteError) throw deleteError;
    const { error: insertError } = await supabase.from('absence_periods').insert(
      newPeriods.map(period => ({
        absence_id: target.id,
        start_date: period.start,
        end_date: period.end,
        business_days: period.businessDays,
        status: period.status,
      }))
    );
    if (insertError) throw insertError;

    await copyDocumentsToAttachments(target, session.user.id);
    return true;
  };

  const handleApprove = async () => {
    if (!request) return;
    setIsLoading(true);

    try {
      const hasPeriods = request.periods && request.periods.length > 0;
      const daysToApprove =
        mode === 'partial'
          ? selectedDates.length
          : hasPeriods
            ? request.periods.reduce((sum, p) => sum + p.business_days, 0)
            : request.total_business_days || allRequestedDates.length;

      let approved: boolean;
      if (mode === 'partial') {
        approved = await approvePartially(request);
      } else {
        const { data, error } = await absenceDecisionService.approve(request);
        if (error || !data) throw error ?? new Error('Sem resposta');
        if (data.conflict) showConflict(request, data.conflict);
        approved = !data.conflict;
      }
      if (!approved) return;

      // O saldo de férias é atualizado automaticamente via database trigger
      toast({
        title: mode === 'partial' ? 'Pedido parcialmente aprovado' : 'Pedido aprovado',
        description: `${daysToApprove} dias úteis aprovados para ${request.employee.name}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error approving absence:', error);
      toast({
        title: 'Erro ao aprovar',
        description: 'Ocorreu um erro ao processar o pedido.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!request) return;

    setIsLoading(true);

    try {
      const { error } = await absenceDecisionService.reject(request, rejectionReason);
      if (error) throw error;

      toast({
        title: 'Pedido rejeitado',
        description: `O pedido de ${request.employee.name} foi rejeitado.`,
      });

      onSuccess();
      onOpenChange(false);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting absence:', error);
      toast({
        title: 'Erro ao rejeitar',
        description: 'Ocorreu um erro ao processar o pedido.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleDate = (date: Date) => {
    setSelectedDates(prev => {
      const exists = prev.some(d => format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
      if (exists) {
        return prev.filter(d => format(d, 'yyyy-MM-dd') !== format(date, 'yyyy-MM-dd'));
      }
      return [...prev, date];
    });
  };

  const isDateSelected = (date: Date) => {
    return selectedDates.some(d => format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
  };

  const isDateRequested = (date: Date) => {
    return allRequestedDates.some(d => format(d, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
  };

  if (!request) return null;

  const hasPeriods = request.periods && request.periods.length > 0;
  const totalRequested = hasPeriods
    ? request.periods.reduce((sum, p) => sum + p.business_days, 0)
    : request.total_business_days || allRequestedDates.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'approve' && 'Aprovar Pedido'}
            {mode === 'partial' && 'Aprovar Parcialmente'}
            {mode === 'reject' && 'Rejeitar Pedido'}
          </DialogTitle>
          <DialogDescription>
            Pedido de {request.employee.name} - {totalRequested} dias úteis solicitados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode === 'approve' && (
            <div className="bg-primary/10 rounded-lg p-4 flex items-start gap-3">
              <Check className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Confirmar aprovação total</p>
                <p className="text-sm text-muted-foreground">
                  Serão aprovados todos os {totalRequested} dias úteis solicitados.
                  {request.absence_type === 'vacation' && (
                    <> O saldo de férias do colaborador será atualizado automaticamente.</>
                  )}
                </p>
              </div>
            </div>
          )}

          {mode === 'partial' && (
            <div className="space-y-4">
              <div className="bg-secondary rounded-lg p-4">
                <p className="font-medium mb-2">Selecione os dias a aprovar</p>
                <p className="text-sm text-muted-foreground">
                  Clique nos dias para selecionar/desselecionar. Fins de semana e feriados estão
                  desativados.
                </p>
              </div>

              <div className="flex justify-center">
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={() => {}}
                  locale={pt}
                  disabled={date =>
                    isWeekend(date) || !!isHoliday(date, holidays) || !isDateRequested(date)
                  }
                  modifiers={{
                    requested: date => isDateRequested(date),
                    selected: date => isDateSelected(date),
                  }}
                  modifiersStyles={{
                    requested: {
                      backgroundColor: 'hsl(var(--secondary))',
                      borderRadius: '0.375rem',
                    },
                    selected: {
                      backgroundColor: 'hsl(var(--primary))',
                      color: 'hsl(var(--primary-foreground))',
                      borderRadius: '0.375rem',
                    },
                  }}
                  onDayClick={date => {
                    if (!isWeekend(date) && !isHoliday(date, holidays) && isDateRequested(date)) {
                      toggleDate(date);
                    }
                  }}
                  className="rounded-md border"
                  numberOfMonths={2}
                />
              </div>

              <div className="flex items-center justify-between bg-secondary rounded-lg p-3">
                <span className="font-medium">Dias selecionados:</span>
                <span className="text-primary font-semibold">
                  {selectedDates.length} de {totalRequested} dias úteis
                </span>
              </div>

              {selectedDates.length === 0 && (
                <div className="bg-destructive/10 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm text-destructive">
                    Selecione pelo menos um dia para aprovar
                  </span>
                </div>
              )}
            </div>
          )}

          {mode === 'reject' && (
            <div className="space-y-4">
              <div className="bg-destructive/10 rounded-lg p-4 flex items-start gap-3">
                <X className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Rejeitar pedido</p>
                  <p className="text-sm text-muted-foreground">
                    O colaborador será notificado sobre a rejeição do seu pedido.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Motivo da Rejeição (opcional)</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Indique o motivo da rejeição..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          {mode === 'reject' ? (
            <Button variant="destructive" onClick={handleReject} disabled={isLoading}>
              {isLoading ? 'A processar...' : 'Rejeitar Pedido'}
            </Button>
          ) : (
            <Button
              onClick={handleApprove}
              disabled={isLoading || (mode === 'partial' && selectedDates.length === 0)}
            >
              {isLoading
                ? 'A processar...'
                : mode === 'partial'
                  ? `Aprovar ${selectedDates.length} Dias`
                  : 'Aprovar Tudo'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AbsenceApprovalDialog;
