// Marcar pessoas numa conversa (@Nome): o que se está a escrever, inserir o nome escolhido,
// quem ficou marcado e as partes do texto a destacar.

export interface MentionPerson {
  userId: string;
  name: string;
}

/** Está a escrever "@Ana" logo antes do cursor? Devolve onde começa o @ e o que vem a seguir. */
export const mentionQuery = (
  text: string,
  caret: number
): { start: number; query: string } | null => {
  const match = /(^|\s)@([\p{L}\p{N}._'-]{0,30})$/u.exec(text.slice(0, caret));
  if (!match) return null;
  return { start: caret - match[2].length - 1, query: match[2] };
};

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Quem aparece na lista: o nome (ou um dos nomes) começa pelo que se escreveu. */
export const mentionSuggestions = (
  people: MentionPerson[],
  query: string,
  limit = 6
): MentionPerson[] => {
  const term = fold(query);
  return people
    .filter(
      p =>
        !term ||
        fold(p.name)
          .split(/\s+/)
          .some(word => word.startsWith(term))
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    .slice(0, limit);
};

/** Troca "@an" pelo nome escolhido ("@Ana Silva "), com o cursor logo a seguir. */
export const insertMention = (
  text: string,
  start: number,
  caret: number,
  name: string
): { text: string; caret: number } => {
  const inserted = `@${name} `;
  return {
    text: text.slice(0, start) + inserted + text.slice(caret),
    caret: start + inserted.length,
  };
};

/**
 * Quem fica marcado no texto final: os escolhidos da lista (se o "@Nome" ainda lá está) e os
 * escritos à mão ("@thiago", "@Ana Silva"), quando o nome ou o primeiro nome é de uma só pessoa.
 */
export const mentionedIds = (
  text: string,
  picked: MentionPerson[],
  people: MentionPerson[] = []
): string[] => {
  const ids = new Set(picked.filter(p => text.includes(`@${p.name}`)).map(p => p.userId));
  const typed = [...text.matchAll(/(?:^|\s)@([\p{L}\p{N}._'-]{2,30})/gu)].map(m => fold(m[1]));
  for (const word of typed) {
    const full = people.filter(p => fold(p.name).replace(/\s+/g, '').startsWith(word));
    const first = people.filter(p => fold(p.name).split(/\s+/)[0] === word);
    const match = first.length === 1 ? first : full.length === 1 ? full : [];
    match.forEach(p => ids.add(p.userId));
  }
  return [...ids];
};

/** O texto partido em bocados, com os "@Nome" das pessoas marcadas à parte (para destacar). */
export const mentionParts = (
  text: string,
  names: string[]
): { text: string; mention: boolean }[] => {
  const valid = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length);
  if (!valid.length) return [{ text, mention: false }];
  const escaped = valid.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  // Com o grupo de captura, o split põe os "@Nome" nas posições ímpares.
  const pattern = new RegExp(`(@(?:${escaped.join('|')}))`);
  return text
    .split(pattern)
    .map((part, index) => ({ text: part, mention: index % 2 === 1 }))
    .filter(part => part.text !== '');
};
