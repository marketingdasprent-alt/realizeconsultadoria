import React from 'react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import logoRealize from '@/assets/logo-realize.png';
import { absenceTypeLabels } from '@/lib/absence-types';
import type { CalendarAbsence } from '../../lib/teamCalendar';

interface CalendarPrintReportProps {
  month: Date;
  monthStart: string;
  monthEnd: string;
  absences: CalendarAbsence[];
  companyName: string | null;
}

interface PrintRow {
  id: string;
  name: string;
  company: string;
  type: string;
  start: string;
  end: string;
  hours: string | null;
}

/** Períodos aprovados que tocam o mês, por ordem de início. */
const approvedRows = (absences: CalendarAbsence[], from: string, to: string): PrintRow[] =>
  absences
    .flatMap(absence => {
      const base = {
        name: absence.employees?.name ?? '',
        company: absence.employees?.companies?.name ?? '',
        type: absence.absence_type,
      };
      const periods = absence.absence_periods ?? [];
      if (periods.length === 0)
        return absence.status === 'approved'
          ? [
              {
                ...base,
                id: absence.id,
                start: absence.start_date,
                end: absence.end_date,
                hours: null,
              },
            ]
          : [];
      return periods
        .filter(period => period.status === 'approved')
        .map(period => ({
          ...base,
          id: `${absence.id}-${period.id}`,
          start: period.start_date,
          end: period.end_date,
          hours:
            period.period_type === 'partial' && period.start_time && period.end_time
              ? `${period.start_time}-${period.end_time}`
              : null,
        }));
    })
    .filter(row => row.start <= to && row.end >= from)
    .sort((a, b) => a.start.localeCompare(b.start));

const periodText = (row: PrintRow) =>
  row.hours
    ? `${format(parseISO(row.start), 'dd/MM')} (${row.hours})`
    : `${format(parseISO(row.start), 'dd/MM')} - ${format(parseISO(row.end), 'dd/MM/yyyy')}`;

/** Relatório de ausências aprovadas do mês, só na impressão da página (Ctrl+P). */
export const CalendarPrintReport: React.FC<CalendarPrintReportProps> = ({
  month,
  monthStart,
  monthEnd,
  absences,
  companyName,
}) => {
  const rows = approvedRows(absences, monthStart, monthEnd);
  const cell = 'border-b border-border px-4 py-3';

  return (
    <div className="print-report hidden print:block">
      <div className="mb-6 flex items-center justify-between border-b-2 border-primary pb-4">
        <img src={logoRealize} alt="Realize Consultadoria" className="h-14" />
        <p className="text-sm text-muted-foreground">
          Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
        </p>
      </div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold">Relatório de Ausências Aprovadas</h1>
        <p className="mt-2 text-lg capitalize text-muted-foreground">
          {format(month, "MMMM 'de' yyyy", { locale: pt })}
        </p>
        {companyName && (
          <p className="mt-1 text-sm text-muted-foreground">Empresa: {companyName}</p>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Nenhuma ausência aprovada para este mês
        </p>
      ) : (
        <>
          <table className="print-table w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-primary bg-secondary/50">
                {['Colaborador', 'Empresa', 'Tipo', 'Período'].map(label => (
                  <th key={label} className="px-4 py-3 text-left font-semibold">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className={index % 2 === 0 ? '' : 'bg-secondary/30'}>
                  <td className={cell}>{row.name}</td>
                  <td className={cell}>{row.company}</td>
                  <td className={cell}>{absenceTypeLabels[row.type]}</td>
                  <td className={cell}>{periodText(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-8 flex items-center justify-between border-t-2 border-primary pt-4">
            <p className="text-sm text-muted-foreground">
              Total: <strong>{rows.length}</strong> ausência(s) aprovada(s)
            </p>
            <p className="text-xs text-muted-foreground">Realize Consultadoria</p>
          </div>
        </>
      )}
    </div>
  );
};
