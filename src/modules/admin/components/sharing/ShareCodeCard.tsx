import React, { useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { useShareCode } from '../../hooks/useSharing';
import { useSharingAction } from '../../hooks/useSharingAction';
import { formatShareCode } from '../../lib/sharing';
import { sharingService } from '../../services/sharingService';
import { QueryState } from './QueryState';
import { ReauthDialog } from './ReauthDialog';

/** O código da empresa: quem o souber pode pedir ligação. Rodar invalida o código antigo. */
export const ShareCodeCard: React.FC<{ company: string }> = ({ company }) => {
  const { toast } = useToast();
  const query = useShareCode(company);
  const action = useSharingAction();
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!query.data) return;
    try {
      await navigator.clipboard.writeText(query.data.share_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Não foi possível copiar',
        description: 'Selecione o código e copie à mão.',
        variant: 'destructive',
      });
    }
  };

  const rotate = async () => {
    setConfirmRotate(false);
    await action.run(() => sharingService.rotateShareCode(company), 'Código novo criado');
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">Código da sua empresa</CardTitle>
        <CardDescription>
          Dê este código ao administrador de outra empresa para ela lhe pedir ligação. O código
          sozinho não dá acesso a nada: cada pedido tem de ser aprovado por si.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryState
          isLoading={query.isLoading}
          error={query.error}
          isEmpty={!query.data}
          emptyTitle="Sem código"
          onRetry={() => query.refetch()}
        >
          <div className="flex flex-wrap items-center gap-3">
            <code
              className="select-all rounded-md bg-muted px-4 py-2 text-xl font-semibold tracking-widest"
              aria-label="Código da empresa"
            >
              {formatShareCode(query.data?.share_code ?? '')}
            </code>
            <Button variant="outline" onClick={copy}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmRotate(true)}
              disabled={action.pending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Gerar código novo
            </Button>
          </div>
        </QueryState>
      </CardContent>

      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar um código novo?</AlertDialogTitle>
            <AlertDialogDescription>
              O código atual deixa de servir para pedidos novos. As partilhas e os pedidos que já
              existem não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={rotate}>Gerar código novo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <ReauthDialog open={action.reauthOpen} onDone={action.finishReauth} />
    </Card>
  );
};
