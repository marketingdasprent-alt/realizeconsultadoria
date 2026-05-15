import { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import {
  DISCOUNT_CATEGORIES,
  getCategoryColor,
  getCategoryLabel,
  type DiscountItem,
} from '@/modules/admin/services/employeeFinanceService';
import { cn } from '@/lib/utils';

const currencyFormatter = new Intl.NumberFormat('pt-PT', {
  style: 'currency',
  currency: 'EUR',
});

const formatCurrency = (value: number) => currencyFormatter.format(value || 0);

interface DiscountItemsPopoverProps {
  employeeId: string;
  employeeName: string;
  total: number;
  items: DiscountItem[];
  canEdit: boolean;
  onAdd: (payload: {
    category: string;
    description: string | null;
    amount: number;
  }) => Promise<{ success: boolean; error?: string }>;
  onRemove: (id: string) => Promise<{ success: boolean; error?: string }>;
}

const DiscountItemsPopover = ({
  employeeName,
  total,
  items,
  canEdit,
  onAdd,
  onRemove,
}: DiscountItemsPopoverProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<string>('adiantamento');
  const [newDescription, setNewDescription] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const resetForm = () => {
    setNewCategory('adiantamento');
    setNewDescription('');
    setNewAmount('');
  };

  const handleAdd = async () => {
    const amount = parseFloat(newAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Introduza um valor maior do que zero.',
        variant: 'destructive',
      });
      return;
    }
    setIsSaving(true);
    const result = await onAdd({
      category: newCategory,
      description: newDescription.trim() || null,
      amount,
    });
    setIsSaving(false);
    if (!result.success) {
      toast({
        title: 'Erro ao adicionar',
        description: result.error,
        variant: 'destructive',
      });
      return;
    }
    resetForm();
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    const result = await onRemove(id);
    setRemovingId(null);
    if (!result.success) {
      toast({
        title: 'Erro ao remover',
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded px-1 -mx-1"
          aria-label={`Detalhes do desconto de ${employeeName}`}
        >
          {formatCurrency(total)}
          {items.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">({items.length})</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Detalhe do Desconto</h4>
            <span className="text-sm font-bold">{formatCurrency(total)}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{employeeName}</p>
        </div>

        <div className="max-h-[280px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 px-3">
              Sem itens. Adicione abaixo.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map(item => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 py-2 px-3 text-sm hover:bg-muted/40"
                >
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] font-normal shrink-0 border-0',
                      getCategoryColor(item.category)
                    )}
                  >
                    {getCategoryLabel(item.category)}
                  </Badge>
                  <span className="flex-1 truncate text-xs text-muted-foreground">
                    {item.description || '—'}
                  </span>
                  <span className="font-medium text-sm tabular-nums">
                    {formatCurrency(Number(item.amount))}
                  </span>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => handleRemove(item.id)}
                      disabled={removingId === item.id}
                      aria-label="Remover item"
                    >
                      {removingId === item.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 text-destructive" />
                      )}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {canEdit && (
          <div className="p-3 border-t bg-muted/30 space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Adicionar item
            </p>
            <div className="flex flex-wrap gap-1">
              {DISCOUNT_CATEGORIES.map(cat => {
                const isSelected = newCategory === cat.value;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setNewCategory(cat.value)}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border transition-colors',
                      isSelected
                        ? cn(cat.badge, 'border-current font-semibold')
                        : 'bg-background hover:bg-muted border-input text-muted-foreground'
                    )}
                  >
                    <span className={cn('h-2 w-2 rounded-full', cat.dot)} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="Valor €"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              className="h-8 text-xs"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Input
              placeholder="Descrição (opcional)"
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              className="h-8 text-xs"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              className="w-full h-8"
              onClick={handleAdd}
              disabled={isSaving || !newAmount.trim()}
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-1" />
              )}
              Adicionar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default DiscountItemsPopover;
