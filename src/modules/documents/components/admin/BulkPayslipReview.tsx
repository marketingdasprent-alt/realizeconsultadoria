import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatPeriodMonth, type MatchableEmployee, type PayslipFileMatch } from '@/lib/documents';
import { documentService } from '../../services/documentService';

interface BulkPayslipReviewProps {
  matches: PayslipFileMatch[];
  employees: MatchableEmployee[];
  periodMonth: string;
  onClose: () => void;
  onImported: () => void;
}

const SKIP = '__skip__';

/** Confirmação da importação em lote: corrigir correspondências e importar. */
export const BulkPayslipReview: React.FC<BulkPayslipReviewProps> = ({
  matches,
  employees,
  periodMonth,
  onClose,
  onImported,
}) => {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Record<number, string>>(() =>
    Object.fromEntries(matches.map((m, i) => [i, m.employeeId ?? SKIP]))
  );
  const [progress, setProgress] = useState<number | null>(null);

  const toImport = matches.filter((_, i) => assignments[i] !== SKIP);

  const runImport = async () => {
    setProgress(0);
    let failed = 0;
    for (let i = 0; i < matches.length; i++) {
      const employeeId = assignments[i];
      if (employeeId === SKIP) continue;
      const { error } = await documentService.uploadPayslip({
        employeeId,
        periodMonth,
        file: matches[i].file,
      });
      if (error) failed++;
      setProgress(i + 1);
    }
    setProgress(null);
    toast({
      title: failed
        ? `${toImport.length - failed} importados, ${failed} com erro`
        : `${toImport.length} recibos importados`,
      variant: failed ? 'destructive' : 'default',
    });
    onImported();
  };

  return (
    <Dialog open onOpenChange={open => !open && progress === null && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar recibos · {formatPeriodMonth(periodMonth)}</DialogTitle>
          <DialogDescription>
            Confirme a quem pertence cada ficheiro. Os nomes foram reconhecidos automaticamente a
            partir do nome do ficheiro; corrija os que faltam.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {matches.map((m, i) => (
            <div
              key={m.file.name + i}
              className="flex flex-col gap-2 rounded-md border p-2 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.file.name}</p>
                {m.confidence === 'partial' && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    correspondência parcial — confirme
                  </Badge>
                )}
                {!m.employeeId && (
                  <Badge variant="destructive" className="mt-1 text-xs">
                    sem correspondência
                  </Badge>
                )}
              </div>
              <Select
                value={assignments[i]}
                onValueChange={v => setAssignments(a => ({ ...a, [i]: v }))}
                disabled={progress !== null}
              >
                <SelectTrigger className="sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SKIP}>Não importar</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={progress !== null}>
            Cancelar
          </Button>
          <Button onClick={runImport} disabled={progress !== null || toImport.length === 0}>
            {progress !== null && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {progress !== null
              ? `A importar ${progress}/${matches.length}`
              : `Importar ${toImport.length}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
