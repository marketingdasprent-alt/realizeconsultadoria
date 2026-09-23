import { useEffect, useMemo, useState } from 'react';
import { sanitizeFileName } from '@/lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar as CalendarIcon, Plus, Paperclip, Upload, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import VacationBalanceCard from '@/components/employee/VacationBalanceCard';
import MultiPeriodSelector from '@/components/employee/MultiPeriodSelector';
import EmployeeCalendar from '@/components/employee/EmployeeCalendar';
import { DatePeriod, Holiday, countBusinessDays, formatTimeRange } from '@/lib/vacation-utils';
import { findApprovedConflicts, describeConflicts } from '@/lib/absence-overlap';
import { absenceTypeLabels, trainingModeLabels } from '@/lib/absence-types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import DocumentUploader from '@/components/employee/DocumentUploader';
import AbsenceDocumentsDialog from '@/components/admin/AbsenceDocumentsDialog';
import AddDocumentsDialog from '@/components/employee/AddDocumentsDialog';
import AbsenceEditDialog from '@/components/admin/AbsenceEditDialog';

type RequestFilter = 'all' | 'pending' | 'upcoming' | 'past';

const REQUEST_FILTERS: Array<{ value: RequestFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'upcoming', label: 'Próximos' },
  { value: 'past', label: 'Passados' },
];

interface SelectedFile {
  file: File;
  preview?: string;
}

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
  rejection_reason?: string | null;
  absence_periods?: AbsencePeriod[];
  document_count?: number;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  company_id: string;
  companies: { name: string };
}

