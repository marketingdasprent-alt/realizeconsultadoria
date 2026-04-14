import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Holiday, isWeekend, isHoliday } from "@/lib/vacation-utils";
import { cn } from "@/lib/utils";
import { absenceTypeLabels } from "@/lib/absence-types";

interface AbsencePeriod {
  id: string;
  start_date: string;
  end_date: string;
  business_days: number;
  status: string;
  period_type?: string;
  start_time?: string | null;
  end_time?: string | null;
}

interface Absence {
  id: string;
  start_date: string;
  end_date: string;
  absence_type: string;
  status: string;
  notes: string | null;
  absence_periods?: AbsencePeriod[];
}

interface EmployeeCalendarProps {
  absences: Absence[];
  holidays: Holiday[];
}

// Abbreviated weekday labels for mobile
const weekdaysFull = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const weekdaysShort = ["D", "S", "T", "Q", "Q", "S", "S"];

const EmployeeCalendar = ({ absences, holidays }: EmployeeCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const startDayOfWeek = startOfMonth(currentMonth).getDay();

  const getAbsenceForDay = (day: Date): { absence: Absence; dayStatus: string; period?: AbsencePeriod } | null => {
    // Skip weekends and holidays
    if (isWeekend(day) || isHoliday(day, holidays)) {
      return null;
    }

    for (const absence of absences) {
      // Se tem períodos definidos, verificar apenas os períodos (não o range principal)
      if (absence.absence_periods && absence.absence_periods.length > 0) {
        for (const period of absence.absence_periods) {
          const pStart = parseISO(period.start_date);
          const pEnd = parseISO(period.end_date);
          
          if (day >= pStart && day <= pEnd) {
            let dayStatus = period.status || absence.status;
            
            // Fallback: if still partially_approved, show as pending
            if (dayStatus === "partially_approved") {
              dayStatus = "pending";
            }
            
            return { absence, dayStatus, period };
          }
        }
      } else {
        // Fallback: usar range principal se não há períodos
        const start = parseISO(absence.start_date);
        const end = parseISO(absence.end_date);

        if (day >= start && day <= end) {
          let dayStatus = absence.status;
          
          if (dayStatus === "partially_approved") {
            dayStatus = "pending";
          }
          
          return { absence, dayStatus };
        }
      }
    }

    return null;
  };

  const getHolidayForDay = (day: Date): Holiday | undefined => {
    return holidays.find(h => isSameDay(new Date(h.date), day));
  };

  const getDayClasses = (day: Date) => {
    const holiday = getHolidayForDay(day);
    const weekend = isWeekend(day);
    const absenceInfo = getAbsenceForDay(day);

    if (holiday) {
      return "bg-primary/10 text-primary border border-primary/20";
    }

    if (weekend) {
      return "bg-muted/50 text-muted-foreground";
    }

    if (absenceInfo) {
      const isPartial = absenceInfo.period?.period_type === 'partial';
      
      switch (absenceInfo.dayStatus) {
        case "approved":
          return isPartial 
            ? "bg-gradient-to-b from-green-500 to-background text-green-700 border border-green-300" 
            : "bg-green-500 text-white";
        case "pending":
          return isPartial 
            ? "bg-gradient-to-b from-orange-500 to-background text-orange-700 border border-orange-300" 
            : "bg-orange-500 text-white";
        case "rejected":
          return isPartial 
            ? "bg-gradient-to-b from-red-500 to-background text-red-700 border border-red-300" 
            : "bg-red-500 text-white";
        default:
          return "";
      }
    }

    return "";
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2 px-3 lg:px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="font-display text-lg lg:text-xl">Meu Calendário</CardTitle>
          <div className="flex items-center gap-1 lg:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 lg:h-10 lg:w-10"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4 lg:h-5 lg:w-5" />
            </Button>
            <span className="font-medium text-sm lg:text-base min-w-[100px] lg:min-w-[140px] text-center capitalize">
              {format(currentMonth, "MMM yyyy", { locale: pt })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 lg:h-10 lg:w-10"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 lg:px-6 pb-4">
        {/* Weekday headers - Short on mobile, full on desktop */}
        <div className="grid grid-cols-7 gap-0.5 lg:gap-1 mb-1 lg:mb-2">
          {weekdaysFull.map((day, i) => (
            <div
              key={day}
              className="text-center text-[10px] lg:text-xs font-medium text-muted-foreground py-1 lg:py-2"
            >
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{weekdaysShort[i]}</span>
            </div>
          ))}
        </div>

        {/* Calendar grid - Larger touch targets on mobile */}
        <TooltipProvider>
          <div className="grid grid-cols-7 gap-0.5 lg:gap-1">
            {/* Empty cells for days before the start of the month */}
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10 lg:h-10" />
            ))}

            {/* Days of the month */}
            {days.map((day) => {
              const holiday = getHolidayForDay(day);
              const absenceInfo = getAbsenceForDay(day);

              const getTooltipContent = () => {
                if (holiday) return holiday.name;
                if (!absenceInfo) return null;
                
                const statusText = absenceInfo.dayStatus === "approved"
                  ? "Aprovado"
                  : absenceInfo.dayStatus === "pending"
                  ? "Pendente"
                  : "Rejeitado";
                
                const typeLabel = absenceTypeLabels[absenceInfo.absence.absence_type];
                
                // Check if it's a partial period
                if (absenceInfo.period?.period_type === 'partial' && absenceInfo.period.start_time && absenceInfo.period.end_time) {
                  return `${typeLabel} (${absenceInfo.period.start_time}-${absenceInfo.period.end_time}) - ${statusText}`;
                }
                
                return `${typeLabel} - ${statusText}`;
              };

              const tooltipContent = getTooltipContent();

              const dayElement = (
                <div
                  className={cn(
                    "h-10 lg:h-10 flex items-center justify-center rounded-md text-xs lg:text-sm transition-colors font-medium",
                    getDayClasses(day),
                    !isSameMonth(day, currentMonth) && "opacity-30"
                  )}
                >
                  {format(day, "d")}
                </div>
              );

              if (tooltipContent) {
                return (
                  <Tooltip key={day.toISOString()}>
                    <TooltipTrigger asChild>{dayElement}</TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{tooltipContent}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return <div key={day.toISOString()}>{dayElement}</div>;
            })}
          </div>
        </TooltipProvider>

        {/* Legend - Grid on mobile, flex on desktop */}
        <div className="mt-3 lg:mt-4 pt-3 lg:pt-4 border-t border-border">
          <p className="text-[10px] lg:text-xs font-medium text-muted-foreground mb-2">Legenda:</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 lg:flex lg:flex-wrap lg:gap-4 text-[10px] lg:text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded bg-green-500 shrink-0" />
              <span>Aprovado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded bg-orange-500 shrink-0" />
              <span>Pendente</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded bg-red-500 shrink-0" />
              <span>Rejeitado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded bg-gradient-to-b from-green-500 to-background border border-green-300 shrink-0" />
              <span>Parcial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded bg-primary/10 border border-primary/30 shrink-0" />
              <span>Feriado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 rounded bg-muted/50 shrink-0" />
              <span>Fim-de-semana</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeCalendar;
