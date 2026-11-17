import React from 'react';
import { MailSearchScope } from './MailSearchScope';
import type { AllFoldersInfo } from '../hooks/useMailbox';
import { AlertTriangle, Loader2, Menu, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MailChange } from '../hooks/useMailChanges';
import { useAutoLoadMore } from '../hooks/useAutoLoadMore';
import { useMailSelection } from '../hooks/useMailSelection';
import {
  filterEmptyText,
  filterKey,
  isFiltering,
  maxAutoPages,
  type ListFilter,
  type ListFilterKey,
} from '../lib/listFilter';
import { ACCOUNT_DOTS, accountName, mailKey } from '../lib/mailFormat';
import { mailErrorText, type MailError } from '../services/mailService';
import type { MailAccount, MailSummary } from '../types';
import { MailBulkBar } from './MailBulkBar';
import { MailContextMenu, type ListMailAction } from './MailContextMenu';
import { MailFilterBar } from './MailFilterBar';
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
  /** A última página pedida falhou. */
  loadMoreFailed: boolean;
  /** Páginas já carregadas (para o carregamento automático ao rolar). */
  pageCount: number;
  onLoadMore: () => void;
  /** Filtros ligados (não lidos, com estrela, com anexos) e como os mudar. */
  filter: ListFilter;
  onToggleFilter: (key: ListFilterKey) => void;
  onClearFilter: () => void;
  /** Filtros que não se podem ligar nesta pasta. */
  filterDisabled?: readonly ListFilterKey[];
  errors: Record<string, MailError>;
  /** Pesquisa em todas as pastas: a escolha, o que o servidor disse e o texto a mostrar. */
  searchScope?: {
    allFolders: boolean;
    onAllFolders: (value: boolean) => void;
    includeBody: boolean;
    onIncludeBody: (value: boolean) => void;
    /** A pesquisa em todas as pastas está a correr (2 ou mais letras). */
    active: boolean;
    info: AllFoldersInfo | null;
    folderLabel: string;
  };
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
  const filtering = isFiltering(props.filter);
  const inAllFolders = !!props.searchScope?.active;
  const allInfo = props.searchScope?.info ?? null;
  // Avisos da pesquisa em todas as pastas (servidor antigo, resultado cortado, tempo esgotado)
  const scopeInfo = !inAllFolders
    ? null
    : allInfo && !allInfo.supported
      ? 'O servidor ainda não pesquisa em todas as pastas: estão só os emails da pasta aberta.'
      : allInfo?.partial
        ? 'A pesquisa demorou demasiado e algumas pastas ficaram por procurar. Refine a pesquisa.'
        : allInfo?.truncated
          ? 'Mostram-se os 100 emails mais recentes. Refine a pesquisa para ver outros.'
          : null;
  const autoLoad = useAutoLoadMore({
    hasMore: props.hasMore,
    isLoadingMore: props.isLoadingMore,
    failed: props.loadMoreFailed,
    loadMore: props.onLoadMore,
    pageCount: props.pageCount,
    maxRun: maxAutoPages(filtering),
    resetKey: `${props.selectionKey}|${filterKey(props.filter)}`,
  });
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
          unreadCount={selection.unreadCount}
          onToggleAll={selection.toggleAll}
          onSelectUnread={selection.selectUnread}
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
        {props.searchScope && props.search.trim().length > 0 && (
          <MailSearchScope
            allFolders={props.searchScope.allFolders}
            onAllFolders={props.searchScope.onAllFolders}
            includeBody={props.searchScope.includeBody}
            onIncludeBody={props.searchScope.onIncludeBody}
            tooShort={props.search.trim().length < 2}
            folderLabel={props.searchScope.folderLabel}
          />
        )}
        {scopeInfo && (
          <p className="flex gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900 ring-1 ring-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{scopeInfo}</span>
          </p>
        )}
        <MailFilterBar
          filter={props.filter}
          onToggle={props.onToggleFilter}
          onClear={props.onClearFilter}
          disabled={props.filterDisabled}
        />
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
          <div
            className="mt-10 flex flex-col items-center gap-2 text-sm text-rz-muted"
            role="status"
          >
            <Loader2 className="h-6 w-6 animate-spin text-rz-primary" />
            {inAllFolders && <span>A pesquisar em todas as pastas…</span>}
          </div>
        )}
        {!props.isLoading && props.messages.length === 0 && (
          <p className="mt-12 text-center text-sm text-rz-muted">
            {filtering
              ? filterEmptyText(props.filter, props.search.trim().length > 0)
              : inAllFolders
                ? 'Nenhum email encontrado nas pastas (o Lixo e o Spam não entram).'
                : 'Nenhum email aqui.'}
            {filtering && props.hasMore && (
              <span className="mt-1 block text-[12.5px]">Ainda há emails por procurar.</span>
            )}
          </p>
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
              folderName={inAllFolders ? (mail.folderName ?? undefined) : undefined}
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
          <li ref={autoLoad.sentinel} className="min-h-6 py-3 text-center" aria-live="polite">
            {props.isLoadingMore ? (
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-rz-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                {filtering ? 'A procurar emails…' : 'A carregar…'}
              </span>
            ) : props.loadMoreFailed ? (
              <span className="inline-flex flex-wrap items-center justify-center gap-2 text-[13px] text-amber-900">
                Não foi possível carregar mais emails.
                <button
                  type="button"
                  onClick={props.onLoadMore}
                  className="h-9 rounded-full bg-rz-canvas px-4 text-[13px] font-bold text-rz-primary"
                >
                  Tentar de novo
                </button>
              </span>
            ) : autoLoad.stalled || !autoLoad.supported ? (
              <button
                type="button"
                onClick={props.onLoadMore}
                className="h-9 rounded-full bg-rz-canvas px-4 text-[13px] font-bold text-rz-primary"
              >
                {filtering ? 'Procurar mais emails' : 'Carregar mais'}
              </button>
            ) : null}
          </li>
        )}
      </ul>
    </section>
  );
};
