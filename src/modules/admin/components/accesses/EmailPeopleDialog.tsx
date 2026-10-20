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
import type { Credential, CredentialEmployee } from '../../lib/credentials';
import { PeoplePicker } from './panel/PeoplePicker';

interface EmailPeopleDialogProps {
  credential: Credential | null;
  current: string[];
  employees: CredentialEmployee[];
  onClose: () => void;
  onSave: (credential: Credential, people: string[]) => Promise<void>;
}

/** Quem tem um email departamental no Webmail (juntar/tirar pessoas e ligar logo). */
export const EmailPeopleDialog: React.FC<EmailPeopleDialogProps> = ({
  credential,
  current,
  employees,
  onClose,
  onSave,
}) => {
  const [people, setPeople] = useState<string[]>(current);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (credential) setPeople(current);
    // Só ao abrir (a lista recarrega por trás depois de gravar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credential?.id]);

  const save = async () => {
    if (!credential) return;
    setBusy(true);
    try {
      await onSave(credential, people);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!credential} onOpenChange={open => !open && !busy && onClose()}>
      <DialogContent className="max-w-md font-jakarta">
        <DialogHeader>
          <DialogTitle>Pessoas · {credential?.username}</DialogTitle>
          <DialogDescription>
            Quem estiver aqui (e tiver conta na app) vê esta caixa no Webmail.
          </DialogDescription>
        </DialogHeader>
        <PeoplePicker
          employees={employees.filter(
            e => e.company_id === credential?.company_id || people.includes(e.id)
          )}
          value={people}
          onChange={setPeople}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar e ligar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
