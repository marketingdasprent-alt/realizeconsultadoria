import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Check, X, Filter, Printer, RefreshCw, Search, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { getLogoBase64 } from '@/lib/logo-utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import AbsenceRequestCard from '@/components/admin/AbsenceRequestCard';
import AbsenceApprovalDialog from '@/components/admin/AbsenceApprovalDialog';
import AbsenceDocumentsDialog from '@/components/admin/AbsenceDocumentsDialog';
import AbsenceEditDialog from '@/components/admin/AbsenceEditDialog';
import AdminAddAbsenceDialog from '@/components/admin/AdminAddAbsenceDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { absenceTypeLabels, trainingModeLabels } from '@/lib/absence-types';
import {
  useAdminAbsences,
  type AbsenceRequest,
  type AbsencePeriod,
} from '@/hooks/useAdminAbsences';

const statusOptions = [
  { value: 'all', label: 'Todos os Estados' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'approved', label: 'Aprovados' },
  { value: 'rejected', label: 'Rejeitados' },
];

const AbsenceRequestsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const { requests, holidays, isLoading, refetch, unapproveRequest } =
    useAdminAbsences(statusFilter);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'approve' | 'partial' | 'reject'>('approve');
  const [selectedRequest, setSelectedRequest] = useState<AbsenceRequest | null>(null);
  const [docsDialogOpen, setDocsDialogOpen] = useState(false);
  const [selectedAbsenceId, setSelectedAbsenceId] = useState<string | null>(null);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editRequest, setEditRequest] = useState<AbsenceRequest | null>(null);
  const [unapproveDialogOpen, setUnapproveDialogOpen] = useState(false);
  const [unapproveReq, setUnapproveReq] = useState<AbsenceRequest | null>(null);
  const [isUnapproving, setIsUnapproving] = useState(false);
  const [unapproveNote, setUnapproveNote] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    if (value === 'all') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', value);
    }
    setSearchParams(searchParams);
  };

  const openDialog = (request: AbsenceRequest, mode: 'approve' | 'partial' | 'reject') => {
    setSelectedRequest(request);
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const handlePrintAbsence = async (request: AbsenceRequest) => {
    const logoBase64 = await getLogoBase64();
    // Filter only approved periods (for partially_approved) or all periods (for approved)
    const approvedPeriods = request.periods.filter(
      p => p.status === 'approved' || request.status === 'approved'
    );

    // Calculate total approved business days
    const totalApprovedDays = approvedPeriods.reduce((sum, p) => sum + Number(p.business_days), 0);

    const statusLabels: Record<string, string> = {
      approved: 'Aprovado',
      partially_approved: 'Parcialmente Aprovado',
    };

    const calculateWorkingHours = (startTime: string, endTime: string): number => {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      let totalMinutes = endMinutes - startMinutes;

      // Hora de almoço: 13:00 às 14:00
      const lunchStart = 13 * 60;
      const lunchEnd = 14 * 60;

      if (startMinutes < lunchEnd && endMinutes > lunchStart) {
        const overlapStart = Math.max(startMinutes, lunchStart);
        const overlapEnd = Math.min(endMinutes, lunchEnd);
        const lunchOverlap = Math.max(0, overlapEnd - overlapStart);
        totalMinutes -= lunchOverlap;
      }

      return totalMinutes / 60;
    };

    const formatPeriodDuration = (period: AbsencePeriod): string => {
      if (period.period_type === 'partial' && period.start_time && period.end_time) {
        const hours = calculateWorkingHours(period.start_time, period.end_time);
        return `${hours}h (${period.start_time.slice(0, 5)}-${period.end_time.slice(0, 5)})`;
      }
      const days = Number(period.business_days);
      if (days % 1 === 0) {
        return `${days} dia${days !== 1 ? 's' : ''} útil`;
      }
      return `${days.toFixed(2)} dias úteis`;
    };

    const formatTotal = (): string => {
      const allPartial = approvedPeriods.every(p => p.period_type === 'partial');
      const singleDay =
        approvedPeriods.length === 1 ||
        approvedPeriods.every(p => p.start_date === approvedPeriods[0].start_date);

      if (
        allPartial &&
        singleDay &&
        approvedPeriods[0]?.start_time &&
        approvedPeriods[0]?.end_time
      ) {
        const totalHours = approvedPeriods.reduce((sum, p) => {
          if (p.start_time && p.end_time) {
            return sum + calculateWorkingHours(p.start_time, p.end_time);
          }
          return sum;
        }, 0);
        return `${totalHours} Horas Não Trabalhadas`;
      }

      const days = totalApprovedDays % 1 === 0 ? totalApprovedDays : totalApprovedDays.toFixed(2);
      const label =
        totalApprovedDays === 1 ? 'Dia Útil Não Trabalhado' : 'Dias Úteis Não Trabalhados';
      return `${days} ${label}`;
    };

    const formatPeriodDates = (period: AbsencePeriod) => {
      if (period.start_date === period.end_date) {
        return format(new Date(period.start_date), 'dd MMM yyyy', { locale: pt });
      }
      return `${format(new Date(period.start_date), 'dd MMM', { locale: pt })} a ${format(new Date(period.end_date), 'dd MMM yyyy', { locale: pt })}`;
    };

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Comprovativo de Ausência - ${request.employee.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; }
          .container { max-width: 700px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 3px solid #d4a853; padding-bottom: 25px; margin-bottom: 30px; }
          .header h1 { font-size: 24px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px; letter-spacing: 1px; }
          .header .company { font-size: 16px; color: #666; }
          .section { margin-bottom: 25px; padding: 20px; background: #fafafa; border-radius: 8px; border: 1px solid #e5e5e5; }
          .section h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 15px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
          .field { margin-bottom: 10px; }
          .field .label { font-weight: 600; color: #555; display: inline-block; width: 100px; }
          .field .value { color: #1a1a1a; }
          .period { padding: 12px 15px; margin: 8px 0; background: #fff; border-radius: 6px; border: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; }
          .period .dates { font-weight: 500; }
          .period .days { color: #666; font-size: 14px; }
          .total { font-size: 18px; font-weight: 600; color: #1a1a1a; margin-top: 15px; padding-top: 15px; border-top: 2px solid #d4a853; }
          .footer { margin-top: 50px; padding-top: 30px; border-top: 1px dashed #ccc; }
          .signature-area { display: flex; justify-content: space-between; margin-top: 60px; }
          .signature-box { text-align: center; width: 45%; }
          .signature-line { border-top: 1px solid #333; padding-top: 10px; margin-top: 50px; font-size: 14px; color: #666; }
          .date-info { font-size: 13px; color: #888; margin-top: 20px; }
          @media print { 
            body { padding: 20px; } 
            .section { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="${logoBase64}" alt="Realize" style="height:60px;margin-bottom:8px;" />
            <h1>COMPROVATIVO DE AUSÊNCIA</h1>
            <p class="company">${request.company.name}</p>
          </div>
          
          <div class="section">
            <h3>Colaborador</h3>
            <div class="field">
              <span class="label">Nome:</span>
              <span class="value">${request.employee.name}</span>
            </div>
            <div class="field">
              <span class="label">Email:</span>
              <span class="value">${request.employee.email}</span>
            </div>
          </div>
          
          <div class="section">
            <h3>Detalhes da Ausência</h3>
            <div class="field">
              <span class="label">Tipo:</span>
              <span class="value">${absenceTypeLabels[request.absence_type] || request.absence_type}${request.absence_type === 'training' && (request as any).training_mode ? ` (${trainingModeLabels[(request as any).training_mode] || (request as any).training_mode})` : ''}</span>
            </div>
            <div class="field">
              <span class="label">Estado:</span>
              <span class="value">${statusLabels[request.status] || request.status}</span>
            </div>
            <div class="field">
              <span class="label">Aprovado Por:</span>
              <span class="value">${request.approver_name || 'N/A'}</span>
            </div>
            <div class="field">
              <span class="label">Justificativa:</span>
              <span class="value">${request.document_count && request.document_count > 0 ? 'Sim (com documentos anexados)' : 'Não apresentada'}</span>
            </div>
            
            <h3 style="margin-top: 20px;">Períodos Aprovados</h3>
            ${approvedPeriods
              .map(
                p => `
              <div class="period">
                <span class="dates">${formatPeriodDates(p)}</span>
                <span class="days">${formatPeriodDuration(p)}</span>
              </div>
            `
              )
              .join('')}
            
            <div class="total">
              Total: ${formatTotal()}
            </div>
          </div>
          
          <div class="date-info">
            <p>Data do pedido: ${format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}</p>
          </div>
          
          <div class="footer">
            <div class="signature-area">
              <div class="signature-box">
                <div class="signature-line">Colaborador</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">Responsável</div>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleUnapprove = async () => {
    if (!unapproveReq) return;
    setIsUnapproving(true);
    try {
      await unapproveRequest(unapproveReq, unapproveNote);

      toast({
        title: 'Pedido desaprovado',
        description: `O pedido de ${unapproveReq.employee.name} voltou ao estado pendente. O saldo de férias foi devolvido.`,
      });

      setUnapproveDialogOpen(false);
      setUnapproveReq(null);
      setUnapproveNote('');
    } catch (error) {
      toast({
        title: 'Erro ao desaprovar',
        description: 'Não foi possível desaprovar o pedido.',
        variant: 'destructive',
      });
    } finally {
      setIsUnapproving(false);
    }
  };

  const filteredRequests = requests.filter(request =>
    request.employee.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrintReport = async () => {
    if (filteredRequests.length === 0) {
      toast({
        title: 'Sem pedidos para imprimir',
        description: 'Não existem pedidos com os filtros actuais.',
        variant: 'destructive',
      });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Erro ao abrir janela de impressão',
        description: 'Verifique se pop-ups estão bloqueados.',
        variant: 'destructive',
      });
      return;
    }

    const logoBase64 = await getLogoBase64();
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const statusLabels: Record<string, string> = {
      pending: 'Pendente',
      approved: 'Aprovado',
      partially_approved: 'Parcialmente Aprovado',
      rejected: 'Rejeitado',
    };
    const statusClass: Record<string, string> = {
      pending: 'st-pending',
      approved: 'st-approved',
      partially_approved: 'st-partial',
      rejected: 'st-rejected',
    };

    const statusFilterLabel =
      statusOptions.find(o => o.value === statusFilter)?.label || 'Todos os Estados';

    // Group by absence_type
    const grouped = new Map<string, typeof filteredRequests>();
    filteredRequests.forEach(req => {
      const key = req.absence_type;
      const arr = grouped.get(key) || [];
      arr.push(req);
      grouped.set(key, arr);
    });

    // Sort categories by predefined order, then unknown
    const categoryOrder = [
      'vacation',
      'sick_leave',
      'appointment',
      'personal_leave',
      'maternity',
      'paternity',
      'training',
      'other',
    ];
    const sortedCategories = Array.from(grouped.keys()).sort((a, b) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const formatPeriod = (req: AbsenceRequest) => {
      const periods = req.periods || [];
      if (periods.length === 0) return '-';
      const starts = periods
        .map(p => p.start_date)
        .filter(Boolean)
        .sort();
      const ends = periods
        .map(p => p.end_date)
        .filter(Boolean)
        .sort();
      const minStart = starts[0];
      const maxEnd = ends[ends.length - 1];
      if (!minStart || !maxEnd) return '-';
      if (minStart === maxEnd) {
        return format(new Date(minStart), 'dd/MM/yyyy', { locale: pt });
      }
      const compact =
        periods.length > 1
          ? ` <span class="muted">(${periods.length} períodos)</span>`
          : '';
      return `${format(new Date(minStart), 'dd/MM/yyyy', { locale: pt })} – ${format(new Date(maxEnd), 'dd/MM/yyyy', { locale: pt })}${compact}`;
    };

    const formatDays = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(2));
    const sumDays = (reqs: typeof filteredRequests) =>
      reqs.reduce(
        (acc, r) => acc + (r.periods || []).reduce((s, p) => s + Number(p.business_days || 0), 0),
        0
      );

    let totalDaysAll = 0;
    const sections = sortedCategories
      .map(cat => {
        const items = grouped.get(cat) || [];
        const sortedItems = [...items].sort((a, b) => {
          const aStart = (a.periods || []).map(p => p.start_date).sort()[0] || '';
          const bStart = (b.periods || []).map(p => p.start_date).sort()[0] || '';
          return aStart.localeCompare(bStart);
        });
        const categoryLabel = absenceTypeLabels[cat] || cat;
        const catDays = sumDays(items);
        totalDaysAll += catDays;

        const rows = sortedItems
          .map(req => {
            const reqDays = (req.periods || []).reduce(
              (s, p) => s + Number(p.business_days || 0),
              0
            );
            return `<tr>
                <td>${escapeHtml(req.employee.name)}</td>
                <td>${escapeHtml(req.company?.name || '-')}</td>
                <td>${formatPeriod(req)}</td>
                <td class="num">${formatDays(reqDays)}</td>
                <td><span class="badge ${statusClass[req.status] || ''}">${statusLabels[req.status] || req.status}</span></td>
              </tr>`;
          })
          .join('');

        return `<section class="cat">
            <h2>${escapeHtml(categoryLabel)}
              <span class="cat-meta">${items.length} ${items.length === 1 ? 'pedido' : 'pedidos'} · ${formatDays(catDays)} dias</span>
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Empresa</th>
                  <th>Período</th>
                  <th style="text-align:right">Dias úteis</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </section>`;
      })
      .join('');

    const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8" />
      <title>Relatório de Pedidos de Ausência</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: Arial, sans-serif; font-size: 10.5px; color: #111; margin: 0; padding: 0; }
        header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #B7933D; padding-bottom: 10px; margin-bottom: 12px; }
        header img { height: 48px; }
        header .title { text-align: right; }
        header h1 { font-size: 15px; margin: 0; color: #111; }
        header .subtitle { font-size: 10px; color: #666; margin-top: 2px; }
        .filters { font-size: 10px; color: #666; margin-bottom: 12px; padding: 6px 10px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 6px; }
        .filters strong { color: #111; }
        section.cat { margin-bottom: 14px; page-break-inside: avoid; break-inside: avoid; }
        section.cat h2 { font-size: 12px; font-weight: 700; color: #B7933D; border-bottom: 1px solid #B7933D55; padding-bottom: 3px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: baseline; }
        .cat-meta { font-size: 10px; color: #666; font-weight: 500; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #eee; padding: 5px 7px; text-align: left; vertical-align: top; }
        th { background: #f3f3f3; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
        td.num { text-align: right; font-variant-numeric: tabular-nums; }
        .muted { color: #999; }
        .badge { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 9px; font-weight: 600; }
        .st-pending { background: #fef3c7; color: #92400e; }
        .st-approved { background: #d1fae5; color: #065f46; }
        .st-partial { background: #dbeafe; color: #1e40af; }
        .st-rejected { background: #fee2e2; color: #991b1b; }
        .totals { margin-top: 14px; padding: 8px 12px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 6px; display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; }
        footer { margin-top: 14px; font-size: 9px; color: #888; text-align: right; }
      </style></head>
      <body>
        <header>
          <img src="${logoBase64}" alt="Realize" />
          <div class="title">
            <h1>Relatório de Pedidos de Ausência</h1>
            <div class="subtitle">${filteredRequests.length} pedidos · ${sortedCategories.length} categorias</div>
          </div>
        </header>
        <div class="filters">
          <strong>Filtros:</strong> Estado: ${escapeHtml(statusFilterLabel)}${searchTerm ? ` · Pesquisa: "${escapeHtml(searchTerm)}"` : ''}
        </div>
        ${sections}
        <div class="totals">
          <span>TOTAL: ${filteredRequests.length} pedidos</span>
          <span>${formatDays(totalDaysAll)} dias úteis</span>
        </div>
        <footer>Documento gerado em ${format(new Date(), 'dd/MM/yyyy', { locale: pt })}</footer>
        <script>
          setTimeout(function() { window.print(); window.onafterprint = function() { window.close(); }; }, 300);
        </script>
      </body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const pendingCount = filteredRequests.filter(r => r.status === 'pending').length;
  const approvedCount = filteredRequests.filter(
    r => r.status === 'approved' || r.status === 'partially_approved'
  ).length;
  const rejectedCount = filteredRequests.filter(r => r.status === 'rejected').length;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Pedidos de Ausência</h1>
            <p className="text-muted-foreground mt-1">
              Gerir pedidos de férias e ausências dos colaboradores
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="gold" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintReport}
              disabled={isLoading || filteredRequests.length === 0}
            >
              <Printer className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Imprimir Relatório</span>
              <span className="sm:hidden">Imprimir</span>
            </Button>
            <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg p-4 border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-lg p-4 border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedCount}</p>
                <p className="text-sm text-muted-foreground">Aprovados</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-lg p-4 border shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <X className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rejectedCount}</p>
                <p className="text-sm text-muted-foreground">Rejeitados</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="search"
              name="search-absences"
              placeholder="Pesquisar por nome..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">Nenhum pedido encontrado</h3>
            <p className="text-muted-foreground">
              {searchTerm
                ? 'Nenhum pedido corresponde à pesquisa.'
                : statusFilter === 'pending'
                  ? 'Não existem pedidos pendentes de aprovação.'
                  : 'Não existem pedidos com o filtro selecionado.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredRequests.map(request => (
              <AbsenceRequestCard
                key={request.id}
                request={request}
                onApproveAll={() => openDialog(request, 'approve')}
                onApprovePartially={() => openDialog(request, 'partial')}
                onReject={() => openDialog(request, 'reject')}
                onViewDocuments={() => {
                  setSelectedAbsenceId(request.id);
                  setSelectedEmployeeName(request.employee.name);
                  setDocsDialogOpen(true);
                }}
                onEdit={() => {
                  setEditRequest(request);
                  setEditDialogOpen(true);
                }}
                onPrint={() => handlePrintAbsence(request)}
                onUnapprove={() => {
                  setUnapproveReq(request);
                  setUnapproveDialogOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <AbsenceApprovalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        request={selectedRequest}
        mode={dialogMode}
        onSuccess={refetch}
      />

      <AbsenceDocumentsDialog
        open={docsDialogOpen}
        onOpenChange={setDocsDialogOpen}
        absenceId={selectedAbsenceId}
        employeeName={selectedEmployeeName}
      />

      <AbsenceEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        request={editRequest}
        onSuccess={refetch}
      />

      <AdminAddAbsenceDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        holidays={holidays}
        onSuccess={refetch}
      />

      <Dialog
        open={unapproveDialogOpen}
        onOpenChange={open => {
          setUnapproveDialogOpen(open);
          if (!open) {
            setUnapproveNote('');
            setUnapproveReq(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Desaprovar Pedido</DialogTitle>
            <DialogDescription>
              O pedido de {unapproveReq?.employee.name} voltará ao estado "Pendente" e os dias de
              férias serão devolvidos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Nota de desaprovação (opcional)</label>
            <Textarea
              value={unapproveNote}
              onChange={e => setUnapproveNote(e.target.value)}
              placeholder="Indique o motivo da desaprovação..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnapproveDialogOpen(false)}
              disabled={isUnapproving}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleUnapprove} disabled={isUnapproving}>
              {isUnapproving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />A desaprovar...
                </>
              ) : (
                'Confirmar Desaprovação'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AbsenceRequestsPage;
