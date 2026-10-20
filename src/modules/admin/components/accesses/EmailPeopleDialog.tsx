import React, { useEffect, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { Credential, CredentialCompany, CredentialEmployee } from '../../lib/credentials';
import { PeoplePicker } from './panel/PeoplePicker';

export interface EmailPeopleValue {
  /** Só no email pessoal: de quem é a caixa. */
  ownerId: string | null;
  people: string[];
}

interface EmailPeopleDialogProps {
  credential: Credential | null;
  department: boolean;
  shares: string[];
  employees: CredentialEmployee[];
  companies: CredentialCompany[];
  onClose: () => void;
  onSave: (credential: Credential, value: EmailPeopleValue) => Promise<void>;
}

const Section: React.FC<{ title: string; hint: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <section className="space-y-2">
    <div>
      <h3 className="text-[13.5px] font-bold text-rz-ink">{title}</h3>
      <p className="text-[12px] text-rz-muted">{hint}</p>
    </div>
    {children}
  </section>
);

/** Quem vê a caixa no Webmail: o dono (email pessoal) e as pessoas com quem é partilhada. */
export const EmailPeopleDialog: React.FC<EmailPeopleDialogProps> = ({
  credential,
  department,
  shares,
  employees,
  companies,
  onClose,
  onSave,
}) => {
  const [owner, setOwner] = useState<string[]>([]);
  const [people, setPeople] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!credential) return;
    setOwner(credential.employee_id ? [credential.employee_id] : []);
    setPeople(shares.filter(id => id !== credential.employee_id));
    // Só ao abrir (a lista recarrega por trás depois de gravar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credential?.id]);

  const save = async () => {
    if (!credential) return;
    setBusy(true);
    try {
      await onSave(credential, { ownerId: department ? null : (owner[0] ?? null), people });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!credential} onOpenChange={open => !open && !busy && onClose()}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-[28px] p-0 font-jakarta">
        <div className="flex items-center gap-3 border-b border-rz-line p-5 pr-12">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rz-primary-soft text-rz-primary">
            <Mail className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="truncate text-[17px] font-extrabold">
              {credential?.username}
            </DialogTitle>
            <DialogDescription className="text-[12.5px]">
              {department ? 'Email departamental' : 'Email pessoal'} · quem estiver aqui (com conta
              na app) vê a caixa no Webmail
            </DialogDescription>
          </div>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto p-5">
          {!department && (
            <Section title="Dono" hint="O colaborador a quem pertence este email.">
              <PeoplePicker
                employees={employees}
                companies={companies}
                value={owner}
                onChange={setOwner}
                preferCompanyId={credential?.company_id}
                max={1}
                placeholder="Escolher o dono — escreva o nome"
              />
            </Section>
          )}
          <Section
            title={department ? 'Pessoas' : 'Também têm acesso'}
            hint={
              department
                ? 'Quem partilha esta caixa.'
                : 'Outras pessoas que também veem esta caixa (ex.: quem a acompanha nas férias).'
            }
          >
            <PeoplePicker
              employees={employees.filter(e => !owner.includes(e.id))}
              companies={companies}
              value={people}
              onChange={setPeople}
              preferCompanyId={credential?.company_id}
            />
          </Section>
        </div>

        <div className="flex justify-end gap-2 border-t border-rz-line p-4">
          <Button variant="outline" className="rounded-full" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button className="rounded-full" onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar e ligar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
