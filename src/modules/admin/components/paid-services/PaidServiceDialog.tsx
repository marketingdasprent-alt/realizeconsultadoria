import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  emptyPaidForm,
  paidFormFrom,
  validatePaidForm,
  type PaidForm,
  type PaidFormErrors,
} from '../../lib/paidServiceForm';
import type { PaidKind, PaidService } from '../../lib/paidServices';
import { PaidServiceFields } from './PaidServiceFields';

/** O que a janela abre: um serviço para editar ou um novo do tipo escolhido. */
export type PaidDialogTarget = { service: PaidService } | { kind: PaidKind } | null;

interface PaidServiceDialogProps {
  target: PaidDialogTarget;
  companies: { id: string; name: string }[];
  onClose: () => void;
  onSave: (form: PaidForm, existing: PaidService | null) => Promise<boolean>;
}

/**
 * Domínio, internet ou assinatura numa janela só, de tamanho fixo: data de início e ciclo,
 * e a próxima renovação calcula-se sozinha.
 */
export const PaidServiceDialog: React.FC<PaidServiceDialogProps> = ({
  target,
  companies,
  onClose,
  onSave,
}) => {
  const existing = target && 'service' in target ? target.service : null;
  const [form, setForm] = useState<PaidForm>(emptyPaidForm('subscription'));
  const [errors, setErrors] = useState<PaidFormErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!target) return;
    setForm('service' in target ? paidFormFrom(target.service) : emptyPaidForm(target.kind));
    setErrors({});
  }, [target]);

  const update = (patch: Partial<PaidForm>) => {
    setForm(current => ({ ...current, ...patch }));
    setErrors({});
  };

  const save = async () => {
    const found = validatePaidForm(form);
    if (Object.keys(found).length > 0) return setErrors(found);
    setBusy(true);
    try {
      if (await onSave(form, existing)) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={open => !open && !busy && onClose()}>
      <DialogContent className="flex h-[min(640px,90vh)] w-[min(620px,95vw)] max-w-none flex-col gap-0 overflow-hidden rounded-[28px] p-0 font-jakarta">
        <header className="shrink-0 border-b border-rz-line p-5 pr-12">
          <DialogTitle className="text-[18px] font-extrabold">
            {existing ? 'Editar serviço pago' : 'Novo serviço pago'}
          </DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Indique quando começou e de quanto em quanto tempo se paga.
          </DialogDescription>
        </header>
        <form
          id="paid-service-form"
          onSubmit={event => {
            event.preventDefault();
            if (!busy) void save();
          }}
          className="min-h-0 flex-1 overflow-y-auto p-5"
        >
          <PaidServiceFields
            form={form}
            errors={errors}
            existing={existing}
            companies={companies}
            update={update}
          />
        </form>
        <footer className="flex shrink-0 justify-end gap-2 border-t border-rz-line p-4">
          <Button variant="outline" className="rounded-full" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" form="paid-service-form" className="rounded-full" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
};
