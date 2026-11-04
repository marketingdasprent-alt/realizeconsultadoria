import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { absenceTypeLabels } from '@/lib/absence-types';
import { formatMinutes, type DaySummary, type TimeClockEntryWithRelations } from '@/lib/timeclock';
import { formatBalance } from '../../lib/hourBank';
import type { EmployeeTimesheet } from '../../hooks/useTimesheet';
import { EntryChip, type EntryDialogMode } from './EntryChip';

interface EmployeeTimesheetCardProps {
  sheet: EmployeeTimesheet;
  canEdit: boolean;
  onAction: (mode: EntryDialogMode, entry: TimeClockEntryWithRelations) => void;
}

export const EmployeeTimesheetCard: React.FC<EmployeeTimesheetCardProps> = ({
  sheet,
  canEdit,
  onAction,
}) => {
  const bankByDay = new Map(sheet.bank?.days.map(d => [d.date, d]));
  // Dias sem registos mas com saldo (faltas, ausências) também entram na folha.
  const known = new Set(sheet.days.map(d => d.date));
  const missing: DaySummary[] = (sheet.bank?.days ?? [])
    .filter(d => !known.has(d.date))
    .map(d => ({
      date: d.date,
      entries: [],
      workedMinutes: 0,
      breakMinutes: 0,
      openSince: null,
      pausedSince: null,
      incomplete: false,
      hasFlags: false,
      hasPending: false,
    }));
  const days = [...sheet.days, ...missing].sort((a, b) => a.date.localeCompare(b.date));
  const balanceTone = (minutes: number) =>
    minutes > 0 ? 'text-emerald-700' : minutes < 0 ? 'text-rose-700' : 'text-muted-foreground';
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2 flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base lg:text-lg">{sheet.employeeName}</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {sheet.flaggedCount > 0 && (
            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
              {sheet.flaggedCount} em revisão
            </Badge>
          )}
          {sheet.incompleteDays > 0 && (
            <Badge variant="outline">{sheet.incompleteDays} dias incompletos</Badge>
          )}
          <span className="font-semibold text-gold">{formatMinutes(sheet.totalMinutes)}</span>
          {sheet.bank && (
            <Badge
              variant="outline"
              className={cn('tabular-nums', balanceTone(sheet.bank.balance))}
              title={`Até ontem: ${formatMinutes(sheet.bank.worked)} feitas + ${formatMinutes(sheet.bank.justified)} justificadas, de ${formatMinutes(sheet.bank.expected)} previstas`}
            >
              Saldo {formatBalance(sheet.bank.balance)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Dia</TableHead>
              <TableHead>Registos</TableHead>
              <TableHead className="w-28 text-right">Horas</TableHead>
              <TableHead className="w-28 text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map(day => (
              <TableRow
                key={day.date}
                className={day.incomplete ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}
              >
                <TableCell className="whitespace-nowrap capitalize">
                  {format(new Date(`${day.date}T12:00:00`), 'EEE, dd/MM', { locale: pt })}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {[...day.entries]
                      .sort((a, b) => a.punched_at.localeCompare(b.punched_at))
                      .map(entry => (
                        <EntryChip
                          key={entry.id}
                          entry={entry as TimeClockEntryWithRelations}
                          canEdit={canEdit}
                          onAction={onAction}
                        />
                      ))}
                  </div>
                  {day.entries.length === 0 && (
                    <span className="text-xs text-muted-foreground">Sem registos</span>
                  )}
                  {day.incomplete && (
                    <p className="text-xs text-amber-700 mt-1">Registo incompleto</p>
                  )}
                  {bankByDay.get(day.date)?.absenceType && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {absenceTypeLabels[bankByDay.get(day.date)!.absenceType!] ?? 'Ausência'}
                      {bankByDay.get(day.date)!.justified > 0 &&
                        ` · justificada ${formatMinutes(bankByDay.get(day.date)!.justified)}`}
                      {bankByDay.get(day.date)!.toCompensate > 0 &&
                        ` · a compensar ${formatMinutes(bankByDay.get(day.date)!.toCompensate)}`}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap">
                  {formatMinutes(day.workedMinutes)}
                  {day.openSince && (
                    <span className="block text-xs text-muted-foreground">em curso</span>
                  )}
                  {day.pausedSince && (
                    <span className="block text-xs text-muted-foreground">em pausa</span>
                  )}
                  {day.breakMinutes > 0 && (
                    <span className="block text-xs text-muted-foreground">
                      pausas {formatMinutes(day.breakMinutes)}
                    </span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-medium whitespace-nowrap tabular-nums',
                    bankByDay.get(day.date) && balanceTone(bankByDay.get(day.date)!.balance)
                  )}
                >
                  {bankByDay.get(day.date) ? formatBalance(bankByDay.get(day.date)!.balance) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
