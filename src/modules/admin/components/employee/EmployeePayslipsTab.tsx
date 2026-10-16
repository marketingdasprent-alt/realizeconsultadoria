import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { toPeriodMonth } from '@/lib/documents';
import { getErrorMessage } from '@/lib/timeclock';
import { useDocumentDownload } from '@/modules/documents/hooks/useDocumentDownload';
import { useEmployeeDocuments } from '@/modules/documents/hooks/useEmployeeDocuments';
import { documentService } from '@/modules/documents/services/documentService';
import { useDocumentRemoval } from '../../hooks/useDocumentRemoval';
import { payslipsByMonth } from '../../lib/registrationSlots';
import { PayslipMonthCard } from './files/PayslipMonthCard';

interface EmployeePayslipsTabProps {
  employeeId: string;
}

const pad = (month: number) => String(month).padStart(2, '0');

/**
 * Recibos de vencimento do colaborador, mês a mês: um mês pode ter vários (vencimento,
 * subsídios…). Carregar ou arrastar os ficheiros para cima do mês; o mesmo nome de ficheiro
 * substitui o anterior. Aparecem ao colaborador em Os meus documentos → Recibos.
 */
const EmployeePayslipsTab = ({ employeeId }: EmployeePayslipsTabProps) => {
  const { toast } = useToast();
  const { all, isLoading, refetch } = useEmployeeDocuments(employeeId);
  const { openingId, open } = useDocumentDownload();
  const removal = useDocumentRemoval(refetch);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [uploadingMonth, setUploadingMonth] = useState<string | null>(null);

  const byMonth = useMemo(() => payslipsByMonth(all), [all]);
  const months = Array.from({ length: 12 }, (_, index) => `${year}-${pad(index + 1)}`);
  const currentMonth = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;

  const upload = async (month: string, files: File[]) => {
    setUploadingMonth(month);
    let failed = 0;
    for (const file of files) {
      const { error } = await documentService.uploadPayslip({
        employeeId,
        periodMonth: toPeriodMonth(month),
        file,
      });
      if (error) {
        failed += 1;
        toast({
          title: `Erro ao carregar ${file.name}`,
          description: getErrorMessage(error, ''),
          variant: 'destructive',
        });
      }
    }
    setUploadingMonth(null);
    const done = files.length - failed;
    if (done > 0)
      toast({
        title: done === 1 ? 'Recibo carregado' : `${done} recibos carregados`,
        description: 'O colaborador já os vê na app.',
      });
    refetch();
  };

  return (
    <section className="rounded-[24px] bg-white p-4 shadow-rz-soft ring-1 ring-rz-line sm:p-5">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15.5px] font-extrabold">Recibos de vencimento</h3>
          <p className="text-[12.5px] text-rz-muted">
            Arraste os ficheiros para cima do mês (pode ter vários). O colaborador vê-os na app, em
            Os meus documentos → Recibos.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-rz-canvas p-1">
          <button
            type="button"
            onClick={() => setYear(y => y - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white"
            aria-label="Ano anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-[14px] font-extrabold tabular-nums">{year}</span>
          <button
            type="button"
            onClick={() => setYear(y => y + 1)}
            disabled={year >= today.getFullYear()}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white disabled:opacity-30"
            aria-label="Ano seguinte"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {months.map(month => (
            <div key={month} className="h-[104px] animate-pulse rounded-2xl bg-rz-canvas" />
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {months.map(month => (
            <PayslipMonthCard
              key={month}
              label={format(new Date(`${month}-01T12:00:00`), 'MMMM', { locale: pt })}
              payslips={byMonth.get(month) ?? []}
              future={month > currentMonth}
              uploading={uploadingMonth === month}
              onFiles={files => upload(month, files)}
              onOpen={open}
              openingId={openingId}
              onDelete={removal.ask}
            />
          ))}
        </ul>
      )}

      <p className="mt-3 text-[12px] text-rz-muted">
        Para carregar os recibos de todos de uma vez: menu Documentos → Recibos de vencimento.
      </p>

      <DeleteConfirmDialog
        open={!!removal.target}
        onOpenChange={value => !value && removal.cancel()}
        title="Apagar recibo"
        description="O colaborador deixa de o ver na app."
        itemName={removal.target?.file_name}
        onConfirm={removal.confirm}
        isLoading={removal.isRemoving}
      />
    </section>
  );
};

export default EmployeePayslipsTab;
