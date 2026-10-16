// Férias e ausências do colaborador: dados, novo pedido (com todas as validações, pela
// ordem de sempre) e cancelar. Na pré-visualização trabalha com dados de exemplo.
import { useState } from 'react';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { describeConflicts, findApprovedConflicts } from '@/lib/absence-overlap';
import type { DatePeriod } from '@/lib/vacation-utils';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { periodsRange, toPeriodRows, violatesVacationNotice } from '../lib/absenceRules';
import type { PeriodItem } from '../lib/periodItems';
import { DEMO_ABSENCES } from '../lib/demoData';
import { absenceRequestService, type AbsencesData } from '../services/absenceRequestService';

export const ABSENCES_KEY = ['absences', 'mine'] as const;

export interface NewAbsenceInput {
  absenceType: string;
  trainingMode: string;
  periods: DatePeriod[];
  notes: string;
  files: File[];
}

const fail = (title: string, description: string): false => {
  toast({ title, description, variant: 'destructive' });
  return false;
};

export interface PeriodEdit {
  from: Date;
  to: Date;
  periodType: 'full_day' | 'partial';
  startTime: string | null;
  endTime: string | null;
  businessDays: number;
}

export const useMyAbsences = () => {
  const { isPreview, user } = useWorkspace();
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const [demo, setDemo] = useState<AbsencesData>(DEMO_ABSENCES);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const live = useQuery({
    queryKey: [...ABSENCES_KEY, year],
    queryFn: async () => {
      const { data, error } = await absenceRequestService.load(user.employeeId, year);
      if (error || !data) throw error;
      return data;
    },
    enabled: !isPreview,
  });
  const data = isPreview ? demo : live.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ABSENCES_KEY });

  const submit = async (input: NewAbsenceInput): Promise<boolean> => {
    if (!input.absenceType) return fail('Erro', 'Por favor selecione o tipo de ausência.');
    if (input.absenceType === 'training' && !input.trainingMode) {
      return fail('Erro', 'Por favor selecione o modo de formação (Online ou Presencial).');
    }
    if (input.periods.length === 0)
      return fail('Erro', 'Por favor adicione pelo menos um período.');
    const { from, to } = periodsRange(input.periods);
    if (violatesVacationNotice(input.absenceType, from)) {
      return fail(
        'Erro de antecedência',
        'Os pedidos de férias devem ser feitos com pelo menos 48 horas de antecedência.'
      );
    }
    const rows = toPeriodRows(input.periods, data?.holidays ?? []);

    if (isPreview) {
      setDemo(current => ({
        ...current,
        absences: [
          {
            id: `demo-${Date.now()}`,
            start_date: format(from, 'yyyy-MM-dd'),
            end_date: format(to, 'yyyy-MM-dd'),
            absence_type: input.absenceType,
            status: 'pending',
            notes: input.notes || null,
            absence_periods: rows.map((row, i) => ({ ...row, id: `n${i}`, status: 'pending' })),
            document_count: input.files.length,
          },
          ...current.absences,
        ],
      }));
      toast({ title: 'Pedido submetido com sucesso!' });
      return true;
    }

    setIsSubmitting(true);
    try {
      const pending = await absenceRequestService.hasPendingOverlap(user.employeeId, from, to);
      if (pending.error) throw pending.error;
      if (pending.data) {
        return fail(
          'Pedido pendente para essas datas',
          'Já tem um pedido pendente que cobre essas datas. Aguarde a aprovação ou recusa antes de submeter outro.'
        );
      }
      const conflicts = await findApprovedConflicts(user.employeeId, rows);
      if (conflicts.error) throw conflicts.error;
      if (conflicts.data && conflicts.data.length > 0) {
        return fail('Já tem ausência aprovada nessas datas', describeConflicts(conflicts.data));
      }

      const created = await absenceRequestService.create({
        employeeId: user.employeeId,
        companyId: user.companyId,
        absenceType: input.absenceType,
        trainingMode: input.trainingMode || null,
        notes: input.notes || null,
        from,
        to,
        periods: rows,
      });
      if (created.error || !created.data) throw created.error;

      if (input.files.length > 0) {
        const failed = await absenceRequestService.uploadDocuments(
          user.userId,
          created.data,
          input.files
        );
        if (failed > 0 && failed < input.files.length) {
          toast({ title: 'Aviso', description: `${failed} documento(s) não foram carregados.` });
        }
      }
      absenceRequestService.notifyHR({
        employeeName: user.name,
        employeeEmail: user.email,
        companyName: user.companyName ?? '',
        absenceType: input.absenceType,
        periods: rows.map(p => ({
          startDate: p.start_date,
          endDate: p.end_date,
          businessDays: p.business_days,
        })),
        notes: input.notes || undefined,
      });
      toast({ title: 'Pedido submetido com sucesso!' });
      await refresh();
      return true;
    } catch (error: unknown) {
      return fail(
        'Erro',
        error instanceof Error ? error.message : 'Não foi possível submeter o pedido.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancel = async (absenceId: string) => {
    if (isPreview) {
      setDemo(current => ({
        ...current,
        absences: current.absences.filter(a => a.id !== absenceId),
      }));
      return;
    }
    const { error } = await absenceRequestService.cancel(absenceId);
    if (error) return void fail('Erro', 'Não foi possível cancelar o pedido.');
    toast({ title: 'Pedido cancelado', description: 'O seu pedido foi removido com sucesso.' });
    await refresh();
  };

  /** Muda as datas de um período (as regras de sempre, aplicadas na base de dados). */
  const editPeriod = async (item: PeriodItem, edit: PeriodEdit): Promise<boolean> => {
    const startDate = format(edit.from, 'yyyy-MM-dd');
    const endDate = format(edit.to, 'yyyy-MM-dd');
    if (isPreview) {
      setDemo(current => ({
        ...current,
        absences: current.absences.map(a =>
          a.id !== item.absenceId
            ? a
            : {
                ...a,
                status: 'pending',
                absence_periods: a.absence_periods?.map(p =>
                  p.id === item.id
                    ? {
                        ...p,
                        start_date: startDate,
                        end_date: endDate,
                        business_days: edit.businessDays,
                        period_type: edit.periodType,
                        start_time: edit.startTime,
                        end_time: edit.endTime,
                        status: 'pending',
                      }
                    : p
                ),
              }
        ),
      }));
      toast({ title: 'Novas datas enviadas aos RH' });
      return true;
    }
    const { error } = await absenceRequestService.reschedulePeriod(item.id, {
      startDate,
      endDate,
      periodType: edit.periodType,
      startTime: edit.startTime,
      endTime: edit.endTime,
    });
    if (error) {
      fail(
        'Não foi possível alterar as datas',
        (error as { message?: string }).message ?? 'Tente novamente.'
      );
      return false;
    }
    absenceRequestService.notifyHR({
      employeeName: user.name,
      employeeEmail: user.email,
      companyName: user.companyName ?? '',
      absenceType: item.absenceType,
      periods: [{ startDate, endDate, businessDays: edit.businessDays }],
      notes: 'Remarcação de um período de férias.',
    });
    toast({
      title: 'Novas datas enviadas aos RH',
      description: 'O período fica à espera de aprovação; os outros mantêm-se.',
    });
    await refresh();
    return true;
  };

  const cancelPeriod = async (item: PeriodItem) => {
    if (isPreview) {
      setDemo(current => ({
        ...current,
        absences: current.absences
          .map(a =>
            a.id !== item.absenceId
              ? a
              : { ...a, absence_periods: a.absence_periods?.filter(p => p.id !== item.id) }
          )
          .filter(a => a.id !== item.absenceId || (a.absence_periods?.length ?? 0) > 0),
      }));
      return;
    }
    const { error } = await absenceRequestService.cancelPeriod(item.id);
    if (error) return void fail('Erro', 'Não foi possível cancelar este período.');
    toast({ title: 'Período cancelado' });
    await refresh();
  };

  return {
    data,
    isLoading: !isPreview && live.isLoading,
    error: live.error,
    isSubmitting,
    submit,
    cancel,
    editPeriod,
    cancelPeriod,
    refresh,
  };
};
