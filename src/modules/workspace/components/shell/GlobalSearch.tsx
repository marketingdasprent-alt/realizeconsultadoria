import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Search } from 'lucide-react';
import { Command, CommandGroup, CommandInput, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { SearchResultRow } from '../../search/SearchResultRow';
import { MIN_SERVER_TERM, type SearchHit } from '../../search/searchRules';
import { useGlobalSearch } from '../../search/useGlobalSearch';

interface GlobalSearchProps {
  /** Só a lupa (telemóvel) em vez da caixa de pesquisa. */
  compact?: boolean;
}

/**
 * Pesquisa global (briefing §19), com Ctrl+K: pessoas, conversas, mensagens, tarefas,
 * eventos, documentos, tickets, publicações e módulos.
 */
export const GlobalSearch: React.FC<GlobalSearchProps> = ({ compact = false }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [term, setTerm] = useState('');
  const { groups, isSearching, error } = useGlobalSearch(term, isOpen);
  const [active, setActive] = useState('');

  // Sempre que os resultados mudam, o Enter vai para o primeiro.
  const signature = groups.flatMap(group => group.hits.map(hit => hit.key)).join('|');
  useEffect(() => setActive(signature.split('|')[0] ?? ''), [signature]);
  // Limpa ao abrir (e não ao fechar, para não piscar durante a animação).
  useEffect(() => {
    if (isOpen) setTerm('');
  }, [isOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen(open => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const select = (hit: SearchHit) => {
    setIsOpen(false);
    navigate(hit.to);
  };
  const trimmed = term.trim();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          'rz-glass flex h-10 items-center rounded-full text-white/70 transition-colors hover:bg-white/20 hover:text-white',
          compact ? 'w-10 justify-center' : 'w-full max-w-md gap-2.5 px-4 text-left text-sm'
        )}
        aria-label="Pesquisar"
      >
        <Search className="h-[18px] w-[18px] shrink-0" />
        {!compact && (
          <>
            <span className="flex-1 truncate">Pesquisar pessoas, mensagens, documentos…</span>
            <kbd className="hidden rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-semibold text-white/80 lg:inline">
              Ctrl K
            </kbd>
          </>
        )}
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden rounded-[26px] p-0 font-jakarta">
          <DialogTitle className="sr-only">Pesquisa global</DialogTitle>
          <Command
            shouldFilter={false}
            value={active}
            onValueChange={setActive}
            className="rounded-[26px] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-rz-muted [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-14 [&_[cmdk-input]]:text-[15px]"
          >
            <div className="relative">
              <CommandInput
                value={term}
                onValueChange={setTerm}
                placeholder="Pesquisar pessoas, mensagens, tarefas…"
              />
              {isSearching && (
                <Loader2 className="absolute right-12 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-rz-primary" />
              )}
            </div>
            <CommandList className="rz-scroll max-h-[min(60vh,460px)] pb-2">
              {groups.map(group => (
                <CommandGroup key={group.key} heading={group.label}>
                  {group.hits.map(hit => (
                    <SearchResultRow key={hit.key} hit={hit} onSelect={select} />
                  ))}
                </CommandGroup>
              ))}
              {!groups.length && !isSearching && (
                <p className="py-8 text-center text-sm text-rz-muted">Nada encontrado.</p>
              )}
              {trimmed.length > 0 && trimmed.length < MIN_SERVER_TERM && (
                <p className="px-4 pb-2 text-center text-[12px] text-rz-muted">
                  Escreva mais uma letra para pesquisar mensagens, tarefas e documentos.
                </p>
              )}
              {error && (
                <p className="px-4 pb-2 text-center text-[12px] text-rose-600">
                  Alguns resultados não carregaram. Tente novamente.
                </p>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
};
