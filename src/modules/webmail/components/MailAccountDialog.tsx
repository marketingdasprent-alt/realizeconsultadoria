import React, { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, PenLine, Plug, Settings2, type LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/modules/workspace/components/ConfirmDialog';
import { cleanSignatures } from '../lib/signatures';
import { providerOf } from '../lib/providers';
import type { MailAccount, MailSignature } from '../types';
import { ConnectionTab, GeneralTab, NoticesTab, type AccountForm } from './AccountSettingsTabs';
import { SignaturesManager } from './SignaturesManager';

interface MailAccountDialogProps {
  account: MailAccount | null;
  onClose: () => void;
  onSave: (
    id: string,
    patch: Pick<MailAccount, 'displayName' | 'label' | 'isDefault' | 'color' | 'notify'>
  ) => Promise<boolean>;
  onSaveSignatures: (id: string, signatures: MailSignature[]) => Promise<boolean>;
  onReconnect: (account: MailAccount) => void;
  onDisconnect: (account: MailAccount) => Promise<void>;
}

type Tab = 'general' | 'signatures' | 'notices' | 'connection';
const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'general', label: 'Geral', icon: Settings2 },
  { key: 'signatures', label: 'Assinaturas', icon: PenLine },
  { key: 'notices', label: 'Avisos', icon: BellRing },
  { key: 'connection', label: 'Ligação', icon: Plug },
];

/**
 * Definições de uma caixa, em separadores, numa janela de tamanho fixo (não muda de tamanho ao
 * trocar de separador nem ao escrever): geral, assinaturas, avisos e ligação.
 */
export const MailAccountDialog: React.FC<MailAccountDialogProps> = ({
  account,
  onClose,
  onSave,
  onSaveSignatures,
  onReconnect,
  onDisconnect,
}) => {
  const [tab, setTab] = useState<Tab>('general');
  const [form, setForm] = useState<AccountForm>({
    displayName: '',
    label: '',
    color: 'violet',
    isDefault: false,
    notify: true,
  });
  const [signatures, setSignatures] = useState<MailSignature[]>([]);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!account) return;
    setTab('general');
    setForm({
      displayName: account.displayName ?? '',
      label: account.label ?? '',
      color: account.color,
      isDefault: account.isDefault,
      notify: account.notify,
    });
    setSignatures(account.signatures);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir outra caixa
  }, [account?.id]);

  if (!account) return null;
  const provider = providerOf(account.provider);
  // Fecha logo: a alteração aparece na hora e grava em fundo (avisa se falhar).
  const save = () => {
    void onSave(account.id, {
      displayName: account.shared ? account.displayName : form.displayName.trim() || null,
      label: form.label.trim().slice(0, 60) || null,
      color: form.color,
      isDefault: account.shared ? account.isDefault : form.isDefault,
      notify: form.notify,
    });
    void onSaveSignatures(account.id, cleanSignatures(signatures));
    onClose();
  };

  return (
    <>
      <Dialog open onOpenChange={open => !open && onClose()}>
        <DialogContent
          onInteractOutside={event => event.preventDefault()}
          className="flex h-[min(90vh,820px)] w-[min(96vw,1040px)] max-w-none flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-none sm:rounded-[28px]"
        >
          <header className="flex items-center gap-3 border-b border-rz-line px-6 py-4 pr-14">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rz-canvas">
              <provider.Logo />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-[17px] font-extrabold">
                {form.label.trim() || account.email}
              </DialogTitle>
              <DialogDescription className="truncate text-[12.5px] text-rz-muted">
                {account.email} · {provider.name}
              </DialogDescription>
            </div>
            {account.status !== 'active' && (
              <button
                type="button"
                onClick={() => setTab('connection')}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[12.5px] font-bold text-amber-800 ring-1 ring-amber-200"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Ver ligação
              </button>
            )}
          </header>

          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <nav
              className="flex shrink-0 gap-1 overflow-x-auto border-b border-rz-line p-2 md:w-52 md:flex-col md:border-b-0 md:border-r md:p-3"
              aria-label="Secções"
            >
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  aria-current={tab === key ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[14px] font-semibold',
                    tab === key ? 'bg-rz-primary-soft text-rz-primary' : 'hover:bg-rz-canvas'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {key === 'signatures' && signatures.length > 0 && (
                    <span className="ml-auto text-[12px] font-normal text-rz-muted">
                      {signatures.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="rz-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {tab === 'general' && <GeneralTab account={account} form={form} setForm={setForm} />}
              {tab === 'signatures' && (
                <SignaturesManager key={account.id} value={signatures} onChange={setSignatures} />
              )}
              {tab === 'notices' && <NoticesTab account={account} form={form} setForm={setForm} />}
              {tab === 'connection' && (
                <ConnectionTab
                  account={account}
                  onReconnect={() => onReconnect(account)}
                  onDisconnect={() => setConfirm(true)}
                />
              )}
            </div>
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-rz-line px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center rounded-full px-5 text-[14px] font-semibold text-rz-muted hover:bg-rz-canvas"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              className="inline-flex h-11 items-center rounded-full bg-rz-primary px-7 text-[14px] font-bold text-white"
            >
              Guardar
            </button>
          </footer>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        title="Desligar esta caixa?"
        description="O Realize deixa de ter acesso a esta caixa. Os emails continuam no seu fornecedor."
        confirmLabel="Desligar"
        onConfirm={() => {
          // Fecha logo: a caixa sai da lista na hora e o servidor confirma em fundo.
          void onDisconnect(account);
          onClose();
        }}
        onClose={() => setConfirm(false)}
      />
    </>
  );
};
