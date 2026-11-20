import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Crown, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DirectoryPerson } from '@/modules/messenger/types';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import type { OrgNode, OrgTree } from '../lib/orgchart';

/** Níveis abertos ao entrar (o resto abre-se em cada chefe). */
const OPEN_LEVELS = 2;

interface TreeProps {
  profilePath: (userId: string) => string;
  isOnline: (userId: string) => boolean;
  myUserId: string;
  /** Com pesquisa ativa abre-se tudo. */
  expanded?: boolean;
}

const PersonLink: React.FC<
  Omit<TreeProps, 'expanded'> & { person: DirectoryPerson; teamSize?: number }
> = ({ person, teamSize = 0, profilePath, isOnline, myUserId }) => (
  <Link
    to={profilePath(person.userId)}
    className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-2 py-1.5 transition-colors hover:bg-rz-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rz-primary/40"
  >
    <UserAvatar
      name={person.name}
      userId={person.userId}
      size="sm"
      status={isOnline(person.userId) ? 'online' : undefined}
    />
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1 truncate text-[13.5px] font-bold">
        {person.name}
        {person.userId === myUserId && <span className="font-semibold text-rz-muted">(eu)</span>}
      </span>
      <span className="flex items-center gap-1 truncate text-[12px] text-rz-muted">
        {teamSize > 0 && <Crown className="h-3 w-3 shrink-0 text-amber-500" aria-hidden />}
        {person.position || 'Colaborador'}
        {person.department && <span className="truncate"> · {person.department}</span>}
      </span>
    </span>
    {teamSize > 0 && (
      <span
        className="shrink-0 rounded-full bg-rz-primary-soft px-2 py-0.5 text-[11.5px] font-bold text-rz-primary"
        title={`${teamSize} ${teamSize === 1 ? 'pessoa' : 'pessoas'} na equipa`}
      >
        {teamSize}
        <span className="sr-only"> na equipa</span>
      </span>
    )}
  </Link>
);

const TreeNode: React.FC<TreeProps & { node: OrgNode; level: number }> = ({
  node,
  level,
  expanded,
  ...props
}) => {
  const [open, setOpen] = useState(level < OPEN_LEVELS);
  const isOpen = expanded || open;
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div className="flex items-center gap-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen(!isOpen)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Fechar' : 'Abrir'} a equipa de ${node.person.name}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rz-primary/40"
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-9 shrink-0" aria-hidden />
        )}
        <PersonLink person={node.person} teamSize={node.teamSize} {...props} />
      </div>
      {hasChildren && isOpen && (
        <ul className="ml-[18px] border-l-2 border-rz-primary/15 pl-2 sm:pl-3">
          {node.children.map(child => (
            <TreeNode
              key={child.person.employeeId}
              node={child}
              level={level + 1}
              expanded={expanded}
              {...props}
            />
          ))}
        </ul>
      )}
    </li>
  );
};

/** Organograma pela chefia real: cada chefe abre a sua equipa; quem não tem chefia fica à parte. */
export const OrgTreeView: React.FC<TreeProps & { tree: OrgTree }> = ({ tree, ...props }) => (
  <div className="mx-auto mt-6 w-full max-w-3xl space-y-4">
    {tree.roots.length > 0 && (
      <section className="rz-rise rounded-[24px] bg-white p-2 shadow-rz-soft ring-1 ring-rz-line sm:p-3">
        <ul aria-label="Chefias e equipas" className="space-y-0.5">
          {tree.roots.map(root => (
            <TreeNode key={root.person.employeeId} node={root} level={0} {...props} />
          ))}
        </ul>
      </section>
    )}
    {tree.unassigned.length > 0 && <UnassignedCard people={tree.unassigned} {...props} />}
  </div>
);

const COLLAPSED = 6;

const UnassignedCard: React.FC<TreeProps & { people: DirectoryPerson[] }> = ({
  people,
  expanded,
  ...props
}) => {
  const [showAll, setShowAll] = useState(false);
  const shown = expanded || showAll ? people : people.slice(0, COLLAPSED);
  const hidden = people.length - shown.length;
  return (
    <section className="overflow-hidden rounded-[24px] bg-white shadow-rz-soft ring-1 ring-rz-line">
      <header className="flex items-center justify-between gap-2 border-b border-rz-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-[14.5px] font-extrabold">
          <UserRound className="h-4 w-4 text-rz-muted" aria-hidden />
          Sem responsável direto
        </h2>
        <span className="shrink-0 rounded-full bg-rz-canvas px-2 py-0.5 text-[11.5px] font-bold text-rz-muted">
          {people.length}
        </span>
      </header>
      <ul className={cn('grid gap-0.5 p-2 sm:grid-cols-2')}>
        {shown.map(person => (
          <li key={person.employeeId} className="flex">
            <PersonLink person={person} {...props} />
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full border-t border-rz-line py-2.5 text-[12.5px] font-bold text-rz-primary hover:bg-rz-canvas"
        >
          Ver mais {hidden}
        </button>
      )}
    </section>
  );
};
