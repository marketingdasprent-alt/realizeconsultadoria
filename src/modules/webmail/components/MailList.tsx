import React from 'react';
import { AlertTriangle, Loader2, Menu, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCOUNT_DOTS, mailKey } from '../lib/mailFormat';
import { mailErrorText, type MailError } from '../services/mailService';
import type { MailAccount, MailSummary } from '../types';
import { MailListItem } from './MailListItem';

interface MailListProps {
  title: string;
  messages: MailSummary[];
  accounts: MailAccount[];
  activeKey: string | null;
  showAccount: boolean;
  search: string;
  onSearch: (value: string) => void;
  onOpen: (mail: MailSummary) => void;
  onToggleStar: (mail: MailSummary) => void;
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

/** Lista de emails (pesquisa, estrela, anexos e a cor da caixa na vista unificada). */
export const MailList: React.FC<MailListProps> = props => {
  const colorOf = new Map(props.accounts.map(a => [a.id, ACCOUNT_DOTS[a.color]]));
  const emailOf = new Map(props.accounts.map(a => [a.id, a.email]));
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
        <label className="flex h-10 items-center gap-2 rounded-full bg-rz-canvas px-4 text-rz-muted focus-within:ring-2 focus-within:ring-rz-primary/30">
          <Search className="h-4 w-4" />
          <input
            value={props.search}
            onChange={event => props.onSearch(event.target.value)}
            placeholder="Pesquisar emails"
            className="w-full bg-transparent text-sm text-rz-ink outline-none"
          />
        </label>
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
        {props.messages.map(mail => (
          <MailListItem
            key={mailKey(mail)}
            mail={mail}
            isActive={props.activeKey === mailKey(mail)}
            accountDot={props.showAccount ? colorOf.get(mail.accountId) : undefined}
            onOpen={props.onOpen}
            onToggleStar={props.onToggleStar}
            onHover={props.onHover}
          />
        ))}
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
