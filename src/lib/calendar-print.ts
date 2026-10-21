import { format, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { absenceTypeColors, defaultAbsenceTypeColor } from './absence-types';
import { countBusinessDays, isHoliday, isWeekend, type Holiday } from './vacation-utils';

interface PrintPeriod {
  start_date: string;
  end_date: string;
  status?: string | null;
  period_type?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  business_days?: number | null;
}

export interface PrintAbsence {
  id: string;
  employee_id?: string | null;
  start_date: string;
  end_date: string;
  absence_type: string;
  status: string;
  employees?: { name?: string | null; companies?: { name?: string | null } | null } | null;
  absence_periods?: PrintPeriod[] | null;
}

export interface CalendarPrintOptions {
  absences: PrintAbsence[];
  holidays: Holiday[];
  /** Months to render, one sheet each (month is 0-based). Order is normalised. */
  months: { year: number; month: number }[];
  companyLabel: string;
  logoBase64: string;
  orientation: 'portrait' | 'landscape';
}

interface Segment {
  start: Date;
  end: Date;
  partial: boolean;
  businessDays: number | null;
  startTime: string | null;
  endTime: string | null;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Approved date segments of an absence. When the absence has periods, only the
 * approved periods count (handles partially_approved). Otherwise falls back to
 * the main dates when the absence itself is approved.
 */
const approvedSegments = (a: PrintAbsence): Segment[] => {
  const periods = a.absence_periods || [];
  if (periods.length > 0) {
    return periods
      .filter(p => (p.status || a.status) === 'approved')
      .map(p => ({
        start: parseISO(p.start_date),
        end: parseISO(p.end_date),
        partial: p.period_type === 'partial',
        businessDays: p.business_days != null ? Number(p.business_days) : null,
        startTime: p.start_time ?? null,
        endTime: p.end_time ?? null,
      }));
  }
  if (a.status === 'approved') {
    return [
      {
        start: parseISO(a.start_date),
        end: parseISO(a.end_date),
        partial: false,
        businessDays: null,
        startTime: null,
        endTime: null,
      },
    ];
  }
  return [];
};

/** "10" ou "0,5". */
const fmtDays = (n: number): string =>
  n % 1 === 0 ? String(n) : n.toFixed(2).replace(/0$/, '').replace('.', ',');

/** "01/10 – 09/10", "15/10" ou "15/10 (09:00–13:00)". */
const segmentLabel = (seg: Segment): string => {
  const from = format(seg.start, 'dd/MM');
  if (seg.partial) {
    const hours =
      seg.startTime && seg.endTime
        ? `${seg.startTime.slice(0, 5)}–${seg.endTime.slice(0, 5)}`
        : '½ dia';
    return `${from} (${hours})`;
  }
  const to = format(seg.end, 'dd/MM');
  return from === to ? from : `${from} – ${to}`;
};

type Cell = { kind: 'full' | 'half'; type: string } | null;

export interface MapRow {
  name: string;
  company: string;
  /** Um registo por dia do mês (só dias úteis podem estar ocupados). */
  cells: Cell[];
  /** Dias úteis aprovados dentro do mês. */
  total: number;
  periods: string[];
}

/**
 * Linhas do mapa de um mês: uma por colaborador com férias aprovadas nesse mês, com os dias
 * ocupados, os períodos e o total de dias úteis.
 */
export const buildMapRows = (
  year: number,
  month: number,
  absences: PrintAbsence[],
  holidays: Holiday[]
): { days: Date[]; rows: MapRow[] } => {
  const monthStart = new Date(year, month, 1);
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const off = days.map(day => isWeekend(day) || !!isHoliday(day, holidays));
  const rows = new Map<string, MapRow>();

  for (const absence of absences) {
    const segments = approvedSegments(absence).filter(
      seg => seg.start <= monthEnd && seg.end >= monthStart
    );
    if (segments.length === 0) continue;

    const key = absence.employee_id || absence.employees?.name || absence.id;
    let row = rows.get(key);
    if (!row) {
      row = {
        name: absence.employees?.name || '—',
        company: absence.employees?.companies?.name || '',
        cells: days.map(() => null),
        total: 0,
        periods: [],
      };
      rows.set(key, row);
    }

    for (const seg of segments) {
      days.forEach((day, index) => {
        if (off[index] || day < seg.start || day > seg.end || row.cells[index]?.kind === 'full')
          return;
        row.cells[index] = { kind: seg.partial ? 'half' : 'full', type: absence.absence_type };
      });
      if (seg.partial) {
        const workday = !isWeekend(seg.start) && !isHoliday(seg.start, holidays);
        if (workday && seg.start >= monthStart) row.total += seg.businessDays ?? 0.5;
      } else {
        const from = seg.start < monthStart ? monthStart : seg.start;
        const to = seg.end > monthEnd ? monthEnd : seg.end;
        row.total += countBusinessDays(from, to, holidays);
      }
      row.periods.push(segmentLabel(seg));
    }
  }

  return {
    days,
    rows: [...rows.values()]
      .filter(row => row.cells.some(Boolean))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt')),
  };
};

const buildMonthSheet = (year: number, month: number, opts: CalendarPrintOptions): string => {
  const { days, rows } = buildMapRows(year, month, opts.absences, opts.holidays);
  const holidays = days.map(day => isHoliday(day, opts.holidays));
  const dayClass = (index: number) =>
    holidays[index] ? 'hol' : isWeekend(days[index]) ? 'we' : '';
  const manyCompanies = new Set(rows.map(row => row.company)).size > 1;

  const head = days
    .map(
      (day, index) =>
        `<th class="d ${dayClass(index)}"><span class="wd">${format(day, 'EEE', { locale: pt }).replace('.', '')}</span><span class="dn">${format(day, 'd')}</span></th>`
    )
    .join('');

  const body = rows
    .map(row => {
      const cells = row.cells
        .map((cell, index) => {
          if (!cell) return `<td class="c ${dayClass(index)}"></td>`;
          const color = absenceTypeColors[cell.type] || defaultAbsenceTypeColor;
          const prev = row.cells[index - 1];
          const next = row.cells[index + 1];
          const classes = [
            'bar',
            cell.kind === 'half' ? 'h' : '',
            !prev ? 's' : '',
            !next ? 'e' : '',
          ].join(' ');
          return `<td class="c"><span class="${classes}" style="background:${color.border}"></span></td>`;
        })
        .join('');
      const detail = [manyCompanies ? row.company : '', row.periods.join(' · ')]
        .filter(Boolean)
        .join(' · ');
      return `<tr>
        <td class="name"><div class="n">${escapeHtml(row.name)}</div><div class="per">${escapeHtml(detail)}</div></td>
        ${cells}
        <td class="tot">${fmtDays(row.total)}</td>
      </tr>`;
    })
    .join('');

  const perDay = days
    .map((_, index) => {
      const count = rows.filter(row => row.cells[index]).length;
      return `<td class="${dayClass(index)}">${count || ''}</td>`;
    })
    .join('');

  const holidayNotes = days
    .map(
      (day, index) =>
        holidays[index] && `${format(day, 'd MMM', { locale: pt })} — ${holidays[index]!.name}`
    )
    .filter(Boolean)
    .map(text => `<span>${escapeHtml(text as string)}</span>`)
    .join('');

  const totalDays = rows.reduce((sum, row) => sum + row.total, 0);
  const monthLabel = format(new Date(year, month, 1), 'MMMM yyyy', { locale: pt });
  const color = (absenceTypeColors.vacation || defaultAbsenceTypeColor).border;

  return `
    <section class="sheet">
      <div class="sheet-head">
        <div class="brand">
          <img src="${opts.logoBase64}" alt="Realize" />
          <small>Mapa de Férias</small>
        </div>
        <div class="month-title">
          <div class="m">${escapeHtml(monthLabel)}</div>
          <div class="sub">Férias aprovadas · ${rows.length} ${rows.length === 1 ? 'colaborador' : 'colaboradores'} · ${fmtDays(totalDays)} dias úteis</div>
        </div>
        <div class="sheet-meta">
          Empresa<br><strong>${escapeHtml(opts.companyLabel)}</strong>
        </div>
      </div>

      ${
        rows.length === 0
          ? '<p class="empty">Sem férias aprovadas neste mês.</p>'
          : `<table class="map">
        <colgroup><col class="col-name" />${days.map(() => '<col />').join('')}<col class="col-tot" /></colgroup>
        <thead><tr><th class="name">Colaborador</th>${head}<th class="tot">Dias</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td class="name">Em férias por dia</td>${perDay}<td></td></tr></tfoot>
      </table>`
      }

      <div class="notes">
        <span><i class="key" style="background:${color}"></i>Férias</span>
        <span><i class="key half" style="background:${color}"></i>Meio dia / horas</span>
        <span><i class="key we"></i>Fim de semana</span>
        ${holidayNotes ? `<span><i class="key hol"></i>Feriados:</span>${holidayNotes}` : ''}
      </div>

      <div class="sheet-foot">
        <span>Realize Consultadoria · Documento interno</span>
        <span>${escapeHtml(monthLabel)}</span>
      </div>
    </section>`;
};

/**
 * Builds a full, self-contained HTML document — the "Mapa de Férias" — with one
 * sheet per selected month: one row per collaborator (full name, periods and
 * total business days) across the days of the month.
 */
export const generateCalendarPrintHtml = (opts: CalendarPrintOptions): string => {
  const months = [...opts.months].sort((a, b) => a.year - b.year || a.month - b.month);
  const sheets = months.map(mo => buildMonthSheet(mo.year, mo.month, opts));

  const generatedOn = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: pt });
  const landscape = opts.orientation === 'landscape';
  const pageSize = landscape ? 'A4 landscape' : 'A4 portrait';
  const sheetWidth = landscape ? '277mm' : '190mm';
  const nameWidth = landscape ? '50mm' : '38mm';

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>Mapa de Férias</title>
<link rel="icon" href="/favicon.png" type="image/png" />
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0; background: #e8e5df; color: #1a1a1a;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .toolbar {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: center; gap: 14px;
    padding: 12px 20px; background: rgba(255,255,255,.95); backdrop-filter: blur(8px);
    border-bottom: 1px solid #d4d4d8; font-size: 13px;
  }
  .toolbar button {
    padding: 8px 18px; border: 1px solid transparent; border-radius: 6px; cursor: pointer;
    font-weight: 600; font-size: 13px; font-family: inherit;
  }
  .toolbar button.primary { background: #b7933d; color: #fff; }
  .toolbar button.secondary { background: #fff; color: #444; border-color: #d4d4d8; }
  .toolbar .gen { color: #777; font-size: 12px; }

  .sheets { padding: 24px 16px 48px; }
  .sheet {
    background: #fff; color: #1a1a1a; width: ${sheetWidth}; max-width: 100%;
    margin: 0 auto 20px; padding: 10mm 12mm; border-radius: 3px;
    box-shadow: 0 8px 28px rgba(0,0,0,.14);
  }
  .sheet-head {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;
    border-bottom: 2px solid #b7933d; padding-bottom: 10px; margin-bottom: 12px;
  }
  .brand { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
  .brand img { height: 46px; width: auto; object-fit: contain; }
  .brand small { font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #6b6b6b; }
  .month-title { text-align: center; flex: 1; }
  .month-title .m {
    font-family: Georgia, 'Times New Roman', serif; font-size: 26px; font-weight: 600;
    line-height: 1; text-transform: capitalize; letter-spacing: .02em;
  }
  .month-title .sub { font-size: 11px; color: #6b6b6b; margin-top: 4px; }
  .sheet-meta { text-align: right; font-size: 11px; color: #6b6b6b; line-height: 1.5; min-width: 110px; }
  .sheet-meta strong { color: #1a1a1a; }

  .map { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; font-size: 10px; }
  .map .col-name { width: ${nameWidth}; }
  .map .col-tot { width: 11mm; }
  .map th, .map td { border-bottom: 1px solid #ebe7de; padding: 0; }
  .map thead th {
    background: #faf8f3; border-bottom: 1px solid #cfc9bb; padding: 4px 0 3px;
    text-align: center; font-weight: 700;
  }
  .map .wd { display: block; overflow: hidden; white-space: nowrap; font-size: 7px; font-weight: 600; text-transform: uppercase; color: #8a8170; }
  .map .dn { display: block; font-size: 10px; font-variant-numeric: tabular-nums; }
  .map .we { background: #f3f1ec; }
  .map .hol { background: #fbf1da; }
  .map thead .we .dn { color: #a89f8b; }
  .map thead .hol .dn { color: #a07f2f; }
  .map th.name, .map td.name { text-align: left; padding: 4px 8px 4px 2px; }
  .map td.c { height: 24px; vertical-align: middle; }
  .bar { display: block; height: 12px; }
  .bar.h { height: 6px; }
  .bar.s { margin-left: 2px; border-radius: 4px 0 0 4px; }
  .bar.e { margin-right: 2px; border-radius: 0 4px 4px 0; }
  .bar.s.e { border-radius: 4px; }
  .n { font-weight: 700; font-size: 10.5px; line-height: 1.2; }
  .per { font-size: 8.5px; color: #6b6b6b; margin-top: 1px; line-height: 1.25; }
  .map .tot { text-align: center; font-weight: 800; font-size: 11px; font-variant-numeric: tabular-nums; }
  .map tbody tr:nth-child(even) td.name, .map tbody tr:nth-child(even) td.tot { background: #fcfbf8; }
  .map tfoot td {
    background: #faf8f3; border-top: 1px solid #cfc9bb; border-bottom: 0;
    font-size: 8.5px; font-weight: 700; color: #6b6b6b; text-align: center; padding: 4px 0;
  }
  .map tfoot td.name { text-align: left; font-weight: 600; }
  .map thead { display: table-header-group; }
  .map tr { page-break-inside: avoid; break-inside: avoid; }
  .empty { text-align: center; color: #6b6b6b; font-size: 12px; padding: 30px 0; }

  .notes { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin-top: 8px; font-size: 9px; color: #6b6b6b; }
  .notes span { display: inline-flex; align-items: center; gap: 5px; }
  .key { display: inline-block; width: 14px; height: 8px; border-radius: 2px; }
  .key.half { height: 4px; }
  .key.we { background: #f3f1ec; border: 1px solid #e4e0d6; }
  .key.hol { background: #fbf1da; border: 1px solid #ecdcb4; }
  .sheet-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 10px; color: #999; border-top: 1px solid #e4e0d6; padding-top: 8px; }

  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .sheets { padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; margin: 0; padding: 0; width: auto; page-break-after: always; }
    .sheet:last-child { page-break-after: auto; }
    @page { size: ${pageSize}; margin: 8mm; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button class="primary" onclick="window.print()">🖨 Imprimir</button>
    <button class="secondary" onclick="window.close()">Fechar</button>
    <span class="gen">Gerado em ${generatedOn}</span>
  </div>
  <div class="sheets">${sheets.join('')}</div>
</body>
</html>`;
};
