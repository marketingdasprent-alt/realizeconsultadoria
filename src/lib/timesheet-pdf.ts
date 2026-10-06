// Folha de ponto mensal em PDF (ficheiro para guardar, sem passar pela impressão):
// uma página A4 por colaborador, com a mesma informação da versão para imprimir.
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { formatMinutes } from './timeclock';
import {
  PRINT_PAIR_COLUMNS,
  type TimesheetPrintOptions,
  type TimesheetPrintSheet,
} from './timesheet-print';

const GOLD: [number, number, number] = [183, 147, 61];
const GREY: [number, number, number] = [107, 107, 107];
const WEEKEND_FILL: [number, number, number] = [246, 244, 239];
const HOLIDAY_FILL: [number, number, number] = [251, 246, 233];
const PAGE_W = 210;
const MARGIN = 10;
const LOGO_H = 12;

/** As fontes base do PDF só cobrem Latin-1: troca os poucos símbolos fora dele. */
const pdfText = (value: string): string => value.replace(/–/g, '-').replace(/→/g, '->');

const drawHeader = (doc: jsPDF, sheet: TimesheetPrintSheet, opts: TimesheetPrintOptions) => {
  if (opts.logoBase64) {
    const logo = doc.getImageProperties(opts.logoBase64);
    doc.addImage(opts.logoBase64, 'PNG', MARGIN, 8, (logo.width / logo.height) * LOGO_H, LOGO_H);
  }
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(26, 26, 26);
  doc.text('Folha de Ponto', PAGE_W / 2, 14, { align: 'center' });
  const month = format(opts.month, 'MMMM yyyy', { locale: pt });
  doc
    .setFont('helvetica', 'normal')
    .setFontSize(10)
    .setTextColor(...GREY);
  doc.text(month.charAt(0).toUpperCase() + month.slice(1), PAGE_W / 2, 20, { align: 'center' });

  const right = PAGE_W - MARGIN;
  doc.setFontSize(8.5).setTextColor(68, 68, 68);
  doc.text(pdfText(`Colaborador: ${sheet.employeeName}`), right, 11, { align: 'right' });
  if (sheet.employeeRole)
    doc.text(pdfText(`Função: ${sheet.employeeRole}`), right, 15, { align: 'right' });
  const company = `Empresa: ${sheet.companyName ?? '-'}${sheet.companyNif ? ` · NIF ${sheet.companyNif}` : ''}`;
  doc.text(pdfText(company), right, 19, { align: 'right' });

  doc
    .setDrawColor(...GOLD)
    .setLineWidth(0.6)
    .line(MARGIN, 24, right, 24);
};

const drawFooter = (doc: jsPDF, sheet: TimesheetPrintSheet, tableEndY: number) => {
  const right = PAGE_W - MARGIN;
  const { month } = sheet;
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(26, 26, 26);
  doc.text(
    `Total do mês: ${formatMinutes(month.totalMinutes)}     Dias com registo: ${month.workedDays}     Dias incompletos: ${month.incompleteDays}`,
    right,
    tableEndY + 6,
    { align: 'right' }
  );
  doc.setFontSize(7).setTextColor(136, 136, 136);
  doc.text(
    '* Registo inserido ou corrigido pelos RH. Horas calculadas pelos pares entrada/saída.',
    MARGIN,
    tableEndY + 11
  );

  const signY = Math.max(tableEndY + 30, 272);
  doc.setDrawColor(85, 85, 85).setLineWidth(0.2);
  doc.line(20, signY, 92, signY);
  doc.line(118, signY, 190, signY);
  doc.setFontSize(8.5).setTextColor(68, 68, 68);
  doc.text('O colaborador', 56, signY + 4, { align: 'center' });
  doc.text('A entidade empregadora', 154, signY + 4, { align: 'center' });
};

const drawSheet = (doc: jsPDF, sheet: TimesheetPrintSheet, opts: TimesheetPrintOptions) => {
  drawHeader(doc, sheet, opts);
  const pairHeads = Array.from({ length: PRINT_PAIR_COLUMNS }, () => ['Entrada', 'Saída']).flat();
  const rows = sheet.month.rows;
  let tableEndY = 0;

  autoTable(doc, {
    startY: 27,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    head: [['Dia', '', ...pairHeads, 'Horas', 'Observações']],
    body: rows.map(row => [
      row.day,
      row.weekday.charAt(0).toUpperCase() + row.weekday.slice(1),
      ...Array.from({ length: PRINT_PAIR_COLUMNS }, (_, i) => [
        row.pairs[i]?.in ?? '',
        row.pairs[i]?.out ?? '',
      ]).flat(),
      row.workedMinutes > 0 ? formatMinutes(row.workedMinutes) : '',
      pdfText(row.notes.join(' · ')),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 1.3, bottom: 1.3, left: 1.5, right: 1.5 },
      lineColor: [228, 224, 214],
      lineWidth: 0.1,
      textColor: [26, 26, 26],
      valign: 'middle',
    },
    headStyles: { fillColor: [250, 248, 243], textColor: GREY, fontSize: 7, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 10, textColor: GREY },
      2: { cellWidth: 17, halign: 'center' },
      3: { cellWidth: 17, halign: 'center' },
      4: { cellWidth: 17, halign: 'center' },
      5: { cellWidth: 17, halign: 'center' },
      6: { cellWidth: 15, halign: 'center', fontStyle: 'bold' },
      7: { fontSize: 7, textColor: [68, 68, 68] },
    },
    didParseCell: data => {
      if (data.section !== 'body') return;
      const row = rows[data.row.index];
      if (row.holiday) data.cell.styles.fillColor = HOLIDAY_FILL;
      else if (row.isWeekend) data.cell.styles.fillColor = WEEKEND_FILL;
    },
    didDrawPage: data => {
      tableEndY = data.cursor?.y ?? tableEndY;
    },
  });

  drawFooter(doc, sheet, tableEndY);
};

/** Gera o PDF (uma página A4 por colaborador). */
export const generateTimesheetPdf = (opts: TimesheetPrintOptions): jsPDF => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  opts.sheets.forEach((sheet, index) => {
    if (index > 0) doc.addPage();
    drawSheet(doc, sheet, opts);
  });
  const generatedOn = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: pt });
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(153, 153, 153);
    doc.text(`Gerado em ${generatedOn}`, MARGIN, 290);
    doc.text(`Página ${page} de ${total}`, PAGE_W - MARGIN, 290, { align: 'right' });
  }
  return doc;
};
