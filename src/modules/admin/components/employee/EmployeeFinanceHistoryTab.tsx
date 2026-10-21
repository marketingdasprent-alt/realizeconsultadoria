import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  computeAjudaCusto,
  employeeFinanceService,
  type EmployeeMonthlyFinance,
} from '../../services/employeeFinanceService';

interface EmployeeFinanceHistoryTabProps {
  employeeId: string;
}

const euro = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
const money = (value: number) => (value ? euro.format(value) : '—');

const totals = (row: EmployeeMonthlyFinance) => {
  const ajuda = computeAjudaCusto(row.km_extras, row.taxa_km);
  return {
    vencimento: Number(row.valor_recebido) || 0,
    subsidio: Number(row.valor_subsidio_alimentacao) || 0,
    cartao: Number(row.valor_cartao_da) || 0,
    ajuda,
    descontos: Number(row.valor_descontado) || 0,
    total:
      (Number(row.valor_recebido) || 0) +
      (Number(row.valor_subsidio_alimentacao) || 0) +
      (Number(row.valor_cartao_da) || 0) +
      ajuda,
  };
};

const COLUMNS = [
  { key: 'vencimento', label: 'Vencimento' },
  { key: 'subsidio', label: 'Sub. Alimentação' },
  { key: 'cartao', label: 'Cartão DÁ' },
  { key: 'ajuda', label: 'Ajuda de custo' },
  { key: 'descontos', label: 'Descontos' },
  { key: 'total', label: 'Total' },
] as const;

/**
 * Histórico financeiro do colaborador, mês a mês (só consulta). Os valores editam-se no
 * módulo Financeiro (o mês abre lá com um clique).
 */
const EmployeeFinanceHistoryTab = ({ employeeId }: EmployeeFinanceHistoryTabProps) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin', 'finance-history', employeeId, year],
    queryFn: async () => {
      const { data, error } = await employeeFinanceService.listForEmployee(employeeId, year);
      if (error) throw error;
      return data;
    },
  });

  const byMonth = new Map(rows.map(row => [row.month, totals(row)]));
  const yearTotal = COLUMNS.reduce(
    (acc, column) => ({
      ...acc,
      [column.key]: [...byMonth.values()].reduce((sum, t) => sum + t[column.key], 0),
    }),
    {} as Record<(typeof COLUMNS)[number]['key'], number>
  );

  return (
    <section className="rounded-[24px] bg-white p-4 shadow-rz-soft ring-1 ring-rz-line sm:p-5">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15.5px] font-extrabold">Histórico financeiro</h3>
          <p className="text-[12.5px] text-rz-muted">
            Valores de cada mês. Para editar, abra o mês no Financeiro.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-rz-canvas p-1">
          <button
            type="button"
            onClick={() => setYear(y => y - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white"
            aria-label="Ano anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-[14px] font-extrabold tabular-nums">{year}</span>
          <button
            type="button"
            onClick={() => setYear(y => y + 1)}
            disabled={year >= new Date().getFullYear()}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white disabled:opacity-30"
            aria-label="Ano seguinte"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-rz-canvas" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-rz-line text-[12px] font-bold text-rz-muted">
                <th className="px-2 py-2 text-left">Mês</th>
                {COLUMNS.map(column => (
                  <th key={column.key} className="whitespace-nowrap px-2 py-2 text-right">
                    {column.label}
                  </th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, index) => index + 1).map(month => {
                const values = byMonth.get(month);
                return (
                  <tr
                    key={month}
                    className={cn('border-b border-rz-line', !values && 'text-rz-muted')}
                  >
                    <td className="px-2 py-2 font-semibold capitalize">
                      {format(new Date(year, month - 1, 1), 'MMMM', { locale: pt })}
                    </td>
                    {COLUMNS.map(column => (
                      <td
                        key={column.key}
                        className={cn(
                          'whitespace-nowrap px-2 py-2 text-right tabular-nums',
                          column.key === 'total' && 'font-bold text-rz-ink',
                          column.key === 'descontos' && 'text-rz-muted'
                        )}
                      >
                        {values ? money(values[column.key]) : '—'}
                      </td>
                    ))}
                    <td className="px-1 py-2 text-right">
                      <Link
                        to={`${ROUTES.ADMIN.FINANCE}?year=${year}&month=${month}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-primary"
                        aria-label="Abrir este mês no Financeiro"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-rz-canvas font-bold">
                <td className="px-2 py-2.5 text-[12px] uppercase tracking-wide">Total {year}</td>
                {COLUMNS.map(column => (
                  <td
                    key={column.key}
                    className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums"
                  >
                    {money(yearTotal[column.key])}
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default EmployeeFinanceHistoryTab;
