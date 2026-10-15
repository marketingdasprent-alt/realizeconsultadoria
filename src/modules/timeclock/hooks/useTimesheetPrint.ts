import { useCallback, useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getLogoBase64 } from '@/lib/logo-utils';
import { getErrorMessage, type TimeClockEntry } from '@/lib/timeclock';
import {
  buildTimesheetMonth,
  generateTimesheetPrintHtml,
  type TimesheetPrintOptions,
} from '@/lib/timesheet-print';
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

export interface PrintParams {
  month: Date;
  employees: PrintEmployee[];
  entries: TimeClockEntry[];
  companies: PrintCompany[];
}

export type ReportAction = 'view' | 'pdf';

interface UseTimesheetPrintResult {
  /** Abre o relatório numa janela nova (ver, imprimir ou guardar PDF). */
  view: (params: PrintParams) => Promise<void>;
  /** Descarrega o PDF diretamente, sem abrir a impressão. */
  downloadPdf: (params: PrintParams) => Promise<void>;
  busyAction: ReportAction | null;
}

/** Junta registos, feriados e logótipo numa folha por colaborador. */
const buildReport = async ({
  month,
  employees,
  entries,
  companies,
}: PrintParams): Promise<TimesheetPrintOptions> => {
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
      employeeRole: [employee.position, employee.department].filter(Boolean).join(' · ') || null,
      companyName: company?.name ?? null,
      companyNif: company?.nif ?? null,
      month: buildTimesheetMonth(byEmployee.get(employee.id) ?? [], month, holidaysRes.data),
    };
  });
  return { month, sheets, logoBase64 };
};

const savePdf = async (report: TimesheetPrintOptions) => {
  // Carregado só quando é preciso (a biblioteca de PDF é pesada).
  const { generateTimesheetPdf } = await import('@/lib/timesheet-pdf');
  const suffix = report.sheets.length === 1 ? `-${report.sheets[0].employeeName}` : '';
  generateTimesheetPdf(report).save(
    `folha-de-ponto-${format(report.month, 'yyyy-MM')}${suffix}.pdf`.replace(/\s+/g, '-')
  );
};

/**
 * Relatório mensal da folha de ponto: uma A4 por colaborador, para ver, imprimir ou guardar em PDF.
 */
export const useTimesheetPrint = (): UseTimesheetPrintResult => {
  const { toast } = useToast();
  const [busyAction, setBusyAction] = useState<ReportAction | null>(null);

  const fail = useCallback(
    (error: unknown) =>
      toast({
        title: 'Erro ao gerar a folha de ponto',
        description: getErrorMessage(error, 'Não foi possível gerar o documento.'),
        variant: 'destructive',
      }),
    [toast]
  );

  const hasEmployees = useCallback(
    (params: PrintParams) => {
      if (params.employees.length > 0) return true;
      toast({ title: 'Nenhum colaborador ativo para estes filtros' });
      return false;
    },
    [toast]
  );

  const view = useCallback(
    async (params: PrintParams) => {
      if (!hasEmployees(params)) return;
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
        '<p style="font-family:sans-serif;padding:24px">A preparar o relatório…</p>'
      );
      setBusyAction('view');
      try {
        const report = await buildReport(params);
        win.document.open();
        win.document.write(generateTimesheetPrintHtml(report));
        win.document.close();
        win.document.getElementById('save-pdf')?.addEventListener('click', () => {
          savePdf(report).catch(fail);
        });
      } catch (error: unknown) {
        win.close();
        fail(error);
      } finally {
        setBusyAction(null);
      }
    },
    [fail, hasEmployees, toast]
  );

  const downloadPdf = useCallback(
    async (params: PrintParams) => {
      if (!hasEmployees(params)) return;
      setBusyAction('pdf');
      try {
        await savePdf(await buildReport(params));
      } catch (error: unknown) {
        fail(error);
      } finally {
        setBusyAction(null);
      }
    },
    [fail, hasEmployees]
  );

  return { view, downloadPdf, busyAction };
};
