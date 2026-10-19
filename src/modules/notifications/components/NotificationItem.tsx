import React from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  Award,
  Bell,
  FolderOpen,
  LifeBuoy,
  Mail,
  MessageCircle,
  Palmtree,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModuleIcon } from '@/modules/workspace/components/ModuleIcon';
import type { NotificationRow } from '../services/notificationService';

const KINDS: Record<string, { icon: typeof Bell; tint: string }> = {
  appreciation: { icon: Award, tint: 'from-pink-400 to-rose-500' },
  feed_comment: { icon: MessageCircle, tint: 'from-orange-400 to-rose-500' },
  absence: { icon: Palmtree, tint: 'from-lime-400 to-green-600' },
  ticket: { icon: LifeBuoy, tint: 'from-cyan-400 to-sky-600' },
  document: { icon: FolderOpen, tint: 'from-amber-400 to-orange-500' },
  assistant: { icon: Sparkles, tint: 'from-violet-500 via-fuchsia-500 to-amber-400' },
  mail: { icon: Mail, tint: 'from-sky-400 to-blue-600' },
};

interface NotificationItemProps {
  item: NotificationRow;
  onOpen: (item: NotificationRow) => void;
}

/** Uma notificação: ícone do tipo, título, detalhe, há quanto tempo e ponto se por ler. */
export const NotificationItem: React.FC<NotificationItemProps> = ({ item, onOpen }) => {
  const kind = KINDS[item.kind] ?? { icon: Bell, tint: 'from-violet-500 to-indigo-500' };
  const isUnread = !item.read_at;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl p-2.5 text-left transition-colors hover:bg-rz-canvas',
        isUnread && 'bg-rz-primary-soft/60'
      )}
    >
      <ModuleIcon module={kind} size="md" />
      <span className="min-w-0 flex-1">
        <span
          className={cn('block text-[14px] leading-snug', isUnread ? 'font-bold' : 'font-medium')}
        >
          {item.title}
        </span>
        {item.body && (
          <span className="mt-0.5 line-clamp-2 block text-[13px] text-rz-muted">{item.body}</span>
        )}
        <span className="mt-1 block text-[11.5px] text-rz-muted">
          {formatDistanceToNowStrict(new Date(item.created_at), { locale: pt, addSuffix: true })}
        </span>
      </span>
      {isUnread && (
        <span
          className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-rz-primary"
          aria-label="Por ler"
        />
      )}
    </button>
  );
};
