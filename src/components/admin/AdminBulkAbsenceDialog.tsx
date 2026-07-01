import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Users, Loader2, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MultiPeriodSelector from '@/components/employee/MultiPeriodSelector';
import { DatePeriod, Holiday, countBusinessDays } from '@/lib/vacation-utils';
import { absenceTypeLabels, trainingModeLabels } from '@/lib/absence-types';

interface Employee {
  id: string;
  name: string;
  company_id: string;
  company_name: string;
}

interface AdminBulkAbsenceDialogProps {
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
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const matchesEmployee = (emp: Employee, query: string): boolean => {
  if (!query.trim()) return true;
  const haystack = normalise(`${emp.name} ${emp.company_name}`);
  const tokens = normalise(query).trim().split(/\s+/).filter(Boolean);
  return tokens.every(token => haystack.includes(token));
};

/**
 * Bulk absence marking. Lets an admin/HR mark the same period (e.g. a company
 * closure or bridge day) for many employees at once — one absence request per
 * employee. Optionally auto-approves them (which deducts the vacation balance
 * via the existing database trigger).
 */
const AdminBulkAbsenceDialog = ({
  open,
  onOpenChange,
  holidays,
  onSuccess,
}: AdminBulkAbsenceDialogProps) => {
  const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [absenceType, setAbsenceType] = useState('vacation');
  const [trainingMode, setTrainingMode] = useState('');
  const [periods, setPeriods] = useState<DatePeriod[]>([]);
  const [notes, setNotes] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      loadEmployees();
    } else {
      // Reset form on close
      setSelectedIds(new Set());
      setSearch('');
      setAbsenceType('vacation');
      setTrainingMode('');
      setPeriods([]);
      setNotes('');
      setAutoApprove(true);
    }
  }, [open]);

  const loadEmployees = async () => {
    setIsLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, company_id, companies(name)')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      const formatted: Employee[] = (data || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        company_id: e.company_id,
        company_name: e.companies?.name || 'Sem empresa',
      }));

      setEmployees(formatted);
    } catch (err) {
      console.error('Error loading employees:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a lista de colaboradores.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  // Employees matching the current search, grouped by company (sorted).
  const groupedEmployees = useMemo(() => {
    const filtered = employees.filter(e => matchesEmployee(e, search));
    const groups = new Map<string, Employee[]>();
    filtered.forEach(e => {
      const arr = groups.get(e.company_name) || [];
      arr.push(e);
      groups.set(e.company_name, arr);
    });
    return Array.from(groups.entries()).sort((a, b) =>
      a[0].toLowerCase().localeCompare(b[0].toLowerCase())
    );
  }, [employees, search]);

  const visibleIds = useMemo(
    () => employees.filter(e => matchesEmployee(e, search)).map(e => e.id),
    [employees, search]
  );

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));

  const toggleEmployee = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCompany = (companyEmployees: Employee[], selectAll: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      companyEmployees.forEach(e => {
        if (selectAll) next.add(e.id);
        else next.delete(e.id);
      });
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const companyCheckState = (companyEmployees: Employee[]): boolean | 'indeterminate' => {
    const selectedCount = companyEmployees.filter(e => selectedIds.has(e.id)).length;
    if (selectedCount === 0) return false;
    if (selectedCount === companyEmployees.length) return true;
    return 'indeterminate';
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: 'Nenhum colaborador selecionado',
        description: 'Selecione pelo menos um colaborador.',
        variant: 'destructive',
      });
      return;
    }
    if (!absenceType) {
      toast({
        title: 'Erro',
        description: 'Selecione o tipo de ausência.',
        variant: 'destructive',
      });
      return;
    }
    if (absenceType === 'training' && !trainingMode) {
      toast({
        title: 'Erro',
        description: 'Selecione o modo de formação.',
        variant: 'destructive',
      });
      return;
    }
    if (periods.length === 0) {
      toast({
        title: 'Erro',
        description: 'Adicione pelo menos um período.',
        variant: 'destructive',
      });
      return;
    }

    const chosen = employees.filter(e => selectedIds.has(e.id));

    setIsSubmitting(true);
    let insertedAbsenceIds: string[] = [];
    try {
      // When auto-approving we need the current admin as the approver.
      let approverId: string | null = null;
      if (autoApprove) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error('Não autenticado');
        approverId = session.user.id;
      }

      const allDates = periods.flatMap(p => [p.from, p.to]);
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
      const startDate = format(minDate, 'yyyy-MM-dd');
      const endDate = format(maxDate, 'yyyy-MM-dd');
      const nowIso = new Date().toISOString();

      // 1. Insert one absence per employee (batch).
      const absenceRows = chosen.map(emp => ({
        employee_id: emp.id,
        company_id: emp.company_id,
        start_date: startDate,
        end_date: endDate,
        absence_type: absenceType,
        notes: notes || null,
        training_mode: absenceType === 'training' ? trainingMode : null,
        created_by_role: 'admin',
        ...(autoApprove
          ? { status: 'approved', approved_by: approverId, approved_at: nowIso }
          : {}),
      }));

      const { data: insertedAbsences, error: absenceError } = await supabase
        .from('absences')
        .insert(absenceRows as any)
        .select('id, employee_id');

      if (absenceError) throw absenceError;
      insertedAbsenceIds = (insertedAbsences || []).map(a => a.id);

      // 2. Build periods for every inserted absence and insert them (batch).
      const periodStatus = autoApprove ? 'approved' : 'pending';
      const periodRows = (insertedAbsences || []).flatMap(absence =>
        periods.map(period => ({
          absence_id: absence.id,
          start_date: format(period.from, 'yyyy-MM-dd'),
          end_date: format(period.to, 'yyyy-MM-dd'),
          business_days:
            period.periodType === 'partial' && period.businessDays !== undefined
              ? period.businessDays
              : countBusinessDays(period.from, period.to, holidays),
          period_type: period.periodType,
          start_time: period.startTime || null,
          end_time: period.endTime || null,
          status: periodStatus,
        }))
      );

      const { error: periodsError } = await supabase
        .from('absence_periods')
        .insert(periodRows as any);

      if (periodsError) {
        // Emulated rollback: remove the absences we just created so we don't
        // leave orphan absences without periods.
        if (insertedAbsenceIds.length > 0) {
          await supabase.from('absences').delete().in('id', insertedAbsenceIds);
        }
        throw periodsError;
      }

      toast({
        title: 'Marcação em massa concluída',
        description: `${chosen.length} ${chosen.length === 1 ? 'pedido criado' : 'pedidos criados'}${
          autoApprove ? ' e aprovados automaticamente' : ' (pendentes de aprovação)'
        }.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error creating bulk absences:', error);
      toast({
        title: 'Erro na marcação em massa',
        description: error.message || 'Não foi possível criar os pedidos.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl h-[90dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Users className="h-5 w-5" />
            Marcação em Massa
          </DialogTitle>
          <DialogDescription>
            Marque o mesmo período para vários colaboradores de uma vez — por exemplo, um dia de
            fecho da empresa ou uma ponte. É criado um pedido por colaborador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* ── Absence Type ── */}
          <div>
            <label className="block text-sm font-medium mb-2">Tipo de Ausência *</label>
            <Select
              value={absenceType}
              onValueChange={value => {
                setAbsenceType(value);
                if (value !== 'training') setTrainingMode('');
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
          {absenceType === 'training' && (
            <div>
              <label className="block text-sm font-medium mb-2">Modo de Formação *</label>
              <RadioGroup
                value={trainingMode}
                onValueChange={setTrainingMode}
                className="flex gap-4"
              >
                {Object.entries(trainingModeLabels).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <RadioGroupItem value={key} id={`bulk-training-${key}`} />
                    <Label htmlFor={`bulk-training-${key}`} className="cursor-pointer">
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

          {/* ── Employee multi-select ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">
                Colaboradores *
                {selectedCount > 0 && (
                  <span className="ml-2 text-primary font-semibold">
                    {selectedCount} selecionado{selectedCount !== 1 ? 's' : ''}
                  </span>
                )}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={toggleAllVisible}
                disabled={isLoadingEmployees || visibleIds.length === 0}
              >
                {allVisibleSelected ? 'Limpar seleção' : 'Selecionar todos'}
              </Button>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                autoComplete="off"
                spellCheck={false}
                placeholder="Pesquisar por nome ou empresa..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="border rounded-md">
              {isLoadingEmployees ? (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />A carregar colaboradores...
                </div>
              ) : groupedEmployees.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum colaborador encontrado.
                </div>
              ) : (
                <ScrollArea className="h-[240px]">
                  <div className="p-1">
                    {groupedEmployees.map(([companyName, companyEmployees]) => {
                      const state = companyCheckState(companyEmployees);
                      return (
                        <div key={companyName} className="mb-1">
                          {/* Company header — selects/deselects the whole company */}
                          <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/60 rounded-sm sticky top-0">
                            <Checkbox
                              id={`company-${companyName}`}
                              checked={state}
                              onCheckedChange={checked =>
                                toggleCompany(companyEmployees, checked === true)
                              }
                            />
                            <label
                              htmlFor={`company-${companyName}`}
                              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer flex-1"
                            >
                              {companyName}
                            </label>
                            <span className="text-[11px] text-muted-foreground">
                              {companyEmployees.filter(e => selectedIds.has(e.id)).length}/
                              {companyEmployees.length}
                            </span>
                          </div>
                          {/* Employees */}
                          {companyEmployees.map(emp => (
                            <div
                              key={emp.id}
                              className="flex items-center gap-2 px-2 py-2 pl-4 rounded-sm hover:bg-accent/50 cursor-pointer"
                              onClick={() => toggleEmployee(emp.id)}
                            >
                              <Checkbox
                                checked={selectedIds.has(emp.id)}
                                onCheckedChange={() => toggleEmployee(emp.id)}
                                onClick={e => e.stopPropagation()}
                              />
                              <span className="text-sm flex-1">{emp.name}</span>
                              {selectedIds.has(emp.id) && (
                                <Check className="h-3.5 w-3.5 text-primary" />
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          {/* ── Auto-approve toggle ── */}
          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="auto-approve" className="font-medium">
                Aprovar automaticamente
              </Label>
              <p className="text-xs text-muted-foreground">
                {autoApprove
                  ? absenceType === 'vacation'
                    ? 'Os pedidos ficam aprovados e o saldo de férias é descontado.'
                    : 'Os pedidos ficam aprovados de imediato.'
                  : 'Os pedidos ficam pendentes para aprovação individual.'}
              </p>
            </div>
            <Switch id="auto-approve" checked={autoApprove} onCheckedChange={setAutoApprove} />
          </div>

          {/* ── Notes ── */}
          <div>
            <label className="block text-sm font-medium mb-2">Notas</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex.: Fecho da empresa, ponte de feriado... (opcional)"
              rows={2}
              className="min-h-[60px]"
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
            disabled={isSubmitting || selectedCount === 0}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />A criar...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                {selectedCount > 0
                  ? `Criar ${selectedCount} pedido${selectedCount !== 1 ? 's' : ''}`
                  : 'Criar pedidos'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminBulkAbsenceDialog;
