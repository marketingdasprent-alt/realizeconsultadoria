import React from 'react';
import { AlertTriangle, Loader2, Menu, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MailChange } from '../hooks/useMailChanges';
import { useMailSelection } from '../hooks/useMailSelection';
import { ACCOUNT_DOTS, accountName, mailKey } from '../lib/mailFormat';
import { mailErrorText, type MailError } from '../services/mailService';
import type { MailAccount, MailSummary } from '../types';
import { MailBulkBar } from './MailBulkBar';
import { MailContextMenu, type ListMailAction } from './MailContextMenu';
import { findDoneLabel } from '../lib/doneLabel';
import { LabelChips } from './LabelChips';
import { LabelPicker } from './LabelPicker';
import { MailListItem } from './MailListItem';
import { MoveToFolder } from './MoveToFolder';
import type { MoveTarget } from '../hooks/useFolderActions';
import type { MailLabel } from '../types';

interface MailListProps {
  title: string;
  messages: MailSummary[];
  accounts: MailAccount[];
  activeKey: string | null;
  showAccount: boolean;
  /** Caixa + pasta + pesquisa: ao mudar, a seleção limpa-se. */
  selectionKey: string;
  search: string;
  onSearch: (value: string) => void;
  onOpen: (mail: MailSummary) => void;
  /** Duplo clique: abre o email numa janela própria (sem ele, o duplo clique não faz nada). */
  onOpenWindow?: (mail: MailSummary) => void;
  onToggleStar: (mail: MailSummary) => void;
  onTrash: (mail: MailSummary) => void;
  /** Ação sobre os emails selecionados. */
  onBulk: (mails: MailSummary[], kind: MailChange) => void;
  /** Mover emails (todos da mesma caixa) para uma pasta da pessoa. */
  onMove: (mails: MailSummary[], target: MoveTarget) => void;
  /** Criar regra para o remetente deste email. */
  onRule?: (mail: MailSummary) => void;
  /** Marcadores: todos por id (para as etiquetas), os de cada caixa e as ações. */
  labelsById?: Map<string, MailLabel>;
  labelsByAccount?: Record<string, MailLabel[]>;
  onLabel?: (mails: MailSummary[], label: MailLabel) => void;
  onManageLabels?: (accountId: string) => void;
  /** Responder, reencaminhar, criar tarefa/evento ou imprimir, a partir do menu do clique direito. */
  onAction?: (mail: MailSummary, action: ListMailAction) => void;
  onHover?: (mail: MailSummary | null) => void;
  onRefresh: () => void;
  onMenu: () => void;
  isLoading: boolean;
  isRefreshing: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  errors: Record<string, MailError>;
  className?: string;
}

