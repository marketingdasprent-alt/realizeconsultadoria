import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Plus, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import MultiPeriodSelector from "@/components/employee/MultiPeriodSelector";
import { DatePeriod, Holiday, countBusinessDays } from "@/lib/vacation-utils";
import { absenceTypeLabels, trainingModeLabels } from "@/lib/absence-types";

interface Employee {
  id: string;
  name: string;
  company_id: string;
  company_name: string;
}

interface AdminAddAbsenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holidays: Holiday[];
  onSuccess: () => void;
}

/**
 * Normalise a string: lowercase + remove diacritics.
 * "João" → "joao", "Ângela" → "angela"
 */
const normalise = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/**
 * Returns true if every word in the query is a prefix of at least one word
 * in the employee name — ignoring accents.
 *
 * Examples:
 *   "joa si"  matches "João Silva"   ✓
 *   "sil"     matches "Carlos Silva" ✓
 *   "jo ca"   matches "João Carlos"  ✓
 */
const matchesEmployee = (emp: Employee, query: string): boolean => {
  const nameWords = normalise(emp.name).split(/\s+/);
  const queryTokens = normalise(query).trim().split(/\s+/).filter(Boolean);

  return queryTokens.every((token) =>
    nameWords.some((word) => word.startsWith(token))
  );
};

const AdminAddAbsenceDialog = ({
  open,
  onOpenChange,
  holidays,
  onSuccess,
}: AdminAddAbsenceDialogProps) => {
  const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [absenceType, setAbsenceType] = useState("");
  const [trainingMode, setTrainingMode] = useState("");
  const [periods, setPeriods] = useState<DatePeriod[]>([]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load employees when dialog opens
  useEffect(() => {
    if (open) {
      loadEmployees();
    } else {
      // Reset form on close
      setSelectedEmployeeId("");
      setAbsenceType("");
      setTrainingMode("");
      setPeriods([]);
      setNotes("");
      setComboOpen(false);
    }
  }, [open]);

  const loadEmployees = async () => {
    setIsLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name, company_id, companies(name)")
        .order("name");

      if (error) throw error;

      const formatted: Employee[] = (data || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        company_id: e.company_id,
        company_name: e.companies?.name || "",
      }));

      setEmployees(formatted);
    } catch (err) {
      console.error("Error loading employees:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a lista de colaboradores.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  const handleSubmit = async () => {
    if (!selectedEmployeeId) {
      toast({
        title: "Erro",
        description: "Por favor selecione um colaborador.",
        variant: "destructive",
      });
      return;
    }
    if (!absenceType) {
      toast({
        title: "Erro",
        description: "Por favor selecione o tipo de ausência.",
        variant: "destructive",
      });
      return;
    }
    if (absenceType === "training" && !trainingMode) {
      toast({
        title: "Erro",
        description: "Por favor selecione o modo de formação.",
        variant: "destructive",
      });
      return;
    }
    if (periods.length === 0) {
      toast({
        title: "Erro",
        description: "Por favor adicione pelo menos um período.",
        variant: "destructive",
      });
      return;
    }

    const employee = employees.find((e) => e.id === selectedEmployeeId);
    if (!employee) return;

    setIsSubmitting(true);
    try {
      const allDates = periods.flatMap((p) => [p.from, p.to]);
      const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

      const { data: absenceData, error: absenceError } = await supabase
        .from("absences")
        .insert([
          {
            employee_id: employee.id,
            company_id: employee.company_id,
            start_date: format(minDate, "yyyy-MM-dd"),
            end_date: format(maxDate, "yyyy-MM-dd"),
            absence_type: absenceType,
            notes: notes || null,
            training_mode: absenceType === "training" ? trainingMode : null,
            created_by_role: "admin",
          } as any,
        ])
        .select()
        .single();

      if (absenceError) throw absenceError;

      const periodsToInsert = periods.map((period) => ({
        absence_id: absenceData.id,
        start_date: format(period.from, "yyyy-MM-dd"),
        end_date: format(period.to, "yyyy-MM-dd"),
        business_days:
          period.periodType === "partial" && period.businessDays !== undefined
            ? period.businessDays
            : countBusinessDays(period.from, period.to, holidays),
        period_type: period.periodType,
        start_time: period.startTime || null,
        end_time: period.endTime || null,
      }));

      const { error: periodsError } = await supabase
        .from("absence_periods")
        .insert(periodsToInsert);

      if (periodsError) throw periodsError;

      toast({
        title: "Pedido criado com sucesso!",
        description: `Pedido de ausência criado para ${employee.name}. Aguarda aprovação.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error creating absence:", error);
      toast({
        title: "Erro ao criar pedido",
        description:
          error.message || "Não foi possível criar o pedido de ausência.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg h-[90dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Adicionar Pedido de Ausência
          </DialogTitle>
          <DialogDescription>
            Como administrador, pode criar pedidos sem a restrição de 48 horas.
            O pedido ficará pendente de aprovação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* ── Employee Combobox ── */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Colaborador *
            </label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  disabled={isLoadingEmployees}
                  className="w-full justify-between h-11 sm:h-10 font-normal"
                >
                  {isLoadingEmployees ? (
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      A carregar colaboradores...
                    </span>
                  ) : selectedEmployee ? (
                    <span>
                      {selectedEmployee.name}
                      {selectedEmployee.company_name && (
                        <span className="text-muted-foreground ml-2 text-xs">
                          — {selectedEmployee.company_name}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Pesquisar colaborador...
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command
                  filter={(value, search) => {
                    // value = employee.id; find the employee and apply our custom filter
                    const emp = employees.find((e) => e.id === value);
                    if (!emp) return 0;
                    return matchesEmployee(emp, search) ? 1 : 0;
                  }}
                >
                  <CommandInput placeholder="Escreva o nome..." />
                  <CommandList>
                    <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                    <CommandGroup>
                      {employees.map((emp) => (
                        <CommandItem
                          key={emp.id}
                          value={emp.id}
                          onSelect={(val) => {
                            setSelectedEmployeeId(
                              val === selectedEmployeeId ? "" : val
                            );
                            setComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              selectedEmployeeId === emp.id
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="font-medium">{emp.name}</span>
                            {emp.company_name && (
                              <span className="text-muted-foreground ml-2 text-xs">
                                — {emp.company_name}
                              </span>
                            )}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* ── Absence Type ── */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Tipo de Ausência *
            </label>
            <Select
              value={absenceType}
              onValueChange={(value) => {
                setAbsenceType(value);
                if (value !== "training") setTrainingMode("");
              }}
            >
              <SelectTrigger className="h-11 sm:h-10">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(absenceTypeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Training Mode ── */}
          {absenceType === "training" && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Modo de Formação *
              </label>
              <RadioGroup
                value={trainingMode}
                onValueChange={setTrainingMode}
                className="flex gap-4"
              >
                {Object.entries(trainingModeLabels).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <RadioGroupItem value={key} id={`admin-training-${key}`} />
                    <Label
                      htmlFor={`admin-training-${key}`}
                      className="cursor-pointer"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* ── Period Selector — adminMode bypasses 48h restriction ── */}
          <MultiPeriodSelector
            periods={periods}
            onPeriodsChange={setPeriods}
            holidays={holidays}
            adminMode={true}
          />

          {/* ── Notes ── */}
          <div>
            <label className="block text-sm font-medium mb-2">Notas</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informações adicionais (opcional)"
              rows={3}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            variant="gold"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                A criar...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Criar Pedido
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminAddAbsenceDialog;
