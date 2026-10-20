import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { absenceTypeLabels } from '@/lib/absence-types';
import { cn } from '@/lib/utils';
import { useTodayBoard } from '../../hooks/useTodayBoard';
import { boardCounts, groupByPlace, type BoardPerson } from '../../lib/todayBoard';
import { TodayPlaceCard } from './TodayPlaceCard';

const SUMMARY = [
  { state: 'working', label: 'A trabalhar', dot: 'bg-emerald-500' },
  { state: 'paused', label: 'Em pausa', dot: 'bg-amber-500' },
  { state: 'done', label: 'Já saíram', dot: 'bg-slate-400' },
  { state: 'not_started', label: 'Ainda não começaram', dot: 'bg-rose-400' },
  { state: 'absent', label: 'Ausentes', dot: 'bg-sky-400' },
] as const;

const NameChips: React.FC<{ title: string; people: BoardPerson[]; detail?: boolean }> = ({
  title,
  people,
  detail,
}) =>
  people.length === 0 ? null : (
    <section className="rounded-2xl border bg-card p-4">
      <h3 className="text-sm font-semibold">
        {title} <span className="font-normal text-muted-foreground">· {people.length}</span>
      </h3>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {people.map(person => (
          <li key={person.employee.id} className="rounded-full bg-muted px-2.5 py-1 text-xs">
            {person.employee.name}
            {detail && person.absenceType && (
              <span className="text-muted-foreground">
                {' '}
                · {absenceTypeLabels[person.absenceType] ?? 'Ausente'}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );

/** Ponto → Hoje: quem está a trabalhar e onde, agora. */
export const TodayTab: React.FC = () => {
  const board = useTodayBoard();
  const [companyId, setCompanyId] = useState('all');

  const companies = useMemo(
    () =>
      [
        ...new Map(
          board.people.map(p => [p.employee.companyId, p.employee.companyName ?? 'Sem empresa'])
        ),
      ].sort((a, b) => a[1].localeCompare(b[1])),
    [board.people]
  );
  const people =
    companyId === 'all'
      ? board.people
      : board.people.filter(p => p.employee.companyId === companyId);
  const counts = boardCounts(people);
  const groups = groupByPlace(people);
  const showCompany = companyId === 'all' && companies.length > 1;

  if (board.isLoading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {SUMMARY.map(item => (
          <span
            key={item.state}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm"
          >
            <span className={cn('h-2 w-2 rounded-full', item.dot)} />
            {item.label} <strong className="tabular-nums">{counts[item.state]}</strong>
          </span>
        ))}
        <span className="ml-auto flex items-center gap-2">
          {companies.length > 1 && (
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="h-9 w-[190px]" aria-label="Empresa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {companies.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void board.refetch()}
            title="Atualizar"
          >
            <RefreshCw className={cn('h-4 w-4', board.isFetching && 'animate-spin')} />
            {board.updatedAt ? format(board.updatedAt, 'HH:mm') : ''}
          </Button>
        </span>
      </div>

      {board.isError && (
        <p className="text-sm text-destructive">Não foi possível carregar o quadro de hoje.</p>
      )}

      {groups.length === 0 ? (
        <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Ainda ninguém registou o ponto hoje.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {groups.map(group => (
            <TodayPlaceCard key={group.place} group={group} showCompany={showCompany} />
          ))}
        </div>
      )}

      <NameChips
        title="Ainda não começaram"
        people={people.filter(p => p.state === 'not_started')}
      />
      <NameChips title="Ausentes hoje" people={people.filter(p => p.state === 'absent')} detail />
    </div>
  );
};
