import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { getLogoBase64 } from '@/lib/logo-utils';
import { openPrintPreview } from '@/lib/print-preview';
import { buildVacationReportHtml, type ReportEmployee } from '../lib/vacationReport';
import { calendarService } from '../services/calendarService';

/** Gera o Relatório de Férias (saldos do ano) e abre-o na pré-visualização de impressão. */
export const useVacationReport = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = async (year: number, employees: ReportEmployee[]) => {
    if (employees.length === 0) {
      toast({
        title: 'Sem colaboradores ativos',
        description: 'Não há colaboradores ativos para gerar o relatório.',
        variant: 'destructive',
      });
      return;
    }
    setIsGenerating(true);
    try {
      const [{ data, error }, logoBase64] = await Promise.all([
        calendarService.getVacationReportData(year),
        getLogoBase64(),
      ]);
      if (error || !data) throw error ?? new Error('Sem dados para o relatório');
      openPrintPreview(
        buildVacationReportHtml({ year, employees, ...data, logoBase64 }),
        `Relatório de Férias ${year}`
      );
    } catch (error: unknown) {
      toast({
        title: 'Erro ao gerar relatório',
        description: error instanceof Error ? error.message : 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return { generate, isGenerating };
};
