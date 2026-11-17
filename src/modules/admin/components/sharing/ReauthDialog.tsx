import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { sharingErrorText } from '../../lib/sharing';
import { sharingService } from '../../services/sharingService';

interface ReauthDialogProps {
  open: boolean;
  /** `true` quando a palavra-passe foi confirmada; `false` se a pessoa desistiu. */
  onDone: (ok: boolean) => void;
}

/** Pede a palavra-passe outra vez: partilhar dados sensíveis exige um login recente. */
export const ReauthDialog: React.FC<ReauthDialogProps> = ({ open, onDone }) => {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = (ok: boolean) => {
    setPassword('');
    setError(null);
    onDone(ok);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user?.email || !password) return;
    setBusy(true);
    setError(null);
    try {
      await sharingService.reauthenticate(user.email, password);
      close(true);
    } catch (e) {
      setError(sharingErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => !next && !busy && close(false)}>
      <DialogContent className="max-w-sm">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Confirme a sua palavra-passe</DialogTitle>
            <DialogDescription>
              Esta partilha dá acesso a dados sensíveis. Por segurança, confirme que é você.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reauth-password">Palavra-passe</Label>
            <Input
              id="reauth-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? 'reauth-error' : undefined}
            />
            {error && (
              <p id="reauth-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={busy || !password}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
