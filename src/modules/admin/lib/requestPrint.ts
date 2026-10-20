// Impressões dos pedidos de ausência (Férias e Ausências → Pedidos): o comprovativo de um
// pedido aprovado e o relatório da lista filtrada (por categoria, ou só o saldo de férias).
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { absenceTypeLabels, trainingModeLabels } from '@/lib/absence-types';
import { getLogoBase64 } from '@/lib/logo-utils';
import { openPrintPreview } from '@/lib/print-preview';
import type { AbsencePeriod, AbsenceRequest } from './absenceRequests';

/** Comprovativo de ausência de um pedido aprovado (só os períodos aprovados). */
export const printAbsenceReceipt = async (request: AbsenceRequest): Promise<void> => {
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

    if (allPartial && singleDay && approvedPeriods[0]?.start_time && approvedPeriods[0]?.end_time) {
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
      <link rel="icon" href="/favicon.png" type="image/png" />
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
            <span class="value">${absenceTypeLabels[request.absence_type] || request.absence_type}${request.absence_type === 'training' && request.training_mode ? ` (${trainingModeLabels[request.training_mode] || request.training_mode})` : ''}</span>
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

  openPrintPreview(printContent, 'Comprovativo de ausência');
};

export interface RequestsReportOptions {
  mode: 'full' | 'saldo';
  /** Estado filtrado, para o cabeçalho (ex.: "Pendentes"). */
  statusLabel: string;
  searchTerm: string;
}

/**
 * Relatório da lista filtrada. Devolve a razão quando não há nada para imprimir (para o aviso),
 * ou null quando abriu a pré-visualização.
 */
export const printRequestsReport = async (
  filteredRequests: AbsenceRequest[],
  { mode, statusLabel, searchTerm }: RequestsReportOptions
): Promise<string | null> => {
  if (filteredRequests.length === 0) return 'Não existem pedidos com os filtros atuais.';

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

  const statusFilterLabel = statusLabel;

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
  const sortCategories = (cats: string[]) =>
    cats.sort((a, b) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

  const formatDays = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(2));

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
      periods.length > 1 ? ` <span class="muted">(${periods.length} períodos)</span>` : '';
    return `${format(new Date(minStart), 'dd/MM/yyyy', { locale: pt })} – ${format(new Date(maxEnd), 'dd/MM/yyyy', { locale: pt })}${compact}`;
  };

  // Dias pedidos (todos os períodos)
  const requestedDays = (req: AbsenceRequest) =>
    (req.periods || []).reduce((s, p) => s + Number(p.business_days || 0), 0);

  // Dias efectivamente aprovados (somam ao total)
  const approvedDays = (req: AbsenceRequest) => {
    if (req.status === 'rejected' || req.status === 'pending') return 0;
    if (req.status === 'approved') return requestedDays(req);
    // partially_approved → só períodos aprovados
    return (req.periods || [])
      .filter(p => p.status === 'approved')
      .reduce((s, p) => s + Number(p.business_days || 0), 0);
  };

  // Separar rejeitados do resto
  const mainRequests = filteredRequests.filter(r => r.status !== 'rejected');
  const rejectedRequests = filteredRequests.filter(r => r.status === 'rejected');

  // Conjunto de colaboradores que excederam a sua quota própria de férias
  // (preenchido durante o fetch do saldo, usado para destacar a linha da
  // tabela de Saldo de Férias).
  const exceededEmployeeIds = new Set<string>();
  // Conjunto de IDs de absences cujo *cumulativo cronológico* excedeu a
  // quota própria do colaborador. Apenas estes pedidos individuais ficam
  // destacados (em vez de todos do colaborador).
  const exceededAbsenceIds = new Set<string>();
  // Absences que estão na fronteira: parte dos seus dias ainda cabe na
  // quota do colaborador, parte excede (consumida pela empresa).
  const partialAbsenceIds = new Set<string>();

  // Agrupar por categoria
  const groupByCategory = (reqs: typeof filteredRequests) => {
    const m = new Map<string, typeof filteredRequests>();
    reqs.forEach(req => {
      const arr = m.get(req.absence_type) || [];
      arr.push(req);
      m.set(req.absence_type, arr);
    });
    return m;
  };

  const buildSection = (
    categoryKey: string,
    items: AbsenceRequest[],
    opts: { dayMode: 'approved' | 'requested'; showSubtotal: boolean }
  ) => {
    // Ordenar por nome do colaborador (acentos ignorados), depois por data
    const sortedItems = [...items].sort((a, b) => {
      const aName = a.employee.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const bName = b.employee.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const nameCompare = aName.localeCompare(bName);
      if (nameCompare !== 0) return nameCompare;
      const aStart = (a.periods || []).map(p => p.start_date).sort()[0] || '';
      const bStart = (b.periods || []).map(p => p.start_date).sort()[0] || '';
      return aStart.localeCompare(bStart);
    });
    const categoryLabel = absenceTypeLabels[categoryKey] || categoryKey;
    const subtotal =
      opts.dayMode === 'approved'
        ? items.reduce((s, r) => s + approvedDays(r), 0)
        : items.reduce((s, r) => s + requestedDays(r), 0);

    let prevEmpId: string | null = null;
    const rows = sortedItems
      .map(req => {
        const isNewEmpGroup = prevEmpId !== null && prevEmpId !== req.employee.id;
        prevEmpId = req.employee.id;
        const isExceeded = categoryKey === 'vacation' && exceededAbsenceIds.has(req.id);
        const isPartial = categoryKey === 'vacation' && partialAbsenceIds.has(req.id);
        const classes = [
          isNewEmpGroup ? 'row-emp-divider' : '',
          isExceeded ? 'exceeded' : '',
          isPartial ? 'partial' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const days = opts.dayMode === 'approved' ? approvedDays(req) : requestedDays(req);
        const dayText =
          opts.dayMode === 'approved' && (req.status === 'pending' || days === 0)
            ? `<span class="muted">${formatDays(requestedDays(req))} pedidos</span>`
            : formatDays(days);
        return `<tr${classes ? ` class="${classes}"` : ''}>
            <td>${escapeHtml(req.employee.name)}</td>
            <td>${escapeHtml(req.company?.name || '-')}</td>
            <td>${formatPeriod(req)}</td>
            <td class="num">${dayText}</td>
            <td><span class="badge ${statusClass[req.status] || ''}">${statusLabels[req.status] || req.status}</span></td>
          </tr>`;
      })
      .join('');

    const subtotalHtml = opts.showSubtotal
      ? `<span class="cat-meta">${items.length} ${items.length === 1 ? 'pedido' : 'pedidos'} · ${formatDays(subtotal)} dias aprovados</span>`
      : `<span class="cat-meta">${items.length} ${items.length === 1 ? 'pedido' : 'pedidos'}</span>`;

    return `<section class="cat">
        <h2>${escapeHtml(categoryLabel)}${subtotalHtml}</h2>
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
  };

  const mainGrouped = groupByCategory(mainRequests);
  const mainCategories = sortCategories(Array.from(mainGrouped.keys()));

  // Saldo de férias por colaborador (só para a categoria 'vacation')
  let vacationQuotaHtml = '';
  const vacationRequests = mainRequests.filter(r => r.absence_type === 'vacation');
  const vacationEmpIds = Array.from(new Set(vacationRequests.map(r => r.employee.id)));
  const currentYear = new Date().getFullYear();

  if (mode === 'saldo' && vacationEmpIds.length === 0)
    return 'O Saldo de Férias só sai quando há pedidos de Férias na lista filtrada.';

  if (vacationEmpIds.length > 0) {
    const [balancesRes, empAbsencesRes] = await Promise.all([
      supabase
        .from('employee_vacation_balances')
        .select('employee_id, total_days, used_days, self_schedulable_days')
        .eq('year', currentYear)
        .in('employee_id', vacationEmpIds),
      supabase
        .from('absences')
        .select('id, employee_id, status, absence_periods(business_days, start_date)')
        .eq('absence_type', 'vacation')
        .eq('created_by_role', 'employee')
        .in('status', ['pending', 'approved'])
        .in('employee_id', vacationEmpIds),
    ]);

    const balanceMap = new Map((balancesRes.data || []).map(b => [b.employee_id, b]));

    const yearStart = `${currentYear}-01-01`;
    const yearEnd = `${currentYear}-12-31`;
    const today = new Date().toISOString().slice(0, 10);
    const scheduledMap = new Map<string, number>();
    // Para cálculo do excedente por prioridade (aprovadas passadas →
    // aprovadas futuras → pendentes)
    const absencesByEmployee = new Map<
      string,
      Array<{ id: string; days: number; firstDate: string; status: string }>
    >();
    (
      (empAbsencesRes.data || []) as Array<{
        id: string;
        employee_id: string;
        status: string;
        absence_periods: { business_days: number; start_date: string }[] | null;
      }>
    ).forEach(a => {
      const yearPeriods = (a.absence_periods || []).filter(
        p => p.start_date >= yearStart && p.start_date <= yearEnd
      );
      if (yearPeriods.length === 0) return;
      const sum = yearPeriods.reduce((s, p) => s + Number(p.business_days || 0), 0);
      scheduledMap.set(a.employee_id, (scheduledMap.get(a.employee_id) || 0) + sum);

      const firstDate = yearPeriods.map(p => p.start_date).sort()[0];
      const arr = absencesByEmployee.get(a.employee_id) || [];
      arr.push({ id: a.id, days: sum, firstDate, status: a.status });
      absencesByEmployee.set(a.employee_id, arr);
    });

    // Identificar absences que excederam o selfMax aplicando prioridade:
    // 1) Aprovadas passadas (já gozadas)
    // 2) Aprovadas futuras (compromisso firmado)
    // 3) Pendentes (ainda não confirmadas)
    // Dentro de cada grupo, ordem cronológica.
    // Só são marcadas como excedidas as absences cujo cumulativo ANTES de as
    // somar já passa o selfMax (i.e., totalmente fora da quota do
    // colaborador). Absences "fronteira" — parte dentro da quota, parte fora —
    // não são marcadas (a saldo geral já indica o excesso).
    absencesByEmployee.forEach((list, empId) => {
      const bal = balanceMap.get(empId);
      if (!bal) return;
      const selfMax = bal.self_schedulable_days != null ? Number(bal.self_schedulable_days) : null;
      if (selfMax === null) return;
      const byDate = (a: { firstDate: string }, b: { firstDate: string }) =>
        a.firstDate.localeCompare(b.firstDate);
      const approvedPast = list
        .filter(a => a.status === 'approved' && a.firstDate < today)
        .sort(byDate);
      const approvedFuture = list
        .filter(a => a.status === 'approved' && a.firstDate >= today)
        .sort(byDate);
      const pending = list.filter(a => a.status === 'pending').sort(byDate);
      const ordered = [...approvedPast, ...approvedFuture, ...pending];
      let cumul = 0;
      for (const abs of ordered) {
        if (cumul >= selfMax) {
          exceededAbsenceIds.add(abs.id);
        } else if (cumul + abs.days > selfMax) {
          // Linha fronteira: começa dentro da quota mas ultrapassa-a
          partialAbsenceIds.add(abs.id);
        }
        cumul += abs.days;
      }
    });

    // Pendentes (deste relatório, da categoria férias)
    const pendingMap = new Map<string, number>();
    vacationRequests
      .filter(r => r.status === 'pending')
      .forEach(req => {
        const sum = requestedDays(req);
        pendingMap.set(req.employee.id, (pendingMap.get(req.employee.id) || 0) + sum);
      });

    const employeesById = new Map<string, AbsenceRequest['employee']>();
    vacationRequests.forEach(r => employeesById.set(r.employee.id, r.employee));
    const employeesArr = Array.from(employeesById.values()).sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    const quotaRows = employeesArr
      .map(emp => {
        const balance = balanceMap.get(emp.id);
        const scheduled = scheduledMap.get(emp.id) || 0;
        const pending = pendingMap.get(emp.id) || 0;

        if (!balance) {
          return `<tr>
              <td>${escapeHtml(emp.name)}</td>
              <td colspan="6" class="muted">Sem saldo configurado para ${currentYear}</td>
            </tr>`;
        }

        const total = Number(balance.total_days) || 0;
        const used = Number(balance.used_days) || 0;
        const available = total - used;
        const selfMax =
          balance.self_schedulable_days != null ? Number(balance.self_schedulable_days) : null;
        const remainingSelf = selfMax !== null ? Math.max(0, selfMax - scheduled) : available;
        const adminReserved =
          selfMax !== null ? Math.max(0, total - Math.max(scheduled, selfMax)) : 0;
        const adminReservedTheoretical = selfMax !== null ? total - selfMax : 0;

        // Marcar excedido: colaborador marcou mais do que a sua quota propria
        const isExceeded = selfMax !== null && scheduled > selfMax;
        if (isExceeded) exceededEmployeeIds.add(emp.id);

        return `<tr${isExceeded ? ' class="exceeded"' : ''}>
            <td>${escapeHtml(emp.name)}</td>
            <td class="num">${formatDays(total)}</td>
            <td class="num">${formatDays(used)}</td>
            <td class="num ${pending > 0 ? 'warn' : 'muted'}">${formatDays(pending)}</td>
            <td class="num">${
              selfMax !== null
                ? `${formatDays(remainingSelf)} <span class="muted">/ ${formatDays(selfMax)}</span>`
                : `${formatDays(available)} <span class="muted">(todos)</span>`
            }</td>
            <td class="num">${
              selfMax !== null
                ? `${formatDays(adminReserved)} <span class="muted">/ ${formatDays(adminReservedTheoretical)}</span>`
                : '<span class="muted">—</span>'
            }</td>
            <td class="num strong">${formatDays(available)}</td>
          </tr>`;
      })
      .join('');

    vacationQuotaHtml = `<section class="quota-summary">
        <h3>Saldo de Férias por Colaborador <small>(ano ${currentYear})</small></h3>
        <table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th style="text-align:right">Total</th>
              <th style="text-align:right">Usados</th>
              <th style="text-align:right">Pendentes</th>
              <th style="text-align:right">Pode Marcar</th>
              <th style="text-align:right">Empresa</th>
              <th style="text-align:right">Disponíveis</th>
            </tr>
          </thead>
          <tbody>${quotaRows}</tbody>
        </table>
        <div class="quota-note">
          Colaborador que excedeu a sua quota própria: o excedente desconta da
          reserva da empresa.
        </div>
      </section>`;
  }

  const mainSections = mainCategories
    .map(cat => {
      const section = buildSection(cat, mainGrouped.get(cat) || [], {
        dayMode: 'approved',
        showSubtotal: true,
      });
      if (cat === 'vacation' && vacationQuotaHtml) {
        return section + vacationQuotaHtml;
      }
      return section;
    })
    .join('');

  const rejectedGrouped = groupByCategory(rejectedRequests);
  const rejectedCategories = sortCategories(Array.from(rejectedGrouped.keys()));
  const rejectedSections = rejectedCategories
    .map(cat =>
      buildSection(cat, rejectedGrouped.get(cat) || [], {
        dayMode: 'requested',
        showSubtotal: false,
      })
    )
    .join('');

  const totalApprovedDays = mainRequests.reduce((s, r) => s + approvedDays(r), 0);
  const totalApprovedRequests = mainRequests.filter(
    r => r.status === 'approved' || r.status === 'partially_approved'
  ).length;

  const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8" />
    <title>Relatório de Pedidos de Ausência</title>
    <link rel="icon" href="/favicon.png" type="image/png" />
    <style>
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 11px;
        color: #111;
        margin: 0;
        padding: 0;
        background: #e8e8ed;
      }
      .toolbar {
        position: sticky;
        top: 0;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        padding: 12px 20px;
        border-bottom: 1px solid #d4d4d8;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        z-index: 100;
        font-size: 13px;
      }
      .toolbar button {
        padding: 8px 18px;
        border: 1px solid transparent;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        font-size: 13px;
        font-family: inherit;
        transition: background 0.15s, border-color 0.15s;
      }
      .toolbar button.primary {
        background: #B7933D;
        color: white;
      }
      .toolbar button.primary:hover { background: #a07f2f; }
      .toolbar button.secondary {
        background: white;
        color: #444;
        border-color: #d4d4d8;
      }
      .toolbar button.secondary:hover { background: #f5f5f5; }
      .toolbar label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        color: #444;
        user-select: none;
      }
      .toolbar input[type="checkbox"] {
        width: 16px;
        height: 16px;
        cursor: pointer;
        accent-color: #B7933D;
      }
      .page-wrap {
        padding: 24px 0;
      }
      .page {
        width: 210mm;
        min-height: 297mm;
        background: white;
        margin: 0 auto;
        padding: 14mm;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      }
      header.doc {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 2px solid #B7933D;
        padding-bottom: 12px;
        margin-bottom: 16px;
      }
      header.doc img { height: 52px; }
      header.doc .title { text-align: right; }
      header.doc h1 {
        font-size: 17px;
        margin: 0;
        color: #111;
        font-weight: 700;
        letter-spacing: -0.01em;
      }
      header.doc .subtitle {
        font-size: 11px;
        color: #666;
        margin-top: 4px;
      }
      .filters {
        font-size: 10.5px;
        color: #555;
        margin-bottom: 16px;
        padding: 8px 12px;
        background: #fafafa;
        border: 1px solid #e5e5e5;
        border-radius: 8px;
      }
      .filters strong { color: #111; }
      section.cat {
        margin-bottom: 18px;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      section.cat h2 {
        font-size: 13px;
        font-weight: 700;
        color: #B7933D;
        border-bottom: 1px solid #B7933D55;
        padding-bottom: 5px;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      .cat-meta {
        font-size: 10.5px;
        color: #666;
        font-weight: 500;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border-bottom: 1px solid #eee;
        padding: 6px 8px;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #f8f8f8;
        font-size: 9.5px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #555;
        font-weight: 600;
      }
      td.num {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .muted { color: #999; }
      .badge {
        display: inline-block;
        padding: 2px 9px;
        border-radius: 12px;
        font-size: 9.5px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .st-pending { background: #fef3c7; color: #92400e; }
      .st-approved { background: #d1fae5; color: #065f46; }
      .st-partial { background: #dbeafe; color: #1e40af; }
      .st-rejected { background: #fee2e2; color: #991b1b; }
      /* Divider entre grupos de colaboradores na mesma categoria */
      tr.row-emp-divider td { border-top: 2px solid #d4d4d8; }
      /* Linhas de colaboradores que excederam a quota propria de ferias */
      tr.exceeded td { background: #fef2f2; }
      tr.exceeded.row-emp-divider td { border-top-color: #fca5a5; }
      /* Linhas fronteira: parte dentro da quota, parte fora (laranja claro) */
      tr.partial td { background: #fff7ed; }
      tr.partial.row-emp-divider td { border-top-color: #fdba74; }
      .totals {
        margin-top: 18px;
        padding: 12px 16px;
        background: #B7933D10;
        border: 1px solid #B7933D44;
        border-radius: 8px;
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        font-weight: 700;
        color: #5a4a1f;
      }
      .quota-summary {
        margin-top: 4px;
        margin-bottom: 18px;
        padding: 10px 12px;
        background: #fafaf5;
        border: 1px solid #B7933D33;
        border-radius: 8px;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .quota-summary h3 {
        font-size: 11px;
        font-weight: 700;
        color: #B7933D;
        margin: 0 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .quota-summary h3 small {
        color: #999;
        font-weight: 400;
        text-transform: none;
        font-size: 10px;
      }
      .quota-summary table { font-size: 10px; }
      .quota-summary th { background: transparent; }
      .quota-summary .strong { font-weight: 700; color: #B7933D; }
      .quota-summary .warn { color: #d97706; font-weight: 600; }
      .quota-note {
        margin-top: 6px;
        font-size: 9px;
        color: #888;
        font-style: italic;
      }
      .rejected-divider {
        margin: 28px 0 16px;
        padding: 10px 14px;
        background: #fee2e2;
        border-left: 4px solid #ef4444;
        border-radius: 0 6px 6px 0;
        color: #991b1b;
        font-weight: 600;
        font-size: 12px;
      }
      .rejected-divider small {
        display: block;
        font-weight: 400;
        font-size: 10.5px;
        margin-top: 2px;
        color: #b85a5a;
      }
      footer.doc {
        margin-top: 20px;
        font-size: 9.5px;
        color: #999;
        text-align: right;
      }
      body.exclude-rejected .rejected-section { display: none; }
      @media print {
        body { background: white; }
        .toolbar { display: none !important; }
        .page-wrap { padding: 0; }
        .page {
          width: auto;
          min-height: auto;
          margin: 0;
          padding: 0;
          box-shadow: none;
        }
        @page { size: A4 portrait; margin: 12mm; }
      }
    </style></head>
    <body class="${mode === 'full' && rejectedRequests.length > 0 ? 'exclude-rejected' : ''}">
      <div class="toolbar">
        <button class="primary" onclick="window.print()">🖨 Imprimir</button>
        ${
          mode === 'full' && rejectedRequests.length > 0
            ? `<label>
                <input type="checkbox" onchange="document.body.classList.toggle('exclude-rejected', !this.checked)" />
                Incluir rejeitados (${rejectedRequests.length})
              </label>`
            : ''
        }
        <button class="secondary" onclick="window.close()">Fechar</button>
      </div>
      <div class="page-wrap">
        <div class="page">
          <header class="doc">
            <img src="${logoBase64}" alt="Realize" />
            <div class="title">
              <h1>${mode === 'saldo' ? 'Saldo de Férias por Colaborador' : 'Relatório de Pedidos de Ausência'}</h1>
              <div class="subtitle">${
                mode === 'saldo'
                  ? `${vacationEmpIds.length} ${vacationEmpIds.length === 1 ? 'colaborador' : 'colaboradores'} · ano ${currentYear}`
                  : `${mainRequests.length} pedidos · ${mainCategories.length} categorias`
              }</div>
            </div>
          </header>
          <div class="filters">
            <strong>Filtros:</strong> Estado: ${escapeHtml(statusFilterLabel)}${searchTerm ? ` · Pesquisa: "${escapeHtml(searchTerm)}"` : ''}
          </div>
          ${mode === 'saldo' ? vacationQuotaHtml : mainSections}
          ${
            mode === 'full'
              ? `<div class="totals">
                  <span>TOTAL APROVADO: ${totalApprovedRequests} ${totalApprovedRequests === 1 ? 'pedido' : 'pedidos'}</span>
                  <span>${formatDays(totalApprovedDays)} dias úteis</span>
                </div>
                ${
                  rejectedRequests.length > 0
                    ? `<div class="rejected-section">
                        <div class="rejected-divider">
                          Pedidos Rejeitados
                          <small>Não contam para o total · ${rejectedRequests.length} ${rejectedRequests.length === 1 ? 'pedido' : 'pedidos'}</small>
                        </div>
                        ${rejectedSections}
                      </div>`
                    : ''
                }`
              : ''
          }
          <footer class="doc">Documento gerado em ${format(new Date(), 'dd/MM/yyyy', { locale: pt })}</footer>
        </div>
      </div>
    </body></html>`;

  openPrintPreview(html, mode === 'saldo' ? 'Saldo de férias' : 'Relatório de pedidos de ausência');
  return null;
};
