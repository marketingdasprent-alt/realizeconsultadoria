import React, { useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCapabilities } from '../../hooks/useSharing';
import { useSharingAction } from '../../hooks/useSharingAction';
import { REQUEST_SUBMITTED_NOTICE, normalizeShareCode, type Capability } from '../../lib/sharing';
import { sharingService } from '../../services/sharingService';
import { CapabilityPicker } from './CapabilityPicker';
import { QueryState } from './QueryState';
import { ReauthDialog } from './ReauthDialog';

/** "Ligar a outra empresa": o código da outra empresa e o que se pede e/ou oferece. */
export const RequestShareDialog: React.FC<{ company: string }> = ({ company }) => {
  const catalog = useCapabilities();
  const action = useSharingAction();
  const [open, setOpen] = useState(false);
  const [rawCode, setRawCode] = useState('');
  const [ask, setAsk] = useState<string[]>([]);
  const [offer, setOffer] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);

  const { code, valid } = normalizeShareCode(rawCode);
  const hasSomething = ask.length + offer.length > 0;

  const reset = () => {
    setRawCode('');
    setAsk([]);
    setOffer([]);
    setTouched(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!valid || !hasSomething) return;
    const done = await action.run(
      () => sharingService.requestShare(company, code, { ask, offer }),
      'Pedido enviado'
    );
    if (done) {
      reset();
      setOpen(false);
    }
  };

  const data: readonly Capability[] = catalog.data ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="gold">
          <Link2 className="mr-2 h-4 w-4" />
          Ligar a outra empresa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <form onSubmit={submit} className="space-y-5" noValidate>
          <DialogHeader>
            <DialogTitle>Ligar a outra empresa</DialogTitle>
            <DialogDescription>{REQUEST_SUBMITTED_NOTICE}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="share-code">Código da outra empresa</Label>
            <Input
              id="share-code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ABCDE FGHJK"
              value={rawCode}
              onChange={e => setRawCode(e.target.value)}
              aria-invalid={touched && !valid}
              aria-describedby="share-code-hint"
              className="uppercase tracking-widest"
            />
            <p
              id="share-code-hint"
              className={
                touched && !valid ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'
              }
            >
              {touched && !valid
                ? 'O código tem 10 letras e números (sem I, O, 0 nem 1).'
                : 'Peça o código ao administrador da outra empresa.'}
            </p>
          </div>

          <QueryState
            isLoading={catalog.isLoading}
            error={catalog.error}
            isEmpty={data.length === 0}
            emptyTitle="Não há permissões para partilhar"
            onRetry={() => catalog.refetch()}
          >
            <section className="space-y-2">
              <h3 className="font-semibold">O que quer ver da outra empresa</h3>
              <CapabilityPicker idPrefix="ask" catalog={data} value={ask} onChange={setAsk} />
            </section>
            <section className="space-y-2">
              <h3 className="font-semibold">O que oferece à outra empresa</h3>
              <p className="text-sm text-muted-foreground">
                Ao enviar, já está a aprovar a sua parte. Só passa a valer quando a outra empresa
                aprovar.
              </p>
              <CapabilityPicker idPrefix="offer" catalog={data} value={offer} onChange={setOffer} />
            </section>
          </QueryState>
          {touched && !hasSomething && (
            <p role="alert" className="text-sm text-destructive">
              Escolha pelo menos uma permissão para pedir ou oferecer.
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={action.pending}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="gold" disabled={action.pending || data.length === 0}>
              {action.pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar pedido
            </Button>
          </DialogFooter>
        </form>
        <ReauthDialog open={action.reauthOpen} onDone={action.finishReauth} />
      </DialogContent>
    </Dialog>
  );
};
