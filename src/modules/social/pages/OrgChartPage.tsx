import React, { useCallback, useMemo, useState } from 'react';
import { Building2, Loader2, Search } from 'lucide-react';
import type { DirectoryPerson } from '@/modules/messenger/types';
import { useOptionalMessenger } from '@/modules/messenger/context/useMessengerApi';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { OrgDepartmentCard } from '../components/OrgDepartmentCard';
import { useDirectory } from '../hooks/useDirectory';
import { buildOrgChart } from '../lib/orgchart';

/** Linha vertical entre níveis (só em ecrãs largos, onde a árvore é horizontal). */
const Stem: React.FC = () => <div className="mx-auto hidden h-6 w-0.5 bg-rz-primary/25 md:block" />;

/** Organograma (briefing §6): empresa → direção → departamentos → pessoas. */
const OrgChartPage: React.FC = () => {
  const { basePath, user } = useWorkspace();
  const { byId, isLoading } = useDirectory();
  const messenger = useOptionalMessenger();
  const [query, setQuery] = useState('');

  // O diretório da pré-visualização não inclui o próprio utilizador.
  const people = useMemo<DirectoryPerson[]>(() => {
    const list = [...byId.values()];
    if (!byId.has(user.userId))
      list.push({
        userId: user.userId,
        employeeId: user.employeeId,
        name: user.name,
        position: user.position,
        department: user.department,
        email: user.email,
      });
    return list;
  }, [byId, user]);
  const chart = useMemo(() => buildOrgChart(people, query), [people, query]);
  const searching = !!query.trim();

  const profilePath = useCallback(
    (userId: string) =>
      userId === user.userId ? `${basePath}/perfil` : `${basePath}/pessoas/${userId}`,
    [basePath, user.userId]
  );
  const isOnline = useCallback(
    (userId: string) => userId === user.userId || !!messenger?.isOnline(userId),
    [messenger, user.userId]
  );
  const cardProps = { profilePath, isOnline, myUserId: user.userId, expanded: searching };

  return (
    <WorkspacePage>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold">Organograma</h1>
          <p className="text-sm text-rz-muted">Departamentos e equipas da empresa</p>
        </div>
        <label className="flex h-11 w-full items-center gap-2 rounded-full bg-white px-4 text-rz-muted ring-1 ring-rz-line focus-within:ring-rz-primary/40 sm:w-80">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Pessoa, cargo ou departamento"
            className="w-full bg-transparent text-sm text-rz-ink outline-none"
          />
        </label>
      </div>

      {isLoading ? (
        <Loader2 className="mx-auto mt-12 h-7 w-7 animate-spin text-rz-primary" />
      ) : (
        <div className="mt-6">
          <div className="mx-auto flex w-full max-w-sm items-center gap-3 rounded-[24px] bg-gradient-to-br from-rz-primary to-indigo-500 p-4 text-white shadow-rz-soft">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20">
              <Building2 className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[16px] font-extrabold">
                {user.companyName || 'A empresa'}
              </span>
              <span className="block text-[12.5px] text-white/85">
                {chart.total} pessoas · {chart.departments.length + (chart.board ? 1 : 0)}{' '}
                departamentos
              </span>
            </span>
          </div>

          {chart.board && (
            <>
              <Stem />
              <div className="mx-auto mt-4 w-full max-w-sm md:mt-0">
                <OrgDepartmentCard department={chart.board} board {...cardProps} />
              </div>
            </>
          )}

          {chart.departments.length > 0 && (
            <>
              <Stem />
              <div className="mt-4 overflow-x-auto pb-2 md:mt-0">
                <ul className="flex flex-col gap-4 md:mx-auto md:w-max md:flex-row md:gap-0">
                  {chart.departments.map(department => (
                    <li
                      key={department.name}
                      className="relative md:w-64 md:shrink-0 md:px-2.5 md:pt-6 md:before:absolute md:before:left-0 md:before:right-0 md:before:top-0 md:before:h-0.5 md:before:bg-rz-primary/25 md:after:absolute md:after:left-1/2 md:after:top-0 md:after:h-6 md:after:w-0.5 md:after:bg-rz-primary/25 md:first:before:left-1/2 md:last:before:right-1/2"
                    >
                      <OrgDepartmentCard department={department} {...cardProps} />
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {chart.total === 0 && (
            <p className="mt-10 text-center text-rz-muted">Ninguém corresponde à pesquisa.</p>
          )}
        </div>
      )}
    </WorkspacePage>
  );
};

export default OrgChartPage;
