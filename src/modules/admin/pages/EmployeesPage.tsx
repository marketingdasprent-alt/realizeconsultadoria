import { useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  MoreHorizontal,
  AlertTriangle,
  Key,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Cake,
  CalendarDays,
  Upload,
  RefreshCw,
  Loader2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import EmployeeAvisoDialog from '@/components/admin/EmployeeAvisoDialog';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import ChangeEmployeePasswordDialog from '@/components/admin/ChangeEmployeePasswordDialog';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import BulkDocumentUploadDialog from '@/components/admin/BulkDocumentUploadDialog';
import ResendInviteSuccessDialog from '@/components/admin/ResendInviteSuccessDialog';
import { useEmployees } from '@/hooks/useEmployees';
import EmployeeFinancialTab from '@/modules/admin/components/employee/EmployeeFinancialTab';
import type { Employee } from '@/modules/admin/services/employeeService';
import { supabase } from '@/integrations/supabase/client';
import { getLogoBase64 } from '@/lib/logo-utils';

const EmployeesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canExecuteTopic } = useAdminPermissions();
  const { employees, isLoading, deleteEmployee, toggleStatus, resendInvite } = useEmployees();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: 'personal' | 'financial' =
    searchParams.get('tab') === 'financial' ? 'financial' : 'personal';
  const searchTerm = searchParams.get('q') || '';
  const statusFilter: 'active' | 'inactive' | 'all' =
    searchParams.get('status') === 'inactive'
      ? 'inactive'
      : searchParams.get('status') === 'all'
        ? 'all'
        : 'active';

  const setActiveTab = useCallback(
    (tab: 'personal' | 'financial') => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (tab === 'personal') next.delete('tab');
          else next.set('tab', tab);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setSearchTerm = useCallback(
    (term: string) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (term) next.set('q', term);
          else next.delete('q');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setStatusFilter = useCallback(
    (status: 'active' | 'inactive' | 'all') => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (status === 'active') next.delete('status');
          else next.set('status', status);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const [avisoDialogEmployee, setAvisoDialogEmployee] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [passwordDialogEmployee, setPasswordDialogEmployee] = useState<any>(null);
  const [bulkDocDialogOpen, setBulkDocDialogOpen] = useState(false);
  const [isResending, setIsResending] = useState<string | null>(null);
  const [resendSuccessData, setResendSuccessData] = useState<{
    name: string;
    password: string;
  } | null>(null);

  // Sorting state
  type SortField = 'name' | 'email' | 'company' | 'position' | 'status' | 'iban';
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );
  };

  // Permission checks
  const canCreate = canExecuteTopic('employees', 'create');
  const canEdit = canExecuteTopic('employees', 'edit');
  const canDelete = canExecuteTopic('employees', 'delete');
  const canNotifications = canExecuteTopic('employees', 'notifications');
  const canResetPassword = canExecuteTopic('employees', 'reset_password');

  const openDeleteDialog = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!employeeToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await deleteEmployee(employeeToDelete.id);
      if (error) throw error;
      toast({ title: 'Colaborador eliminado com sucesso!' });
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao eliminar.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResendInvite = async (employee: Employee) => {
    setIsResending(employee.id);
    const result = await resendInvite(employee.id, employee.name);

    if (result.success) {
      setResendSuccessData({
        name: employee.name,
        password: result.newPassword!,
      });

      if (result.emailSuccess) {
        toast({ title: 'Convite re-enviado com sucesso!' });
      } else {
        toast({
          title: 'Convite Enviado (SEM EMAIL)',
          description:
            'A senha foi alterada, mas o email falhou. Partilhe a senha com o utilizador.',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Erro ao re-enviar',
        description: result.error || 'Ocorreu um erro desconhecido.',
        variant: 'destructive',
      });
    }
    setIsResending(null);
  };

  const handleToggleStatus = async (employee: Employee) => {
    try {
      const { error } = await toggleStatus(employee.id, !employee.is_active);
      if (error) throw error;

      toast({
        title: 'Estado atualizado',
        description: `O colaborador ${employee.name} está agora ${!employee.is_active ? 'Ativo' : 'Desativado'}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar estado',
        description: error.message || 'Erro desconhecido.',
        variant: 'destructive',
      });
    }
  };

  const filteredEmployees = employees.filter(
    employee =>
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      // @ts-expect-error - Supabase relational data typing
      employee.companies?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (employee.iban || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // KPI stats: refletem a pesquisa mas não o filtro de status
  // (o filtro de status existe precisamente para escolher Ativos/Inativos).
  const currentMonthIdx = new Date().getMonth();
  const stats = {
    active: filteredEmployees.filter(e => e.is_active).length,
    inactive: filteredEmployees.filter(e => !e.is_active).length,
    birthdays: filteredEmployees.filter(e => {
      // @ts-expect-error - Supabase relational data typing
      if (!e.birth_date) return false;
      // @ts-expect-error - Supabase relational data typing
      return new Date(e.birth_date).getMonth() === currentMonthIdx;
    }).length,
  };

  const statusFilteredEmployees = filteredEmployees.filter(employee => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return employee.is_active;
    return !employee.is_active;
  });

  const sortedEmployees = [...statusFilteredEmployees].sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'name':
        comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        break;
      case 'email':
        comparison = a.email.toLowerCase().localeCompare(b.email.toLowerCase());
        break;
      case 'company':
        // @ts-expect-error - Supabase relational data typing
        comparison = (a.companies?.name || '')
          .toLowerCase()
          // @ts-expect-error - Supabase relational data typing
          .localeCompare((b.companies?.name || '').toLowerCase());
        break;
      case 'position':
        comparison = (a.position || '')
          .toLowerCase()
          .localeCompare((b.position || '').toLowerCase());
        break;
      case 'status':
        comparison = a.is_active === b.is_active ? 0 : a.is_active ? -1 : 1;
        break;
      case 'iban':
        comparison = (a.iban || '').toLowerCase().localeCompare((b.iban || '').toLowerCase());
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const [isPrintingReport, setIsPrintingReport] = useState(false);

  const handlePrintVacationReport = async () => {
    const activeEmployees = sortedEmployees.filter(e => e.is_active);

    if (activeEmployees.length === 0) {
      toast({
        title: 'Sem colaboradores ativos',
        description: 'Não há colaboradores ativos na lista atual para gerar o relatório.',
        variant: 'destructive',
      });
      return;
    }

    setIsPrintingReport(true);
    try {
      const currentYear = new Date().getFullYear();

      const [balancesRes, absencesRes, logoBase64] = await Promise.all([
        supabase
          .from('employee_vacation_balances')
          .select('employee_id, total_days, used_days, self_schedulable_days')
          .eq('year', currentYear),
        supabase
          .from('absences')
          .select(
            'id, employee_id, status, created_by_role, absence_periods(business_days, start_date)'
          )
          .eq('absence_type', 'vacation')
          .in('status', ['pending', 'approved']),
        getLogoBase64(),
      ]);

      if (balancesRes.error) throw balancesRes.error;
      if (absencesRes.error) throw absencesRes.error;

      const balanceByEmp = new Map(
        (balancesRes.data || []).map(b => [b.employee_id, b])
      );

      type AbsenceRow = {
        employee_id: string;
        status: string;
        created_by_role: string | null;
        absence_periods: { business_days: number; start_date: string }[] | null;
      };
      const absences = (absencesRes.data || []) as unknown as AbsenceRow[];

      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      type Aggregate = { pending: number; scheduledByEmployee: number };
      const aggByEmp = new Map<string, Aggregate>();
      absences.forEach(a => {
        const periods = a.absence_periods || [];
        const sumDays = periods
          .filter(p => p.start_date >= yearStart && p.start_date <= yearEnd)
          .reduce((s, p) => s + (Number(p.business_days) || 0), 0);
        if (sumDays === 0) return;
        const agg = aggByEmp.get(a.employee_id) || { pending: 0, scheduledByEmployee: 0 };
        if (a.status === 'pending') agg.pending += sumDays;
        if (a.created_by_role === 'employee') agg.scheduledByEmployee += sumDays;
        aggByEmp.set(a.employee_id, agg);
      });

      const formatDays = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1));
      const escapeHtml = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      // Build rows + totals
      let totTotal = 0;
      let totUsed = 0;
      let totPending = 0;
      let totAvailable = 0;
      let totRemainingSelf = 0;
      let totAdminReserved = 0;
      let rowsWithoutBalance = 0;

      const rows = activeEmployees
        .map(emp => {
          const balance = balanceByEmp.get(emp.id);
          const agg = aggByEmp.get(emp.id) || { pending: 0, scheduledByEmployee: 0 };
          // @ts-expect-error - Supabase relational data typing
          const companyName = emp.companies?.name || '-';

          if (!balance) {
            rowsWithoutBalance++;
            return `<tr>
                <td>${escapeHtml(emp.name)}</td>
                <td>${escapeHtml(companyName)}</td>
                <td colspan="6" class="muted center">Sem saldo configurado para ${currentYear}</td>
              </tr>`;
          }

          const total = Number(balance.total_days) || 0;
          const used = Number(balance.used_days) || 0;
          const available = total - used;
          const selfMax =
            balance.self_schedulable_days != null ? Number(balance.self_schedulable_days) : null;
          const remainingSelf =
            selfMax !== null ? Math.max(0, selfMax - agg.scheduledByEmployee) : null;
          // Se o colaborador marcou mais do que a sua quota própria (selfMax),
          // o excedente "come" da reserva da empresa.
          const adminReserved =
            selfMax !== null
              ? Math.max(0, total - Math.max(agg.scheduledByEmployee, selfMax))
              : 0;

          totTotal += total;
          totUsed += used;
          totPending += agg.pending;
          totAvailable += available;
          // Sem limite próprio (selfMax null) → o colaborador pode marcar todos
          // os dias disponíveis; somam à mesma à totRemainingSelf.
          totRemainingSelf += remainingSelf !== null ? remainingSelf : available;
          totAdminReserved += adminReserved;

          return `<tr>
              <td>${escapeHtml(emp.name)}</td>
              <td>${escapeHtml(companyName)}</td>
              <td class="num">${formatDays(total)}</td>
              <td class="num">${formatDays(used)}</td>
              <td class="num ${agg.pending > 0 ? 'warn' : 'muted'}">${formatDays(agg.pending)}</td>
              <td class="num strong">${formatDays(available)}</td>
              <td class="num">${
                selfMax !== null
                  ? `${formatDays(remainingSelf!)} <span class="muted">/ ${formatDays(selfMax)}</span>`
                  : '<span class="muted">—</span>'
              }</td>
              <td class="num">${
                selfMax !== null ? formatDays(adminReserved) : '<span class="muted">—</span>'
              }</td>
            </tr>`;
        })
        .join('');

      const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8" />
        <title>Relatório de Férias — ${currentYear}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 0; }
          header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #B7933D; padding-bottom: 10px; margin-bottom: 14px; }
          header img { height: 50px; }
          header .title { text-align: right; }
          header h1 { font-size: 16px; margin: 0; color: #111; }
          header .subtitle { font-size: 11px; color: #666; margin-top: 2px; }
          .legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 10px; color: #666; margin-bottom: 10px; padding: 8px 12px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 6px; }
          .legend strong { color: #111; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #e5e5e5; padding: 6px 8px; text-align: left; vertical-align: middle; }
          th { background: #f3f3f3; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
          td.num { text-align: right; font-variant-numeric: tabular-nums; }
          td.center { text-align: center; }
          td.strong { font-weight: 700; color: #B7933D; }
          td.warn { color: #d97706; font-weight: 600; }
          td.muted { color: #888; }
          tr.totals td { border-top: 2px solid #111; border-bottom: none; font-weight: 700; background: #f7f7f7; }
          footer { margin-top: 14px; font-size: 9px; color: #888; text-align: right; }
        </style></head>
        <body>
          <header>
            <img src="${logoBase64}" alt="Realize" />
            <div class="title">
              <h1>Relatório de Férias</h1>
              <div class="subtitle">Ano ${currentYear} · ${activeEmployees.length} colaboradores ativos</div>
            </div>
          </header>
          <div class="legend">
            <div><strong>Utilizados</strong> — dias já gozados (aprovados)</div>
            <div><strong>Pendentes</strong> — aguardam aprovação</div>
            <div><strong>Disponíveis</strong> — total − utilizados</div>
            <div><strong>Pode marcar</strong> — quanto resta o colaborador pode marcar</div>
            <div><strong>Empresa</strong> — dias reservados para marcação pela empresa</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Empresa</th>
                <th style="text-align:right">Total</th>
                <th style="text-align:right">Utilizados</th>
                <th style="text-align:right">Pendentes</th>
                <th style="text-align:right">Disponíveis</th>
                <th style="text-align:right">Pode Marcar</th>
                <th style="text-align:right">Empresa</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              <tr class="totals">
                <td>TOTAL</td>
                <td></td>
                <td class="num">${formatDays(totTotal)}</td>
                <td class="num">${formatDays(totUsed)}</td>
                <td class="num">${formatDays(totPending)}</td>
                <td class="num">${formatDays(totAvailable)}</td>
                <td class="num">${formatDays(totRemainingSelf)}</td>
                <td class="num">${formatDays(totAdminReserved)}</td>
              </tr>
            </tbody>
          </table>
          ${
            rowsWithoutBalance > 0
              ? `<p style="margin-top:10px;font-size:10px;color:#999">* ${rowsWithoutBalance} colaboradores sem saldo de férias configurado para ${currentYear}.</p>`
              : ''
          }
          <footer>Documento gerado em ${new Date().toLocaleDateString('pt-PT')}</footer>
          <script>
            setTimeout(function() { window.print(); window.onafterprint = function() { window.close(); }; }, 300);
          </script>
        </body></html>`;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({
          title: 'Erro ao abrir janela de impressão',
          description: 'Verifique se pop-ups estão bloqueados.',
          variant: 'destructive',
        });
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar relatório',
        description: error.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setIsPrintingReport(false);
    }
  };

  const renderRowActions = (employee: Employee) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEdit && (
          <DropdownMenuItem onClick={() => navigate(`/admin/colaboradores/${employee.id}`)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
        )}
        {canNotifications && (
          <DropdownMenuItem onClick={() => setAvisoDialogEmployee(employee)}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Avisos
          </DropdownMenuItem>
        )}
        {canResetPassword && (
          <>
            <DropdownMenuItem onClick={() => setPasswordDialogEmployee(employee)}>
              <Key className="h-4 w-4 mr-2" />
              Definir Nova Senha
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleResendInvite(employee)} disabled={!!isResending}>
              {isResending === employee.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Re-enviar Convite
            </DropdownMenuItem>
          </>
        )}
        {canDelete && (
          <DropdownMenuItem onClick={() => openDeleteDialog(employee)} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Colaboradores</h1>
            <p className="text-muted-foreground mt-1">Gerir colaboradores das empresas</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handlePrintVacationReport}
              disabled={isPrintingReport || isLoading}
            >
              {isPrintingReport ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CalendarDays className="h-4 w-4 mr-2" />
              )}
              <span className="hidden sm:inline">Relatório de Férias</span>
              <span className="sm:hidden">Férias</span>
            </Button>
            {canEdit && (
              <Button variant="outline" onClick={() => setBulkDocDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Enviar Documento</span>
                <span className="sm:hidden">Doc. Empresa</span>
              </Button>
            )}
            {canCreate && (
              <Button variant="gold" onClick={() => navigate('/admin/colaboradores/novo')}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Colaborador
              </Button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>Ativos</span>
              </div>
              <div className="text-2xl font-bold tabular-nums leading-tight">{stats.active}</div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                <UserX className="h-3.5 w-3.5 text-destructive" />
                <span>Inativos</span>
              </div>
              <div className="text-2xl font-bold tabular-nums leading-tight text-muted-foreground">
                {stats.inactive}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                <Cake className="h-3.5 w-3.5 text-gold" />
                <span>Aniversariantes do Mês</span>
              </div>
              <div className="text-2xl font-bold tabular-nums leading-tight">{stats.birthdays}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search + Status filter */}
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode="search"
                  name="search-employees"
                  placeholder={
                    activeTab === 'financial'
                      ? 'Pesquisar por nome, IBAN ou empresa...'
                      : 'Pesquisar por nome, email ou empresa...'
                  }
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={value => setStatusFilter(value as 'active' | 'inactive' | 'all')}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Pessoais / Financeiras */}
        <Tabs
          value={activeTab}
          onValueChange={value => setActiveTab(value as 'personal' | 'financial')}
        >
          <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
            <TabsTrigger value="personal">Informações Pessoais</TabsTrigger>
            <TabsTrigger value="financial">Informações Financeiras</TabsTrigger>
          </TabsList>

          {/* Informações Pessoais */}
          <TabsContent value="personal" className="mt-4">
            <Card className="shadow-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="h-8 py-1 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Nome
                          <SortIcon field="name" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="hidden md:table-cell h-8 py-1 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSort('email')}
                      >
                        <div className="flex items-center gap-1">
                          Email
                          <SortIcon field="email" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="h-8 py-1 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSort('company')}
                      >
                        <div className="flex items-center gap-1">
                          Empresa
                          <SortIcon field="company" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="hidden md:table-cell h-8 py-1 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSort('position')}
                      >
                        <div className="flex items-center gap-1">
                          Cargo
                          <SortIcon field="position" />
                        </div>
                      </TableHead>
                      <TableHead
                        className="h-8 py-1 px-2 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-1">
                          Estado
                          <SortIcon field="status" />
                        </div>
                      </TableHead>
                      <TableHead className="w-[40px] h-8 py-1 px-2"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-sm">
                          <div className="flex justify-center items-center">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : sortedEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-4 text-sm text-muted-foreground"
                        >
                          Nenhum colaborador encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedEmployees.map(employee => (
                        <TableRow
                          key={employee.id}
                          className={`h-8 ${canEdit ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                          onClick={() => canEdit && navigate(`/admin/colaboradores/${employee.id}`)}
                        >
                          <TableCell className="py-1 px-2">
                            <span className="font-medium">{employee.name}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell py-1 px-2 text-sm">
                            {employee.email}
                          </TableCell>
                          <TableCell className="py-1 px-2 text-sm">
                            {/* @ts-expect-error - Supabase relational data typing */}
                            {employee.companies?.name}
                          </TableCell>
                          <TableCell className="hidden md:table-cell py-1 px-2 text-sm">
                            {employee.position || '-'}
                          </TableCell>
                          <TableCell
                            className="py-1 px-2"
                            onClick={e => {
                              if (canEdit) {
                                e.stopPropagation();
                                handleToggleStatus(employee);
                              }
                            }}
                          >
                            <Badge
                              variant={employee.is_active ? 'default' : 'secondary'}
                              className={`text-xs py-0 ${canEdit ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                            >
                              {employee.is_active ? 'Ativo' : 'Desativado'}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-1 px-2" onClick={e => e.stopPropagation()}>
                            {renderRowActions(employee)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Informações Financeiras */}
          <TabsContent value="financial" className="mt-4">
            <EmployeeFinancialTab
              employees={sortedEmployees}
              isLoading={isLoading}
              searchTerm={searchTerm}
            />
          </TabsContent>
        </Tabs>

        {/* Employee Aviso Dialog */}
        <EmployeeAvisoDialog
          open={!!avisoDialogEmployee}
          onOpenChange={open => !open && setAvisoDialogEmployee(null)}
          employeeId={avisoDialogEmployee?.id || ''}
          employeeName={avisoDialogEmployee?.name || ''}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={open => {
            setDeleteDialogOpen(open);
            if (!open) setEmployeeToDelete(null);
          }}
          title="Eliminar Colaborador"
          description="Tem a certeza que deseja eliminar este colaborador?"
          itemName={employeeToDelete?.name}
          onConfirm={handleDelete}
          isLoading={isDeleting}
        />

        {/* Change Employee Password Dialog */}
        <ChangeEmployeePasswordDialog
          open={!!passwordDialogEmployee}
          onOpenChange={open => !open && setPasswordDialogEmployee(null)}
          employeeId={passwordDialogEmployee?.id || ''}
          employeeName={passwordDialogEmployee?.name || ''}
        />

        {/* Bulk Document Upload Dialog */}
        <BulkDocumentUploadDialog open={bulkDocDialogOpen} onOpenChange={setBulkDocDialogOpen} />

        {/* Resend Success Dialog */}
        <ResendInviteSuccessDialog
          open={!!resendSuccessData}
          onOpenChange={open => !open && setResendSuccessData(null)}
          employeeName={resendSuccessData?.name || ''}
          newPassword={resendSuccessData?.password || ''}
        />
      </div>
    </>
  );
};

export default EmployeesPage;
