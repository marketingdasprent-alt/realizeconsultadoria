import React, { useEffect, useState } from 'react';
import { AlertTriangle, BellRing, RefreshCw, Unplug, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/modules/workspace/components/ConfirmDialog';
import { ACCOUNT_DOTS } from '../lib/mailFormat';
import { sanitizeSignatureHtml } from '../lib/signature';
import { providerOf } from '../lib/providers';
import type { MailAccount, MailAccountColor } from '../types';
import { SignatureEditor } from './SignatureEditor';

const FIELD =
  'w-full rounded-2xl bg-rz-canvas px-4 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40';
const LABEL = 'mb-1.5 block text-[13px] font-bold';
const COLORS = Object.keys(ACCOUNT_DOTS) as MailAccountColor[];

interface MailAccountDialogProps {
  account: MailAccount | null;
  onClose: () => void;
  onSave: (
    id: string,
    patch: Pick<MailAccount, 'displayName' | 'signature' | 'isDefault' | 'color' | 'notify'>
  ) => Promise<boolean>;
  onReconnect: (account: MailAccount) => void;
  onDisconnect: (account: MailAccount) => Promise<void>;
}

/**
 * Definições de uma caixa: nome, assinatura, cor, avisos de email novo, predefinida, voltar a
 * ligar e desligar.
 */
export const MailAccountDialog: React.FC<MailAccountDialogProps> = ({
  account,
  onClose,
  onSave,
  onReconnect,
  onDisconnect,
}) => {
  const [form, setForm] = useState({
    displayName: '',
    signature: '',
    color: 'violet' as MailAccountColor,
    isDefault: false,
    notify: true,
  });
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!account) return;
    setForm({
      displayName: account.displayName ?? '',
      signature: account.signature ?? '',
      color: account.color,
      isDefault: account.isDefault,
      notify: account.notify,
    });
  }, [account]);

  if (!account) return null;
  const provider = providerOf(account.provider);
  // Fecha logo: a alteração aparece na hora e grava em fundo (avisa se falhar).
  const save = () => {
    void onSave(account.id, {
      displayName: account.shared ? account.displayName : form.displayName.trim() || null,
      signature: sanitizeSignatureHtml(form.signature) || null,
      color: form.color,
      isDefault: account.shared ? account.isDefault : form.isDefault,
      notify: form.notify,
    });
    onClose();
  };

  return (
    <>
      <Dialog open onOpenChange={open => !open && onClose()}>
        <DialogContent
          onInteractOutside={event => event.preventDefault()}
          className="max-h-[92vh] overflow-y-auto rounded-[28px] sm:max-w-xl sm:rounded-[28px]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rz-canvas">
              <provider.Logo />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate text-[17px] font-extrabold">
                {account.email}
              </DialogTitle>
              <p className="text-[12.5px] text-rz-muted">{provider.name}</p>
            </div>
          </div>

          {account.shared && (
            <p className="flex gap-2 rounded-2xl bg-rz-primary-soft px-4 py-3 text-[13px]">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-rz-primary" />
              Caixa partilhada pela empresa: quem tem acesso e a ligação são geridos pelo
              administrador. A assinatura e a cor aqui são só suas.
            </p>
          )}

          {account.status !== 'active' && (
            <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">
                {account.status === 'reauth'
                  ? 'A autorização expirou.'
                  : (account.lastError ?? 'Houve um erro ao sincronizar.')}
              </span>
              {account.authMethod !== 'imap' && !account.shared && (
                <button
                  type="button"
                  onClick={() => onReconnect(account)}
                  className="flex items-center gap-1 font-bold"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Voltar a ligar
                </button>
              )}
            </div>
          )}

          <div className="space-y-4">
            {!account.shared && (
              <label className="block">
                <span className={LABEL}>Nome do remetente</span>
                <input
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className={cn(FIELD, 'h-11')}
                />
              </label>
            )}
            <div>
              <span className={LABEL}>Assinatura</span>
              <SignatureEditor
                key={account.id}
                initial={account.signature}
                onChange={signature => setForm(f => ({ ...f, signature }))}
              />
            </div>
            <div>
              <span className={LABEL}>Cor</span>
              <div className="flex gap-2">
                {COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color }))}
                    className={cn(
                      'h-8 w-8 rounded-full ring-offset-2',
                      ACCOUNT_DOTS[color],
                      form.color === color && 'ring-2 ring-rz-ink'
                    )}
                    aria-label={color}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-2xl bg-rz-canvas px-4 py-3">
              <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-rz-primary" />
              <span className="flex-1">
                <span className="block text-[14px] font-semibold">Avisar emails novos</span>
                <span className="block text-[12.5px] text-rz-muted">
                  Notificação no Realize e no telemóvel quando chega um email a esta caixa
                  {account.shared ? ' (só para si)' : ''}.
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={form.notify}
                onChange={e => setForm(f => ({ ...f, notify: e.target.checked }))}
                className="mt-1 h-5 w-5 accent-violet-600"
                aria-label="Avisar emails novos desta caixa"
              />
            </label>
            {!account.shared && (
              <label className="flex items-center gap-3 text-[14px] font-semibold">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                  className="h-5 w-5 accent-violet-600"
                />
                Caixa predefinida para escrever
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!account.shared && (
              <button
                type="button"
                onClick={() => setConfirm(true)}
                className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[13.5px] font-bold text-rose-600 hover:bg-rose-50"
              >
                <Unplug className="h-4 w-4" /> Desligar
              </button>
            )}
            <button
              type="button"
              onClick={save}
              className="ml-auto inline-flex h-11 items-center gap-2 rounded-full bg-rz-primary px-6 text-[14px] font-bold text-white disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
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
