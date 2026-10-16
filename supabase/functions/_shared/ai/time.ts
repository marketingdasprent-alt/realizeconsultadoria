// Datas e texto do assistente: o modelo fala em hora de Lisboa ("2026-10-17T10:00"); a base
// de dados guarda UTC. Só funções puras (testadas em src/lib/__tests__/ai-time.test.ts).

const TZ = 'Europe/Lisbon';

const zoneParts = (date: Date) => {
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out: Record<string, number> = {};
  for (const part of format.formatToParts(date))
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  return out;
};

/** Diferença entre a hora de Lisboa e UTC nesse instante (1 h no verão, 0 no inverno). */
const offsetMs = (date: Date): number => {
  const p = zoneParts(date);
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
    Math.floor(date.getTime() / 1000) * 1000
  );
};

/** "2026-10-17T10:00" (hora de Lisboa) → instante UTC; null se o texto não for uma data. */
export const lisbonToUtc = (local: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(local.trim());
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
  let guess = naive - offsetMs(new Date(naive));
  guess = naive - offsetMs(new Date(guess));
  const date = new Date(guess);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** "2026-10-17T10:00" em hora de Lisboa, a partir de um instante. */
export const utcToLisbon = (date: Date): string => {
  const p = zoneParts(date);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
};

/** "sábado, 17 de outubro de 2026, 10:00" */
export const describeInstant = (date: Date): string =>
  new Intl.DateTimeFormat('pt-PT', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

/** "sexta-feira, 16 de outubro de 2026" */
export const describeDay = (date: Date): string =>
  new Intl.DateTimeFormat('pt-PT', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);

/** Sem acentos, em minúsculas e com espaços normalizados (para comparar nomes). */
export const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export interface Person {
  user_id: string;
  name: string;
  position?: string | null;
  department?: string | null;
}

/** Colegas cujo nome contém todas as palavras escritas ("joão bahia"). Os iguais ganham. */
export const matchPeople = (name: string, people: Person[]): Person[] => {
  const words = fold(name).split(' ').filter(Boolean);
  if (!words.length) return [];
  const exact = people.filter(p => fold(p.name) === fold(name));
  if (exact.length) return exact;
  return people.filter(p => {
    const full = fold(p.name);
    return words.every(word => full.includes(word));
  });
};
