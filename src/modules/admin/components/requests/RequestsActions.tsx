import React from 'react';
import { ChevronDown, Plus, Printer, RefreshCw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface RequestsActionsProps {
  canPrint: boolean;
  isFetching: boolean;
  onAdd: () => void;
  onBulk: () => void;
  onPrint: (mode: 'full' | 'saldo') => void;
  onRefresh: () => void;
}

/** Adicionar, marcar em massa, imprimir e atualizar (à direita das abas). */
export const RequestsActions: React.FC<RequestsActionsProps> = ({
  canPrint,
  isFetching,
  onAdd,
  onBulk,
  onPrint,
  onRefresh,
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <Button variant="gold" className="rounded-full" onClick={onAdd}>
      <Plus className="h-4 w-4" />
      Adicionar
    </Button>
    <Button variant="outline" className="rounded-full" onClick={onBulk}>
      <Users className="h-4 w-4" />
      Marcar em massa
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="rounded-full" disabled={!canPrint}>
          <Printer className="h-4 w-4" />
          Imprimir
          <ChevronDown className="h-3 w-3 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[260px]">
        <DropdownMenuItem onClick={() => onPrint('full')}>
          <div className="flex flex-col">
            <span>Relatório de pedidos</span>
            <span className="text-[11px] text-muted-foreground">
              A lista filtrada, por categoria
            </span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPrint('saldo')}>
          <div className="flex flex-col">
            <span>Saldo de férias</span>
            <span className="text-[11px] text-muted-foreground">
              Só a tabela de saldo por colaborador
            </span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Button
      variant="outline"
      size="icon"
      className="rounded-full"
      onClick={onRefresh}
      title="Atualizar"
      aria-label="Atualizar"
    >
      <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
    </Button>
  </div>
);
