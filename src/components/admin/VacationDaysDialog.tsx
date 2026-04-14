import { useState, useEffect } from "react";
import { Calendar, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VacationBalance {
  id?: string;
  employee_id: string;
  year: number;
  total_days: number;
  used_days: number;
  self_schedulable_days: number | null;
}

interface VacationDaysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  onSaved?: () => void;
}

const VacationDaysDialog = ({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  onSaved,
}: VacationDaysDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState<VacationBalance | null>(null);
  const [totalDaysInput, setTotalDaysInput] = useState("22");
  const [selfSchedulableDaysInput, setSelfSchedulableDaysInput] = useState("");

  const currentYear = new Date().getFullYear();

  // Format days to show decimals only when needed
  const formatDays = (days: number) => {
    if (isNaN(days)) return "0";
    return days % 1 === 0 ? days.toString() : days.toFixed(1);
  };

  useEffect(() => {
    if (open && employeeId) {
      fetchBalance();
    }
  }, [open, employeeId]);

  const fetchBalance = async () => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from("employee_vacation_balances")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("year", currentYear)
        .maybeSingle();

      if (data) {
        setBalance(data);
        setTotalDaysInput(data.total_days.toString());
        setSelfSchedulableDaysInput(data.self_schedulable_days?.toString() || "");
      } else {
        setBalance(null);
        setTotalDaysInput("22");
        setSelfSchedulableDaysInput("");
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    const totalDays = parseFloat(totalDaysInput);
    const selfSchedulableDays = selfSchedulableDaysInput ? parseFloat(selfSchedulableDaysInput) : null;
    
    if (isNaN(totalDays) || totalDays < 0) {
      toast({
        title: "Erro",
        description: "Por favor insira um valor válido para os dias totais.",
        variant: "destructive",
      });
      return;
    }

    if (selfSchedulableDays !== null && (isNaN(selfSchedulableDays) || selfSchedulableDays < 0)) {
      toast({
        title: "Erro",
        description: "Por favor insira um valor válido para os dias que pode marcar.",
        variant: "destructive",
      });
      return;
    }

    if (selfSchedulableDays !== null && selfSchedulableDays > totalDays) {
      toast({
        title: "Erro",
        description: "Os dias que pode marcar não podem exceder os dias totais.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      if (balance?.id) {
        // Update existing
        const { error } = await supabase
          .from("employee_vacation_balances")
          .update({ 
            total_days: totalDays,
            self_schedulable_days: selfSchedulableDays,
          })
          .eq("id", balance.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("employee_vacation_balances")
          .insert({
            employee_id: employeeId,
            year: currentYear,
            total_days: totalDays,
            used_days: 0,
            self_schedulable_days: selfSchedulableDays,
          });

        if (error) throw error;
      }

      toast({ title: "Dias de férias atualizados com sucesso!" });
      onOpenChange(false);
      onSaved?.();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const totalDays = parseFloat(totalDaysInput) || 0;
  const selfSchedulableDays = selfSchedulableDaysInput ? parseFloat(selfSchedulableDaysInput) : null;
  const adminReservedDays = selfSchedulableDays !== null ? totalDays - selfSchedulableDays : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gold" />
            Gerir Dias de Férias
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div>
            <p className="text-sm text-muted-foreground">Colaborador</p>
            <p className="font-medium">{employeeName}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Ano</p>
            <p className="font-medium">{currentYear}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Dias de férias totais
            </label>
            <Input
              type="number"
              min={0}
              max={365}
              step={0.5}
              value={totalDaysInput}
              onChange={(e) => setTotalDaysInput(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Dias que o colaborador pode marcar
            </label>
            <Input
              type="number"
              min={0}
              max={totalDays}
              step={0.5}
              value={selfSchedulableDaysInput}
              onChange={(e) => setSelfSchedulableDaysInput(e.target.value)}
              placeholder="Todos (sem limite)"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Deixe vazio para permitir marcar todos os dias
            </p>
          </div>

          {/* Summary */}
          <div className="p-4 bg-secondary rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Total:
              </span>
              <span className="font-medium">{formatDays(totalDays)} dias</span>
            </div>
            
            {selfSchedulableDays !== null && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" /> Colaborador pode marcar:
                  </span>
                  <span className="font-medium text-gold">{formatDays(selfSchedulableDays)} dias</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Reservado pela empresa:
                  </span>
                  <span className="font-medium">{formatDays(adminReservedDays)} dias</span>
                </div>
              </>
            )}

            {balance && (
              <div className="pt-2 border-t border-border mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dias utilizados:</span>
                  <span className="font-medium">{formatDays(balance.used_days)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dias disponíveis:</span>
                  <span className="font-medium text-gold">
                    {formatDays(totalDays - balance.used_days)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="gold"
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? "A guardar..." : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VacationDaysDialog;
