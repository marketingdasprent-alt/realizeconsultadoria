// Folha de ponto mensal para impressão: uma página A4 por colaborador, com a
// tabela de todos os dias do mês, totais e espaço para assinaturas.
import { eachDayOfInterval, endOfMonth, format, isWeekend, startOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { formatMinutes, summarizeDays, type TimeClockEntry } from './timeclock';

export interface PrintHoliday {
  date: string; // yyyy-MM-dd
  name: string;
}

export interface TimesheetPrintPair {
  in: string | null; // HH:mm (com * se inserido pelos RH)
  out: string | null;
}

export interface TimesheetPrintRow {
  date: string;
  day: string;
  weekday: string;
  isWeekend: boolean;
  holiday: string | null;
  pairs: TimesheetPrintPair[];
  workedMinutes: number;
  notes: string[];
}

export interface TimesheetPrintMonth {
  rows: TimesheetPrintRow[];
  totalMinutes: number;
  workedDays: number;
  incompleteDays: number;
}

/** Observações do colaborador cortadas a este tamanho para a folha caber numa página. */
const PRINT_NOTE_MAX = 80;

const shortNote = (note: string) =>
  note.length > PRINT_NOTE_MAX ? `${note.slice(0, PRINT_NOTE_MAX - 1).trimEnd()}…` : note;

/** Colunas Entrada/Saída impressas; pares a mais vão para as observações. */
export const PRINT_PAIR_COLUMNS = 2;

const timeLabel = (entry: TimeClockEntry): string =>
  `${format(new Date(entry.punched_at), 'HH:mm')}${entry.source === 'admin' ? '*' : ''}`;

/** Emparelha entrada → saída pela ordem do dia (registos anulados não contam). */
const buildPairs = (entries: TimeClockEntry[]): TimesheetPrintPair[] => {
  const pairs: TimesheetPrintPair[] = [];
  const sorted = [...entries]
    .filter(e => e.status !== 'voided')
    .sort((a, b) => a.punched_at.localeCompare(b.punched_at));
  for (const entry of sorted) {
    const last = pairs[pairs.length - 1];
    if (entry.entry_type === 'in') pairs.push({ in: timeLabel(entry), out: null });
    else if (last && last.in && !last.out) last.out = timeLabel(entry);
    else pairs.push({ in: null, out: timeLabel(entry) });
  }
  return pairs;
};

/** Linhas de todos os dias do mês de um colaborador, com horas e observações. */
export const buildTimesheetMonth = (
  entries: TimeClockEntry[],
  month: Date,
  holidays: PrintHoliday[],
  now: Date = new Date()
): TimesheetPrintMonth => {
  const summaries = new Map(summarizeDays(entries, now).map(d => [d.date, d]));
  const holidayByDate = new Map(holidays.map(h => [h.date, h.name]));
  let totalMinutes = 0;
  let workedDays = 0;
  let incompleteDays = 0;

  const rows = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }).map(
    date => {
      const key = format(date, 'yyyy-MM-dd');
      const summary = summaries.get(key);
      const dayEntries = summary?.entries ?? [];
      const pairs = buildPairs(dayEntries);
      const notes: string[] = [];
      const holiday = holidayByDate.get(key) ?? null;
      if (holiday) notes.push(holiday);

      const extra = pairs.slice(PRINT_PAIR_COLUMNS);
      if (extra.length) {
        notes.push(`Também: ${extra.map(p => `${p.in ?? '—'}–${p.out ?? '—'}`).join(', ')}`);
      }
      if (summary?.incomplete) notes.push('Registo incompleto');
      if (summary?.openSince) notes.push('Em curso');
      if (dayEntries.some(e => e.status === 'pending')) notes.push('Remoto por aprovar');
      if (dayEntries.some(e => e.status === 'flagged')) notes.push('Com alertas');
      for (const e of dayEntries) {
        if (e.status === 'voided' || !e.employee_note) continue;
        notes.push(`${format(new Date(e.punched_at), 'HH:mm')}: "${shortNote(e.employee_note)}"`);
      }

      const workedMinutes = summary?.workedMinutes ?? 0;
      totalMinutes += workedMinutes;
      if (workedMinutes > 0) workedDays += 1;
      if (summary?.incomplete) incompleteDays += 1;

      return {
        date: key,
        day: format(date, 'dd'),
        weekday: format(date, 'EEE', { locale: pt }).replace('.', ''),
        isWeekend: isWeekend(date),
        holiday,
        pairs,
        workedMinutes,
        notes,
      };
    }
  );

  return { rows, totalMinutes, workedDays, incompleteDays };
};

export interface TimesheetPrintSheet {
  employeeName: string;
  employeeRole: string | null;
  companyName: string | null;
  companyNif: string | null;
  month: TimesheetPrintMonth;
}

export interface TimesheetPrintOptions {
  month: Date;
  sheets: TimesheetPrintSheet[];
  logoBase64: string;
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );

const cell = (value: string | null) => `<td class="t">${value ? escapeHtml(value) : ''}</td>`;

const buildRow = (row: TimesheetPrintRow): string => {
  const times = Array.from({ length: PRINT_PAIR_COLUMNS }, (_, i) => {
    const pair = row.pairs[i];
    return cell(pair?.in ?? null) + cell(pair?.out ?? null);
  }).join('');
  const cls = row.holiday ? 'hol' : row.isWeekend ? 'we' : '';
  return `<tr class="${cls}">
    <td class="d">${row.day}</td><td class="wd">${escapeHtml(row.weekday)}</td>${times}
    <td class="h">${row.workedMinutes > 0 ? formatMinutes(row.workedMinutes) : ''}</td>
    <td class="n" title="${escapeHtml(row.notes.join(' · '))}">${escapeHtml(row.notes.join(' · '))}</td>
  </tr>`;
};

