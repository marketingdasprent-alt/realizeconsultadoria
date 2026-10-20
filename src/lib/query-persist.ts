// A cache do React Query também fica no aparelho (por utilizador): ao abrir a app, as
// conversas, o calendário, as tarefas… aparecem logo com o que se viu da última vez, e o
// React Query vai buscar a versão nova em segundo plano (os dados guardados contam como
// antigos). Só as áreas do dia a dia; nada de documentos pessoais, recibos ou dados financeiros.
import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { clearDeviceCache, readDeviceCache, sessionUserId, writeDeviceCache } from './device-cache';

const NAME = 'queries';
const VERSION = 1;
/** Dados guardados há mais tempo do que isto não se mostram. */
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;
/** Conversas guardadas com mensagens (as mais recentes), e só a 1.ª página de cada uma. */
const MAX_THREADS = 15;
const WRITE_DELAY_MS = 2000;

/** Famílias de dados guardadas (o início da chave do React Query). */
const PERSISTED: readonly (readonly string[])[] = [
  ['chat'],
  ['calendar'],
  ['tasks'],
  ['notifications'],
  ['feed'],
  ['appreciations'],
  ['absences', 'mine'],
  ['support', 'tickets'],
  ['mail', 'accounts'],
  ['mail', 'unread'],
  ['ai', 'suggestions'],
  // Pastas da empresa: só os nomes e as datas (os links de leitura expiram e não se guardam).
  ['company-files'],
];

export const isPersisted = (key: readonly unknown[]): boolean =>
  // O arranque do Messenger (entrar no canal Geral…) corre sempre em cada sessão.
  !(key[0] === 'chat' && key[1] === 'boot') &&
  !(key[0] === 'company-files' && (key[1] === 'url' || key[1] === 'thumbs')) &&
  PERSISTED.some(prefix => prefix.every((part, index) => key[index] === part));

interface Saved {
  version: number;
  savedAt: number;
  state: DehydratedState;
}

const isThread = (key: readonly unknown[]) => key[0] === 'chat' && key[1] === 'thread';

/** O que se guarda: só o que correu bem, das áreas da lista; conversas limitadas. */
export const snapshot = (client: QueryClient): DehydratedState => {
  const state = dehydrate(client, {
    shouldDehydrateQuery: query => query.state.status === 'success' && isPersisted(query.queryKey),
  });
  const threads = state.queries
    .filter(q => isThread(q.queryKey))
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
    .slice(0, MAX_THREADS);
  return {
    ...state,
    queries: state.queries
      .filter(q => !isThread(q.queryKey) || threads.includes(q))
      .map(q => {
        if (!isThread(q.queryKey)) return q;
        const data = q.state.data as { pages: unknown[]; pageParams: unknown[] } | undefined;
        return data
          ? {
              ...q,
              state: {
                ...q.state,
                data: { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) },
              },
            }
          : q;
      }),
  };
};

/** Põe na cache o que ficou guardado deste utilizador (antes de a app desenhar). */
export const restoreQueries = (client: QueryClient, userId = sessionUserId()) => {
  const saved = readDeviceCache<Saved>(NAME, userId);
  if (!saved || saved.version !== VERSION || Date.now() - saved.savedAt > MAX_AGE_MS) return;
  try {
    hydrate(client, saved.state);
  } catch {
    // Guardado com outro formato: ignora (a app vai buscar tudo).
  }
};

/** Vai guardando a cache (no máximo de 2 em 2 s e ao sair da app); limpa ao terminar a sessão. */
export const persistQueries = (client: QueryClient) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const save = () => {
    timer = null;
    writeDeviceCache(NAME, sessionUserId(), {
      version: VERSION,
      savedAt: Date.now(),
      state: snapshot(client),
    } satisfies Saved);
  };
  const schedule = () => {
    if (!timer) timer = setTimeout(save, WRITE_DELAY_MS);
  };
  const unsubscribe = client.getQueryCache().subscribe(event => {
    if (event.type === 'updated' && isPersisted(event.query.queryKey)) schedule();
  });
  const onHidden = () => document.visibilityState === 'hidden' && save();
  document.addEventListener('visibilitychange', onHidden);
  const { data } = supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') {
      if (timer) clearTimeout(timer);
      timer = null;
      clearDeviceCache();
    }
  });
  return () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onHidden);
    data.subscription.unsubscribe();
  };
};
