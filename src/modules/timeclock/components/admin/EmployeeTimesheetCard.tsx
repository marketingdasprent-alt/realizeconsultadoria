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
import { formatMinutes, type TimeClockEntryWithRelations } from '@/lib/timeclock';
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
  const days = [...sheet.days].sort((a, b) => a.date.localeCompare(b.date));
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
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Dia</TableHead>
              <TableHead>Registos</TableHead>
              <TableHead className="w-28 text-right">Horas</TableHead>
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
                  {day.incomplete && (
                    <p className="text-xs text-amber-700 mt-1">Registo incompleto</p>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap">
                  {formatMinutes(day.workedMinutes)}
                  {day.openSince && (
                    <span className="block text-xs text-muted-foreground">em curso</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
