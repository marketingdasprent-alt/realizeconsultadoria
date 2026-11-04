import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ABSENCE_TYPE_KEYS, absenceTypeLabels } from '@/lib/absence-types';
import { formatMinutes, getErrorMessage } from '@/lib/timeclock';
import { cn } from '@/lib/utils';
import { HOUR_BANK_SETTINGS_KEY, useHourBankSettings } from '../../hooks/useHourBank';
import type { AbsenceRule, HourBankSettings } from '../../lib/hourBank';
import { hourBankService } from '../../services/hourBankService';

const DAYS = [
  [1, 'Seg'],
  [2, 'Ter'],
  [3, 'Qua'],
  [4, 'Qui'],
  [5, 'Sex'],
  [6, 'Sáb'],
  [7, 'Dom'],
] as const;

const RULES: { value: AbsenceRule; label: string }[] = [
  { value: 'justified', label: 'Justificada' },
  { value: 'compensate', label: 'A compensar' },
];

const pill = (on: boolean) =>
  cn(
    'h-8 rounded-full px-3 text-[12.5px] font-semibold ring-1 transition-colors disabled:opacity-60',
    on ? 'bg-rz-ink text-white ring-transparent' : 'text-rz-muted ring-rz-line hover:bg-rz-canvas'
  );

/**
 * Regras do banco de horas (iguais para todos): horas por dia, dias de trabalho e, por tipo de
 * ausência, se conta como trabalhada ("justificada") ou tem de ser compensada.
 */
export const HourBankSettingsCard: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const saved = useHourBankSettings();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<HourBankSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (saved.data && !form) setForm(saved.data);
  }, [saved.data, form]);

  const current = form ?? saved.data;
  const hours = current ? current.dailyMinutes / 60 : 8;

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await hourBankService.saveSettings(form);
    setSaving(false);
    if (error)
      return void toast({
        title: 'Não foi possível guardar',
        description: getErrorMessage(error, 'Só os administradores mudam estas regras.'),
        variant: 'destructive',
      });
    await qc.invalidateQueries({ queryKey: HOUR_BANK_SETTINGS_KEY });
    toast({ title: 'Regras do banco de horas guardadas' });
  };

  const toggleDay = (day: number) =>
    setForm(f => {
      if (!f) return f;
      const has = f.workdays.includes(day);
      if (has && f.workdays.length === 1) return f;
      const workdays = has ? f.workdays.filter(d => d !== day) : [...f.workdays, day].sort();
      return { ...f, workdays };
    });

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex w-full items-center gap-2 text-left"
          aria-expanded={open}
        >
          <Scale className="h-5 w-5 text-primary" />
          <CardTitle className="flex-1 text-base">Banco de horas</CardTitle>
          <span className="text-sm text-muted-foreground">
            {current
              ? `${formatMinutes(current.dailyMinutes)} por dia · ${current.workdays.length} dias por semana`
              : ''}
          </span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
        </button>
      </CardHeader>
      {open && current && (
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Saldo de cada pessoa no mês = horas feitas + ausências justificadas − horas previstas.
            Feriados e dias fora do horário não têm horas previstas; o que se fizer neles conta tudo
            a mais.
          </p>

          <div className="flex flex-wrap items-end gap-6">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Conta a partir de</span>
              <input
                type="date"
                value={current.startsOn ?? ''}
                disabled={!canEdit}
                onChange={e =>
                  e.target.value && setForm(f => (f ? { ...f, startsOn: e.target.value } : f))
                }
                className="h-9 rounded-full bg-rz-canvas px-3 text-sm font-semibold outline-none ring-1 ring-rz-line focus:ring-rz-primary/40"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Horas por dia</span>
              <input
                type="number"
                min={1}
                max={12}
                step={0.5}
                value={hours}
                disabled={!canEdit}
                onChange={e =>
                  setForm(f =>
                    f
                      ? {
                          ...f,
                          dailyMinutes: Math.round(
                            Math.min(12, Math.max(1, Number(e.target.value) || 8)) * 60
                          ),
                        }
                      : f
                  )
                }
                className="h-9 w-24 rounded-full bg-rz-canvas px-3 text-sm font-semibold outline-none ring-1 ring-rz-line focus:ring-rz-primary/40"
              />
            </label>
            <div>
              <span className="mb-1.5 block text-sm font-medium">Dias de trabalho</span>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map(([day, label]) => (
                  <button
                    key={day}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => toggleDay(day)}
                    className={pill(current.workdays.includes(day))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium">Ausências aprovadas</span>
            <p className="mb-2 text-xs text-muted-foreground">
              Justificada: conta como tempo trabalhado. A compensar: a pessoa tem de repor as horas
              noutro dia do mês. Pedidos pendentes ou recusados nunca contam.
            </p>
            <ul className="divide-y divide-rz-line rounded-2xl ring-1 ring-rz-line">
              {ABSENCE_TYPE_KEYS.map(type => {
                const rule = current.absenceRules[type] ?? 'justified';
                return (
                  <li key={type} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="flex-1 text-sm font-medium">{absenceTypeLabels[type]}</span>
                    {RULES.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={!canEdit}
                        onClick={() =>
                          setForm(f =>
                            f
                              ? { ...f, absenceRules: { ...f.absenceRules, [type]: option.value } }
                              : f
                          )
                        }
                        className={pill(rule === option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </li>
                );
              })}
            </ul>
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <Button
                onClick={() => void save()}
                disabled={saving || !form}
                className="rounded-full"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar regras
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
