import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MfaCodeForm } from '@/modules/auth/components/MfaCodeForm';
import { mfaErrorMessage } from '@/modules/auth/lib/mfa';
import { mfaService } from '@/modules/auth/services/mfaService';

interface MfaConfirmDialogProps {
  open: boolean;
  /** `true` quando o código foi confirmado; `false` se a pessoa desistiu. */
  onDone: (ok: boolean) => void;
}

/** Pede o código da aplicação de autenticação: gerir super admins exige o segundo passo. */
export const MfaConfirmDialog: React.FC<MfaConfirmDialogProps> = ({ open, onDone }) => {
  const status = useQuery({
    queryKey: ['auth', 'mfa-status'],
    queryFn: mfaService.status,
    enabled: open,
    staleTime: 0,
    retry: false,
  });
  const factor = status.data?.active ?? null;
  // Enquanto o código está a ser verificado não se fecha (a sessão podia subir a aal2 sem ninguém ver).
  const [verifying, setVerifying] = useState(false);

  return (
    <Dialog open={open} onOpenChange={next => !next && !verifying && onDone(false)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-rz-primary" aria-hidden />
            Confirme com o autenticador
          </DialogTitle>
          <DialogDescription>
            Introduza o código de 6 dígitos da aplicação de autenticação.
          </DialogDescription>
        </DialogHeader>
        {status.isLoading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-rz-primary" aria-hidden />
        ) : status.isError ? (
          <div role="alert" className="space-y-3 text-sm">
            <p>Não foi possível verificar o segundo passo.</p>
            <Button type="button" variant="outline" onClick={() => void status.refetch()}>
              Tentar outra vez
            </Button>
          </div>
        ) : factor ? (
          <MfaCodeForm
            submitLabel="Confirmar"
            onSubmit={async code => {
              setVerifying(true);
              try {
                await mfaService.verify(factor.id, code);
                onDone(true);
                return null;
              } catch (error) {
                return mfaErrorMessage(error);
              } finally {
                setVerifying(false);
              }
            }}
          />
        ) : (
          <p role="alert" className="text-sm text-muted-foreground">
            Esta conta ainda não tem o segundo passo. Ative-o em{' '}
            <Link
              to="/colaborador/definicoes"
              onClick={() => onDone(false)}
              className="font-semibold text-rz-primary underline"
            >
              Definições
            </Link>{' '}
            e volte a entrar.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
