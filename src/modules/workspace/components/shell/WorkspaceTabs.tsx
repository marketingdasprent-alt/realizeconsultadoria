import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceTabs } from '../../hooks/useWorkspaceTabs';
import { tabInfo } from '../../lib/tabs';
import { ModuleIcon } from '../ModuleIcon';

/**
 * Barra de abas no topo do painel (como no Chrome). Clique para mudar, ✕ ou clique do meio
 * para fechar, ↗ para abrir numa aba verdadeira do browser. Alt+1…9 e Alt+W no teclado.
 */
export const WorkspaceTabs: React.FC = () => {
  const { tabs, active, open, close, openExternal } = useWorkspaceTabs();
  if (!tabs.length) return null;

  return (
    <div
      role="tablist"
      aria-label="Abas abertas"
      className="scrollbar-hide flex shrink-0 items-end gap-1 overflow-x-auto bg-black/[0.04] px-3 pt-2"
    >
      {tabs.map((tab, index) => {
        const info = tabInfo(tab.key);
        if (!info) return null;
        const isActive = tab.key === active;
        return (
          <div
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            tabIndex={0}
            title={`${info.label}${index < 9 ? ` · Alt+${index + 1}` : ''}`}
            onClick={() => open(tab)}
            onKeyDown={event => event.key === 'Enter' && open(tab)}
            onAuxClick={event => {
              if (event.button === 1) {
                event.preventDefault();
                close(tab.key);
              }
            }}
            className={cn(
              'group relative flex h-9 min-w-[7.5rem] max-w-[13rem] flex-1 cursor-pointer items-center gap-2 rounded-t-xl px-2.5 text-[13px] font-semibold transition-colors',
              isActive
                ? 'bg-rz-canvas text-rz-ink shadow-[0_-1px_0_0_hsl(var(--rz-line))]'
                : 'text-rz-muted hover:bg-white/60'
            )}
          >
            <ModuleIcon module={info} size="xs" />
            <span className="min-w-0 flex-1 truncate">{info.label}</span>
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                openExternal(tab);
              }}
              className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-rz-muted hover:bg-black/5 hover:text-rz-ink group-hover:flex"
              aria-label={`Abrir ${info.label} numa aba do browser`}
              title="Abrir numa aba do browser"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                close(tab.key);
              }}
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-rz-muted hover:bg-black/5 hover:text-rz-ink',
                !isActive && 'opacity-0 group-hover:opacity-100'
              )}
              aria-label={`Fechar ${info.label}`}
              title="Fechar (Alt+W)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
