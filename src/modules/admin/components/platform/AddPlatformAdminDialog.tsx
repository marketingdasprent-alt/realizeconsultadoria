import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QueryState } from '../sharing/QueryState';
import { useSuperAdminCandidates } from '../../hooks/usePlatformTeam';

interface AddPlatformAdminDialogProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (userId: string) => void;
}

/** Escolhe, entre quem já administra uma empresa, quem passa a super administrador. */
export const AddPlatformAdminDialog: React.FC<AddPlatformAdminDialogProps> = ({
  open,
  busy,
  onClose,
  onConfirm,
}) => {
  const candidates = useSuperAdminCandidates(open);
  const [chosen, setChosen] = useState('');
  const list = candidates.data ?? [];
  const picked = list.find(item => item.user_id === chosen);

  // Fechar (cancelar, Esc ou depois de adicionar) limpa a escolha: ao reabrir não vem a anterior
  useEffect(() => {
    if (!open) setChosen('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={next => !next && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar super administrador</DialogTitle>
          <DialogDescription>
            Passa a ver e a gerir todas as empresas. Escolha entre quem já administra uma empresa.
          </DialogDescription>
        </DialogHeader>
        <QueryState
          isLoading={candidates.isLoading}
          error={candidates.error}
          isEmpty={list.length === 0}
          emptyTitle="Não há ninguém para adicionar"
          emptyHint="Só se pode promover quem já administra uma empresa."
          onRetry={() => candidates.refetch()}
        >
          <Select value={chosen} onValueChange={setChosen} disabled={busy}>
            <SelectTrigger aria-label="Pessoa">
              <SelectValue placeholder="Escolher uma pessoa" />
            </SelectTrigger>
            <SelectContent>
              {list.map(item => (
                <SelectItem key={item.user_id} value={item.user_id}>
                  {item.name} · {item.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {picked && (
            <p className="text-xs text-muted-foreground">Administra {picked.companies}.</p>
          )}
        </QueryState>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="gold"
            disabled={busy || !picked}
            onClick={() => onConfirm(chosen)}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