/** Lista de emails (pesquisa, seleção, estrela, lixo e a cor da caixa na vista unificada). */
export const MailList: React.FC<MailListProps> = props => {
  const colorOf = new Map(props.accounts.map(a => [a.id, ACCOUNT_DOTS[a.color]]));
  const emailOf = new Map(props.accounts.map(a => [a.id, accountName(a)]));
  const selection = useMailSelection(props.messages, props.selectionKey);
  const onBulkOf = (mails: MailSummary[], kind: MailChange) => {
    props.onBulk(mails, kind);
    if (kind === 'trash') selection.clear();
  };
  const onBulk = (kind: MailChange) => onBulkOf(selection.selected, kind);
  const moveMails = (mails: MailSummary[], target: MoveTarget) => {
    props.onMove(mails, target);
    selection.clear();
  };
  const oneAccount = new Set(selection.selected.map(m => m.accountId)).size === 1;
  return (
    <section className={cn('flex min-h-0 flex-col bg-white', props.className)} aria-label="Emails">
      <div className="space-y-3 px-4 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onMenu}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-rz-canvas lg:hidden"
            aria-label="Caixas e pastas"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h1 className="flex-1 truncate text-[22px] font-extrabold">{props.title}</h1>
          <button
            type="button"
            onClick={props.onRefresh}
            className="flex h-9 w-9 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas"
            aria-label="Atualizar"
          >
            <RefreshCw className={cn('h-4 w-4', props.isRefreshing && 'animate-spin')} />
          </button>
        </div>
        <MailBulkBar
          count={selection.count}
          allSelected={selection.allSelected}
          allStarred={selection.selected.every(m => m.starred)}
          hasMessages={props.messages.length > 0}
          onToggleAll={selection.toggleAll}
          onAction={onBulk}
          onClear={selection.clear}
          moveSlot={
            selection.count > 0 && oneAccount ? (
              <>
                {props.onLabel && (
                  <LabelPicker
                    mails={selection.selected}
                    labels={props.labelsByAccount?.[selection.selected[0]?.accountId] ?? []}
                    onToggle={(mails, label) => {
                      props.onLabel?.(mails, label);
                    }}
                    onManage={id => props.onManageLabels?.(id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
                  />
                )}
                <MoveToFolder
                  mails={selection.selected}
                  accounts={props.accounts}
                  onMove={moveMails}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
                />
              </>
            ) : null
          }
        >
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-rz-canvas px-4 text-rz-muted focus-within:ring-2 focus-within:ring-rz-primary/30">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={props.search}
              onChange={event => props.onSearch(event.target.value)}
              placeholder="Pesquisar emails"
              className="w-full bg-transparent text-sm text-rz-ink outline-none"
            />
          </label>
        </MailBulkBar>
        {Object.entries(props.errors).map(([accountId, error]) => (
          <p
            key={accountId}
            className="flex gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900 ring-1 ring-amber-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>{emailOf.get(accountId)}</b>: {mailErrorText(error) || 'Erro ao carregar.'}
            </span>
          </p>
        ))}
      </div>

      <ul className="rz-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-28 md:pb-4">
        {props.isLoading && (
          <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin text-rz-primary" />
        )}
        {!props.isLoading && props.messages.length === 0 && (
          <p className="mt-12 text-center text-sm text-rz-muted">Nenhum email aqui.</p>
        )}
        {props.messages.map(mail => {
          const key = mailKey(mail);
          // Clique direito num email dentro da seleção atua em todos os selecionados (da mesma caixa)
          const group =
            selection.isSelected(key) && selection.count > 1 && oneAccount
              ? selection.selected
              : [mail];
          return (
            <MailListItem
              key={key}
              quickDone={(() => {
                const done = props.onLabel
                  ? findDoneLabel(props.labelsByAccount?.[mail.accountId])
                  : undefined;
                return done
                  ? {
                      done: !!mail.labelIds?.includes(done.id),
                      name: done.name,
                      onToggle: () => props.onLabel?.([mail], done),
                    }
                  : undefined;
              })()}
              chips={
                props.labelsById ? (
                  <LabelChips labelIds={mail.labelIds} byId={props.labelsById} />
                ) : undefined
              }
              wrap={row => (
                <MailContextMenu
                  mail={mail}
                  targets={group}
                  accounts={props.accounts}
                  onOpen={props.onOpen}
                  onOpenWindow={props.onOpenWindow}
                  onChange={onBulkOf}
                  onMove={moveMails}
                  onRule={props.onRule}
                  labels={props.labelsByAccount?.[mail.accountId]}
                  onLabel={props.onLabel}
                  onManageLabels={props.onManageLabels}
                  onAction={props.onAction}
                >
                  {row}
                </MailContextMenu>
              )}
              mail={mail}
              dragGroup={group}
              isActive={props.activeKey === mailKey(mail)}
              isSelected={selection.isSelected(mailKey(mail))}
              selecting={selection.count > 0}
              accountDot={props.showAccount ? colorOf.get(mail.accountId) : undefined}
              accountName={props.showAccount ? emailOf.get(mail.accountId) : undefined}
              onOpen={props.onOpen}
              onOpenWindow={props.onOpenWindow}
              onSelect={(target, range) => selection.toggle(mailKey(target), range)}
              onToggleStar={props.onToggleStar}
              onTrash={props.onTrash}
              onHover={props.onHover}
            />
          );
        })}
        {props.hasMore && (
          <li className="py-3 text-center">
            <button
              type="button"
              onClick={props.onLoadMore}
              disabled={props.isLoadingMore}
              className="h-9 rounded-full bg-rz-canvas px-4 text-[13px] font-bold text-rz-primary"
            >
              {props.isLoadingMore ? 'A carregar…' : 'Carregar mais'}
            </button>
          </li>
        )}
      </ul>
    </section>
  );
};
