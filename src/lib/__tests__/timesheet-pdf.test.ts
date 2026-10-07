// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { TimeClockEntry } from '../timeclock';
import { generateTimesheetPdf } from '../timesheet-pdf';
import { buildTimesheetMonth, type TimesheetPrintSheet } from '../timesheet-print';

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const OCT = new Date('2026-10-01T00:00:00');

let seq = 0;
const NOTE =
  'Esqueci-me de picar a saída do almoço porque estive numa reunião no cliente e voltei mais tarde do que o previsto';
const entry = (
  entry_type: 'in' | 'out',
  local: string,
  status = 'valid',
  employee_note: string | null = null
): TimeClockEntry =>
  ({
    id: `e${++seq}`,
    employee_id: 'emp-1',
    company_id: 'c-1',
    entry_type,
    punched_at: new Date(local).toISOString(),
    status,
    flags: [],
    source: 'nfc',
    employee_note,
  }) as TimeClockEntry;

/** Mês cheio: 3 pares e 2 observações compridas todos os dias (o pior caso para caber numa página). */
const busyMonth = () => {
  const entries: TimeClockEntry[] = [];
  for (let d = 1; d <= 31; d += 1) {
    const day = `2026-10-${String(d).padStart(2, '0')}`;
    entries.push(
      entry('in', `${day}T08:00:00`),
      entry('out', `${day}T12:00:00`),
      entry('in', `${day}T13:00:00`, 'valid', NOTE),
      entry('out', `${day}T17:00:00`),
      entry('in', `${day}T18:00:00`, d % 2 ? 'flagged' : 'valid'),
      entry('out', `${day}T19:30:00`, 'valid', NOTE)
    );
  }
  return buildTimesheetMonth(
    entries,
    OCT,
    [{ date: '2026-10-05', name: 'Implantação da República' }],
    new Date('2026-11-02T10:00:00')
  );
};

const sheet = (employeeName: string): TimesheetPrintSheet => ({
  employeeName,
  employeeRole: 'Consultora Sénior · Recursos Humanos',
  companyName: 'Realize Consultadoria, Lda.',
  companyNif: '515123456',
  month: busyMonth(),
});

describe('generateTimesheetPdf', () => {
  it('puts each employee on exactly one A4 page, even in a busy month', () => {
    const doc = generateTimesheetPdf({
      month: OCT,
      logoBase64: PNG_1PX,
      sheets: [sheet('Ana Sofia Conceição'), sheet('Rui Patrício'), sheet('João Bahia')],
    });
    expect(doc.getNumberOfPages()).toBe(3);
    const raw = doc.output();
    expect(raw).toContain('Folha de Ponto');
    expect(raw).toContain('Também: 18:00-19:30');
  });
});
