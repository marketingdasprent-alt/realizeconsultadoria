// Relatório de Férias (saldo do ano por colaborador): total, gozados, pendentes, disponíveis,
// quanto o colaborador ainda pode marcar e quanto fica reservado para a empresa marcar.

export interface ReportEmployee {
  id: string;
  name: string;
  companyName: string;
}

export interface ReportBalance {
  employee_id: string;
  total_days: number | null;
  used_days: number | null;
  self_schedulable_days: number | null;
}

export interface ReportAbsence {
  employee_id: string;
  status: string;
  created_by_role: string | null;
  absence_periods: { business_days: number | null; start_date: string }[] | null;
}

export interface VacationReportInput {
  year: number;
  employees: ReportEmployee[];
  balances: ReportBalance[];
  absences: ReportAbsence[];
  logoBase64: string;
}

export interface VacationReportRow {
  employee: ReportEmployee;
  /** Sem saldo configurado para o ano. */
  missing: boolean;
  total: number;
  used: number;
  pending: number;
  available: number;
  /** Limite que o próprio colaborador pode marcar (null = sem limite). */
  selfMax: number | null;
  remainingSelf: number | null;
  adminReserved: number;
}

/** Contas do relatório, uma linha por colaborador (pela ordem recebida). */
export const vacationReportRows = ({
  year,
  employees,
  balances,
  absences,
}: Omit<VacationReportInput, 'logoBase64'>): VacationReportRow[] => {
  const balanceByEmployee = new Map(balances.map(balance => [balance.employee_id, balance]));
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const aggregates = new Map<string, { pending: number; byEmployee: number }>();
  for (const absence of absences) {
    const days = (absence.absence_periods ?? [])
      .filter(p => p.start_date >= yearStart && p.start_date <= yearEnd)
      .reduce((sum, p) => sum + (Number(p.business_days) || 0), 0);
    if (days === 0) continue;
    const agg = aggregates.get(absence.employee_id) ?? { pending: 0, byEmployee: 0 };
    if (absence.status === 'pending') agg.pending += days;
    if (absence.created_by_role === 'employee') agg.byEmployee += days;
    aggregates.set(absence.employee_id, agg);
  }

  return employees.map(employee => {
    const balance = balanceByEmployee.get(employee.id);
    const agg = aggregates.get(employee.id) ?? { pending: 0, byEmployee: 0 };
    if (!balance) {
      return {
        employee,
        missing: true,
        total: 0,
        used: 0,
        pending: agg.pending,
        available: 0,
        selfMax: null,
        remainingSelf: null,
        adminReserved: 0,
      };
    }
    const total = Number(balance.total_days) || 0;
    const used = Number(balance.used_days) || 0;
    const selfMax =
      balance.self_schedulable_days != null ? Number(balance.self_schedulable_days) : null;
    return {
      employee,
      missing: false,
      total,
      used,
      pending: agg.pending,
      available: total - used,
      selfMax,
      remainingSelf: selfMax !== null ? Math.max(0, selfMax - agg.byEmployee) : null,
      // Se o colaborador marcou mais do que a sua quota, o excedente "come" a reserva da empresa.
      adminReserved: selfMax !== null ? Math.max(0, total - Math.max(agg.byEmployee, selfMax)) : 0,
    };
  });
};

