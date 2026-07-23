import { format, endOfMonth, eachDayOfInterval, getDay, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { absenceTypeColors, defaultAbsenceTypeColor } from './absence-types';
import { isHoliday, type Holiday } from './vacation-utils';

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
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "João Silva" → "João S." · single-word names stay as-is. */
const shortName = (full: string): string => {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || '';
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

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
      }));
  }
  if (a.status === 'approved') {
    return [
      {
        start: parseISO(a.start_date),
        end: parseISO(a.end_date),
        partial: false,
        businessDays: null,
      },
    ];
  }
  return [];
};

interface DayChip {
  name: string;
  type: string;
  half: boolean;
}

const chipsForDay = (day: Date, absences: PrintAbsence[]): DayChip[] => {
  // Um chip por colaborador por dia: se tiver mais do que uma ausência aprovada
  // a cair no mesmo dia, o nome não pode sair repetido no mapa.
  const byEmployee = new Map<string, DayChip>();

  for (const a of absences) {
    for (const seg of approvedSegments(a)) {
      if (day >= seg.start && day <= seg.end) {
        const key = a.employee_id || a.employees?.name || a.id;
        if (!byEmployee.has(key)) {
          byEmployee.set(key, {
            name: shortName(a.employees?.name || ''),
            type: a.absence_type,
            half: seg.partial,
          });
        }
        break; // one chip per absence per day
      }
    }
  }

  return Array.from(byEmployee.values());
};

const typeChip = (type: string, content: string, extraClass = ''): string => {
  const c = absenceTypeColors[type] || defaultAbsenceTypeColor;
  return `<span class="${extraClass}" style="background:${c.fill};color:${c.text};border-color:${c.border}">${content}</span>`;
};

const buildMonthSheet = (year: number, month: number, opts: CalendarPrintOptions): string => {
  const { absences, holidays } = opts;
  const monthStart = new Date(year, month, 1);
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDow = (getDay(monthStart) + 6) % 7; // Monday-first (Mon=0)

  const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  let cells = weekdays.map((w, i) => `<div class="wd${i >= 5 ? ' we' : ''}">${w}</div>`).join('');

  // leading blanks
  for (let i = 0; i < firstDow; i++) cells += '<div class="cell empty"></div>';

  for (const day of days) {
    const dow = (getDay(day) + 6) % 7;
    const we = dow >= 5;
    const holiday = isHoliday(day, holidays);
    const dnum = format(day, 'd');

    let inner = `<div class="dnum">${dnum}`;
    if (holiday) {
      const label = holiday.name.length > 12 ? holiday.name.slice(0, 11) + '…' : holiday.name;
      inner += `<span class="hol-name">${escapeHtml(label)}</span>`;
    }
    inner += '</div>';

    if (!we && !holiday) {
      const chips = chipsForDay(day, absences);
      if (chips.length > 0) {
        inner += '<div class="chips">';
        chips.forEach(ch => {
          inner += typeChip(ch.type, escapeHtml(ch.name) + (ch.half ? ' ½' : ''), 'chip');
        });
        inner += '</div>';
      }
    }

    const cls = we ? 'cell we' : holiday ? 'cell hol' : 'cell';
    cells += `<div class="${cls}">${inner}</div>`;
  }

  // trailing blanks
  const trail = (7 - ((firstDow + days.length) % 7)) % 7;
  for (let i = 0; i < trail; i++) cells += '<div class="cell empty"></div>';

  const monthLabel = format(monthStart, 'MMMM yyyy', { locale: pt });

  return `
    <section class="sheet">
      <div class="sheet-head">
        <div class="brand">
          <img src="${opts.logoBase64}" alt="Realize" />
          <small>Mapa de Férias</small>
        </div>
        <div class="month-title">
          <div class="m">${escapeHtml(monthLabel)}</div>
          <div class="sub">Férias aprovadas</div>
        </div>
        <div class="sheet-meta">
          Empresa<br><strong>${escapeHtml(opts.companyLabel)}</strong>
        </div>
      </div>

      <div class="grid">${cells}</div>

      <div class="sheet-foot">
        <span>Realize Consultadoria · Documento interno</span>
        <span>${escapeHtml(monthLabel)}</span>
      </div>
    </section>`;
};

/**
 * Builds a full, self-contained HTML document — the "Mapa de Férias" — with one
 * landscape A4 sheet per selected month. Meant to be written into a new window
 * and printed.
 */
export const generateCalendarPrintHtml = (opts: CalendarPrintOptions): string => {
  const months = [...opts.months].sort((a, b) => a.year - b.year || a.month - b.month);
  const sheets = months.map(mo => buildMonthSheet(mo.year, mo.month, opts));

  const generatedOn = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: pt });
  const landscape = opts.orientation === 'landscape';
  const pageSize = landscape ? 'A4 landscape' : 'A4 portrait';
  const sheetWidth = landscape ? '277mm' : '190mm';

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
  .toolbar button.primary:hover { background: #a07f2f; }
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

  .grid { display: grid; grid-template-columns: repeat(7, 1fr); border: 1px solid #cfc9bb; border-radius: 6px; overflow: hidden; }
  .wd {
    font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    color: #6b6b6b; padding: 5px 8px; background: #faf8f3;
    border-bottom: 1px solid #cfc9bb; border-right: 1px solid #e4e0d6;
  }
  .wd:nth-child(7n) { border-right: 0; }
  .wd.we { color: #b0a894; }
  .cell {
    min-height: 60px; padding: 3px 5px 5px; background: #fff;
    border-right: 1px solid #e4e0d6; border-bottom: 1px solid #e4e0d6;
    display: flex; flex-direction: column; gap: 3px;
  }
  .cell:nth-child(7n) { border-right: 0; }
  .cell.we { background: #f6f4ef; }
  .cell.hol { background: #fbf6e9; }
  .cell.empty { background: repeating-linear-gradient(135deg,#fbfaf6,#fbfaf6 6px,#f4f2ec 6px,#f4f2ec 12px); }
  .dnum { font-size: 12px; font-weight: 700; color: #1a1a1a; font-variant-numeric: tabular-nums; line-height: 1.1; display: flex; align-items: baseline; gap: 5px; }
  .cell.we .dnum { color: #a89f8b; font-weight: 600; }
  .hol-name { font-size: 8.5px; font-weight: 600; color: #a07f2f; text-transform: none; letter-spacing: 0; }
  .chips { display: flex; flex-direction: column; gap: 1.5px; }
  .chip {
    font-size: 9.5px; font-weight: 600; line-height: 1.2; padding: 1px 5px;
    border-radius: 4px; border: 1px solid; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .sheet-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-size: 10px; color: #999; border-top: 1px solid #e4e0d6; padding-top: 8px; }

  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .sheets { padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; margin: 0; padding: 8mm; width: auto; page-break-after: always; }
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
