import React from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tallyReactions, type NoticeReactionRow } from '@/modules/social/lib/noticeReactions';
import type { BroadcastEmployee } from '../../lib/broadcast';

interface BroadcastReactionsProps {
  reactions: Omit<NoticeReactionRow, 'notification_id'>[];
  people: BroadcastEmployee[];
}

/** Reações ao comunicado na app: votos por emoji, o mais votado à frente, e quem escolheu. */
export const BroadcastReactions: React.FC<BroadcastReactionsProps> = ({ reactions, people }) => {
  const tally = tallyReactions(reactions);
  const nameOf = new Map(people.flatMap(p => (p.user_id ? [[p.user_id, p.name] as const] : [])));
  const total = reactions.length;

  return (
    <section className="space-y-2">
      <h3 className="text-[13px] font-bold text-rz-muted">
        Reações {total > 0 && `· ${total} ${total === 1 ? 'pessoa' : 'pessoas'}`}
      </h3>
      {tally.length === 0 ? (
        <p className="rounded-2xl bg-rz-canvas px-4 py-3 text-[13px] text-rz-muted">
          Ainda ninguém reagiu. Cada pessoa pode escolher um emoji no Feed (dá para votações).
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tally.map(item => {
            const percent = Math.round((item.count / total) * 100);
            return (
              <li
                key={item.emoji}
                className={cn(
                  'rounded-2xl px-3 py-2.5 ring-1',
                  item.leading ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-rz-line'
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[22px] leading-none">{item.emoji}</span>
                  <span className="text-[15px] font-extrabold">{item.count}</span>
                  <span className="text-[12.5px] text-rz-muted">{percent}%</span>
                  {item.leading && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-bold text-amber-700">
                      <Trophy className="h-3.5 w-3.5" /> Mais votado
                    </span>
                  )}
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-rz-canvas">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      item.leading ? 'bg-amber-500' : 'bg-rz-primary/50'
                    )}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[12px] text-rz-muted">
                  {item.userIds.map(id => nameOf.get(id) ?? 'Antigo colaborador').join(', ')}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
