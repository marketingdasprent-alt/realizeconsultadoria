import type { MailCustomFolder } from '../types';

export interface FlatFolder {
  folder: MailCustomFolder;
  /** 0 = no topo; cada nível de subpasta soma 1. */
  depth: number;
}

/** As pastas em árvore, já "achatadas" (mãe primeiro, depois as filhas), por ordem alfabética. */
export const flattenFolders = (folders: MailCustomFolder[]): FlatFolder[] => {
  const ids = new Set(folders.map(f => f.id));
  const children = new Map<string | null, MailCustomFolder[]>();
  for (const folder of folders) {
    // Uma pasta-mãe que não conste da lista conta como topo
    const key = folder.parentId && ids.has(folder.parentId) ? folder.parentId : null;
    children.set(key, [...(children.get(key) ?? []), folder]);
  }
  children.forEach(list => list.sort((a, b) => a.name.localeCompare(b.name, 'pt')));
  const out: FlatFolder[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const folder of children.get(parent) ?? []) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      out.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
};
