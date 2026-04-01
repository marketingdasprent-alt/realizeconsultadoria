import { useState } from "react";
import { format, parseISO, isSameDay } from "date-fns";
import { pt } from "date-fns/locale";
import { Plus, Trash2, Calendar as CalendarIcon, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  DatePeriod, 
  Holiday, 
  PeriodType,
  AVAILABLE_HOURS,
  isWeekend, 
  isHoliday, 
  countBusinessDays,
  countTotalBusinessDays,
  calculateHoursBetween,
  calculateBusinessDaysFromHours,
  formatTimeRange,
} from "@/lib/vacation-utils";

interface ExistingAbsence {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface MultiPeriodSelectorProps {
  periods: DatePeriod[];
  onPeriodsChange: (periods: DatePeriod[]) => void;
  holidays: Holiday[];
  maxDays?: number;
  existingAbsences?: ExistingAbsence[];
  absenceType?: string;
}

const MultiPeriodSelector = ({
  periods,
  onPeriodsChange,
  holidays,
  maxDays,
  existingAbsences,
  absenceType,
}: MultiPeriodSelectorProps) => {
  const [currentPeriod, setCurrentPeriod] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  
  const [periodType, setPeriodType] = useState<PeriodType>('full_day');
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("13:00");

  // Check if single day is selected
  const isSingleDay = currentPeriod.from && 
    (!currentPeriod.to || isSameDay(currentPeriod.from, currentPeriod.to));

  // Calculate business days for current partial period
  const partialHours = calculateHoursBetween(startTime, endTime);
  const partialBusinessDays = calculateBusinessDaysFromHours(partialHours);

  // Calculate total business days including partial periods
  const calculateTotalBusinessDays = () => {
    return periods.reduce((total, period) => {
      if (period.periodType === 'partial' && period.businessDays !== undefined) {
        return total + period.businessDays;
      }
      return total + countBusinessDays(period.from, period.to, holidays);
    }, 0);
  };

  const totalBusinessDays = calculateTotalBusinessDays();
  const exceedsMax = maxDays !== undefined && totalBusinessDays > maxDays;

  // Filter end time options to only show times after start time
  const availableEndTimes = AVAILABLE_HOURS.filter(time => time > startTime);

  const isDateDisabled = (date: Date) => {
    if (isWeekend(date)) return true;
    if (isHoliday(date, holidays)) return true;
    
    const today = new Date(new Date().setHours(0, 0, 0, 0));
    
    // Allow past dates (up to 30 days) for sick leave and appointments
    if (absenceType === 'sick_leave' || absenceType === 'appointment') {
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return date < thirtyDaysAgo;
    }
    
    // For other types, block past dates
    return date < today;
  };

  const handleAddPeriod = () => {
    if (currentPeriod.from) {
      const newPeriod: DatePeriod = {
        from: currentPeriod.from,
        to: currentPeriod.to || currentPeriod.from,
        periodType: isSingleDay ? periodType : 'full_day',
        ...(isSingleDay && periodType === 'partial' ? {
          startTime,
          endTime,
          businessDays: partialBusinessDays,
        } : {}),
      };
      onPeriodsChange([...periods, newPeriod]);
      setCurrentPeriod({ from: undefined, to: undefined });
      setPeriodType('full_day');
      setStartTime("09:00");
      setEndTime("13:00");
    }
  };

  const handleRemovePeriod = (index: number) => {
    onPeriodsChange(periods.filter((_, i) => i !== index));
  };

  const getPeriodBusinessDays = (period: DatePeriod): number => {
    if (period.periodType === 'partial' && period.businessDays !== undefined) {
      return period.businessDays;
    }
    return countBusinessDays(period.from, period.to, holidays);
  };

  const formatPeriodDisplay = (period: DatePeriod): string => {
    if (period.periodType === 'partial' && period.startTime && period.endTime) {
      return `${format(period.from, "dd MMM yyyy", { locale: pt })} (${formatTimeRange(period.startTime, period.endTime)})`;
    }
    if (isSameDay(period.from, period.to)) {
      return format(period.from, "dd MMM yyyy", { locale: pt });
    }
    return `${format(period.from, "dd MMM", { locale: pt })} - ${format(period.to, "dd MMM yyyy", { locale: pt })}`;
  };

  return (
    <div className="space-y-4">
      {/* Existing Periods */}
      {periods.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Períodos selecionados</label>
          {periods.map((period, index) => {
            const businessDays = getPeriodBusinessDays(period);
            return (
              <Card key={index} className="bg-secondary/50">
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {period.periodType === 'partial' ? (
                      <Clock className="h-4 w-4 text-gold" />
                    ) : (
                      <CalendarIcon className="h-4 w-4 text-gold" />
                    )}
                    <span className="text-sm font-medium">
                      {formatPeriodDisplay(period)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {businessDays} {businessDays === 1 ? "dia útil" : "dias úteis"}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleRemovePeriod(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add New Period */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          {periods.length > 0 ? "Adicionar outro período" : "Selecionar período *"}
        </label>
        
        {/* Date Selection */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !currentPeriod.from && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {currentPeriod.from ? (
                currentPeriod.to && !isSameDay(currentPeriod.from, currentPeriod.to) ? (
                  <>
                    {format(currentPeriod.from, "dd/MM/yyyy")} - {format(currentPeriod.to, "dd/MM/yyyy")}
                  </>
                ) : (
                  format(currentPeriod.from, "dd/MM/yyyy")
                )
              ) : (
                "Selecionar datas"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={currentPeriod}
              onSelect={(range) => {
                setCurrentPeriod({ from: range?.from, to: range?.to });
                // Reset to full day when selecting new dates
                setPeriodType('full_day');
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
            <div className="p-3 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-primary/10 border border-primary/30" />
                <span>Feriados (não selecionáveis)</span>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Period Type Selection - Only for single day */}
        {isSingleDay && (
          <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/30">
            <label className="block text-sm font-medium">Tipo de Ausência</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={periodType === 'full_day' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodType('full_day')}
                className="flex-1"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Dia Completo
              </Button>
              <Button
                type="button"
                variant={periodType === 'partial' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodType('partial')}
                className="flex-1"
              >
                <Clock className="h-4 w-4 mr-2" />
                Período de Horas
              </Button>
            </div>

            {/* Time Selection - Only for partial */}
            {periodType === 'partial' && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Das</label>
                    <Select value={startTime} onValueChange={(value) => {
                      setStartTime(value);
                      // Ensure end time is after start time
                      if (value >= endTime) {
                        const nextTime = AVAILABLE_HOURS.find(t => t > value);
                        if (nextTime) setEndTime(nextTime);
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_HOURS.slice(0, -1).map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Às</label>
                    <Select value={endTime} onValueChange={setEndTime}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableEndTimes.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-background p-2 rounded">
                  <Clock className="h-4 w-4" />
                  <span>{partialHours} horas = <strong className="text-foreground">{partialBusinessDays} dia útil</strong></span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add Button */}
        <Button
          type="button"
          variant="outline"
          onClick={handleAddPeriod}
          disabled={!currentPeriod.from}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Período
        </Button>
      </div>

      {/* Summary */}
      {periods.length > 0 && (
        <div className={cn(
          "p-4 rounded-lg border",
          exceedsMax ? "bg-destructive/10 border-destructive/30" : "bg-gold/5 border-gold/20"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {exceedsMax && <AlertCircle className="h-4 w-4 text-destructive" />}
              <span className="font-medium">Total:</span>
            </div>
            <span className={cn(
              "font-display text-xl font-semibold",
              exceedsMax && "text-destructive"
            )}>
              {totalBusinessDays} {totalBusinessDays === 1 ? "dia útil" : "dias úteis"}
            </span>
          </div>
          {exceedsMax && maxDays && (
            <p className="text-sm text-destructive mt-2">
              Excede os {maxDays} dias disponíveis
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            Exclui fins de semana e feriados
          </p>
        </div>
      )}
    </div>
  );
};

export default MultiPeriodSelector;
