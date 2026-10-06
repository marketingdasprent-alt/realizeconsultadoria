import { useCallback, useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getLogoBase64 } from '@/lib/logo-utils';
import { getErrorMessage, type TimeClockEntry } from '@/lib/timeclock';
import { buildTimesheetMonth, generateTimesheetPrintHtml } from '@/lib/timesheet-print';
import { holidayService } from '../services/holidayService';

export interface PrintEmployee {
  id: string;
  name: string;
  company_id: string;
  position: string | null;
  department: string | null;
}

export interface PrintCompany {
  id: string;
  name: string;
  nif: string | null;
}

interface PrintParams {
  month: Date;
  employees: PrintEmployee[];
  entries: TimeClockEntry[];
  companies: PrintCompany[];
}

interface UseTimesheetPrintResult {
  print: (params: PrintParams) => Promise<void>;
  isPrinting: boolean;
}

/**
 * Abre a folha de ponto mensal numa janela nova (uma A4 por colaborador) pronta a imprimir.
 */
export const useTimesheetPrint = (): UseTimesheetPrintResult => {
  const { toast } = useToast();
  const [isPrinting, setIsPrinting] = useState(false);

  const print = useCallback(
    async ({ month, employees, entries, companies }: PrintParams) => {
      if (employees.length === 0) {
        toast({ title: 'Nenhum colaborador para imprimir com estes filtros' });
        return;
      }
      // Abrir já, no clique: depois de pedidos à rede o browser pode bloquear o pop-up.
      const win = window.open('', '_blank');
      if (!win) {
        toast({
          title: 'Não foi possível abrir a janela',
          description: 'Verifique se os pop-ups estão bloqueados.',
          variant: 'destructive',
        });
        return;
      }
      win.document.write(
        '<p style="font-family:sans-serif;padding:24px">A preparar a folha de ponto…</p>'
      );
      setIsPrinting(true);
      try {
        const [holidaysRes, logoBase64] = await Promise.all([
          holidayService.getRange(
            format(startOfMonth(month), 'yyyy-MM-dd'),
            format(endOfMonth(month), 'yyyy-MM-dd')
          ),
          getLogoBase64(),
        ]);
        const byEmployee = new Map<string, TimeClockEntry[]>();
        for (const entry of entries) {
          const list = byEmployee.get(entry.employee_id) ?? [];
          list.push(entry);
          byEmployee.set(entry.employee_id, list);
        }
        const companyById = new Map(companies.map(c => [c.id, c]));
        const sheets = employees.map(employee => {
          const company = companyById.get(employee.company_id);
          return {
            employeeName: employee.name,
            employeeRole:
              [employee.position, employee.department].filter(Boolean).join(' · ') || null,
            companyName: company?.name ?? null,
            companyNif: company?.nif ?? null,
            month: buildTimesheetMonth(byEmployee.get(employee.id) ?? [], month, holidaysRes.data),
          };
        });
        const html = generateTimesheetPrintHtml({ month, sheets, logoBase64 });
        win.document.open();
        win.document.write(html);
        win.document.close();
      } catch (error: unknown) {
        win.close();
        toast({
          title: 'Erro ao gerar a folha de ponto',
          description: getErrorMessage(error, 'Não foi possível gerar o documento.'),
          variant: 'destructive',
        });
      } finally {
        setIsPrinting(false);
      }
    },
    [toast]
  );

  return { print, isPrinting };
};
