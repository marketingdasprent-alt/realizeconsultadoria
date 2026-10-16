import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { getDocumentCategoryLabel } from '@/lib/documents';
import { DEMO_EVENTS } from '@/modules/calendar/lib/demoData';
import { useOptionalMessenger } from '@/modules/messenger/context/useMessengerApi';
import { DEMO_MESSAGES } from '@/modules/messenger/lib/demoData';
import { useDirectory } from '@/modules/social/hooks/useDirectory';
import { DEMO_POSTS } from '@/modules/social/lib/demoData';
import { DEMO_TICKETS } from '@/modules/support/lib/demoData';
import { TICKET_STATUS } from '@/modules/support/lib/ticketRules';
import { DEMO_TASKS } from '@/modules/tasks/lib/demoData';
import { TASK_STATUSES } from '@/modules/tasks/lib/taskRules';
import { useWorkspace } from '../context/workspaceContext';
import { ALL_MODULES, modulePath } from '../lib/navigation';
import {
  MIN_SERVER_TERM,
  PER_GROUP,
  SEARCH_GROUPS,
  matchesTerm,
  snippet,
  type SearchHit,
} from './searchRules';
import { searchService, type ServerSearchResults } from './searchService';

const DEBOUNCE_MS = 250;
const when = (iso: string, withTime = true) =>
  format(new Date(iso), withTime ? "d MMM yyyy', 'HH:mm" : 'd MMM yyyy', { locale: pt });

/** Os mesmos resultados do servidor, a partir dos dados de exemplo. */
const demoResults = (term: string): ServerSearchResults => ({
  messages: Object.values(DEMO_MESSAGES)
    .flat()
    .filter(m => m.text && !m.deleted && matchesTerm(term, m.text))
    .map(m => ({ ...m, body: m.text ?? '' })),
  tasks: DEMO_TASKS.filter(t => matchesTerm(term, t.title)),
  events: DEMO_EVENTS.filter(e => matchesTerm(term, e.title)),
  documents: [],
  tickets: DEMO_TICKETS.filter(t => matchesTerm(term, t.subject)).map(t => ({
    ...t,
    createdAt: t.created_at,
  })),
  posts: DEMO_POSTS.filter(p => p.body && matchesTerm(term, p.body)).map(p => ({
    ...p,
    body: p.body ?? '',
  })),
});

/**
 * Pesquisa global (briefing §19): pessoas, conversas e módulos na hora; mensagens, tarefas,
 * eventos, documentos, tickets e publicações no servidor (com atraso de 250 ms).
 */
export const useGlobalSearch = (term: string, enabled: boolean) => {
  const { basePath, isPreview, user } = useWorkspace();
  const { colleagues, nameOf } = useDirectory();
  const conversations = useOptionalMessenger()?.conversations;
  const [debounced, setDebounced] = useState(term);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [term]);

  const serverEnabled = enabled && !isPreview && debounced.length >= MIN_SERVER_TERM;
  const query = useQuery({
    queryKey: ['rz-search', debounced],
    queryFn: async () => {
      const { data, error } = await searchService.search(debounced, user.employeeId);
      if (error) throw error;
      return data;
    },
    enabled: serverEnabled,
    staleTime: 30_000,
  });

  const groups = useMemo(() => {
    const t = term.trim();
    const hits: SearchHit[] = [];
    if (t) {
      for (const p of colleagues.filter(p => matchesTerm(t, p.name, p.position, p.department)))
        hits.push({
          key: `person-${p.userId}`,
          group: 'people',
          title: p.name,
          subtitle: [p.position, p.department].filter(Boolean).join(' · ') || undefined,
          to: `${basePath}/pessoas/${p.userId}`,
          avatarName: p.name,
        });
      for (const c of (conversations ?? []).filter(c => matchesTerm(t, c.title)))
        hits.push({
          key: `conv-${c.id}`,
          group: 'conversations',
          title: c.title,
          subtitle: c.subtitle,
          to: `${basePath}?c=${c.id}`,
          avatarName: c.title,
        });
    }
    const server =
      debounced.length >= MIN_SERVER_TERM
        ? isPreview
          ? demoResults(debounced)
          : query.data
        : undefined;
    if (server) {
      const convTitle = new Map((conversations ?? []).map(c => [c.id, c.title]));
      for (const m of server.messages)
        hits.push({
          key: `msg-${m.id}`,
          group: 'messages',
          title: snippet(m.body, debounced),
          subtitle: `${nameOf(m.senderId)} · ${convTitle.get(m.conversationId) ?? 'Conversa'}`,
          to: `${basePath}?c=${m.conversationId}`,
        });
      for (const task of server.tasks)
        hits.push({
          key: `task-${task.id}`,
          group: 'tasks',
          title: task.title,
          subtitle: [
            TASK_STATUSES.find(s => s.key === task.status)?.label,
            task.dueAt && `até ${when(task.dueAt, false)}`,
          ]
            .filter(Boolean)
            .join(' · '),
          to: `${basePath}/tarefas?tarefa=${task.id}`,
        });
      for (const e of server.events)
        hits.push({
          key: `event-${e.id}`,
          group: 'events',
          title: e.title,
          subtitle: when(e.startsAt, !e.allDay),
          to: `${basePath}/calendario?evento=${e.id}`,
        });
      for (const d of server.documents)
        hits.push({
          key: `doc-${d.id}`,
          group: 'documents',
          title: d.fileName,
          subtitle: `${getDocumentCategoryLabel(d.category)} · ${when(d.createdAt, false)}`,
          to: `${basePath}/definicoes/documentos`,
        });
      for (const tk of server.tickets)
        hits.push({
          key: `ticket-${tk.id}`,
          group: 'tickets',
          title: tk.subject,
          subtitle: TICKET_STATUS[tk.status]?.label ?? tk.status,
          to: `${basePath}/tickets?t=${tk.id}`,
        });
      for (const p of server.posts)
        hits.push({
          key: `post-${p.id}`,
          group: 'posts',
          title: snippet(p.body, debounced),
          subtitle: `${nameOf(p.authorId)} · ${when(p.createdAt, false)}`,
          to: `${basePath}/feed?post=${p.id}`,
        });
    }
    for (const m of ALL_MODULES.filter(m => matchesTerm(t, m.label, m.description)))
      hits.push({
        key: `module-${m.key}`,
        group: 'modules',
        title: m.label,
        subtitle: m.ready ? undefined : 'em breve',
        to: modulePath(basePath, m),
        moduleKey: m.key,
      });

    return SEARCH_GROUPS.map(g => ({
      ...g,
      hits: hits.filter(h => h.group === g.key).slice(0, g.key === 'modules' ? 20 : PER_GROUP),
    })).filter(g => g.hits.length);
  }, [term, debounced, colleagues, conversations, isPreview, query.data, basePath, nameOf]);

  const isSearching =
    serverEnabled && (term.trim() !== debounced || query.isFetching || query.isLoading);
  return { groups, isSearching, error: query.isError };
};
