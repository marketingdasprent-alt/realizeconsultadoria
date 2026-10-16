import { useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { toPeriodMonth } from '@/lib/documents';
import { getErrorMessage } from '@/lib/timeclock';
import { cn } from '@/lib/utils';
import { useDocumentDownload } from '@/modules/documents/hooks/useDocumentDownload';
import { useEmployeeDocuments } from '@/modules/documents/hooks/useEmployeeDocuments';
import { documentService } from '@/modules/documents/services/documentService';
import { useDocumentRemoval } from '../../hooks/useDocumentRemoval';
import { payslipsByMonth } from '../../lib/registrationSlots';

interface EmployeePayslipsTabProps {
  employeeId: string;
}

const pad = (month: number) => String(month).padStart(2, '0');

/**
 * Recibos de vencimento do colaborador, mês a mês: carregar (substitui o do mesmo mês), abrir
 * e apagar. Aparecem ao colaborador em Definições → Os meus documentos → Recibos.
 */
const EmployeePayslipsTab = ({ employeeId }: EmployeePayslipsTabProps) => {
  const { toast } = useToast();
  const { all, isLoading, refetch } = useEmployeeDocuments(employeeId);
  const { openingId, open } = useDocumentDownload();
  const removal = useDocumentRemoval(refetch);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [uploadingMonth, setUploadingMonth] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pickFor = useRef<string | null>(null);

  const byMonth = useMemo(() => payslipsByMonth(all), [all]);
  const months = Array.from({ length: 12 }, (_, index) => `${year}-${pad(index + 1)}`);
  const currentMonth = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;

  const choose = (month: string) => {
    pickFor.current = month;
    fileInput.current?.click();
  };

  const upload = async (file: File | undefined) => {
    const month = pickFor.current;
    if (fileInput.current) fileInput.current.value = '';
    if (!file || !month) return;
    setUploadingMonth(month);
    const { error } = await documentService.uploadPayslip({
      employeeId,
      periodMonth: toPeriodMonth(month),
      file,
    });
    setUploadingMonth(null);
    if (error) {
      toast({
        title: 'Erro ao carregar',
        description: getErrorMessage(error, ''),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Recibo carregado', description: 'O colaborador já o vê na app.' });
    refetch();
  };

  return (
    <section className="rounded-[24px] bg-white p-4 shadow-rz-soft ring-1 ring-rz-line sm:p-5">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15.5px] font-extrabold">Recibos de vencimento</h3>
          <p className="text-[12.5px] text-rz-muted">
            Um por mês. O colaborador vê-os na app, em Os meus documentos → Recibos.
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

      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={event => upload(event.target.files?.[0])}
      />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {months.map(month => (
            <div key={month} className="h-[88px] animate-pulse rounded-2xl bg-rz-canvas" />
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {months.map(month => {
            const payslip = byMonth.get(month);
            const future = month > currentMonth;
            const label = format(new Date(`${month}-01T12:00:00`), 'MMMM', { locale: pt });
            return (
              <li
                key={month}
                className={cn(
                  'flex flex-col rounded-2xl p-3 ring-1',
                  payslip ? 'bg-emerald-50 ring-emerald-200' : 'bg-rz-canvas ring-transparent',
                  future && 'opacity-40'
                )}
              >
                <span className="text-[13.5px] font-bold capitalize">{label}</span>
                <span className="truncate text-[12px] text-rz-muted">
                  {payslip ? payslip.file_name : future ? '—' : 'Sem recibo'}
                </span>
                <div className="mt-2 flex items-center gap-1">
                  {uploadingMonth === month ? (
                    <Loader2 className="h-4 w-4 animate-spin text-rz-primary" />
                  ) : payslip ? (
                    <>
                      <button
                        type="button"
                        onClick={() => open(payslip)}
                        disabled={openingId === payslip.id}
                        className="flex h-8 items-center gap-1 rounded-full bg-white px-2.5 text-[12.5px] font-semibold ring-1 ring-rz-line hover:text-rz-primary"
                      >
                        {openingId === payslip.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3.5 w-3.5" />
                        )}
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => choose(month)}
                        className="h-8 rounded-full px-2.5 text-[12.5px] font-semibold text-rz-muted hover:text-rz-ink"
                      >
                        Trocar
                      </button>
                      <button
                        type="button"
                        onClick={() => removal.ask(payslip)}
                        className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-rz-muted hover:bg-red-50 hover:text-red-600"
                        aria-label={`Apagar recibo de ${label}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    !future && (
                      <button
                        type="button"
                        onClick={() => choose(month)}
                        className="flex h-8 items-center gap-1 rounded-full bg-white px-2.5 text-[12.5px] font-semibold text-rz-primary ring-1 ring-rz-line"
                      >
                        <Plus className="h-3.5 w-3.5" /> Carregar
                      </button>
                    )
                  )}
                </div>
              </li>
            );
          })}
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
