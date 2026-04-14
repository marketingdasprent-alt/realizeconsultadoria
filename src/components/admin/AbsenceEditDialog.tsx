import { useState, useEffect } from "react";
import { format, parseISO, isSameDay } from "date-fns";
import { pt } from "date-fns/locale";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Trash2, 
  Pencil,
  Check,
  X,
  Loader2,
  User,
  Building2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { absenceTypeLabels, trainingModeLabels } from "@/lib/absence-types";
import {
  Holiday,
  AVAILABLE_HOURS,
  countBusinessDays,
  calculateHoursBetween,
  calculateBusinessDaysFromHours,
  isWeekend,
  isHoliday as checkIsHoliday,
} from "@/lib/vacation-utils";

interface AbsencePeriod {
  id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  period_type?: string;
  start_time?: string | null;
  end_time?: string | null;
  status?: string;
}

interface AbsenceRequest {
  id: string;
  status: string;
  absence_type: string;
  notes: string | null;
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

interface EditablePeriod {
  id?: string;
  start_date: Date;
  end_date: Date;
  period_type: 'full_day' | 'partial';
  start_time?: string;
  end_time?: string;
  business_days: number;
  isEditing?: boolean;
  isNew?: boolean;
  toDelete?: boolean;
  originalStatus?: string;
}

interface AbsenceEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: AbsenceRequest | null;
  onSuccess: () => void;
}

