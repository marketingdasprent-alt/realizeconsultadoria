import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DirectoryPerson } from '@/modules/messenger/types';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import type { OrgDepartment } from '../lib/orgchart';

const TINTS = [
  'from-violet-500 to-indigo-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-400 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-fuchsia-500 to-purple-500',
];

const tintOf = (name: string) => {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
};

const COLLAPSED = 5;

interface OrgDepartmentCardProps {
  department: OrgDepartment;
  profilePath: (userId: string) => string;
  isOnline: (userId: string) => boolean;
  myUserId: string;
  /** A direção usa sempre o mesmo tom escuro. */
  board?: boolean;
  /** Com pesquisa ativa mostra-se tudo. */
  expanded?: boolean;
}

const PersonRow: React.FC<{
  person: DirectoryPerson;
  to: string;
  online: boolean;
  isMe: boolean;
  lead: boolean;
}> = ({ person, to, online, isMe, lead }) => (
  <li>
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5 transition-colors hover:bg-rz-canvas"
    >
      <UserAvatar
        name={person.name}
        userId={person.userId}
        size="sm"
        status={online ? 'online' : undefined}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 truncate text-[13.5px] font-bold">
          {person.name}
          {isMe && <span className="font-semibold text-rz-muted">(eu)</span>}
        </span>
        <span className="flex items-center gap-1 truncate text-[12px] text-rz-muted">
          {lead && <Crown className="h-3 w-3 shrink-0 text-amber-500" />}
          {person.position || 'Colaborador'}
        </span>
      </span>
    </Link>
  </li>
);

/** Um departamento do organograma: as pessoas por nível; a coroa é de quem o lidera. */
export const OrgDepartmentCard: React.FC<OrgDepartmentCardProps> = ({
  department,
  profilePath,
  isOnline,
  myUserId,
  board,
  expanded,
}) => {
  const [showAll, setShowAll] = useState(false);
  const all = expanded || showAll;
  const people = all ? department.people : department.people.slice(0, COLLAPSED);
  const hidden = department.people.length - people.length;

  return (
    <section className="rz-rise overflow-hidden rounded-[24px] bg-white shadow-rz-soft ring-1 ring-rz-line">
      <header
        className={cn(
          'flex items-center justify-between gap-2 bg-gradient-to-r px-4 py-3 text-white',
          board ? 'from-rz-ink to-slate-700' : tintOf(department.name)
        )}
      >
        <h3 className="truncate text-[14.5px] font-extrabold">{department.name}</h3>
        <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[11.5px] font-bold">
          {department.people.length}
        </span>
      </header>
      <ul className="space-y-0.5 p-2">
        {people.map(person => (
          <PersonRow
            key={person.userId}
            person={person}
            to={profilePath(person.userId)}
            online={isOnline(person.userId)}
            isMe={person.userId === myUserId}
            lead={department.leads.includes(person.userId)}
          />
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full border-t border-rz-line py-2 text-[12.5px] font-bold text-rz-primary hover:bg-rz-canvas"
        >
          Ver mais {hidden}
        </button>
      )}
    </section>
  );
};
