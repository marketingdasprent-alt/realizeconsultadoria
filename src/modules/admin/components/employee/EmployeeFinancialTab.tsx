import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { useIsRhMember } from '@/hooks/useIsRhMember';
import { useEmployeeMonthlyFinances } from '@/modules/admin/hooks/useEmployeeMonthlyFinances';
import type { FinanceFields } from '@/modules/admin/services/employeeFinanceService';
import type { Employee } from '@/modules/admin/services/employeeService';

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

const PIE_COLORS = {
  vencimento: '#B7933D',
  subsidio: '#3B82F6',
  cartao: '#10B981',
};

const currencyFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
});

const formatCurrency = (value: number) => currencyFormatter.format(value || 0);

interface EditableCellProps {
  value: number;
  canEdit: boolean;
  onCommit: (newValue: number) => void;
  ariaLabel: string;
}

const EditableCell = ({ value, canEdit, onCommit, ariaLabel }: EditableCellProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value ? String(value) : '');

  if (!canEdit) {
    return <span className="text-sm">{formatCurrency(value)}</span>;
  }

  if (!editing) {
    return (
      <button
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

  const commit = () => {
    const parsed = parseFloat(draft.replace(',', '.'));
    onCommit(Number.isFinite(parsed) ? parsed : 0);
    setEditing(false);
  };

  return (
    <Input
      autoFocus
      type="number"
      inputMode="decimal"
      step="0.01"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          setEditing(false);
        }
      }}
      onClick={e => e.stopPropagation()}
      className="h-7 w-28 text-sm"
      aria-label={ariaLabel}
    />
  );
};

interface EmployeeFinancialTabProps {
  employees: Employee[];
  isLoading: boolean;
  searchTerm: string;
}

