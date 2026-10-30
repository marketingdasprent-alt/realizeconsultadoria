// Ordem das pessoas nos seletores (responsável, participantes, convidados): primeiro as que a
// pessoa escolheu há pouco, depois as do seu departamento, depois as outras (por nome).

export interface RankedPerson {
  userId: string;
  name: string;
  department: string | null;
}

export type PeopleGroup = 'recent' | 'department' | 'others';

export const PEOPLE_GROUP_LABEL: Record<PeopleGroup, string> = {
  recent: 'Recentes',
  department: 'Do seu departamento',
  others: 'Todos',
};

const MAX_RECENT = 6;
const RECENT_KEY = 'rz.people.recent';

/** Pessoas por grupo, cada grupo já ordenado (recentes pela ordem em que foram escolhidas). */
export const rankPeople = <T extends RankedPerson>(
  people: T[],
  recent: string[],
  department: string | null
): { group: PeopleGroup; people: T[] }[] => {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'pt');
  const recentIds = recent.slice(0, MAX_RECENT);
  const used = new Set<string>();
  const recentPeople = recentIds
    .map(id => people.find(p => p.userId === id))
    .filter((p): p is T => !!p);
  recentPeople.forEach(p => used.add(p.userId));
  const sameDepartment = department
    ? people.filter(p => !used.has(p.userId) && p.department === department).sort(byName)
    : [];
  sameDepartment.forEach(p => used.add(p.userId));
  const others = people.filter(p => !used.has(p.userId)).sort(byName);
  return [
    { group: 'recent' as const, people: recentPeople },
    { group: 'department' as const, people: sameDepartment },
    { group: 'others' as const, people: others },
  ].filter(section => section.people.length > 0);
};

/** Quem a pessoa escolheu há pouco (neste browser), o mais recente primeiro. */
export const readRecentPeople = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export const rememberRecentPerson = (userId: string) => {
  try {
    const next = [userId, ...readRecentPeople().filter(id => id !== userId)].slice(0, 20);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // sem armazenamento (janela privada): fica sem recentes
  }
};
