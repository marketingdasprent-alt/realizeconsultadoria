import React from 'react';
import { Filter, Settings2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { useMailDrop } from '../hooks/useMailDrop';
import { labelStyle } from '../lib/labelColors';
import { ACCOUNT_DOTS, SIDEBAR_ROW, accountName } from '../lib/mailFormat';
import type { MailAccount, MailLabel, MailSummary } from '../types';

export interface LabelFilter {
  accountId: string;
  labelId: string;
}

interface MailLabelsSectionProps {
  accounts: MailAccount[];
  /** Caixa à vista ("all" = todas, cada uma com o seu título). */
  scope: string;
  byAccount: Record<string, MailLabel[]>;
  selected: LabelFilter | null;
  /** Quantos emails tem cada marcador (id → número). */
  counts?: Record<string, number>;
  onPick: (filter: LabelFilter | null) => void;
  onManage?: (accountId: string | null) => void;
  /** Emails largados em cima de um marcador (arrastar da lista). */
  onDropMails?: (mails: MailSummary[], label: MailLabel) => void;
}

/** Marcadores na barra lateral: carregar num deixa só os emails com essa cor (na pasta à vista). */
export const MailLabelsSection: React.FC<MailLabelsSectionProps> = ({
  accounts,
  scope,
  byAccount,
  selected,
  counts,
  onPick,
  onManage,
  onDropMails,
}) => {
  const drop = useMailDrop();
  const shown = accounts.filter(
    a => (scope === 'all' || a.id === scope) && byAccount[a.id]?.length
  );
  if (!shown.length && !onManage) return null;

  return (
    <section>
      <div className="mb-1 flex items-center justify-between px-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-rz-muted">
          Marcadores
        </p>
        {onManage && (
          <button
            type="button"
            onClick={() => onManage(scope === 'all' ? null : scope)}
            aria-label="Gerir marcadores"
            title="Gerir marcadores"
            className="flex h-6 w-6 items-center justify-center rounded-full text-rz-muted hover:bg-white hover:text-rz-primary"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {!shown.length && (
        <p className="px-3 pb-1 text-[12.5px] text-rz-muted">
          Crie marcadores coloridos (ex.: Por tratar, Tratado).
        </p>
      )}
      {shown.map(account => (
        <div key={account.id} className="mb-1">
          {scope === 'all' && (
            <p className="flex items-center gap-2 px-3 pb-0.5 pt-1.5 text-[12px] font-semibold text-rz-muted">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', ACCOUNT_DOTS[account.color])} />
              <span className="truncate">{accountName(account)}</span>
            </p>
          )}
          <ul>
            {byAccount[account.id].map(label => {
              const active = selected?.labelId === label.id;
              return (
                <li key={label.id}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={() =>
                          onPick(active ? null : { accountId: account.id, labelId: label.id })
                        }
                        aria-pressed={active}
                        className={cn(
                          SIDEBAR_ROW,
                          active ? 'bg-rz-primary-soft text-rz-primary' : 'hover:bg-white/70',
                          drop.overKey === label.id && 'bg-rz-primary-soft ring-2 ring-rz-primary'
                        )}
                        {...(onDropMails
                          ? drop.bind(label.id, account.id, mails => onDropMails(mails, label))
                          : {})}
                      >
                        <span
                          className={cn(
                            'ml-0.5 h-3 w-3 shrink-0 rounded-full',
                            labelStyle(label.color).dot
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate text-left">{label.name}</span>
                        {!!counts?.[label.id] && (
                          <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-rz-muted">
                            {counts[label.id]}
                          </span>
                        )}
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-52">
                      <ContextMenuItem
                        onSelect={() =>
                          onPick(active ? null : { accountId: account.id, labelId: label.id })
                        }
                      >
                        <Filter className="mr-2 h-4 w-4" />{' '}
                        {active ? 'Mostrar todos os emails' : 'Ver só este marcador'}
                      </ContextMenuItem>
                      {onManage && (
                        <>
                          <ContextMenuSeparator />
                          <ContextMenuItem onSelect={() => onManage(account.id)}>
                            <Settings2 className="mr-2 h-4 w-4" /> Editar ou apagar…
                          </ContextMenuItem>
                        </>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
};
