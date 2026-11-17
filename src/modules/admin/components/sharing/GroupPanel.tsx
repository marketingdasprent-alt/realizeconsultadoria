import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useGroup } from '../../hooks/useSharing';
import { useSharingAction } from '../../hooks/useSharingAction';
import { sharingService } from '../../services/sharingService';
import { QueryState } from './QueryState';
import { ReauthDialog } from './ReauthDialog';

/** O grupo de empresas ligadas. Sair retira todas as partilhas com as outras empresas do grupo. */
export const GroupPanel: React.FC<{ company: string }> = ({ company }) => {
  const query = useGroup(company);
  const action = useSharingAction();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const members = query.data ?? [];

  const leave = async () => {
    setConfirmLeave(false);
    await action.run(() => sharingService.leaveGroup(company), 'A sua empresa saiu do grupo');
  };

  return (
    <div className="space-y-4">
      <QueryState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={members.length === 0}
        emptyTitle="A sua empresa não está em nenhum grupo"
        emptyHint="O grupo nasce quando um pedido de ligação entre duas empresas é aprovado."
        onRetry={() => query.refetch()}
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {members.map(member => (
            <li
              key={member.company_id}
              className="flex items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{member.name}</p>
                <p className="text-xs text-muted-foreground">
                  Desde {new Date(member.joined_at).toLocaleDateString('pt-PT')}
                </p>
              </div>
              {member.is_me && <Badge>A sua empresa</Badge>}
            </li>
          ))}
        </ul>
        <Button variant="outline" onClick={() => setConfirmLeave(true)} disabled={action.pending}>
          {action.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sair do grupo
        </Button>
      </QueryState>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as partilhas entre a sua empresa e as outras do grupo são retiradas, nos dois
              sentidos. Para voltar, é preciso um pedido novo, aprovado pela outra empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ficar no grupo</AlertDialogCancel>
            <AlertDialogAction onClick={leave}>Sair do grupo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ReauthDialog open={action.reauthOpen} onDone={action.finishReauth} />
    </div>
  );
};
