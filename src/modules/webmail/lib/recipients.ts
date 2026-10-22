// Destinatários: o texto do campo ("a@b.pt, c@d.pt"), as sugestões ao digitar e as listas.
import { parseRecipients } from './mailFormat';

export interface ContactEntry {
  email: string;
  name: string | null;
}

export interface ContactList {
  id: string;
  name: string;
  members: ContactEntry[];
}

/** Uma sugestão: uma pessoa (equipa ou já escrita) ou uma lista (vão todos). */
export type Suggestion =
  | { kind: 'person'; key: string; email: string; name: string | null; source: 'team' | 'sent' }
  | { kind: 'list'; key: string; name: string; emails: string[] };

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const MAX_SUGGESTIONS = 8;

/**
 * Nome limpo de um contacto: sem aspas à volta e sem nomes que são o próprio email
 * (alguns servidores devolvem 'ana@x.pt' como nome).
 */
export const cleanContactName = (name: string | null | undefined): string | null => {
  const cleaned = (name ?? '').trim().replace(/^["'\s]+|["'\s]+$/g, '');
  return cleaned && !cleaned.includes('@') ? cleaned : null;
};

/** Emails já no campo, em minúsculas e sem repetidos. */
export const recipientEmails = (value: string): string[] => [
  ...new Set(parseRecipients(value).map(email => email.toLowerCase())),
];

/** Junta emails ao campo (sem repetir os que lá estão). */
export const addRecipients = (value: string, emails: string[]): string => {
  const current = recipientEmails(value);
  const next = [...current];
  for (const email of emails) {
    const lower = email.toLowerCase();
    if (!next.includes(lower)) next.push(lower);
  }
  return next.join(', ');
};

export const removeRecipient = (value: string, email: string): string =>
  recipientEmails(value)
    .filter(item => item !== email.toLowerCase())
    .join(', ');

/** Quão bem o texto bate: 0 = começa pelo nome/email, 1 = contém, null = não bate. */
const rank = (query: string, ...fields: (string | null)[]): number | null => {
  let best: number | null = null;
  for (const field of fields) {
    if (!field) continue;
    const text = fold(field);
    if (text.startsWith(query) || text.split(/[\s@.]+/).some(word => word.startsWith(query)))
      return 0;
    if (text.includes(query)) best = 1;
  }
  return best;
};

interface SuggestInput {
  query: string;
  /** Colegas da empresa (diretório). */
  team: ContactEntry[];
  /** Quem já recebeu emails desta pessoa, do mais usado para o menos. */
  contacts: ContactEntry[];
  lists: ContactList[];
  /** Emails já no campo: não se voltam a sugerir. */
  exclude: string[];
  allowLists?: boolean;
}

/**
 * Sugestões ao digitar: primeiro as listas, depois quem já escreveu (do mais usado) e a equipa.
 * Sem texto mostram-se as listas e os mais usados.
 */
export const suggestRecipients = ({
  query,
  team,
  contacts,
  lists,
  exclude,
  allowLists = true,
}: SuggestInput): Suggestion[] => {
  const q = fold(query.trim());
  const taken = new Set(exclude.map(email => email.toLowerCase()));
  const out: Suggestion[] = [];

  if (allowLists) {
    const matches = lists
      .map(list => ({ list, score: q ? rank(q, list.name) : 0 }))
      .filter(item => item.score !== null && item.list.members.length > 0)
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
    for (const { list } of matches)
      out.push({
        kind: 'list',
        key: `list:${list.id}`,
        name: list.name,
        emails: list.members.map(member => member.email),
      });
  }

  const seen = new Set<string>();
  const people: { entry: ContactEntry; source: 'team' | 'sent'; score: number; order: number }[] =
    [];
  const collect = (entries: ContactEntry[], source: 'team' | 'sent') =>
    entries.forEach((entry, order) => {
      const email = entry.email.toLowerCase();
      if (!email || taken.has(email) || seen.has(email)) return;
      const score = q ? rank(q, entry.name, entry.email) : source === 'sent' ? 0 : null;
      if (score === null) return;
      seen.add(email);
      people.push({ entry, source, score, order });
    });
  // Quem já escreveu primeiro (aparece com o nome que se conhece); depois a equipa.
  collect(contacts, 'sent');
  collect(team, 'team');
  people.sort(
    (a, b) =>
      a.score - b.score ||
      (a.source === b.source ? a.order - b.order : a.source === 'sent' ? -1 : 1)
  );
  for (const { entry, source } of people)
    out.push({
      kind: 'person',
      key: `person:${entry.email.toLowerCase()}`,
      email: entry.email.toLowerCase(),
      name: entry.name,
      source,
    });
  return out.slice(0, MAX_SUGGESTIONS);
};