interface VacationBalance {
  total_days: number;
  used_days: number;
  self_schedulable_days: number | null;
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  partially_approved: 'Parcialmente Aprovado',
};

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  partially_approved: 'outline',
};

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [vacationBalance, setVacationBalance] = useState<VacationBalance | null>(null);
  const [employeeScheduledDays, setEmployeeScheduledDays] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [periods, setPeriods] = useState<DatePeriod[]>([]);
  const [absenceType, setAbsenceType] = useState('');
  const [trainingMode, setTrainingMode] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState<string | null>(null);
  const [docsDialogOpen, setDocsDialogOpen] = useState(false);
  const [selectedAbsenceId, setSelectedAbsenceId] = useState<string | null>(null);
  const [addDocsDialogOpen, setAddDocsDialogOpen] = useState(false);
  const [absenceIdForUpload, setAbsenceIdForUpload] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [absenceToReschedule, setAbsenceToReschedule] = useState<Absence | null>(null);
  const [filter, setFilter] = useState<RequestFilter>('all');
  const [searchParams, setSearchParams] = useSearchParams();

  const currentYear = new Date().getFullYear();

  // Atalho "Novo pedido" vindo do Início (/colaborador/pedidos?novo=1)
  useEffect(() => {
    if (searchParams.get('novo')) {
      setIsDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadEmployeeData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate('/colaborador/login');
      return;
    }

    // Get employee data
    const { data: employeeData } = await supabase
      .from('employees')
      .select('*, companies(name)')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (employeeData) {
      setEmployee(employeeData);

      // Fetch data in parallel
      const [absencesRes, holidaysRes, balanceRes, docsRes] = await Promise.all([
        supabase
          .from('absences')
          .select('*, absence_periods(*)')
          .eq('employee_id', employeeData.id)
          .order('start_date', { ascending: false }),
        supabase
          .from('holidays')
          .select('*')
          .gte('year', currentYear)
          .lte('year', currentYear + 1),
        supabase
          .from('employee_vacation_balances')
          .select('total_days, used_days, self_schedulable_days')
          .eq('employee_id', employeeData.id)
          .eq('year', currentYear)
          .maybeSingle(),
        supabase.from('absence_documents').select('absence_id'),
      ]);

      // Count documents per absence
      const docCounts: Record<string, number> = {};
      (docsRes.data || []).forEach(doc => {
        docCounts[doc.absence_id] = (docCounts[doc.absence_id] || 0) + 1;
      });

      const absencesWithDocs = (absencesRes.data || []).map(absence => ({
        ...absence,
        document_count: docCounts[absence.id] || 0,
      }));

      setAbsences(absencesWithDocs);
      setHolidays(holidaysRes.data || []);
      setVacationBalance(balanceRes.data);

      // Fetch days scheduled by employee (for self_schedulable limit)
      if (balanceRes.data?.self_schedulable_days !== null) {
        const { data: employeeAbsences } = await supabase
          .from('absences')
          .select('id')
          .eq('employee_id', employeeData.id)
          .eq('absence_type', 'vacation')
          .eq('created_by_role', 'employee')
          .in('status', ['pending', 'approved']);

        if (employeeAbsences && employeeAbsences.length > 0) {
          const absenceIds = employeeAbsences.map(a => a.id);
          const { data: periods } = await supabase
            .from('absence_periods')
            .select('business_days')
            .in('absence_id', absenceIds);

          const totalScheduled = periods?.reduce((sum, p) => sum + p.business_days, 0) || 0;
          setEmployeeScheduledDays(totalScheduled);
        }
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadEmployeeData();

    // iOS PWA: Refresh data when app becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadEmployeeData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate, currentYear]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    navigate(standalone ? '/colaborador/login' : '/');
  };

  const refreshAbsences = async () => {
    if (!employee) return;
    const { data } = await supabase
      .from('absences')
      .select('*, absence_periods(*)')
      .eq('employee_id', employee.id)
      .order('start_date', { ascending: false });
    setAbsences(data || []);
  };

  const handleCancelAbsence = async (absenceId: string) => {
    setIsCancelling(absenceId);
    try {
      // First, delete associated documents
      await supabase.from('absence_documents').delete().eq('absence_id', absenceId);

      // Then, delete associated periods
      await supabase.from('absence_periods').delete().eq('absence_id', absenceId);

      // Finally, delete the absence itself
      const { error } = await supabase.from('absences').delete().eq('id', absenceId);

      if (error) throw error;

      toast({
        title: 'Pedido cancelado',
        description: 'O seu pedido foi removido com sucesso.',
      });

      await loadEmployeeData();
    } catch (error: any) {
      console.error('Error cancelling absence:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível cancelar o pedido.',
        variant: 'destructive',
      });
    } finally {
      setIsCancelling(null);
    }
  };

  const handleSubmitAbsence = async () => {
    if (!absenceType || !employee) {
      toast({
        title: 'Erro',
        description: 'Por favor selecione o tipo de ausência.',
        variant: 'destructive',
      });
      return;
    }

    if (absenceType === 'training' && !trainingMode) {
      toast({
        title: 'Erro',
        description: 'Por favor selecione o modo de formação (Online ou Presencial).',
        variant: 'destructive',
      });
      return;
    }

    if (periods.length === 0) {
      toast({
        title: 'Erro',
        description: 'Por favor adicione pelo menos um período.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada. Por favor, inicie sessão novamente.');
      }

      // Calculate overall date range
      const allDates = periods.flatMap(p => [p.from, p.to]);
      const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

      // Validar antecedência de 48h — APENAS para Férias.
      // Outros tipos (baixa médica, consultas, licenças, etc.) são imprevisíveis
      // e podem ser marcados a qualquer momento, incluindo no próprio dia.
      if (absenceType === 'vacation') {
        const today = new Date(new Date().setHours(0, 0, 0, 0));
        const minNoticeDate = new Date(today);
        minNoticeDate.setDate(minNoticeDate.getDate() + 2);

        if (minDate < minNoticeDate) {
          toast({
            title: 'Erro de antecedência',
            description:
              'Os pedidos de férias devem ser feitos com pelo menos 48 horas de antecedência.',
            variant: 'destructive',
          });
          return;
        }
      }

      // Impedir sobreposição com um pedido ainda pendente (por aprovar/recusar):
      // não pode existir outro pedido pendente do colaborador a cobrir estas datas.
      const { data: overlappingPending, error: overlapError } = await supabase
        .from('absences')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('status', 'pending')
        .lte('start_date', format(maxDate, 'yyyy-MM-dd'))
        .gte('end_date', format(minDate, 'yyyy-MM-dd'))
        .limit(1);

      if (overlapError) throw overlapError;

      if (overlappingPending && overlappingPending.length > 0) {
        toast({
          title: 'Pedido pendente para essas datas',
          description:
            'Já tem um pedido pendente que cobre essas datas. Aguarde a aprovação ou recusa antes de submeter outro.',
          variant: 'destructive',
        });
        return;
      }

      // Impedir sobreposição com uma ausência JÁ APROVADA: o mesmo colaborador
      // não pode ter dois pedidos aprovados a ocupar o mesmo dia. Dois períodos
      // parciais no mesmo dia continuam a ser permitidos se as horas não colidirem.
      const candidatePeriods = periods.map(period => ({
        start_date: format(period.from, 'yyyy-MM-dd'),
        end_date: format(period.to, 'yyyy-MM-dd'),
        period_type: period.periodType,
        start_time: period.startTime || null,
        end_time: period.endTime || null,
      }));

      const { data: conflicts, error: conflictError } = await findApprovedConflicts(
        employee.id,
        candidatePeriods
      );

      if (conflictError) throw conflictError;

      if (conflicts && conflicts.length > 0) {
        toast({
          title: 'Já tem ausência aprovada nessas datas',
          description: describeConflicts(conflicts),
          variant: 'destructive',
        });
        return;
      }

      // Create the main absence record
      const { data: absenceData, error: absenceError } = await supabase
        .from('absences')
        .insert([
          {
            employee_id: employee.id,
            company_id: employee.company_id,
            start_date: format(minDate, 'yyyy-MM-dd'),
            end_date: format(maxDate, 'yyyy-MM-dd'),
            absence_type: absenceType,
            notes: notes || null,
            training_mode: absenceType === 'training' ? trainingMode : null,
          } as any,
        ])
        .select()
        .single();

      if (absenceError) throw absenceError;

      // Create absence periods
      const periodsToInsert = periods.map(period => ({
        absence_id: absenceData.id,
        start_date: format(period.from, 'yyyy-MM-dd'),
        end_date: format(period.to, 'yyyy-MM-dd'),
        business_days:
          period.periodType === 'partial' && period.businessDays !== undefined
            ? period.businessDays
            : countBusinessDays(period.from, period.to, holidays),
        period_type: period.periodType,
        start_time: period.startTime || null,
        end_time: period.endTime || null,
      }));

      const { error: periodsError } = await supabase
        .from('absence_periods')
        .insert(periodsToInsert);

      if (periodsError) throw periodsError;

      // Upload documents if any
      if (selectedFiles.length > 0) {
        const uploadPromises = selectedFiles.map(async item => {
          const filePath = `${session.user.id}/${absenceData.id}/${Date.now()}_${sanitizeFileName(item.file.name)}`;

          const { error: uploadError } = await supabase.storage
            .from('absence-documents')
            .upload(filePath, item.file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            return null;
          }

          const { error: docError } = await supabase.from('absence_documents').insert({
            absence_id: absenceData.id,
            file_name: item.file.name,
            file_path: filePath,
            file_size: item.file.size,
            mime_type: item.file.type,
            uploaded_by: session.user.id,
          });

          if (docError) {
            console.error('Document record error:', docError);
          }

          return !uploadError && !docError;
        });

        const results = await Promise.all(uploadPromises);
        const failedCount = results.filter(r => !r).length;

        if (failedCount > 0 && failedCount < selectedFiles.length) {
          toast({
            title: 'Aviso',
            description: `${failedCount} documento(s) não foram carregados.`,
            variant: 'default',
          });
        }
      }

      // Send notification to admins (fire and forget - don't block user)
      supabase.functions
        .invoke('send-absence-notification', {
          body: {
            employeeName: employee.name,
            employeeEmail: employee.email || '',
            companyName: employee.companies?.name || '',
            absenceType: absenceType,
            periods: periodsToInsert.map(p => ({
              startDate: p.start_date,
              endDate: p.end_date,
              businessDays: p.business_days,
            })),
            notes: notes || undefined,
          },
        })
        .catch(err => console.error('Failed to send admin notification:', err));

      // Optimistic update: add absence immediately to UI
      const newAbsence: Absence = {
        id: absenceData.id,
        start_date: format(minDate, 'yyyy-MM-dd'),
        end_date: format(maxDate, 'yyyy-MM-dd'),
        absence_type: absenceType,
        status: 'pending',
        notes: notes || null,
        absence_periods: periodsToInsert.map((p, idx) => ({
          id: `temp-${idx}`,
          start_date: p.start_date,
          end_date: p.end_date,
          business_days: p.business_days,
          status: 'pending',
          period_type: p.period_type,
          start_time: p.start_time,
          end_time: p.end_time,
        })),
        document_count: selectedFiles.length,
      };
      setAbsences(prev => [newAbsence, ...prev]);

      toast({ title: 'Pedido submetido com sucesso!' });
      setIsDialogOpen(false);
      setPeriods([]);
      setAbsenceType('');
      setTrainingMode('');
      setNotes('');
      setSelectedFiles([]);

      // Background sync with database
      loadEmployeeData();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate max days for vacation requests
  // If self_schedulable_days is set, use remaining self-schedulable quota
  // Otherwise, use total available days
  const maxVacationDays = (() => {
    if (!vacationBalance) return undefined;

    if (vacationBalance.self_schedulable_days !== null) {
      // Employee has a self-scheduling limit
      const remainingSelfSchedulable =
        vacationBalance.self_schedulable_days - employeeScheduledDays;
      return Math.max(0, remainingSelfSchedulable);
    }

    // No limit - use total available
    return vacationBalance.total_days - vacationBalance.used_days;
  })();

  // Filtro da lista: pendentes, próximos (aprovados a partir de hoje) ou passados.
  const visibleAbsences = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return absences.filter(absence => {
      if (filter === 'pending') return absence.status === 'pending';
      if (filter === 'upcoming') {
        return absence.end_date >= today && absence.status !== 'rejected';
      }
      if (filter === 'past') return absence.end_date < today;
      return true;
    });
  }, [absences, filter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto"></div>
          <p className="mt-4 text-muted-foreground">A carregar...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-card">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground mb-4">
              A sua conta ainda não está associada a uma empresa. Por favor contacte o
              administrador.
            </p>
            <Button variant="gold" onClick={handleLogout}>
              Terminar Sessão
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <main>
        {/* Uma coluna no telemóvel; calendário ao lado no computador */}
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* Main Content Column */}
          <div className="w-full space-y-6">
            {/* Vacation Balance - Full width */}
            <VacationBalanceCard employeeId={employee.id} />

            {/* Os Meus Pedidos */}
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div>
                  <h1 className="font-display text-xl lg:text-2xl font-semibold">
                    Os Meus Pedidos
                  </h1>
                  <p className="text-muted-foreground text-sm mt-1">Gerir férias e ausências</p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="gold" className="w-full sm:w-auto h-11 sm:h-10">
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Pedido
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-lg h-[90dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="font-display text-xl lg:text-2xl">
                        Novo Pedido de Ausência
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
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

                      {absenceType === 'training' && (
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
                                <RadioGroupItem value={key} id={`training-${key}`} />
                                <Label htmlFor={`training-${key}`} className="cursor-pointer">
                                  {label}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      )}

                      <MultiPeriodSelector
                        periods={periods}
                        onPeriodsChange={setPeriods}
                        holidays={holidays}
                        maxDays={absenceType === 'vacation' ? maxVacationDays : undefined}
                        existingAbsences={absences}
                        absenceType={absenceType}
                      />

                      <div>
                        <label className="block text-sm font-medium mb-2">Notas</label>
                        <Textarea
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          placeholder="Informações adicionais (opcional)"
                          rows={3}
                          className="min-h-[100px]"
                        />
                      </div>

                      <DocumentUploader
                        files={selectedFiles}
                        onFilesChange={setSelectedFiles}
                        disabled={isSubmitting}
                      />

                      <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                          disabled={isSubmitting}
                          className="w-full sm:w-auto h-11 sm:h-10"
                        >
                          Cancelar
                        </Button>
                        <Button
                          variant="gold"
                          onClick={handleSubmitAbsence}
                          disabled={isSubmitting}
                          className="w-full sm:w-auto h-11 sm:h-10"
                        >
                          {isSubmitting ? 'A submeter...' : 'Submeter Pedido'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Filtro: pendentes / próximos / passados */}
              <Tabs
                value={filter}
                onValueChange={v => setFilter(v as RequestFilter)}
                className="mb-4"
              >
                <TabsList className="grid h-11 w-full grid-cols-4">
                  {REQUEST_FILTERS.map(f => (
                    <TabsTrigger key={f.value} value={f.value} className="text-xs sm:text-sm">
                      {f.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {/* Absences List */}
              <Card className="shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-lg lg:text-xl">
                    {filter === 'all'
                      ? 'Histórico'
                      : REQUEST_FILTERS.find(f => f.value === filter)?.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {visibleAbsences.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      {absences.length === 0
                        ? 'Ainda não tem pedidos registados.'
                        : 'Sem pedidos neste filtro.'}
                    </p>
                  ) : (
                    <div className="space-y-3 lg:space-y-4">
                      {visibleAbsences.map(absence => (
                        <div
                          key={absence.id}
                          className="p-3 lg:p-4 border border-border rounded-lg"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-4 w-4 text-gold shrink-0" />
                              <span className="font-medium text-sm lg:text-base">
                                {format(new Date(absence.start_date), 'dd MMM', { locale: pt })}
                                {absence.start_date !== absence.end_date && (
                                  <>
                                    {' '}
                                    -{' '}
                                    {format(new Date(absence.end_date), 'dd MMM yyyy', {
                                      locale: pt,
                                    })}
                                  </>
                                )}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 ml-6 sm:ml-0">
                              {/* Férias futuras: as aprovadas remarcam-se, as pendentes
                                  corrigem-se enquanto ninguém decidiu sobre elas */}
                              {(absence.status === 'approved' || absence.status === 'pending') &&
                                absence.absence_type === 'vacation' &&
                                new Date(`${absence.start_date}T00:00:00`) > new Date() && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2"
                                    onClick={() => {
                                      setAbsenceToReschedule(absence);
                                      setEditDialogOpen(true);
                                    }}
                                    aria-label={`${
                                      absence.status === 'pending'
                                        ? 'Editar pedido de férias de'
                                        : 'Remarcar férias de'
                                    } ${format(new Date(`${absence.start_date}T00:00:00`), 'dd/MM/yyyy')}`}
                                  >
                                    <Pencil className="h-4 w-4 sm:mr-1" />
                                    <span>
                                      {absence.status === 'pending' ? 'Editar' : 'Remarcar'}
                                    </span>
                                  </Button>
                                )}
                              {/* Cancel button - for pending or rejected absences */}
                              {(absence.status === 'pending' || absence.status === 'rejected') && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      disabled={isCancelling === absence.id}
                                    >
                                      <Trash2 className="h-4 w-4 sm:mr-1" />
                                      <span className="hidden sm:inline">Cancelar</span>
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Cancelar Pedido?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta ação não pode ser desfeita. O pedido será removido
                                        permanentemente.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleCancelAbsence(absence.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        {isCancelling === absence.id
                                          ? 'A cancelar...'
                                          : 'Confirmar'}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {/* Upload button - always visible */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setAbsenceIdForUpload(absence.id);
                                  setAddDocsDialogOpen(true);
                                }}
                                title="Anexar documento"
                              >
                                <Upload className="h-4 w-4" />
                              </Button>
                              {/* View documents button - only if documents exist */}
                              {Number(absence.document_count ?? 0) > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                  onClick={() => {
                                    setSelectedAbsenceId(absence.id);
                                    setDocsDialogOpen(true);
                                  }}
                                >
                                  <Paperclip className="h-4 w-4 mr-1" />
                                  {absence.document_count}
                                </Button>
                              )}
                              <Badge variant={statusColors[absence.status]} className="text-xs">
                                {statusLabels[absence.status]}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2 ml-6 sm:ml-0">
                            {absenceTypeLabels[absence.absence_type]}
                            {absence.absence_type === 'training' &&
                              (absence as any).training_mode && (
                                <span className="ml-1">
                                  (
                                  {trainingModeLabels[(absence as any).training_mode] ||
                                    (absence as any).training_mode}
                                  )
                                </span>
                              )}
                          </p>

                          {/* Show rejection/unapproval note */}
                          {absence.rejection_reason && (
                            <div
                              className={`mt-2 ml-6 sm:ml-0 rounded-lg p-2.5 ${absence.status === 'rejected' ? 'bg-destructive/10' : 'bg-orange-50 dark:bg-orange-900/20'}`}
                            >
                              <p
                                className={`text-xs ${absence.status === 'rejected' ? 'text-destructive' : 'text-orange-700 dark:text-orange-400'}`}
                              >
                                <span className="font-medium">
                                  {absence.status === 'rejected' ? 'Motivo da rejeição:' : 'Nota:'}
                                </span>{' '}
                                {absence.rejection_reason}
                              </p>
                            </div>
                          )}

                          {/* Show period details for all absences */}
                          {absence.absence_periods && absence.absence_periods.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border space-y-2">
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                {absence.absence_periods.length === 1 ? 'Período:' : 'Períodos:'}
                              </p>
                              {absence.absence_periods.map(period => (
                                <div
                                  key={period.id}
                                  className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm"
                                >
                                  <span
                                    className={
                                      period.status === 'rejected'
                                        ? 'line-through text-muted-foreground'
                                        : ''
                                    }
                                  >
                                    {format(new Date(period.start_date), 'dd MMM', { locale: pt })}
                                    {period.start_date !== period.end_date && (
                                      <>
                                        {' '}
                                        -{' '}
                                        {format(new Date(period.end_date), 'dd MMM', {
                                          locale: pt,
                                        })}
                                      </>
                                    )}
                                    {period.period_type === 'partial' &&
                                    period.start_time &&
                                    period.end_time ? (
                                      <span className="text-muted-foreground ml-1">
                                        ({formatTimeRange(period.start_time, period.end_time)})
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground ml-1">
                                        (Dia completo)
                                      </span>
                                    )}{' '}
                                    <span className="text-gold font-medium">
                                      {Number(period.business_days) % 1 === 0
                                        ? `${Number(period.business_days)} ${Number(period.business_days) === 1 ? 'dia' : 'dias'}`
                                        : `${Number(period.business_days).toFixed(2)} dias`}
                                    </span>
                                  </span>
                                  {/* Show status badge only for partially_approved absences */}
                                  {absence.status === 'partially_approved' && (
                                    <Badge
                                      variant={
                                        period.status === 'approved'
                                          ? 'default'
                                          : period.status === 'rejected'
                                            ? 'destructive'
                                            : 'secondary'
                                      }
                                      className="text-xs w-fit"
                                    >
                                      {period.status === 'approved'
                                        ? 'Aprovado'
                                        : period.status === 'rejected'
                                          ? 'Rejeitado'
                                          : 'Pendente'}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Calendário: depois da lista no telemóvel, ao lado no computador */}
          <div className="w-full space-y-6">
            <EmployeeCalendar absences={absences} holidays={holidays} />
          </div>
        </div>
      </main>

      {/* Document viewer dialog */}
      <AbsenceDocumentsDialog
        open={docsDialogOpen}
        onOpenChange={setDocsDialogOpen}
        absenceId={selectedAbsenceId}
      />

      {/* Add documents dialog */}
      <AddDocumentsDialog
        open={addDocsDialogOpen}
        onOpenChange={setAddDocsDialogOpen}
        absenceId={absenceIdForUpload}
        onSuccess={loadEmployeeData}
      />

      <AbsenceEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        actor="employee"
        request={
          absenceToReschedule
            ? {
                id: absenceToReschedule.id,
                status: absenceToReschedule.status,
                absence_type: absenceToReschedule.absence_type,
                notes: absenceToReschedule.notes,
                employee: {
                  id: employee.id,
                  name: employee.name,
                  email: employee.email,
                },
                company: {
                  id: employee.company_id,
                  name: employee.companies?.name || '',
                },
                periods: absenceToReschedule.absence_periods || [],
              }
            : null
        }
        onSuccess={loadEmployeeData}
      />
    </div>
  );
};

export default EmployeeDashboard;
