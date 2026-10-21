import React, { useRef, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { pt } from 'date-fns/locale';
import { FileUp, UploadCloud } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  matchPayslipFiles,
  toPeriodMonth,
  type MatchableEmployee,
  type PayslipFileMatch,
} from '@/lib/documents';
import { BulkPayslipReview } from '@/modules/documents/components/admin/BulkPayslipReview';
import { usePayslipMonth } from '@/modules/documents/hooks/usePayslipMonth';
import { MonthPicker } from './MonthPicker';

interface ImportPayslipsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Colaboradores ativos (o recibo vai para a empresa de cada um). */
  employees: MatchableEmployee[];
}

/**
 * Importar os recibos de todos de uma vez: escolhe-se o mês e largam-se os PDFs. Cada ficheiro
 * vai para o colaborador cujo nome (ou nº de documento) está no nome do ficheiro; antes de
 * importar confirma-se a quem vai cada um.
 */
export const ImportPayslipsDialog: React.FC<ImportPayslipsDialogProps> = ({
  open,
  onOpenChange,
  employees,
}) => {
  const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM');
  const [month, setMonth] = useState(lastMonth);
  const [matches, setMatches] = useState<PayslipFileMatch[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const periodMonth = toPeriodMonth(month);
  const { byEmployee, refetch } = usePayslipMonth(periodMonth);
  const withPayslip = employees.filter(e => byEmployee[e.id]).length;
  const monthLabel = format(new Date(`${month}-01T12:00:00`), "MMMM 'de' yyyy", { locale: pt });

  const pick = (files: File[]) => {
    if (files.length) setMatches(matchPayslipFiles(files, employees));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-lg rounded-[24px] font-jakarta">
        <DialogHeader>
          <DialogTitle className="text-[20px] font-extrabold">Importar recibos</DialogTitle>
          <DialogDescription>
            Escolha o mês e selecione os PDFs de todos. O nome de cada ficheiro deve ter o nome do
            colaborador (ex.: Recibo_Ana_Silva.pdf).
          </DialogDescription>
        </DialogHeader>

        <MonthPicker value={month} onChange={setMonth} max={format(new Date(), 'yyyy-MM')} />

        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={event => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            pick(Array.from(event.dataTransfer.files));
          }}
          className={cn(
            'flex w-full flex-col items-center gap-2 rounded-[20px] border-2 border-dashed px-4 py-8 text-center transition-colors',
            dragging
              ? 'border-rz-primary bg-rz-primary-soft'
              : 'border-rz-line hover:border-rz-primary/50 hover:bg-rz-canvas'
          )}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rz-primary-soft text-rz-primary">
            {dragging ? <UploadCloud className="h-6 w-6" /> : <FileUp className="h-6 w-6" />}
          </span>
          <span className="text-[15px] font-bold">
            Arraste os recibos para aqui ou clique para os escolher
          </span>
          <span className="text-[13px] text-rz-muted first-letter:uppercase">
            {monthLabel} · {withPayslip} de {employees.length} colaboradores já têm recibo
          </span>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="hidden"
          onChange={event => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            pick(files);
          }}
        />

        {matches && (
          <BulkPayslipReview
            matches={matches}
            employees={employees}
            periodMonth={periodMonth}
            onClose={() => setMatches(null)}
            onImported={() => {
              setMatches(null);
              refetch();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