const fmt = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1));
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Documento HTML do relatório (A4 deitado), para a pré-visualização de impressão. */
export const buildVacationReportHtml = (input: VacationReportInput): string => {
  const rows = vacationReportRows(input);
  const filled = rows.filter(row => !row.missing);
  const sum = (pick: (row: VacationReportRow) => number) =>
    filled.reduce((total, row) => total + pick(row), 0);
  const muted = '<span class="muted">—</span>';

  const body = rows
    .map(row => {
      const name = `<td>${escapeHtml(row.employee.name)}</td><td>${escapeHtml(row.employee.companyName || '-')}</td>`;
      if (row.missing)
        return `<tr>${name}<td colspan="6" class="muted center">Sem saldo configurado para ${input.year}</td></tr>`;
      return `<tr>${name}
        <td class="num">${fmt(row.total)}</td>
        <td class="num">${fmt(row.used)}</td>
        <td class="num ${row.pending > 0 ? 'warn' : 'muted'}">${fmt(row.pending)}</td>
        <td class="num strong">${fmt(row.available)}</td>
        <td class="num">${row.selfMax !== null ? `${fmt(row.remainingSelf ?? 0)} <span class="muted">/ ${fmt(row.selfMax)}</span>` : muted}</td>
        <td class="num">${row.selfMax !== null ? fmt(row.adminReserved) : muted}</td>
      </tr>`;
    })
    .join('');

  const missing = rows.length - filled.length;

  return `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8" />
    <title>Relatório de Férias — ${input.year}</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 16px; background: #fff; }
      header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #B7933D; padding-bottom: 10px; margin-bottom: 14px; }
      header img { height: 50px; }
      header .title { text-align: right; }
      header h1 { font-size: 16px; margin: 0; }
      header .subtitle { font-size: 11px; color: #666; margin-top: 2px; }
      .legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: 10px; color: #666; margin-bottom: 10px; padding: 8px 12px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 6px; }
      .legend strong { color: #111; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #e5e5e5; padding: 6px 8px; text-align: left; vertical-align: middle; }
      th { background: #f3f3f3; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
      th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
      td.center { text-align: center; }
      td.strong { font-weight: 700; color: #B7933D; }
      td.warn { color: #d97706; font-weight: 600; }
      .muted { color: #888; }
      tr { page-break-inside: avoid; }
      tr.totals td { border-top: 2px solid #111; border-bottom: none; font-weight: 700; background: #f7f7f7; }
      footer { margin-top: 14px; font-size: 9px; color: #888; text-align: right; }
      @media print { body { padding: 0; } }
    </style></head>
    <body>
      <header>
        <img src="${input.logoBase64}" alt="Realize" />
        <div class="title">
          <h1>Relatório de Férias</h1>
          <div class="subtitle">Ano ${input.year} · ${rows.length} colaboradores ativos</div>
        </div>
      </header>
      <div class="legend">
        <div><strong>Utilizados</strong> — dias já gozados (aprovados)</div>
        <div><strong>Pendentes</strong> — aguardam aprovação</div>
        <div><strong>Disponíveis</strong> — total − utilizados</div>
        <div><strong>Pode marcar</strong> — quanto o colaborador ainda pode marcar</div>
        <div><strong>Empresa</strong> — dias reservados para marcação pela empresa</div>
      </div>
      <table>
        <thead><tr>
          <th>Nome</th><th>Empresa</th><th class="num">Total</th><th class="num">Utilizados</th>
          <th class="num">Pendentes</th><th class="num">Disponíveis</th><th class="num">Pode marcar</th><th class="num">Empresa</th>
        </tr></thead>
        <tbody>
          ${body}
          <tr class="totals">
            <td>TOTAL</td><td></td>
            <td class="num">${fmt(sum(row => row.total))}</td>
            <td class="num">${fmt(sum(row => row.used))}</td>
            <td class="num">${fmt(sum(row => row.pending))}</td>
            <td class="num">${fmt(sum(row => row.available))}</td>
            <td class="num">${fmt(sum(row => row.remainingSelf ?? row.available))}</td>
            <td class="num">${fmt(sum(row => row.adminReserved))}</td>
          </tr>
        </tbody>
      </table>
      ${missing > 0 ? `<p style="margin-top:10px;font-size:10px;color:#999">* ${missing} colaboradores sem saldo de férias configurado para ${input.year}.</p>` : ''}
      <footer>Documento gerado em ${new Date().toLocaleDateString('pt-PT')}</footer>
    </body></html>`;
};
