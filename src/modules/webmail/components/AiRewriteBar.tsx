import React from 'react';
import { ChevronDown, Loader2, Sparkles, Undo2 } from 'lucide-react';
import type { RewriteMode } from '@/modules/ai/services/aiService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AiRewriteBarProps {
  empty: boolean;
  busy: boolean;
  canUndo: boolean;
  onRun: (mode: RewriteMode) => void;
  onUndo: () => void;
}

const MODES: { mode: RewriteMode; label: string }[] = [
  { mode: 'complete', label: 'Mais completo' },
  { mode: 'formal', label: 'Mais formal' },
  { mode: 'short', label: 'Mais curto' },
  { mode: 'fix', label: 'Só corrigir erros' },
];

/** "Usar IA": o Realize AI reescreve o texto e o assunto; dá para desfazer. */
export const AiRewriteBar: React.FC<AiRewriteBarProps> = ({
  empty,
  busy,
  canUndo,
  onRun,
  onUndo,
}) => (
  <div className="mt-2 flex flex-wrap items-center gap-1.5">
    <div className="inline-flex overflow-hidden rounded-full ring-1 ring-violet-200">
      <button
        type="button"
        disabled={empty || busy}
        onClick={() => onRun('complete')}
        title={
          empty ? 'Escreva primeiro o que quer dizer' : 'A IA escreve uma versão mais completa'
        }
        className="inline-flex h-8 items-center gap-1.5 bg-violet-50 pl-3 pr-2.5 text-[12.5px] font-bold text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {busy ? 'A escrever…' : 'Usar IA'}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={empty || busy}
            aria-label="Outras opções da IA"
            className="flex h-8 w-7 items-center justify-center border-l border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {MODES.map(option => (
            <DropdownMenuItem key={option.mode} onSelect={() => onRun(option.mode)}>
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    {busy && (
      <span className="text-[12px] text-rz-muted">
        Pode demorar uns 20 segundos. Pode minimizar, continua a escrever.
      </span>
    )}
    {canUndo && !busy && (
      <button
        type="button"
        onClick={onUndo}
        className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
      >
        <Undo2 className="h-3.5 w-3.5" /> Desfazer
      </button>
    )}
  </div>
);
