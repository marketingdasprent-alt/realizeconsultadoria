import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Briefcase,
  Car,
  Copy,
  CreditCard,
  Info,
  Loader2,
  MinusCircle,
  Printer,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useIsRhMember } from '@/hooks/useIsRhMember';
import { cn, formatIban, matchesSearch } from '@/lib/utils';
import { getLogoBase64 } from '@/lib/logo-utils';
import { useEmployeeMonthlyFinances } from '@/modules/admin/hooks/useEmployeeMonthlyFinances';
import {
  computeAjudaCusto,
  DEFAULT_TAXA_KM,
  employeeFinanceService,
  type FinanceFields,
} from '@/modules/admin/services/employeeFinanceService';
import type { Employee } from '@/modules/admin/services/employeeService';
import DiscountItemsPopover from './DiscountItemsPopover';

const MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const CHART_COLORS = {
  vencimento: '#B7933D',
  subsidio: '#3B82F6',
  cartao: '#10B981',
  ajudaCusto: '#A855F7',
  descontado: '#EF4444',
};

const currencyFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
});

const formatCurrency = (value: number) => currencyFormatter.format(value || 0);

const kmFormatter = new Intl.NumberFormat('pt-PT', {
  maximumFractionDigits: 1,
});

const formatKm = (value: number) => `${kmFormatter.format(value || 0)} km`;

const formatTaxa = (value: number) => `${(value || 0).toFixed(2).replace('.', ',')} €/km`;

const focusCell = (cellId: string | null | undefined) => {
  if (!cellId) return;
  setTimeout(() => {
    const el = document.getElementById(cellId);
    if (el) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      el.click();
    }
  }, 0);
};

interface EditableCellProps {
  value: number;
  canEdit: boolean;
  onCommit: (newValue: number) => void;
  ariaLabel: string;
  id?: string;
  nextCellId?: string | null;
}

const EditableCell = ({
  value,
  canEdit,
  onCommit,
  ariaLabel,
  id,
  nextCellId,
}: EditableCellProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value ? String(value) : '');

  if (!canEdit) {
    return <span className="text-sm">{formatCurrency(value)}</span>;
  }

  if (!editing) {
    return (
      <button
        id={id}
        type="button"
        onClick={e => {
          e.stopPropagation();
          setDraft(value ? String(value) : '');
          setEditing(true);
        }}
        className="text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded px-1 -mx-1"
        aria-label={`Editar ${ariaLabel}`}
      >
        {formatCurrency(value)}
      </button>
    );
  }

  const commit = (advance = false) => {
    const parsed = parseFloat(draft.replace(',', '.'));
    onCommit(Number.isFinite(parsed) ? parsed : 0);
    setEditing(false);
    if (advance) focusCell(nextCellId);
  };

  return (
    <Input
      autoFocus
      type="number"
      inputMode="decimal"
      step="0.01"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => commit(false)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          commit(true);
        } else if (e.key === 'Escape') {
          setEditing(false);
        }
      }}
      onClick={e => e.stopPropagation()}
      className="h-7 w-20 ml-auto text-sm text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      aria-label={ariaLabel}
    />
  );
};

interface KmEditableCellProps {
  value: number;
  canEdit: boolean;
  onCommit: (newValue: number) => void;
  ariaLabel: string;
  id?: string;
  nextCellId?: string | null;
}

