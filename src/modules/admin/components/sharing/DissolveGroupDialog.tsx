import React, { useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useMembershipAction } from '../../hooks/useCompanyMembership';
import type { GroupOverview } from '../../lib/sharing';
import { sharingService } from '../../services/sharingService';
import { ReauthDialog } from './ReauthDialog';

interface DissolveGroupDialogProps {
  group: GroupOverview | null;
  onClose: () => void;
}

/** Dissolver um grupo: as empresas ficam sem grupo e as partilhas entre elas são revogadas. */
export const DissolveGroupDialog: React.FC<DissolveGroupDialogProps> = ({ group, onClose }) => {
  const action = useMembershipAction();
  const submitting = useRef(false);

  const confirm = async () => {
    // O ref apanha o duplo clique antes de o botão chegar a ficar desativado
    if (!group || submitting.current) return;
    submitting.current = true;
    try {
      const done = await action.run(
        () => sharingService.dissolveGroup(group.id),
        'Grupo dissolvido'
      );
      if (done) onClose();
    } finally {
      submitting.current = false;
    }
  };

  return (
    <AlertDialog open={!!group} onOpenChange={next => !next && !action.pending && onClose()}>
      <AlertDialogContent className="max-w-md">
        <ReauthDialog open={action.reauthOpen} onDone={action.finishReauth} />
        <AlertDialogHeader>
          <AlertDialogTitle>Dissolver {group?.name}?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              As partilhas entre as empresas deste grupo serão revogadas, nos dois sentidos. As
              empresas ficam sem grupo e o histórico mantém-se.
            </span>
            <span className="block">Para as juntar outra vez, é preciso criar um grupo novo.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={action.pending}>Cancelar</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={action.pending}>
            {action.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Dissolver grupo
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
