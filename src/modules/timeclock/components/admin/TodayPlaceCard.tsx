import React from 'react';
import { format } from 'date-fns';
import { Building2, ExternalLink, MapPin, MapPinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mapsUrl, type BoardGroup, type BoardPerson } from '../../lib/todayBoard';

const STATE_STYLES: Record<string, { label: string; className: string }> = {
  working: { label: 'A trabalhar', className: 'bg-emerald-100 text-emerald-800' },
  paused: { label: 'Em pausa', className: 'bg-amber-100 text-amber-800' },
  done: { label: 'Saiu', className: 'bg-muted text-muted-foreground' },
};

const hour = (iso: string | null) => (iso ? format(new Date(iso), 'HH:mm') : '');

/** 4h05 */
const worked = (ms: number) => {
  const minutes = Math.floor(ms / 60_000);
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

const stateText = (person: BoardPerson) => {
  if (person.state === 'done') return `${hour(person.startedAt)}–${hour(person.endedAt) || '…'}`;
  return `desde ${hour(person.since)}`;
};

const PersonRow: React.FC<{ person: BoardPerson; showCompany: boolean }> = ({
  person,
  showCompany,
}) => {
  const style = STATE_STYLES[person.state];
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-[11px] font-bold text-gold">
        {initials(person.employee.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{person.employee.name}</span>
        {showCompany && person.employee.companyName && (
          <span className="block truncate text-xs text-muted-foreground">
            {person.employee.companyName}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right">
        <span
          className={cn(
            'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
            style.className
          )}
        >
          {style.label} · {stateText(person)}
        </span>
        <span className="block text-xs tabular-nums text-muted-foreground">
          {worked(person.workedMs)} trabalhadas
        </span>
      </span>
    </li>
  );
};

/** Um sítio (escritório, morada ou sem localização) e quem trabalhou lá hoje. */
export const TodayPlaceCard: React.FC<{ group: BoardGroup; showCompany: boolean }> = ({
  group,
  showCompany,
}) => {
  const Icon = group.kind === 'office' ? Building2 : group.kind === 'address' ? MapPin : MapPinOff;
  const here = group.people.filter(p => p.state !== 'done').length;
  return (
    <section className="rounded-2xl border bg-card p-4">
      <header className="flex items-start gap-2">
        <Icon
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0',
            group.kind === 'none' ? 'text-muted-foreground' : 'text-gold'
          )}
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug">{group.place}</h3>
          <p className="text-xs text-muted-foreground">
            {here > 0 ? `${here} ${here === 1 ? 'pessoa' : 'pessoas'} agora` : 'Ninguém agora'}
            {group.kind === 'address' ? ' · morada aproximada' : ''}
          </p>
        </div>
        {group.coords && group.kind !== 'none' && (
          <a
            href={mapsUrl(group.coords)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-gold hover:underline"
          >
            Mapa <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </header>
      <ul className="mt-2 divide-y">
        {group.people.map(person => (
          <PersonRow key={person.employee.id} person={person} showCompany={showCompany} />
        ))}
      </ul>
    </section>
  );
};
