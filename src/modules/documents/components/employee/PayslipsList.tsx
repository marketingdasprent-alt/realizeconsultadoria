import React, { useMemo } from 'react';
import { ExternalLink, Loader2, Receipt } from 'lucide-react';
import { formatPeriodMonth, type EmployeeDocument } from '@/lib/documents';
import { useDocumentDownload } from '../../hooks/useDocumentDownload';

interface PayslipsListProps {
  payslips: EmployeeDocument[];
}

/** Recibos de vencimento agrupados por ano. */
export const PayslipsList: React.FC<PayslipsListProps> = ({ payslips }) => {
  const { openingId, open } = useDocumentDownload();

  const byYear = useMemo(() => {
    const map = new Map<string, EmployeeDocument[]>();
    payslips.forEach(p => {
      const year = (p.period_month ?? p.created_at).slice(0, 4);
      map.set(year, [...(map.get(year) ?? []), p]);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [payslips]);

  if (payslips.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Ainda não há recibos de vencimento disponíveis.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {byYear.map(([year, docs]) => (
        <div key={year}>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{year}</h3>
          <div className="divide-y divide-border rounded-lg border border-border bg-background">
            {docs.map(doc => (
              <button
                key={doc.id}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/50"
                onClick={() => open(doc)}
                disabled={openingId === doc.id}
              >
                <Receipt className="h-5 w-5 shrink-0 text-gold" />
                <span className="flex-1 font-medium capitalize">
                  {formatPeriodMonth(doc.period_month)}
                </span>
                {openingId === doc.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Os recibos são disponibilizados pelos Recursos Humanos após o processamento salarial.
      </p>
    </div>
  );
};
