import React, { useMemo, useState } from 'react';
import { startOfMonth } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useCompanies } from '@/hooks/useCompanies';
import { useEmployees } from '@/hooks/useEmployees';
import { useTimesheet, type TimesheetFilters as Filters } from '../../hooks/useTimesheet';
import { EmployeeTimesheetCard } from './EmployeeTimesheetCard';
import { EntryDialogs, type EntryDialogState } from './EntryDialogs';
import { TimesheetFilters } from './TimesheetFilters';

interface TimesheetTabProps {
  canEdit: boolean;
}

export const TimesheetTab: React.FC<TimesheetTabProps> = ({ canEdit }) => {
  const [filters, setFilters] = useState<Filters>({
    month: startOfMonth(new Date()),
    companyId: null,
    employeeId: null,
    onlyFlagged: false,
  });
  const [dialog, setDialog] = useState<EntryDialogState | null>(null);
  const { companies } = useCompanies();
  const { employees } = useEmployees();
  const { sheets, isLoading, error, refetch } = useTimesheet(filters);

  const employeeOptions = useMemo(
    () =>
      employees
        .filter(e => !filters.companyId || e.company_id === filters.companyId)
        .map(e => ({ id: e.id, name: e.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    [employees, filters.companyId]
  );

  return (
    <div className="space-y-4">
      <TimesheetFilters
        filters={filters}
        companies={companies.map(c => ({ id: c.id, name: c.name }))}
        employees={employeeOptions}
        canEdit={canEdit}
        onChange={setFilters}
        onCreate={() => setDialog({ mode: 'create', entry: null })}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : sheets.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">
          Sem registos de ponto para estes filtros.
        </p>
      ) : (
        <div className="space-y-4">
          {sheets.map(sheet => (
            <EmployeeTimesheetCard
              key={sheet.employeeId}
              sheet={sheet}
              canEdit={canEdit}
              onAction={(mode, entry) => setDialog({ mode, entry })}
            />
          ))}
        </div>
      )}

      <EntryDialogs
        state={dialog}
        employees={employeeOptions}
        defaultEmployeeId={filters.employeeId}
        onClose={() => setDialog(null)}
        onChanged={refetch}
      />
    </div>
  );
};
