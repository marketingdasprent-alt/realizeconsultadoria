import React from 'react';
import { Link } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Appreciation } from '@/modules/social/types';
import { useWorkspace } from '../../context/workspaceContext';
import { APPRECIATION_TYPES } from '../../lib/appreciations';
import { ModuleIcon } from '../ModuleIcon';

interface AppreciationsCardProps {
  received: Appreciation[];
  /** Perfil do próprio: texto e ligação diferentes. */
  isOwn: boolean;
}

/** Apreciações recebidas (briefing §7): os tipos recebidos acendem-se, com o total. */
export const AppreciationsCard: React.FC<AppreciationsCardProps> = ({ received, isOwn }) => {
  const { basePath } = useWorkspace();
  const counts = new Map<string, number>();
  for (const item of received) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  const latest = received.find(item => item.message);

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line md:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold">Apreciações</h2>
        <span className="rounded-full bg-rz-canvas px-2.5 py-1 text-xs font-semibold text-rz-muted">
          {received.length} recebida{received.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-5 gap-2.5">
        {APPRECIATION_TYPES.map(type => {
          const count = counts.get(type.key) ?? 0;
          return (
            <Tooltip key={type.key} delayDuration={100}>
              <TooltipTrigger asChild>
                <span className="relative flex justify-center">
                  <ModuleIcon
                    module={type}
                    size="md"
                    className={cn('transition-all', count === 0 && 'opacity-30 grayscale')}
                  />
                  {count > 1 && (
                    <span className="absolute -right-0.5 -top-1 min-w-[18px] rounded-full bg-rz-ink px-1 text-center text-[10px] font-bold leading-[18px] text-white">
                      {count}
                    </span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent className="rounded-xl">
                {type.label}
                {count > 0 && ` · ${count}`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      {latest ? (
        <p className="mt-4 rounded-2xl bg-rz-canvas px-4 py-3 text-[13.5px] italic">
          “{latest.message}” <span className="not-italic text-rz-muted">— {latest.senderName}</span>
        </p>
      ) : (
        <p className="mt-4 text-[13px] text-rz-muted">
          {isOwn
            ? 'Quando um colega reconhecer o seu trabalho, a apreciação acende-se aqui.'
            : 'Ainda sem apreciações públicas.'}
        </p>
      )}
      {isOwn && (
        <Link
          to={`${basePath}/apreciacoes`}
          className="mt-3 inline-block text-[13px] font-semibold text-rz-primary"
        >
          Ver todas →
        </Link>
      )}
    </section>
  );
};