const buildSheet = (sheet: TimesheetPrintSheet, opts: TimesheetPrintOptions): string => {
  const monthLabel = format(opts.month, 'MMMM yyyy', { locale: pt });
  const pairHeads = Array.from(
    { length: PRINT_PAIR_COLUMNS },
    () => '<th>Entrada</th><th>Saída</th>'
  );
  const { month } = sheet;
  return `
  <section class="sheet">
    <div class="head">
      <img src="${opts.logoBase64}" alt="Realize" />
      <div class="title"><div class="m">Folha de Ponto</div><div class="sub">${escapeHtml(monthLabel)}</div></div>
      <div class="meta">
        <div>Colaborador: <strong>${escapeHtml(sheet.employeeName)}</strong></div>
        ${sheet.employeeRole ? `<div>Função: ${escapeHtml(sheet.employeeRole)}</div>` : ''}
        <div>Empresa: ${escapeHtml(sheet.companyName ?? '—')}${sheet.companyNif ? ` · NIF ${escapeHtml(sheet.companyNif)}` : ''}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Dia</th><th></th>${pairHeads.join('')}<th>Horas</th><th class="n">Observações</th></tr></thead>
      <tbody>${month.rows.map(buildRow).join('')}</tbody>
    </table>
    <div class="totals">
      <span>Total do mês: <strong>${formatMinutes(month.totalMinutes)}</strong></span>
      <span>Dias com registo: <strong>${month.workedDays}</strong></span>
      <span>Dias incompletos: <strong>${month.incompleteDays}</strong></span>
    </div>
    <p class="legend">* Registo inserido ou corrigido pelos RH. Horas calculadas pelos pares entrada → saída. Observações resumidas: o texto completo está no registo.</p>
    <div class="sign">
      <div><span></span>O colaborador</div>
      <div><span></span>A entidade empregadora</div>
    </div>
  </section>`;
};

/** Documento HTML completo (uma A4 por colaborador) para abrir numa janela e imprimir. */
export const generateTimesheetPrintHtml = (opts: TimesheetPrintOptions): string => {
  const generatedOn = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: pt });
  const title = `Folha de Ponto — ${format(opts.month, 'MMMM yyyy', { locale: pt })}`;
  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.png" type="image/png" />
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #e8e5df; color: #1a1a1a; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .toolbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: center; gap: 14px;
    padding: 12px 20px; background: rgba(255,255,255,.95); border-bottom: 1px solid #d4d4d8; font-size: 13px; }
  .toolbar button { padding: 8px 18px; border: 1px solid transparent; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; font-family: inherit; }
  .toolbar .primary { background: #b7933d; color: #fff; }
  .toolbar .secondary { background: #fff; color: #444; border-color: #d4d4d8; }
  .toolbar .gen { color: #777; font-size: 12px; }
  .sheets { padding: 24px 16px 48px; }
  .sheet { background: #fff; width: 210mm; max-width: 100%; margin: 0 auto 20px; padding: 9mm 11mm; box-shadow: 0 8px 28px rgba(0,0,0,.14); }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #b7933d; padding-bottom: 8px; margin-bottom: 8px; }
  .head img { height: 40px; width: auto; }
  .title { flex: 1; text-align: center; }
  .title .m { font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: 600; }
  .title .sub { font-size: 12px; color: #6b6b6b; text-transform: capitalize; }
  .meta { font-size: 10.5px; line-height: 1.5; text-align: right; color: #444; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; font-variant-numeric: tabular-nums; }
  th { background: #faf8f3; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: #6b6b6b; padding: 3px 4px; border: 1px solid #cfc9bb; }
  td { border: 1px solid #e4e0d6; padding: 0 4px; height: 6.4mm; }
  td.d { width: 8mm; text-align: center; font-weight: 700; }
  td.wd { width: 9mm; color: #6b6b6b; text-transform: capitalize; }
  td.t { width: 15mm; text-align: center; }
  td.h { width: 14mm; text-align: center; font-weight: 600; }
  td.n, th.n { text-align: left; font-size: 9px; color: #444; }
  /* Uma linha por dia (cortada com …) para a folha caber sempre numa página. */
  td.n { max-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  tr.we td { background: #f6f4ef; }
  tr.hol td { background: #fbf6e9; }
  .totals { display: flex; gap: 22px; justify-content: flex-end; font-size: 11px; margin-top: 6px; }
  .legend { font-size: 8.5px; color: #888; margin: 4px 0 0; }
  .sign { display: flex; gap: 40px; margin-top: 14mm; font-size: 10px; color: #444; }
  .sign div { flex: 1; text-align: center; }
  .sign span { display: block; border-top: 1px solid #555; margin-bottom: 3px; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .sheets { padding: 0; }
    .sheet { box-shadow: none; margin: 0; width: auto; padding: 0; break-after: page; page-break-after: always; }
    .sheet:last-child { break-after: auto; page-break-after: auto; }
    @page { size: A4 portrait; margin: 9mm; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button class="primary" id="save-pdf">⬇ Guardar PDF</button>
    <button class="secondary" onclick="window.print()">🖨 Imprimir</button>
    <button class="secondary" onclick="window.close()">Fechar</button>
    <span class="gen">${opts.sheets.length} colaborador(es) · gerado em ${generatedOn}</span>
  </div>
  <div class="sheets">${opts.sheets.map(s => buildSheet(s, opts)).join('')}</div>
</body>
</html>`;
};
