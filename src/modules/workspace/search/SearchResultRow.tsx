import React from 'react';
import {
  CalendarDays,
  FileText,
  LifeBuoy,
  ListChecks,
  MessageSquareText,
  Newspaper,
  type LucideIcon,
} from 'lucide-react';
import { CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { ModuleIcon } from '../components/ModuleIcon';
import { UserAvatar } from '../components/UserAvatar';
import { ALL_MODULES } from '../lib/navigation';
import type { SearchGroup, SearchHit } from './searchRules';

const GROUP_ICONS: Partial<Record<SearchGroup, { icon: LucideIcon; tone: string }>> = {
  messages: { icon: MessageSquareText, tone: 'bg-violet-100 text-violet-600' },
  tasks: { icon: ListChecks, tone: 'bg-emerald-100 text-emerald-600' },
  events: { icon: CalendarDays, tone: 'bg-rose-100 text-rose-600' },
  documents: { icon: FileText, tone: 'bg-amber-100 text-amber-600' },
  tickets: { icon: LifeBuoy, tone: 'bg-sky-100 text-sky-600' },
  posts: { icon: Newspaper, tone: 'bg-orange-100 text-orange-600' },
};

const HitIcon: React.FC<{ hit: SearchHit }> = ({ hit }) => {
  const module = hit.moduleKey && ALL_MODULES.find(m => m.key === hit.moduleKey);
  if (module) return <ModuleIcon module={module} size="xs" />;
  if (hit.avatarName) return <UserAvatar name={hit.avatarName} size="xs" />;
  const group = GROUP_ICONS[hit.group];
  if (!group) return null;
  const Icon = group.icon;
  return (
    <span
      className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-xl', group.tone)}
    >
      <Icon className="!h-4 !w-4" />
    </span>
  );
};

/** Uma linha de resultado da pesquisa global. */
export const SearchResultRow: React.FC<{ hit: SearchHit; onSelect: (hit: SearchHit) => void }> = ({
  hit,
  onSelect,
}) => (
  <CommandItem
    value={hit.key}
    onSelect={() => onSelect(hit)}
    className="gap-3 rounded-2xl !py-2 aria-selected:bg-rz-primary-soft"
  >
    <HitIcon hit={hit} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13.5px] font-semibold text-rz-ink">{hit.title}</span>
      {hit.subtitle && (
        <span className="block truncate text-[12px] text-rz-muted">{hit.subtitle}</span>
      )}
    </span>
  </CommandItem>
);