const KmEditableCell = ({
  value,
  canEdit,
  onCommit,
  ariaLabel,
  id,
  nextCellId,
}: KmEditableCellProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value ? String(value) : '');

  if (!canEdit) {
    return value > 0 ? (
      <span className="text-sm">{formatKm(value)}</span>
    ) : (
      <span className="text-sm text-muted-foreground">—</span>
    );
  }

  if (!editing) {
    return (
      <button
        id={id}
        type="button"
        onClick={e => {
          e.stopPropagation();
          setDraft(value ? String(value) : '');
          setEditing(true);
        }}
        className="text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded px-1 -mx-1"
        aria-label={`Editar ${ariaLabel}`}
      >
        {value > 0 ? formatKm(value) : <span className="text-muted-foreground">—</span>}
      </button>
    );
  }

  const commit = (advance = false) => {
    const parsed = parseFloat(draft.replace(',', '.'));
    onCommit(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
    setEditing(false);
    if (advance) focusCell(nextCellId);
  };

  return (
    <Input
      autoFocus
      type="number"
      inputMode="decimal"
      step="0.1"
      min="0"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => commit(false)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          commit(true);
        } else if (e.key === 'Escape') {
          setEditing(false);
        }
      }}
      onClick={e => e.stopPropagation()}
      className="h-7 w-20 ml-auto text-sm text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      aria-label={ariaLabel}
    />
  );
};

interface AjudaCustoCellProps {
  km: number;
  taxa: number;
  canEdit: boolean;
  onChangeTaxa: (newTaxa: number) => void;
  employeeName: string;
}

