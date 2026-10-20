import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { CredentialsData } from '../../../services/credentialService';
import { AccessPanelFields } from './AccessPanelFields';
import { KindPicker } from './KindPicker';
import { useAccessForm, type AccessPanelTarget } from './useAccessForm';

interface AccessPanelProps {
  target: AccessPanelTarget | null;
  data: CredentialsData;
  onClose: () => void;
  onSaved: () => void;
}

const OUTCOME = {
  ok: { icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-800' },
  warn: { icon: Info, className: 'bg-amber-50 text-amber-900' },
  error: { icon: AlertTriangle, className: 'bg-rose-50 text-rose-800' },
};

/**
 * Novo acesso / editar, num painel lateral: primeiro o tipo, depois os campos desse tipo.
 * Nos emails, ao guardar testa o login e liga a caixa ao Webmail — e diz como correu.
 */
export const AccessPanel: React.FC<AccessPanelProps> = ({ target, data, onClose, onSaved }) => {
  const open = !!target;
  const { form, update, errors, phase, outcome, isEmail, domain, save } = useAccessForm(
    open,
    target,
    data,
    onSaved
  );
  const editing = !!target?.credential;
  const busy = phase === 'saving' || phase === 'linking';
  const result = outcome ? OUTCOME[outcome.tone] : null;
  const ResultIcon = result?.icon;

  return (
    <Sheet open={open} onOpenChange={next => !next && !busy && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 font-jakarta sm:max-w-lg">
        <SheetHeader className="border-b border-rz-line p-5 text-left">
          <SheetTitle className="text-[19px] font-extrabold">
            {editing ? 'Editar acesso' : 'Novo acesso'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <KindPicker value={form.kind} onChange={kind => update({ kind })} />
          <AccessPanelFields
            form={form}
            errors={errors}
            data={data}
            domain={domain}
            isEmail={isEmail}
            update={update}
          />
        </div>

        <div className="space-y-3 border-t border-rz-line p-4">
          {outcome && result && ResultIcon && (
            <p
              className={cn('flex items-start gap-2 rounded-xl p-3 text-[13px]', result.className)}
            >
              <ResultIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {outcome.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-full" onClick={onClose} disabled={busy}>
              {phase === 'done' ? 'Fechar' : 'Cancelar'}
            </Button>
            <Button className="rounded-full" onClick={() => void save()} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {phase === 'linking'
                ? 'A ligar a caixa…'
                : phase === 'done'
                  ? 'Guardar outra vez'
                  : isEmail
                    ? 'Guardar e ligar'
                    : 'Guardar'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
