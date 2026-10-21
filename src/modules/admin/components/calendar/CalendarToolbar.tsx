import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { CalendarCompany } from '../../services/calendarService';

export type CalendarView = 'team' | 'month';

interface CalendarToolbarProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  companies: CalendarCompany[];
  companyId: string;
  onCompanyChange: (companyId: string) => void;
  onlyAbsent: boolean;
  onOnlyAbsentChange: (value: boolean) => void;
  isFetching: boolean;
}

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: 'team', label: 'Equipa' },
  { key: 'month', label: 'Mês' },
];

const ROUND = 'flex h-9 w-9 items-center justify-center rounded-full hover:bg-rz-canvas';

/** Mês (anterior/seguinte/hoje), vista Equipa/Mês, empresa e "só com ausências". */
export const CalendarToolbar: React.FC<CalendarToolbarProps> = props => {
  const { month, onMonthChange, view, onViewChange, isFetching } = props;
  const shift = (delta: number) =>
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-rz-line p-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => shift(-1)} className={ROUND} aria-label="Mês anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="min-w-[150px] text-center text-[18px] font-extrabold capitalize">
          {format(month, 'MMMM yyyy', { locale: pt })}
        </h2>
        <button type="button" onClick={() => shift(1)} className={ROUND} aria-label="Mês seguinte">
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => onMonthChange(new Date())}
          className="ml-1 h-9 rounded-full px-3.5 text-[13px] font-semibold ring-1 ring-rz-line hover:bg-rz-canvas"
        >
          Hoje
        </button>
        {isFetching && <Loader2 className="ml-1 h-4 w-4 animate-spin text-rz-muted" />}
      </div>

      <div className="flex rounded-full bg-rz-canvas p-1">
        {VIEWS.map(option => (
          <button
            key={option.key}
            type="button"
            onClick={() => onViewChange(option.key)}
            className={cn(
              'rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors',
              view === option.key ? 'bg-rz-ink text-white' : 'text-rz-muted hover:text-rz-ink'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        {view === 'team' && (
          <label className="flex items-center gap-2 text-[13px] font-medium text-rz-muted">
            <Switch checked={props.onlyAbsent} onCheckedChange={props.onOnlyAbsentChange} />
            Só com ausências
          </label>
        )}
        <Select value={props.companyId} onValueChange={props.onCompanyChange}>
          <SelectTrigger className="h-9 w-[210px] rounded-full">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {props.companies.map(company => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
