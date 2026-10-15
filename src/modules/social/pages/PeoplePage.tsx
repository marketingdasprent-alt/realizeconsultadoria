import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageCircle, Search } from 'lucide-react';
import { useOptionalMessenger } from '@/modules/messenger/context/useMessengerApi';
import { UserAvatar } from '@/modules/workspace/components/UserAvatar';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { useDirectory } from '../hooks/useDirectory';
import { useOpenChat } from '../hooks/useOpenChat';

/** Colaboradores da empresa (briefing §5/§6): pesquisa por nome, cargo e departamento. */
const PeoplePage: React.FC = () => {
  const { basePath, user } = useWorkspace();
  const { colleagues, isLoading } = useDirectory();
  const messenger = useOptionalMessenger();
  const openChat = useOpenChat();
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState<string | null>(null);

  const departments = useMemo(
    () => [...new Set(colleagues.map(p => p.department).filter(Boolean) as string[])].sort(),
    [colleagues]
  );
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return colleagues.filter(
      p =>
        (!department || p.department === department) &&
        (!term || [p.name, p.position, p.department].some(v => v?.toLowerCase().includes(term)))
    );
  }, [colleagues, department, query]);

  return (
    <WorkspacePage>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold">Colaboradores</h1>
          <p className="text-sm text-rz-muted">
            {colleagues.length} colegas{user.companyName ? ` na ${user.companyName}` : ''}
          </p>
        </div>
        <label className="flex h-11 w-full items-center gap-2 rounded-full bg-white px-4 text-rz-muted ring-1 ring-rz-line focus-within:ring-rz-primary/40 sm:w-80">
          <Search className="h-4 w-4" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Nome, cargo ou departamento"
            className="w-full bg-transparent text-sm text-rz-ink outline-none"
          />
        </label>
      </div>

      {departments.length > 1 && (
        <div className="scrollbar-hide mt-4 flex gap-2 overflow-x-auto">
          {[null, ...departments].map(dep => (
            <button
              key={dep ?? 'all'}
              type="button"
              onClick={() => setDepartment(dep)}
              className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold ${
                department === dep
                  ? 'bg-rz-ink text-white'
                  : 'bg-white text-rz-muted ring-1 ring-rz-line'
              }`}
            >
              {dep ?? 'Todos'}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <Loader2 className="mx-auto mt-12 h-7 w-7 animate-spin text-rz-primary" />
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map(person => (
            <li
              key={person.userId}
              className="rz-rise flex items-center gap-3 rounded-[24px] bg-white p-4 shadow-rz-soft ring-1 ring-rz-line"
            >
              <Link
                to={`${basePath}/pessoas/${person.userId}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <UserAvatar
                  name={person.name}
                  size="lg"
                  status={messenger?.isOnline(person.userId) ? 'online' : undefined}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-bold">{person.name}</span>
                  <span className="block truncate text-[13px] text-rz-muted">
                    {[person.position, person.department].filter(Boolean).join(' · ') ||
                      'Colaborador'}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => openChat(person.userId)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rz-primary-soft text-rz-primary transition-colors hover:bg-rz-primary hover:text-white"
                aria-label={`Mensagem para ${person.name}`}
              >
                <MessageCircle className="h-[18px] w-[18px]" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!isLoading && visible.length === 0 && (
        <p className="mt-10 text-center text-rz-muted">Nenhum colega encontrado.</p>
      )}
    </WorkspacePage>
  );
};

export default PeoplePage;