const AjudaCustoCell = ({ km, taxa, canEdit, onChangeTaxa, employeeName }: AjudaCustoCellProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>(taxa ? String(taxa) : String(DEFAULT_TAXA_KM));

  if (km <= 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const valor = computeAjudaCusto(km, taxa);

  const display = (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-sm">{formatCurrency(valor)}</span>
      <span className="text-[10px] text-muted-foreground">× {formatTaxa(taxa)}</span>
    </div>
  );

  if (!canEdit) {
    return display;
  }

  const commit = () => {
    const parsed = parseFloat(draft.replace(',', '.'));
    onChangeTaxa(Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_TAXA_KM);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={isOpen => {
        if (isOpen) setDraft(taxa ? String(taxa) : String(DEFAULT_TAXA_KM));
        setOpen(isOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted/40 rounded px-1 -mx-1 focus:outline-none focus:ring-2 focus:ring-primary"
          aria-label={`Editar taxa por km de ${employeeName}`}
        >
          {display}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[260px] space-y-3">
        <div>
          <h4 className="text-sm font-semibold">Taxa por km</h4>
          <p className="text-xs text-muted-foreground">{employeeName}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taxa-km" className="text-xs">
            Valor da taxa (€/km)
          </Label>
          <Input
            id="taxa-km"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            className="h-8 text-sm"
          />
        </div>
        <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
          {formatKm(km)} × {(parseFloat(draft.replace(',', '.')) || 0).toFixed(2).replace('.', ',')}{' '}
          €/km ={' '}
          <span className="font-semibold text-foreground">
            {formatCurrency(km * (parseFloat(draft.replace(',', '.')) || 0))}
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7"
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button type="button" size="sm" className="h-7" onClick={commit}>
            Guardar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface KpiCardProps {
  icon: typeof Wallet;
  label: string;
  value: string;
  subtitle?: string;
  accentColor?: string;
  variant?: 'default' | 'highlight' | 'muted';
}

const KpiCard = ({ icon: Icon, label, value, subtitle, accentColor, variant }: KpiCardProps) => (
  <Card
    className={cn(
      'shadow-card transition-colors',
      variant === 'highlight' && 'border-primary/30 bg-primary/5',
      variant === 'muted' && 'bg-muted/30'
    )}
  >
    <CardContent className="p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
        <Icon className="h-3.5 w-3.5" style={accentColor ? { color: accentColor } : undefined} />
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          'text-xl font-bold tabular-nums leading-tight',
          variant === 'muted' && 'text-muted-foreground'
        )}
      >
        {value}
      </div>
      {subtitle && <div className="text-[11px] text-muted-foreground mt-1">{subtitle}</div>}
    </CardContent>
  </Card>
);

interface EmployeeFinancialTabProps {
  employees: Employee[];
  isLoading: boolean;
  searchTerm: string;
}

const EmployeeFinancialTab = ({ employees, isLoading, searchTerm }: EmployeeFinancialTabProps) => {
  const { toast } = useToast();
  const { isRhMember } = useIsRhMember();
  const { isSuperAdmin } = useAdminPermissions();
  const canEditFinancial = isRhMember || isSuperAdmin;

  const [searchParams, setSearchParams] = useSearchParams();
  const now = new Date();
  const yearParam = parseInt(searchParams.get('year') || '', 10);
  const monthParam = parseInt(searchParams.get('month') || '', 10);
  const year =
    Number.isFinite(yearParam) && yearParam >= 2000 && yearParam <= 2100
      ? yearParam
      : now.getFullYear();
  const month =
    Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12
      ? monthParam
      : now.getMonth() + 1;

  const setYear = useCallback(
    (value: number) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          next.set('year', String(value));
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setMonth = useCallback(
    (value: number) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          next.set('month', String(value));
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const {
    finances: currentFinances,
    isLoading: isLoadingFinances,
    updateField,
    addDiscountItem,
    removeDiscountItem,
    refetch: refetchFinances,
  } = useEmployeeMonthlyFinances(year, month);

  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const getFinance = (employeeId: string): FinanceFields =>
    currentFinances[employeeId] || {
      valor_recebido: 0,
      valor_subsidio_alimentacao: 0,
      valor_cartao_da: 0,
      valor_descontado: 0,
      km_extras: 0,
      taxa_km: DEFAULT_TAXA_KM,
      discount_items: [],
    };

  const updateFinance = async (
    employeeId: string,
    field:
      | 'valor_recebido'
      | 'valor_subsidio_alimentacao'
      | 'valor_cartao_da'
      | 'km_extras'
      | 'taxa_km',
    value: number
  ) => {
    if (!canEditFinancial) return;
    const result = await updateField(employeeId, field, value);
    if (!result.success) {
      toast({
        title: 'Erro ao guardar',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const filtered = useMemo(() => {
    const loweredNoSpaces = searchTerm.replace(/\s/g, '').toLowerCase();
    return employees.filter(e => {
      if (matchesSearch(e.name, searchTerm)) return true;
      // @ts-expect-error - Supabase relational data typing
      if (matchesSearch(e.companies?.name || '', searchTerm)) return true;
      // IBAN: comparar sem espaços
      const ibanNoSpaces = (e.iban || '').replace(/\s/g, '').toLowerCase();
      if (loweredNoSpaces && ibanNoSpaces.includes(loweredNoSpaces)) return true;
      return false;
    });
  }, [employees, searchTerm]);

  const totals = useMemo(() => {
    let recebido = 0;
    let subsidio = 0;
    let cartao = 0;
    let descontado = 0;
    let kmExtras = 0;
    let ajudaCusto = 0;
    filtered.forEach(e => {
      const f = currentFinances[e.id];
      if (!f) return;
      recebido += f.valor_recebido || 0;
      subsidio += f.valor_subsidio_alimentacao || 0;
      cartao += f.valor_cartao_da || 0;
      descontado += f.valor_descontado || 0;
      kmExtras += f.km_extras || 0;
      ajudaCusto += computeAjudaCusto(f.km_extras, f.taxa_km);
    });
    return {
      recebido,
      subsidio,
      cartao,
      descontado,
      kmExtras,
      ajudaCusto,
      total: recebido + subsidio + cartao + ajudaCusto,
    };
  }, [filtered, currentFinances]);

  const chartData = useMemo(
    () =>
      [
        { name: 'Vencimento base', value: totals.recebido, color: CHART_COLORS.vencimento },
        { name: 'Sub. alimentação', value: totals.subsidio, color: CHART_COLORS.subsidio },
        { name: 'Cartão DÁ', value: totals.cartao, color: CHART_COLORS.cartao },
        { name: 'Ajuda de Custo', value: totals.ajudaCusto, color: CHART_COLORS.ajudaCusto },
      ].filter(entry => entry.value > 0),
    [totals]
  );

  const hasChartData = totals.total > 0;

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => current - 3 + i);
  }, []);

  const copyFromPreviousMonth = async () => {
    setCopyDialogOpen(false);
    setIsCopying(true);

    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }

    const { data: prevData, error } = await employeeFinanceService.listByPeriod(
      prevYear,
      prevMonth
    );

    if (error) {
      toast({
        title: 'Erro ao carregar mês anterior',
        description: 'Não foi possível ler os valores do mês anterior.',
        variant: 'destructive',
      });
      setIsCopying(false);
      return;
    }

    const prevMap = new Map(prevData.map(r => [r.employee_id, r]));
    let copied = 0;
    let skipped = 0;

    await Promise.all(
      filtered.map(async employee => {
        const prev = prevMap.get(employee.id);
        if (!prev) {
          skipped++;
          return;
        }

        const current = currentFinances[employee.id];
        const taxa = Number(prev.taxa_km);
        const next: FinanceFields = {
          valor_recebido: Number(prev.valor_recebido) || 0,
          valor_subsidio_alimentacao: Number(prev.valor_subsidio_alimentacao) || 0,
          valor_cartao_da: Number(prev.valor_cartao_da) || 0,
          taxa_km: Number.isFinite(taxa) && taxa > 0 ? taxa : DEFAULT_TAXA_KM,
          km_extras: current?.km_extras ?? 0,
          valor_descontado: current?.valor_descontado ?? 0,
          discount_items: current?.discount_items ?? [],
        };

        const { error: upsertErr } = await employeeFinanceService.upsert(
          employee.id,
          year,
          month,
          next
        );
        if (!upsertErr) copied++;
      })
    );

    await refetchFinances();
    setIsCopying(false);

    const prevMonthLabel = MONTH_LABELS[prevMonth - 1];
    toast({
      title: 'Cópia concluída',
      description: `${copied} colaboradores atualizados com valores de ${prevMonthLabel} ${prevYear}.${
        skipped > 0 ? ` ${skipped} sem registos no mês anterior.` : ''
      }`,
    });
  };

  const handlePrint = async () => {
    if (filtered.length === 0) {
      toast({
        title: 'Sem dados para imprimir',
        description: 'Não existem colaboradores na lista atual.',
        variant: 'destructive',
      });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Erro ao abrir janela de impressão',
        description: 'Verifique se pop-ups estão bloqueados.',
        variant: 'destructive',
      });
      return;
    }

    const logoBase64 = await getLogoBase64();
    const monthLabel = MONTH_LABELS[month - 1];

    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const printChartData = [
      { name: 'Vencimento base', value: totals.recebido, color: CHART_COLORS.vencimento },
      { name: 'Sub. Alimentação', value: totals.subsidio, color: CHART_COLORS.subsidio },
      { name: 'Cartão DÁ', value: totals.cartao, color: CHART_COLORS.cartao },
      { name: 'Ajuda de Custo', value: totals.ajudaCusto, color: CHART_COLORS.ajudaCusto },
    ].filter(e => e.value > 0);
    const chartMax = Math.max(...printChartData.map(e => e.value), 1);
    const chartHtml = printChartData
      .map(
        e => `<div class="bar-row">
            <span class="bar-label">${e.name}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(e.value / chartMax) * 100}%;background:${e.color}"></div></div>
            <span class="bar-value">${formatCurrency(e.value)}</span>
          </div>`
      )
      .join('');

    const rows = filtered
      .map(employee => {
        const f = currentFinances[employee.id] || {
          valor_recebido: 0,
          valor_subsidio_alimentacao: 0,
          valor_cartao_da: 0,
          valor_descontado: 0,
          km_extras: 0,
          taxa_km: DEFAULT_TAXA_KM,
          discount_items: [],
        };
        const ajudaCusto = computeAjudaCusto(f.km_extras, f.taxa_km);
        const totalRow =
          (f.valor_recebido || 0) +
          (f.valor_subsidio_alimentacao || 0) +
          (f.valor_cartao_da || 0) +
          ajudaCusto;
        return `<tr>
            <td>${escapeHtml(employee.name)}</td>
            <td class="iban">${escapeHtml(formatIban(employee.iban || '')) || '-'}</td>
            <td class="num">${formatCurrency(f.valor_recebido || 0)}</td>
            <td class="num">${formatCurrency(f.valor_subsidio_alimentacao || 0)}</td>
            <td class="num">${formatCurrency(f.valor_cartao_da || 0)}</td>
            <td class="num">${f.km_extras > 0 ? formatKm(f.km_extras) : '—'}</td>
            <td class="num">${ajudaCusto > 0 ? formatCurrency(ajudaCusto) : '—'}</td>
            <td class="num total">${formatCurrency(totalRow)}</td>
            <td class="num muted">${formatCurrency(f.valor_descontado || 0)}</td>
          </tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8" />
      <title>Informações Financeiras — ${monthLabel} ${year}</title>
      <link rel="icon" href="/favicon.png" type="image/png" />
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 0; }
        header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #B7933D; padding-bottom: 10px; margin-bottom: 14px; }
        header img { height: 50px; }
        header .title { text-align: right; }
        header h1 { font-size: 16px; margin: 0; color: #111; }
        header .subtitle { font-size: 11px; color: #666; margin-top: 2px; }
        .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 12px; }
        .kpi { border: 1px solid #e5e5e5; border-radius: 6px; padding: 8px 10px; background: #fafafa; }
        .kpi .l { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.04em; }
        .kpi .v { font-size: 14px; font-weight: 700; margin-top: 2px; }
        .kpi.primary { background: #B7933D14; border-color: #B7933D55; }
        .kpi.primary .v { color: #8a6e25; }
        .chart { margin-top: 14px; padding: 10px 12px; border: 1px solid #e5e5e5; border-radius: 6px; background: #fafafa; page-break-inside: avoid; break-inside: avoid; }
        .chart h3 { font-size: 10px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.04em; color: #444; font-weight: 700; }
        .bar-row { display: grid; grid-template-columns: 140px 1fr 100px; align-items: center; gap: 10px; margin-bottom: 5px; }
        .bar-row:last-child { margin-bottom: 0; }
        .bar-label { font-size: 10px; color: #333; }
        .bar-track { background: #ececec; height: 14px; border-radius: 3px; overflow: hidden; }
        .bar-fill { height: 100%; border-radius: 3px; min-width: 2px; }
        .bar-value { font-size: 10px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; color: #111; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #e5e5e5; padding: 6px 8px; text-align: left; }
        th { background: #f3f3f3; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #444; }
        td.num { text-align: right; font-variant-numeric: tabular-nums; }
        td.iban { font-family: monospace; font-size: 10.5px; }
        td.total { font-weight: 700; }
        td.muted { color: #888; }
        tr.totals td { border-top: 2px solid #111; border-bottom: none; font-weight: 700; background: #f7f7f7; }
        footer { margin-top: 14px; font-size: 9px; color: #888; text-align: right; }
      </style></head>
      <body>
        <header>
          <img src="${logoBase64}" alt="Realize" />
          <div class="title">
            <h1>Informações Financeiras</h1>
            <div class="subtitle">${monthLabel} ${year} · ${filtered.length} colaboradores</div>
          </div>
        </header>
        <div class="kpis">
          <div class="kpi primary"><div class="l">Total a Pagar</div><div class="v">${formatCurrency(totals.total)}</div></div>
          <div class="kpi"><div class="l">Vencimento</div><div class="v">${formatCurrency(totals.recebido)}</div></div>
          <div class="kpi"><div class="l">Sub. Alimentação</div><div class="v">${formatCurrency(totals.subsidio)}</div></div>
          <div class="kpi"><div class="l">Cartão DÁ</div><div class="v">${formatCurrency(totals.cartao)}</div></div>
          <div class="kpi"><div class="l">Ajuda de Custo</div><div class="v">${formatCurrency(totals.ajudaCusto)}</div></div>
          <div class="kpi"><div class="l">Descontos</div><div class="v">${formatCurrency(totals.descontado)}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>IBAN</th>
              <th style="text-align:right">Valor Recibo</th>
              <th style="text-align:right">Sub. Alimentação</th>
              <th style="text-align:right">Cartão DÁ</th>
              <th style="text-align:right">KM Extras</th>
              <th style="text-align:right">Ajuda de Custo</th>
              <th style="text-align:right">Total</th>
              <th style="text-align:right">Descontos</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="totals">
              <td>TOTAL</td>
              <td></td>
              <td class="num">${formatCurrency(totals.recebido)}</td>
              <td class="num">${formatCurrency(totals.subsidio)}</td>
              <td class="num">${formatCurrency(totals.cartao)}</td>
              <td class="num">${totals.kmExtras > 0 ? formatKm(totals.kmExtras) : '—'}</td>
              <td class="num">${totals.ajudaCusto > 0 ? formatCurrency(totals.ajudaCusto) : '—'}</td>
              <td class="num">${formatCurrency(totals.total)}</td>
              <td class="num muted">${formatCurrency(totals.descontado)}</td>
            </tr>
          </tbody>
        </table>
        ${
          chartHtml
            ? `<section class="chart">
          <h3>Distribuição por categoria</h3>
          ${chartHtml}
        </section>`
            : ''
        }
        <footer>Documento gerado em ${new Date().toLocaleDateString('pt-PT')}</footer>
        <script>
          setTimeout(function() { window.print(); window.onafterprint = function() { window.close(); }; }, 300);
        </script>
      </body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Controls: month/year + export */}
      <Card className="shadow-card print:hidden">
        <CardContent className="pt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Mês</label>
              <Select value={String(month)} onValueChange={value => setMonth(Number(value))}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_LABELS.map((label, idx) => (
                    <SelectItem key={label} value={String(idx + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Ano</label>
              <Select value={String(year)} onValueChange={value => setYear(Number(value))}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {canEditFinancial && (
              <Button
                variant="outline"
                onClick={() => setCopyDialogOpen(true)}
                disabled={isCopying || isLoadingFinances || filtered.length === 0}
              >
                {isCopying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                Copiar do mês anterior
              </Button>
            )}
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={Wallet}
          label="Total a Pagar"
          value={formatCurrency(totals.total)}
          subtitle={`${filtered.length} ${filtered.length === 1 ? 'colaborador' : 'colaboradores'}`}
          variant="highlight"
          accentColor="#B7933D"
        />
        <KpiCard
          icon={Briefcase}
          label="Vencimento"
          value={formatCurrency(totals.recebido)}
          accentColor={CHART_COLORS.vencimento}
        />
        <KpiCard
          icon={UtensilsCrossed}
          label="Sub. Alimentação"
          value={formatCurrency(totals.subsidio)}
          accentColor={CHART_COLORS.subsidio}
        />
        <KpiCard
          icon={CreditCard}
          label="Cartão DÁ"
          value={formatCurrency(totals.cartao)}
          accentColor={CHART_COLORS.cartao}
        />
        <KpiCard
          icon={Car}
          label="Ajuda de Custo"
          value={formatCurrency(totals.ajudaCusto)}
          subtitle={totals.kmExtras > 0 ? `${formatKm(totals.kmExtras)} no total` : undefined}
          accentColor={CHART_COLORS.ajudaCusto}
        />
        <KpiCard
          icon={MinusCircle}
          label="Descontos"
          value={formatCurrency(totals.descontado)}
          variant="muted"
          accentColor={CHART_COLORS.descontado}
        />
      </div>

      <div className="space-y-4">
        {/* Table */}
        <Card className="shadow-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 py-1 px-2">Nome</TableHead>
                  <TableHead className="h-8 py-1 px-2">IBAN</TableHead>
                  <TableHead className="h-8 py-1 px-2 text-right">Valor Recibo</TableHead>
                  <TableHead className="h-8 py-1 px-2 text-right">Sub. Alimentação</TableHead>
                  <TableHead className="h-8 py-1 px-2 text-right">Cartão DÁ</TableHead>
                  <TableHead className="h-8 py-1 px-2 text-right text-muted-foreground">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-end gap-1 cursor-help">
                            KM Extras
                            <Info className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          align="end"
                          sideOffset={6}
                          className="text-xs max-w-[240px] z-50"
                        >
                          Quantidade de quilómetros extra do mês. Informativo — não entra no Total.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="h-8 py-1 px-2 text-right">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-end gap-1 cursor-help">
                            Ajuda de Custo
                            <Info className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          align="end"
                          sideOffset={6}
                          className="text-xs max-w-[240px] z-50"
                        >
                          Calculada como KM Extras × taxa. Clique no valor para editar a taxa. Soma
                          ao Total.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="h-8 py-1 px-2 text-right">Total</TableHead>
                  <TableHead className="h-8 py-1 px-2 text-right text-muted-foreground">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center justify-end gap-1 cursor-help">
                            Valor Descontado
                            <Info className="h-3 w-3" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          align="end"
                          sideOffset={6}
                          className="text-xs max-w-[220px] z-50"
                        >
                          Coluna informativa — não entra no cálculo do Total
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isLoadingFinances ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-4 text-sm">
                      <div className="flex justify-center items-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center py-4 text-sm text-muted-foreground"
                    >
                      Nenhum colaborador encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {filtered.map((employee, idx) => {
                      const f = getFinance(employee.id);
                      const ajudaCustoRow = computeAjudaCusto(f.km_extras, f.taxa_km);
                      const totalRow =
                        (f.valor_recebido || 0) +
                        (f.valor_subsidio_alimentacao || 0) +
                        (f.valor_cartao_da || 0) +
                        ajudaCustoRow;
                      const nextEmployee = filtered[idx + 1];
                      const vrId = `fin-${employee.id}-vr`;
                      const saId = `fin-${employee.id}-sa`;
                      const cdId = `fin-${employee.id}-cd`;
                      const kmId = `fin-${employee.id}-km`;
                      const nextRowVrId = nextEmployee ? `fin-${nextEmployee.id}-vr` : null;
                      return (
                        <TableRow key={employee.id} className="h-8">
                          <TableCell className="py-1 px-2">
                            <span className="font-medium">{employee.name}</span>
                          </TableCell>
                          <TableCell className="py-1 px-2 text-sm font-mono">
                            {employee.iban ? formatIban(employee.iban) : '-'}
                          </TableCell>
                          <TableCell className="py-1 px-2 text-right">
                            <EditableCell
                              id={vrId}
                              nextCellId={saId}
                              value={f.valor_recebido}
                              canEdit={canEditFinancial}
                              onCommit={v => updateFinance(employee.id, 'valor_recebido', v)}
                              ariaLabel={`Valor recibo de ${employee.name}`}
                            />
                          </TableCell>
                          <TableCell className="py-1 px-2 text-right">
                            <EditableCell
                              id={saId}
                              nextCellId={cdId}
                              value={f.valor_subsidio_alimentacao}
                              canEdit={canEditFinancial}
                              onCommit={v =>
                                updateFinance(employee.id, 'valor_subsidio_alimentacao', v)
                              }
                              ariaLabel={`Subsídio de alimentação de ${employee.name}`}
                            />
                          </TableCell>
                          <TableCell className="py-1 px-2 text-right">
                            <EditableCell
                              id={cdId}
                              nextCellId={kmId}
                              value={f.valor_cartao_da}
                              canEdit={canEditFinancial}
                              onCommit={v => updateFinance(employee.id, 'valor_cartao_da', v)}
                              ariaLabel={`Cartão DÁ de ${employee.name}`}
                            />
                          </TableCell>
                          <TableCell className="py-1 px-2 text-right">
                            <KmEditableCell
                              id={kmId}
                              nextCellId={nextRowVrId}
                              value={f.km_extras}
                              canEdit={canEditFinancial}
                              onCommit={v => updateFinance(employee.id, 'km_extras', v)}
                              ariaLabel={`KM extras de ${employee.name}`}
                            />
                          </TableCell>
                          <TableCell className="py-1 px-2 text-right">
                            <AjudaCustoCell
                              km={f.km_extras}
                              taxa={f.taxa_km}
                              canEdit={canEditFinancial}
                              onChangeTaxa={v => updateFinance(employee.id, 'taxa_km', v)}
                              employeeName={employee.name}
                            />
                          </TableCell>
                          <TableCell className="py-1 px-2 text-right font-semibold text-sm">
                            {formatCurrency(totalRow)}
                          </TableCell>
                          <TableCell className="py-1 px-2 text-right">
                            <DiscountItemsPopover
                              employeeId={employee.id}
                              employeeName={employee.name}
                              total={f.valor_descontado || 0}
                              items={f.discount_items}
                              canEdit={canEditFinancial}
                              onAdd={payload => addDiscountItem(employee.id, payload)}
                              onRemove={id => removeDiscountItem(employee.id, id)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/60 font-semibold border-t-2 hover:bg-muted/60">
                      <TableCell className="py-2 px-2 font-bold uppercase text-xs tracking-wide">
                        Total
                      </TableCell>
                      <TableCell className="py-2 px-2" />
                      <TableCell className="py-2 px-2 text-right font-semibold">
                        {formatCurrency(totals.recebido)}
                      </TableCell>
                      <TableCell className="py-2 px-2 text-right font-semibold">
                        {formatCurrency(totals.subsidio)}
                      </TableCell>
                      <TableCell className="py-2 px-2 text-right font-semibold">
                        {formatCurrency(totals.cartao)}
                      </TableCell>
                      <TableCell className="py-2 px-2 text-right font-semibold text-muted-foreground">
                        {totals.kmExtras > 0 ? formatKm(totals.kmExtras) : '—'}
                      </TableCell>
                      <TableCell className="py-2 px-2 text-right font-semibold">
                        {totals.ajudaCusto > 0 ? formatCurrency(totals.ajudaCusto) : '—'}
                      </TableCell>
                      <TableCell className="py-2 px-2 text-right font-bold">
                        {formatCurrency(totals.total)}
                      </TableCell>
                      <TableCell className="py-2 px-2 text-right font-semibold text-muted-foreground">
                        {formatCurrency(totals.descontado)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Bar chart - comparison of categories */}
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-3">Distribuição por categoria</h3>
            {hasChartData ? (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 8, right: 24, bottom: 8, left: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                    <XAxis
                      type="number"
                      tickFormatter={v => formatCurrency(v as number)}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                    <RechartsTooltip
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {chartData.map(entry => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Sem dados para o mês selecionado.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copiar valores do mês anterior?</AlertDialogTitle>
            <AlertDialogDescription>
              Vai copiar <strong>Vencimento</strong>, <strong>Subsídio Alimentação</strong>,{' '}
              <strong>Cartão DÁ</strong> e <strong>Taxa €/km</strong> do mês anterior para os{' '}
              {filtered.length} colaboradores listados.
              <br />
              <br />
              <span className="text-foreground">KM Extras e Descontos não são copiados.</span>
              <br />
              <strong className="text-destructive">
                Valores destas colunas no mês atual serão substituídos.
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={copyFromPreviousMonth}>Copiar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EmployeeFinancialTab;