const AbsenceEditDialog = ({
  open,
  onOpenChange,
  request,
  onSuccess,
}: AbsenceEditDialogProps) => {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<EditablePeriod[]>([]);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  
  // New period state
  const [isAddingPeriod, setIsAddingPeriod] = useState(false);
  const [newPeriodDates, setNewPeriodDates] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [newPeriodType, setNewPeriodType] = useState<'full_day' | 'partial'>('full_day');
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("13:00");

  // Edit period state
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("13:00");

  useEffect(() => {
    if (open) {
      fetchHolidays();
    }
  }, [open]);

  useEffect(() => {
    if (request && open) {
      // Convert periods to editable format
      const editablePeriods: EditablePeriod[] = request.periods.map((p) => ({
        id: p.id,
        start_date: parseISO(p.start_date),
        end_date: parseISO(p.end_date),
        period_type: (p.period_type as 'full_day' | 'partial') || 'full_day',
        start_time: p.start_time || undefined,
        end_time: p.end_time || undefined,
        business_days: Number(p.business_days),
        originalStatus: p.status,
      }));
      setPeriods(editablePeriods);
      setNotes(request.notes || "");
      setIsAddingPeriod(false);
      setEditingPeriodId(null);
    }
  }, [request, open]);

  const fetchHolidays = async () => {
    const currentYear = new Date().getFullYear();
    const { data } = await supabase
      .from("holidays")
      .select("*")
      .in("year", [currentYear - 1, currentYear, currentYear + 1]);
    setHolidays(data || []);
  };

  const isSingleDay = newPeriodDates.from && 
    (!newPeriodDates.to || isSameDay(newPeriodDates.from, newPeriodDates.to));

  const availableEndTimes = AVAILABLE_HOURS.filter(time => time > newStartTime);
  const editAvailableEndTimes = AVAILABLE_HOURS.filter(time => time > editStartTime);

  const isDateDisabled = (date: Date) => {
    if (isWeekend(date)) return true;
    if (checkIsHoliday(date, holidays)) return true;
    return false;
  };

  const calculatePeriodBusinessDays = (
    startDate: Date, 
    endDate: Date, 
    periodType: 'full_day' | 'partial',
    startTime?: string,
    endTime?: string
  ): number => {
    if (periodType === 'partial' && startTime && endTime) {
      const hours = calculateHoursBetween(startTime, endTime);
      return calculateBusinessDaysFromHours(hours);
    }
    return countBusinessDays(startDate, endDate, holidays);
  };

  const handleAddPeriod = () => {
    if (!newPeriodDates.from) return;

    const endDate = newPeriodDates.to || newPeriodDates.from;
    const periodType = isSingleDay ? newPeriodType : 'full_day';
    const startTime = periodType === 'partial' ? newStartTime : undefined;
    const endTime = periodType === 'partial' ? newEndTime : undefined;

    const businessDays = calculatePeriodBusinessDays(
      newPeriodDates.from,
      endDate,
      periodType,
      startTime,
      endTime
    );

    const newPeriod: EditablePeriod = {
      start_date: newPeriodDates.from,
      end_date: endDate,
      period_type: periodType,
      start_time: startTime,
      end_time: endTime,
      business_days: businessDays,
      isNew: true,
    };

    setPeriods([...periods, newPeriod]);
    setNewPeriodDates({ from: undefined, to: undefined });
    setNewPeriodType('full_day');
    setNewStartTime("09:00");
    setNewEndTime("13:00");
    setIsAddingPeriod(false);
  };

  const handleRemovePeriod = (index: number) => {
    const period = periods[index];
    if (period.id) {
      // Mark existing period for deletion
      const updated = [...periods];
      updated[index] = { ...period, toDelete: true };
      setPeriods(updated);
    } else {
      // Remove new period from array
      setPeriods(periods.filter((_, i) => i !== index));
    }
  };

  const handleStartEdit = (index: number) => {
    const period = periods[index];
    if (period.period_type === 'partial') {
      setEditStartTime(period.start_time || "09:00");
      setEditEndTime(period.end_time || "13:00");
    }
    setEditingPeriodId(period.id || `new-${index}`);
  };

  const handleSaveEdit = (index: number) => {
    const period = periods[index];
    const startTime = editStartTime;
    const endTime = editEndTime;

    const businessDays = calculatePeriodBusinessDays(
      period.start_date,
      period.end_date,
      period.period_type,
      startTime,
      endTime
    );

    const updated = [...periods];
    updated[index] = {
      ...period,
      start_time: period.period_type === 'partial' ? startTime : undefined,
      end_time: period.period_type === 'partial' ? endTime : undefined,
      business_days: businessDays,
    };
    setPeriods(updated);
    setEditingPeriodId(null);
  };

  const handleCancelEdit = () => {
    setEditingPeriodId(null);
  };

  const handleSave = async () => {
    if (!request) return;

    const activePeriods = periods.filter(p => !p.toDelete);
    if (activePeriods.length === 0) {
      toast({
        title: "Erro",
        description: "É necessário pelo menos um período de ausência.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Calculate new date range from all active periods
      const allDates = activePeriods.flatMap(p => [p.start_date, p.end_date]);
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

      // 1. Update main absence record
      const { error: absenceError } = await supabase
        .from("absences")
        .update({
          start_date: format(minDate, "yyyy-MM-dd"),
          end_date: format(maxDate, "yyyy-MM-dd"),
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (absenceError) throw absenceError;

      // 2. Delete periods marked for removal
      const periodsToDelete = periods.filter(p => p.toDelete && p.id);
      for (const period of periodsToDelete) {
        const { error } = await supabase
          .from("absence_periods")
          .delete()
          .eq("id", period.id!);
        if (error) throw error;
      }

      // 3. Update existing periods
      const periodsToUpdate = periods.filter(p => !p.toDelete && !p.isNew && p.id);
      for (const period of periodsToUpdate) {
        const { error } = await supabase
          .from("absence_periods")
          .update({
            start_date: format(period.start_date, "yyyy-MM-dd"),
            end_date: format(period.end_date, "yyyy-MM-dd"),
            start_time: period.start_time || null,
            end_time: period.end_time || null,
            business_days: period.business_days,
            period_type: period.period_type,
          })
          .eq("id", period.id!);
        if (error) throw error;
      }

      // 4. Insert new periods
      const newPeriods = periods.filter(p => p.isNew && !p.toDelete);
      for (const period of newPeriods) {
        // New periods inherit status from the absence (or pending if partially_approved)
        const newPeriodStatus = request.status === "approved" ? "approved" : "pending";
        
        const { error } = await supabase
          .from("absence_periods")
          .insert({
            absence_id: request.id,
            start_date: format(period.start_date, "yyyy-MM-dd"),
            end_date: format(period.end_date, "yyyy-MM-dd"),
            start_time: period.start_time || null,
            end_time: period.end_time || null,
            business_days: period.business_days,
            period_type: period.period_type,
            status: newPeriodStatus,
          });
        if (error) throw error;
      }

      toast({
        title: "Pedido atualizado",
        description: "O pedido de ausência foi atualizado com sucesso.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating absence:", error);
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o pedido.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const activePeriods = periods.filter(p => !p.toDelete);
  const totalBusinessDays = activePeriods.reduce((sum, p) => sum + p.business_days, 0);

  const formatPeriodDisplay = (period: EditablePeriod): string => {
    if (period.period_type === 'partial' && period.start_time && period.end_time) {
      return `${format(period.start_date, "dd MMM yyyy", { locale: pt })} (${period.start_time}-${period.end_time})`;
    }
    if (isSameDay(period.start_date, period.end_date)) {
      return format(period.start_date, "dd MMM yyyy", { locale: pt });
    }
    return `${format(period.start_date, "dd MMM", { locale: pt })} - ${format(period.end_date, "dd MMM yyyy", { locale: pt })}`;
  };

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Pedido de Ausência</DialogTitle>
          <DialogDescription className="space-y-2">
            <div className="flex items-center gap-2 mt-2">
              <User className="h-4 w-4" />
              <span className="font-medium">{request.employee.name}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                <span>{request.company.name}</span>
              </div>
              <Badge variant="outline">
                {absenceTypeLabels[request.absence_type] || request.absence_type}
                {request.absence_type === 'training' && (request as any).training_mode && (
                  <span className="ml-1">({trainingModeLabels[(request as any).training_mode] || (request as any).training_mode})</span>
                )}
              </Badge>
            </div>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Periods List */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Períodos</label>
              
              {activePeriods.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum período configurado.</p>
              ) : (
                <div className="space-y-2">
                  {periods.map((period, index) => {
                    if (period.toDelete) return null;
                    
                    const isEditing = editingPeriodId === (period.id || `new-${index}`);
                    const isPartial = period.period_type === 'partial';

                    return (
                      <div 
                        key={period.id || `new-${index}`} 
                        className={cn(
                          "rounded-lg border p-3 space-y-2",
                          period.isNew && "border-primary/50 bg-primary/5"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isPartial ? (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm font-medium">
                              {formatPeriodDisplay(period)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {period.business_days % 1 === 0 
                                ? period.business_days 
                                : period.business_days.toFixed(2)} dia{period.business_days !== 1 ? "s" : ""}
                            </Badge>
                            {!isEditing && isPartial && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleStartEdit(index)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleRemovePeriod(index)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Edit mode for partial periods */}
                        {isEditing && isPartial && (
                          <div className="pt-2 border-t space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Das</label>
                                <Select value={editStartTime} onValueChange={(value) => {
                                  setEditStartTime(value);
                                  if (value >= editEndTime) {
                                    const nextTime = AVAILABLE_HOURS.find(t => t > value);
                                    if (nextTime) setEditEndTime(nextTime);
                                  }
                                }}>
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {AVAILABLE_HOURS.slice(0, -1).map((time) => (
                                      <SelectItem key={time} value={time}>{time}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Às</label>
                                <Select value={editEndTime} onValueChange={setEditEndTime}>
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {editAvailableEndTimes.map((time) => (
                                      <SelectItem key={time} value={time}>{time}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Cancelar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSaveEdit(index)}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Guardar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Period Section */}
              {isAddingPeriod ? (
                <div className="rounded-lg border border-dashed p-4 space-y-3">
                  <label className="block text-sm font-medium">Novo Período</label>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newPeriodDates.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newPeriodDates.from ? (
                          newPeriodDates.to && !isSameDay(newPeriodDates.from, newPeriodDates.to) ? (
                            <>
                              {format(newPeriodDates.from, "dd/MM/yyyy")} - {format(newPeriodDates.to, "dd/MM/yyyy")}
                            </>
                          ) : (
                            format(newPeriodDates.from, "dd/MM/yyyy")
                          )
                        ) : (
                          "Selecionar datas"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={newPeriodDates}
                        onSelect={(range) => {
                          setNewPeriodDates({ from: range?.from, to: range?.to });
                          setNewPeriodType('full_day');
                        }}
                        locale={pt}
                        weekStartsOn={0}
                        disabled={isDateDisabled}
                        modifiers={{
                          holiday: holidays.map(h => new Date(h.date)),
                        }}
                        modifiersStyles={{
                          holiday: { 
                            backgroundColor: "hsl(var(--primary) / 0.1)",
                            color: "hsl(var(--primary))",
                            fontWeight: "bold",
                          },
                        }}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Period Type Selection - Only for single day */}
                  {isSingleDay && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={newPeriodType === 'full_day' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setNewPeriodType('full_day')}
                          className="flex-1"
                        >
                          <CalendarIcon className="h-4 w-4 mr-2" />
                          Dia Completo
                        </Button>
                        <Button
                          type="button"
                          variant={newPeriodType === 'partial' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setNewPeriodType('partial')}
                          className="flex-1"
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Período
                        </Button>
                      </div>

                      {newPeriodType === 'partial' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Das</label>
                            <Select value={newStartTime} onValueChange={(value) => {
                              setNewStartTime(value);
                              if (value >= newEndTime) {
                                const nextTime = AVAILABLE_HOURS.find(t => t > value);
                                if (nextTime) setNewEndTime(nextTime);
                              }
                            }}>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {AVAILABLE_HOURS.slice(0, -1).map((time) => (
                                  <SelectItem key={time} value={time}>{time}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Às</label>
                            <Select value={newEndTime} onValueChange={setNewEndTime}>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableEndTimes.map((time) => (
                                  <SelectItem key={time} value={time}>{time}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsAddingPeriod(false);
                        setNewPeriodDates({ from: undefined, to: undefined });
                      }}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddPeriod}
                      disabled={!newPeriodDates.from}
                      className="flex-1"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddingPeriod(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Período
                </Button>
              )}
            </div>

            {/* Total Summary */}
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total:</span>
                <span className="font-display text-lg font-semibold">
                  {totalBusinessDays % 1 === 0 
                    ? totalBusinessDays 
                    : totalBusinessDays.toFixed(2)} dia{totalBusinessDays !== 1 ? "s" : ""} útil
                </span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Notas</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionais (opcional)"
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading || activePeriods.length === 0}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AbsenceEditDialog;
