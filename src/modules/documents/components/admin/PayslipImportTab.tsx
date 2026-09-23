import React, { useMemo, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { Check, Loader2 } from 'lucide-react';
import { useCompanies } from '@/hooks/useCompanies';
import { useEmployees } from '@/hooks/useEmployees';
import { useToast } from '@/hooks/use-toast';
import { matchPayslipFiles, toPeriodMonth, type PayslipFileMatch } from '@/lib/documents';
import { getErrorMessage } from '@/lib/timeclock';
import { usePayslipMonth } from '../../hooks/usePayslipMonth';
import { documentService } from '../../services/documentService';
import { BulkPayslipReview } from './BulkPayslipReview';
import { PayslipEmployeeRow } from './PayslipEmployeeRow';
import { ALL_COMPANIES, PayslipImportFilters } from './PayslipImportFilters';

interface PayslipImportTabProps {
  canImport: boolean;
}

/** Importação de recibos de vencimento por mês: um a um ou vários de uma vez. */
export const PayslipImportTab: React.FC<PayslipImportTabProps> = ({ canImport }) => {
  const { toast } = useToast();
  const [month, setMonth] = useState(format(subMonths(new Date(), 1), 'yyyy-MM'));
  const [companyId, setCompanyId] = useState(ALL_COMPANIES);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [bulk, setBulk] = useState<PayslipFileMatch[] | null>(null);
  const periodMonth = toPeriodMonth(month);
  const { companies } = useCompanies();
  const { employees, isLoading: loadingEmployees } = useEmployees();
  const { byEmployee, isLoading, refetch } = usePayslipMonth(periodMonth);

  const visible = useMemo(
    () =>
      employees
        .filter(e => e.is_active && (companyId === ALL_COMPANIES || e.company_id === companyId))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt')),
    [employees, companyId]
  );

  const uploadOne = async (employeeId: string, file: File) => {
    setUploadingId(employeeId);
    const { error } = await documentService.uploadPayslip({ employeeId, periodMonth, file });
    setUploadingId(null);
    if (error) {
      toast({
        title: 'Erro ao importar',
        description: getErrorMessage(error, ''),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Recibo importado' });
    refetch();
  };

  const imported = visible.filter(e => byEmployee[e.id]).length;

  return (
    <div className="space-y-4">
      <PayslipImportFilters
        month={month}
        companyId={companyId}
        companies={companies.map(c => ({ id: c.id, name: c.name }))}
        canImport={canImport}
        onMonthChange={setMonth}
        onCompanyChange={setCompanyId}
        onBulkFiles={files => setBulk(matchPayslipFiles(files, visible))}
      />
      <p className="text-sm text-muted-foreground">
        <Check className="mr-1 inline h-4 w-4 text-green-600" />
        {imported} de {visible.length} colaboradores com recibo em {month}. Para importar vários, o
        nome de cada ficheiro deve conter o nome do colaborador (ex.:{' '}
        <code>Recibo_Joao_Silva.pdf</code>).
      </p>

      {isLoading || loadingEmployees ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-background">
          {visible.map(e => (
            <PayslipEmployeeRow
              key={e.id}
              employee={e}
              payslip={byEmployee[e.id] ?? null}
              canImport={canImport}
              isUploading={uploadingId === e.id}
              onUpload={file => uploadOne(e.id, file)}
            />
          ))}
        </div>
      )}

      {bulk && (
        <BulkPayslipReview
          matches={bulk}
          employees={visible}
          periodMonth={periodMonth}
          onClose={() => setBulk(null)}
          onImported={() => {
            setBulk(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};
