import React, { useMemo, useState } from 'react';
import { startOfMonth } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { matchesNameSearch } from '@/lib/timeclock';
import { useCompanies } from '@/hooks/useCompanies';
import { useEmployees } from '@/hooks/useEmployees';
import { useCompanyScope } from '@/modules/admin/context/CompanyScopeContext';
import { inScope } from '@/modules/admin/lib/companyScope';
import { useTimesheet, type TimesheetFilters as Filters } from '../../hooks/useTimesheet';
import { useTimesheetPrint, type ReportAction } from '../../hooks/useTimesheetPrint';
import { EmployeeTimesheetCard } from './EmployeeTimesheetCard';
import { EntryDialogs, type EntryDialogState } from './EntryDialogs';
import { HourBankSettingsCard } from './HourBankSettingsCard';
import { TimesheetFilters } from './TimesheetFilters';

interface TimesheetTabProps {
  canEdit: boolean;
}

export const TimesheetTab: React.FC<TimesheetTabProps> = ({ canEdit }) => {
  const [picked, setFilters] = useState<Filters>({
    month: startOfMonth(new Date()),
    companyId: null,
    employeeId: null,
    onlyFlagged: false,
  });
  const [dialog, setDialog] = useState<EntryDialogState | null>(null);
  const [search, setSearch] = useState('');
  // O menu pode limitar a uma empresa ou grupo: só as empresas e pessoas dessa escolha.
  const { ids: scopeIds } = useCompanyScope();
  const allCompanies = useCompanies().companies;
  const allEmployees = useEmployees().employees;
  const companies = useMemo(
    () => allCompanies.filter(c => inScope(scopeIds, c.id)),
    [allCompanies, scopeIds]
  );
  const employees = useMemo(
    () => allEmployees.filter(e => inScope(scopeIds, e.company_id)),
    [allEmployees, scopeIds]
  );
  // Uma empresa ou pessoa escolhida aqui que deixou de estar na escolha do menu volta a "todas".
  const filters = useMemo<Filters>(
    () => ({
      ...picked,
      companyId:
        picked.companyId && companies.some(c => c.id === picked.companyId)
          ? picked.companyId
          : null,
      employeeId:
        picked.employeeId && employees.some(e => e.id === picked.employeeId)
          ? picked.employeeId
          : null,
    }),
    [picked, companies, employees]
  );
  const { sheets, entries, isLoading, error, refetch } = useTimesheet(filters);
  const { view, downloadPdf, busyAction } = useTimesheetPrint();
  const visibleSheets = useMemo(
    () => sheets.filter(sheet => matchesNameSearch(sheet.employeeName, search)),
    [sheets, search]
  );

  const employeeOptions = useMemo(
    () =>
      employees
        .filter(e => !filters.companyId || e.company_id === filters.companyId)
        .map(e => ({ id: e.id, name: e.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    [employees, filters.companyId]
  );

  // Uma folha por colaborador ativo que cumpra os filtros (inativos nunca entram).
  const handleReport = (action: ReportAction) => {
    const toPrint = employees
      .filter(e => e.is_active)
      .filter(e => !filters.companyId || e.company_id === filters.companyId)
      .filter(e => !filters.employeeId || e.id === filters.employeeId)
      .filter(e => matchesNameSearch(e.name, search))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    const params = { month: filters.month, employees: toPrint, entries, companies };
    if (action === 'pdf') downloadPdf(params);
    else view(params);
  };

  return (
    <div className="space-y-4">
      <HourBankSettingsCard canEdit={canEdit} />
      <TimesheetFilters
        filters={filters}
        companies={companies.map(c => ({ id: c.id, name: c.name }))}
        employees={employeeOptions}
        canEdit={canEdit}
        search={search}
        onSearchChange={setSearch}
        busyAction={busyAction}
        onChange={setFilters}
        onCreate={() => setDialog({ mode: 'create', entry: null })}
        onReport={handleReport}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : visibleSheets.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">
          {sheets.length > 0 && search
            ? `Nenhum colaborador com registos encontrado para "${search.trim()}".`
            : 'Sem registos de ponto para estes filtros.'}
        </p>
      ) : (
        <div className="space-y-4">
          {visibleSheets.map(sheet => (
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