const EmployeeFinancialTab = ({ employees, isLoading, searchTerm }: EmployeeFinancialTabProps) => {
  const { toast } = useToast();
  const { isRhMember } = useIsRhMember();
  const canEditFinancial = isRhMember;

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);

  const {
    finances: currentFinances,
    isLoading: isLoadingFinances,
    updateField,
  } = useEmployeeMonthlyFinances(year, month);

  const getFinance = (employeeId: string): FinanceFields =>
    currentFinances[employeeId] || {
      valor_recebido: 0,
      valor_subsidio_alimentacao: 0,
      valor_cartao_da: 0,
      valor_descontado: 0,
    };

  const updateFinance = async (employeeId: string, field: keyof FinanceFields, value: number) => {
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
    const lowered = searchTerm.toLowerCase();
    return employees.filter(
      e =>
        e.name.toLowerCase().includes(lowered) ||
        (e.iban || '').toLowerCase().includes(lowered) ||
        // @ts-expect-error - Supabase relational data typing
        e.companies?.name?.toLowerCase().includes(lowered)
    );
  }, [employees, searchTerm]);

  const totals = useMemo(() => {
    let recebido = 0;
    let subsidio = 0;
    let cartao = 0;
    filtered.forEach(e => {
      const f = currentFinances[e.id];
      if (!f) return;
      recebido += f.valor_recebido || 0;
      subsidio += f.valor_subsidio_alimentacao || 0;
      cartao += f.valor_cartao_da || 0;
    });
    return { recebido, subsidio, cartao, total: recebido + subsidio + cartao };
  }, [filtered, currentFinances]);

  const chartData = useMemo(
    () => [
      { name: 'Vencimento base', value: totals.recebido, color: PIE_COLORS.vencimento },
      { name: 'Sub. alimentação', value: totals.subsidio, color: PIE_COLORS.subsidio },
      { name: 'Cartão DÁ', value: totals.cartao, color: PIE_COLORS.cartao },
    ],
    [totals]
  );

  const hasChartData = totals.total > 0;

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => current - 3 + i);
  }, []);

  // Toggle a body class so the @media print rules expose only the
  // financial section. Cleaned up via afterprint listener.
  useEffect(() => {
    const cleanup = () => document.body.classList.remove('financial-printing');
    window.addEventListener('afterprint', cleanup);
    return () => {
      window.removeEventListener('afterprint', cleanup);
      cleanup();
    };
  }, []);

  const handlePrint = () => {
    if (filtered.length === 0) {
      toast({
        title: 'Sem dados para exportar',
        description: 'Não existem colaboradores na lista atual.',
        variant: 'destructive',
      });
      return;
    }
    document.body.classList.add('financial-printing');
    // Native print — browser allows "Save as PDF" from the print dialog.
    window.print();
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

          <Button variant="outline" onClick={handlePrint}>
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </CardContent>
      </Card>

      {/* Print area: table + chart */}
      <div className="financial-print-section space-y-4 print:space-y-6">
        <div className="hidden print:block mb-4">
          <h2 className="text-xl font-semibold">
            Informações Financeiras — {MONTH_LABELS[month - 1]} {year}
          </h2>
        </div>

        {/* Table */}
        <Card className="shadow-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 py-1 px-2">Nome</TableHead>
                  <TableHead className="h-8 py-1 px-2">IBAN</TableHead>
                  <TableHead className="h-8 py-1 px-2 text-right">Valor Recebido</TableHead>
                  <TableHead className="h-8 py-1 px-2 text-right">Sub. Alimentação</TableHead>
                  <TableHead className="h-8 py-1 px-2 text-right">Valor Transferido</TableHead>
                  <TableHead className="h-8 py-1 px-2 text-right">Cartão DÁ</TableHead>
                  <TableHead className="h-8 py-1 px-2 text-right">Valor Descontado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || isLoadingFinances ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4 text-sm">
                      <div className="flex justify-center items-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-4 text-sm text-muted-foreground"
                    >
                      Nenhum colaborador encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(employee => {
                    const f = getFinance(employee.id);
                    const transferido =
                      (f.valor_recebido || 0) - (f.valor_subsidio_alimentacao || 0);
                    return (
                      <TableRow key={employee.id} className="h-8">
                        <TableCell className="py-1 px-2">
                          <span className="font-medium">{employee.name}</span>
                        </TableCell>
                        <TableCell className="py-1 px-2 text-sm font-mono">
                          {employee.iban || '-'}
                        </TableCell>
                        <TableCell className="py-1 px-2 text-right">
                          <EditableCell
                            value={f.valor_recebido}
                            canEdit={canEditFinancial}
                            onCommit={v => updateFinance(employee.id, 'valor_recebido', v)}
                            ariaLabel={`Valor recebido de ${employee.name}`}
                          />
                        </TableCell>
                        <TableCell className="py-1 px-2 text-right">
                          <EditableCell
                            value={f.valor_subsidio_alimentacao}
                            canEdit={canEditFinancial}
                            onCommit={v =>
                              updateFinance(employee.id, 'valor_subsidio_alimentacao', v)
                            }
                            ariaLabel={`Subsídio de alimentação de ${employee.name}`}
                          />
                        </TableCell>
                        <TableCell className="py-1 px-2 text-right text-sm text-muted-foreground">
                          {formatCurrency(transferido)}
                        </TableCell>
                        <TableCell className="py-1 px-2 text-right">
                          <EditableCell
                            value={f.valor_cartao_da}
                            canEdit={canEditFinancial}
                            onCommit={v => updateFinance(employee.id, 'valor_cartao_da', v)}
                            ariaLabel={`Cartão DÁ de ${employee.name}`}
                          />
                        </TableCell>
                        <TableCell className="py-1 px-2 text-right">
                          <EditableCell
                            value={f.valor_descontado}
                            canEdit={canEditFinancial}
                            onCommit={v => updateFinance(employee.id, 'valor_descontado', v)}
                            ariaLabel={`Valor descontado de ${employee.name}`}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold mb-3">Distribuição de gastos do mês</h3>
            {hasChartData ? (
              <div className="w-full h-80 print:h-[640px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="80%"
                      label={({ name, percent }) => `${name}: ${(percent! * 100).toFixed(1)}%`}
                    >
                      {chartData.map(entry => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
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
    </div>
  );
};

export default EmployeeFinancialTab;
