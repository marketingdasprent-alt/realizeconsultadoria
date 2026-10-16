import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarPlus, Check, ListPlus, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import type { AiProposal, ProposalTool } from '../services/aiService';

const KINDS: Record<ProposalTool, { icon: typeof Bell; label: string; tint: string }> = {
  event: { icon: CalendarPlus, label: 'Novo evento', tint: 'from-rose-400 to-orange-400' },
  task: { icon: ListPlus, label: 'Nova tarefa', tint: 'from-emerald-400 to-teal-500' },
  reminder: { icon: Bell, label: 'Novo lembrete', tint: 'from-violet-500 to-fuchsia-500' },
};

interface ProposalCardProps {
  proposal: AiProposal;
  onConfirm: (proposal: AiProposal) => void;
  onCancel: (id: string) => void;
}

/** O que o assistente preparou: só fica gravado depois de a pessoa confirmar. */
export const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, onConfirm, onCancel }) => {
  const { basePath } = useWorkspace();
  const kind = KINDS[proposal.tool];
  const Icon = kind.icon;
  const closed = proposal.status === 'done' || proposal.status === 'cancelled';
  return (
    <div
      className={cn(
        'mt-2 w-full max-w-[85%] rounded-2xl bg-white p-3 ring-1 ring-rz-line',
        proposal.status === 'cancelled' && 'opacity-60'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white',
            kind.tint
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-rz-muted">
            {kind.label}
          </p>
          <p className="break-words text-[14.5px] font-bold">{proposal.title}</p>
          {proposal.lines.map(line => (
            <p
              key={line}
              className={cn(
                'text-[13px] first-letter:uppercase',
                line.startsWith('Atenção') ? 'font-semibold text-amber-700' : 'text-rz-muted'
              )}
            >
              {line}
            </p>
          ))}
        </div>
      </div>
      {proposal.status === 'done' && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
          <Check className="h-4 w-4" /> {proposal.note}
          {proposal.link && (
            <Link
              to={`${basePath}${proposal.link.replace('/colaborador', '')}`}
              className="ml-auto text-rz-primary hover:underline"
            >
              Abrir
            </Link>
          )}
        </p>
      )}
      {proposal.status === 'cancelled' && (
        <p className="mt-2 text-[13px] text-rz-muted">Cancelado.</p>
      )}
      {proposal.status === 'error' && (
        <p className="mt-2 text-[13px] font-semibold text-rose-700">{proposal.note}</p>
      )}
      {!closed && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onConfirm(proposal)}
            disabled={proposal.status === 'saving'}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-rz-primary text-[13.5px] font-bold text-white disabled:opacity-60"
          >
            {proposal.status === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {proposal.status === 'error' ? 'Tentar outra vez' : 'Confirmar'}
          </button>
          <button
            type="button"
            onClick={() => onCancel(proposal.id)}
            disabled={proposal.status === 'saving'}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold text-rz-muted hover:bg-rz-canvas"
          >
            <X className="h-4 w-4" /> Cancelar
          </button>
        </div>
      )}
    </div>
  );
};
