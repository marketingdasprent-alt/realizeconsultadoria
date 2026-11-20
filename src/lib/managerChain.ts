// Cadeia de chefia pelo responsável direto (employees.manager_id). Ver docs/chefe-de-equipa.md.

export interface ChainLink {
  id: string;
  manager_id: string | null;
}

/** Todos abaixo de `rootId` (diretos e indiretos), sem a própria pessoa; resiste a ciclos. */
export const descendantsOf = (rootId: string, people: readonly ChainLink[]): Set<string> => {
  const childrenOf = new Map<string, string[]>();
  for (const person of people) {
    if (!person.manager_id) continue;
    childrenOf.set(person.manager_id, [...(childrenOf.get(person.manager_id) ?? []), person.id]);
  }
  const found = new Set<string>();
  const queue = [...(childrenOf.get(rootId) ?? [])];
  while (queue.length) {
    const id = queue.shift()!;
    if (id === rootId || found.has(id)) continue;
    found.add(id);
    queue.push(...(childrenOf.get(id) ?? []));
  }
  return found;
};
