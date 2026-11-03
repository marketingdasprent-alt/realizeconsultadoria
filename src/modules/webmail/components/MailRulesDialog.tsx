import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Folder, Loader2, Plus, Trash2, Workflow } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useMailRules } from '../hooks/useMailRules';
import { ACCOUNT_DOTS, accountName } from '../lib/mailFormat';
import type { MailAccount, MailRule } from '../types';
import { MailRuleForm, type RuleDraft } from './MailRuleForm';

interface MailRulesDialogProps {
  open: boolean;
  onClose: () => void;
  accounts: MailAccount[];
  /** Caixa à vista (null = a primeira). */
  accountId: string | null;
  /** Abre já o formulário com isto (ex.: "Criar regra para este remetente"). */
  prefill?: Partial<RuleDraft> | null;
}

const summary = (rule: MailRule) =>
  [
    rule.fromContains && `remetente com “${rule.fromContains}”`,
    rule.keyword && `palavra “${rule.keyword}”`,
  ]
    .filter(Boolean)
    .join(' e ');

/** Regras automáticas do Webmail: o que chega com tal remetente / palavra-chave vai para uma pasta. */
export const MailRulesDialog: React.FC<MailRulesDialogProps> = ({
  open,
  onClose,
  accounts,
  accountId,
  prefill,
}) => {
  const [account, setAccount] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { rules, save, toggle, remove } = useMailRules(account);

  useEffect(() => {
    if (!open) return;
    setAccount(
      accountId && accounts.some(a => a.id === accountId) ? accountId : (accounts[0]?.id ?? null)
    );
    setCreating(!!prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir
  }, [open]);

  const list = rules.data ?? [];
  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[28px] sm:max-w-lg sm:rounded-[28px]">
        <DialogTitle className="flex items-center gap-2 text-[18px] font-extrabold">
          <Workflow className="h-5 w-5 text-rz-primary" /> Regras automáticas
        </DialogTitle>
        <DialogDescription className="text-[13px]">
          O email que chega com este remetente ou palavra-chave vai logo para a pasta escolhida.
          Corre a cada 2 minutos, mesmo com o Realize fechado.
        </DialogDescription>

        {accounts.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {accounts.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setAccount(item.id);
                  setCreating(false);
                }}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold ring-1',
                  account === item.id
                    ? 'bg-rz-primary-soft text-rz-primary ring-rz-primary'
                    : 'bg-white text-rz-muted ring-rz-line hover:text-rz-ink'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', ACCOUNT_DOTS[item.color])} />
                {accountName(item)}
              </button>
            ))}
          </div>
        )}

        {rules.isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-rz-primary" />}
        {!rules.isLoading && list.length === 0 && !creating && (
          <p className="rounded-2xl bg-rz-canvas px-4 py-5 text-center text-[13.5px] text-rz-muted">
            Ainda não há regras nesta caixa.
          </p>
        )}
        <ul className="space-y-2">
          {list.map(rule => (
            <li key={rule.id} className="rounded-2xl bg-white p-3 ring-1 ring-rz-line">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 text-[13.5px]">
                  <p className="break-words font-semibold">Se {summary(rule)}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-rz-muted">
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    <Folder className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{rule.folderName}</span>
                    {rule.markRead && <span>· marcar como lido</span>}
                  </p>
                  {rule.lastError && (
                    <p className="mt-1 flex items-start gap-1.5 text-[12.5px] text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Não conseguiu mover (a pasta ainda existe?).
                    </p>
                  )}
                </div>
                <Switch
                  checked={rule.isActive}
                  onCheckedChange={() => toggle.mutate(rule)}
                  aria-label={rule.isActive ? 'Desligar regra' : 'Ligar regra'}
                />
                <button
                  type="button"
                  onClick={() => remove.mutate(rule)}
                  aria-label="Apagar regra"
                  title="Apagar regra"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        {account && creating ? (
          <MailRuleForm
            accountId={account}
            initial={prefill ?? undefined}
            isSaving={save.isPending}
            onCancel={() => setCreating(false)}
            onSave={(draft, folderName) =>
              save.mutate(
                {
                  rule: {
                    name: '',
                    fromContains: draft.fromContains.trim() || null,
                    keyword: draft.keyword.trim() || null,
                    folderId: draft.folderId,
                    folderName,
                    markRead: draft.markRead,
                  },
                  applyNow: draft.applyNow,
                },
                { onSuccess: () => setCreating(false) }
              )
            }
          />
        ) : (
          account && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-rz-primary px-5 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" /> Nova regra
            </button>
          )
        )}
      </DialogContent>
    </Dialog>
  );
};
