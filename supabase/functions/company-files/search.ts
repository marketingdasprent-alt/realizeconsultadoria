// Procurar ficheiros e pastas pelo nome, SÓ dentro das pastas atribuídas ao colaborador.
// Usa a pesquisa do agente do servidor (GET /api/search) quando existir; sem ela, percorre as
// pastas com /api/list, com limites de pastas e de tempo para não pendurar o pedido.

export interface SearchEntry {
  name: string;
  type: 'dir' | 'file';
  size?: number;
  modified: string;
}

export interface SearchHit extends SearchEntry {
  path: string;
}

export interface SearchDeps {
  /** Pasta → entradas (o /api/list do agente). */
  list: (path: string) => Promise<SearchEntry[]>;
  /** Pesquisa do agente numa pasta; null se o agente ainda não a tiver. */
  search: (path: string, query: string) => Promise<SearchHit[] | null>;
}

const MAX_HITS = 25;
const MAX_LISTINGS = 150;
const MAX_DEPTH = 6;
const TIME_BUDGET_MS = 9_000;

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Todas as palavras da pesquisa aparecem no nome (sem acentos nem maiúsculas). */
export const nameMatches = (name: string, query: string) => {
  const target = fold(name);
  return fold(query)
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .every(word => target.includes(word));
};

export const searchFiles = async (
  deps: SearchDeps,
  folders: { path: string }[],
  query: string
): Promise<{ results: SearchHit[]; partial: boolean }> => {
  const results: SearchHit[] = [];
  const seen = new Set<string>();
  const add = (hit: SearchHit) => {
    if (seen.has(hit.path) || results.length >= MAX_HITS) return;
    seen.add(hit.path);
    results.push(hit);
  };
  const started = Date.now();
  let partial = false;

  // As pastas atribuídas sem repetir as que estão dentro de outras.
  const roots = folders
    .map(folder => folder.path)
    .filter((path, _, all) => !all.some(other => other !== path && path.startsWith(`${other}/`)));

  const toWalk: { path: string; depth: number }[] = [];
  for (const root of roots) {
    const fromAgent = await deps.search(root, query).catch(() => null);
    if (fromAgent) {
      // Por segurança, só o que fica mesmo dentro desta pasta.
      fromAgent.filter(hit => hit.path.startsWith(`${root}/`)).forEach(add);
    } else toWalk.push({ path: root, depth: 0 });
  }

  let listings = 0;
  while (toWalk.length && results.length < MAX_HITS) {
    if (listings >= MAX_LISTINGS || Date.now() - started > TIME_BUDGET_MS) {
      partial = true;
      break;
    }
    const { path, depth } = toWalk.shift()!;
    listings += 1;
    let entries: SearchEntry[];
    try {
      entries = await deps.list(path);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = `${path}/${entry.name}`;
      if (nameMatches(entry.name, query)) add({ ...entry, path: full });
      if (entry.type === 'dir' && depth + 1 < MAX_DEPTH)
        toWalk.push({ path: full, depth: depth + 1 });
    }
  }
  return { results, partial: partial || results.length >= MAX_HITS };
};
