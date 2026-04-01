import { useEffect, useState } from "react";
import { Calendar, Sun, User, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface VacationBalance {
  total_days: number;
  used_days: number;
  self_schedulable_days: number | null;
}

interface VacationBalanceCardProps {
  employeeId: string;
}

// Format days to show decimals only when needed
const formatDays = (days: number) => {
  return days % 1 === 0 ? days.toString() : days.toFixed(1);
};

const VacationBalanceCard = ({ employeeId }: VacationBalanceCardProps) => {
  const [balance, setBalance] = useState<VacationBalance | null>(null);
  const [pendingDays, setPendingDays] = useState(0);
  const [employeeScheduledDays, setEmployeeScheduledDays] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        console.log("[VacationBalanceCard] Fetching balance for:", { employeeId, currentYear });
        
        // Fetch vacation balance for current year
        const { data: balanceData, error: balanceError } = await supabase
          .from("employee_vacation_balances")
          .select("total_days, used_days, self_schedulable_days")
          .eq("employee_id", employeeId)
          .eq("year", currentYear)
          .maybeSingle();

        console.log("[VacationBalanceCard] Balance result:", { balanceData, balanceError });
        setBalance(balanceData);

        // Fetch pending vacation days
        const { data: pendingAbsences } = await supabase
          .from("absences")
          .select("id")
          .eq("employee_id", employeeId)
          .eq("absence_type", "vacation")
          .eq("status", "pending");

        if (pendingAbsences && pendingAbsences.length > 0) {
          // Get absence periods for pending absences
          const absenceIds = pendingAbsences.map(a => a.id);
          const { data: periods } = await supabase
            .from("absence_periods")
            .select("business_days")
            .in("absence_id", absenceIds);

          const totalPending = periods?.reduce((sum, p) => sum + p.business_days, 0) || 0;
          setPendingDays(totalPending);
        }

        // Fetch days scheduled by employee (not admin) for self_schedulable_days calculation
        if (balanceData?.self_schedulable_days !== null) {
          const { data: employeeAbsences } = await supabase
            .from("absences")
            .select("id")
            .eq("employee_id", employeeId)
            .eq("absence_type", "vacation")
            .eq("created_by_role", "employee")
            .in("status", ["pending", "approved"]);

          if (employeeAbsences && employeeAbsences.length > 0) {
            const absenceIds = employeeAbsences.map(a => a.id);
            const { data: periods } = await supabase
              .from("absence_periods")
              .select("business_days")
              .in("absence_id", absenceIds);

            const totalScheduled = periods?.reduce((sum, p) => sum + p.business_days, 0) || 0;
            setEmployeeScheduledDays(totalScheduled);
          }
        }
      } catch (error) {
        console.error("Error fetching vacation balance:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalance();
  }, [employeeId, currentYear]);

  if (isLoading) {
    return (
      <Card className="shadow-card bg-gradient-to-br from-gold/10 to-gold/5 border-gold/20">
        <CardContent className="py-4 px-4 lg:px-6">
          <div className="animate-pulse h-16 bg-gold/10 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!balance) {
    return (
      <Card className="shadow-card bg-gradient-to-br from-muted/50 to-muted/30 border-border">
        <CardContent className="py-4 px-4 lg:px-6">
          <div className="flex items-start gap-3 lg:gap-4">
            <div className="p-2.5 lg:p-3 bg-muted rounded-full shrink-0">
              <Calendar className="h-5 w-5 lg:h-6 lg:w-6 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Saldo de Férias</p>
              <p className="text-muted-foreground mt-1 text-sm">
                O saldo de férias ainda não foi configurado para {currentYear}.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const availableDays = balance.total_days - balance.used_days;
  const hasSelfSchedulableLimit = balance.self_schedulable_days !== null;
  const remainingSelfSchedulable = hasSelfSchedulableLimit 
    ? Math.max(0, balance.self_schedulable_days! - employeeScheduledDays)
    : null;
  const adminReservedDays = hasSelfSchedulableLimit 
    ? balance.total_days - balance.self_schedulable_days!
    : 0;

  return (
    <Card className="shadow-card bg-gradient-to-br from-gold/10 to-gold/5 border-gold/20">
      <CardContent className="py-4 px-4 lg:px-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 lg:gap-4">
          <div className="p-2.5 lg:p-3 bg-gold/20 rounded-full shrink-0 self-start">
            <Sun className="h-5 w-5 lg:h-6 lg:w-6 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">Saldo de Férias {currentYear}</p>
            <p className="font-display text-xl lg:text-2xl font-semibold text-foreground mt-1">
              {formatDays(availableDays)} <span className="text-base lg:text-lg font-normal text-muted-foreground">dias disponíveis</span>
            </p>
            
            <div className="flex flex-wrap gap-x-3 lg:gap-x-4 gap-y-1 mt-2 text-xs lg:text-sm text-muted-foreground">
              <span>{formatDays(balance.used_days)} dias utilizados</span>
              {pendingDays > 0 && (
                <span className="text-orange-600">• {formatDays(pendingDays)} dias pendentes</span>
              )}
            </div>

            {/* Self-schedulable info */}
            {hasSelfSchedulableLimit && (
              <div className="mt-3 pt-3 border-t border-gold/20 space-y-1.5 lg:space-y-1">
                <div className="flex items-center gap-2 text-xs lg:text-sm">
                  <User className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-gold shrink-0" />
                  <span>
                    <strong className="text-foreground">{formatDays(remainingSelfSchedulable!)}</strong>
                    <span className="text-muted-foreground"> de {formatDays(balance.self_schedulable_days!)} dias que pode marcar</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs lg:text-sm">
                  <Building2 className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    {formatDays(adminReservedDays)} dias reservados pela empresa
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VacationBalanceCard;
