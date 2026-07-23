import { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Printer, Loader2, CalendarRange, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getLogoBase64 } from '@/lib/logo-utils';
import { generateCalendarPrintHtml, type PrintAbsence } from '@/lib/calendar-print';
import type { Holiday } from '@/lib/vacation-utils';

interface Company {
  id: string;
  name: string;
}

interface CalendarPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  defaultCompany: string; // 'all' or company id
  defaultDate: Date; // currently viewed month
}

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];
const MAX_MONTHS = 12;
const monthKey = (year: number, month: number) => `${year}-${month}`;

const CalendarPrintDialog = ({
  open,
  onOpenChange,
  companies,
  defaultCompany,
  defaultDate,
}: CalendarPrintDialogProps) => {
  const { toast } = useToast();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewYear, setViewYear] = useState(defaultDate.getFullYear());
  const [company, setCompany] = useState(defaultCompany);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isGenerating, setIsGenerating] = useState(false);

  const now = new Date();
  const minYear = now.getFullYear() - 2;
  const maxYear = now.getFullYear() + 2;

  // Reset to the page's current context each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSelected(new Set([monthKey(defaultDate.getFullYear(), defaultDate.getMonth())]));
      setViewYear(defaultDate.getFullYear());
      setCompany(defaultCompany);
      setOrientation('portrait');
    }
  }, [open, defaultDate, defaultCompany]);

  const toggleMonth = (year: number, month: number) => {
    const key = monthKey(year, month);
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedList = useMemo(
    () =>
      Array.from(selected)
        .map(k => {
          const [y, m] = k.split('-').map(Number);
          return { key: k, year: y, month: m };
        })
        .sort((a, b) => a.year - b.year || a.month - b.month),
    [selected]
  );

  const handlePrint = async () => {
    if (selectedList.length === 0) {
      toast({
        title: 'Nenhum mês selecionado',
        description: 'Clique em pelo menos um mês para imprimir.',
        variant: 'destructive',
      });
      return;
    }
    if (selectedList.length > MAX_MONTHS) {
      toast({
        title: 'Demasiados meses',
        description: `Selecione no máximo ${MAX_MONTHS} meses de cada vez.`,
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const first = selectedList[0];
      const last = selectedList[selectedList.length - 1];
      const rangeStart = startOfMonth(new Date(first.year, first.month, 1));
      const rangeEnd = endOfMonth(new Date(last.year, last.month, 1));

      const years: number[] = [];
      for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) years.push(y);

      let query = supabase
        .from('absences')
        .select(
          `id, employee_id, start_date, end_date, absence_type, status, company_id,
           employees!inner ( name, companies ( name ) ),
           absence_periods ( start_date, end_date, status, period_type, start_time, end_time, business_days )`
        )
        .eq('absence_type', 'vacation')
        .lte('start_date', format(rangeEnd, 'yyyy-MM-dd'))
        .gte('end_date', format(rangeStart, 'yyyy-MM-dd'))
        .in('status', ['approved', 'partially_approved']);

      if (company !== 'all') {
        query = query.eq('company_id', company);
      }

      const [absencesRes, holidaysRes] = await Promise.all([
        query,
        supabase.from('holidays').select('*').in('year', years),
      ]);

      if (absencesRes.error) throw absencesRes.error;
      if (holidaysRes.error) throw holidaysRes.error;

      const companyLabel =
        company === 'all'
          ? 'Todas as Empresas'
          : companies.find(c => c.id === company)?.name || '—';

      const logoBase64 = await getLogoBase64();

      const html = generateCalendarPrintHtml({
        absences: (absencesRes.data || []) as unknown as PrintAbsence[],
        holidays: (holidaysRes.data || []) as Holiday[],
        months: selectedList.map(m => ({ year: m.year, month: m.month })),
        companyLabel,
        logoBase64,
        orientation,
      });

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({
          title: 'Não foi possível abrir a janela',
          description: 'Verifique se os pop-ups estão bloqueados.',
          variant: 'destructive',
        });
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();

      onOpenChange(false);
    } catch (error: any) {
      console.error('Error generating calendar print:', error);
      toast({
        title: 'Erro ao gerar o calendário',
        description: error.message || 'Não foi possível gerar o documento.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <CalendarRange className="h-5 w-5" />
            Imprimir Mapa de Férias
          </DialogTitle>
          <DialogDescription>
            Clique nos meses que quer imprimir. Cada mês sai numa folha horizontal (A4) com as
            férias aprovadas de cada colaborador no dia certo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* ── Company ── */}
          <div>
            <label className="block text-sm font-medium mb-2">Empresa</label>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as Empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Empresas</SelectItem>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Orientation ── */}
          <div>
            <label className="block text-sm font-medium mb-2">Orientação da folha</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['portrait', 'Vertical'],
                  ['landscape', 'Horizontal'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOrientation(value)}
                  className={cn(
                    'h-10 rounded-md text-sm font-medium border transition-colors',
                    orientation === value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-input hover:bg-accent'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Month grid ── */}
          <div>
            <label className="block text-sm font-medium mb-2">Meses a imprimir</label>
            <div className="rounded-lg border p-3">
              {/* Year navigation */}
              <div className="flex items-center justify-between mb-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewYear(y => Math.max(minYear, y - 1))}
                  disabled={viewYear <= minYear}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-display text-lg font-semibold tabular-nums">{viewYear}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewYear(y => Math.min(maxYear, y + 1))}
                  disabled={viewYear >= maxYear}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Months */}
              <div className="grid grid-cols-4 gap-1.5">
                {MONTH_LABELS.map((label, m) => {
                  const isSelected = selected.has(monthKey(viewYear, m));
                  const isCurrent = viewYear === now.getFullYear() && m === now.getMonth();
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMonth(viewYear, m)}
                      className={cn(
                        'h-10 rounded-md text-sm font-medium border transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-input hover:bg-accent',
                        isCurrent && !isSelected && 'ring-2 ring-primary/40'
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected summary */}
            <div className="mt-2 min-h-[1.5rem]">
              {selectedList.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum mês selecionado.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedList.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleMonth(item.year, item.month)}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-medium pl-2.5 pr-1.5 py-1 hover:bg-primary/20 capitalize"
                    >
                      {format(new Date(item.year, item.month, 1), 'MMM yyyy', { locale: pt })}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                  {selectedList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelected(new Set())}
                      className="text-xs text-muted-foreground hover:text-foreground underline ml-1"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            variant="gold"
            onClick={handlePrint}
            disabled={isGenerating || selectedList.length === 0}
            className="w-full sm:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />A gerar...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4 mr-2" />
                Gerar e Imprimir
                {selectedList.length > 0 && ` (${selectedList.length})`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CalendarPrintDialog;
