// Quadro "Hoje" (Ponto, no admin): quem está a trabalhar, em pausa ou já saiu, e onde —
// agrupado pelo sítio do último registo (escritório criado em Locais, ou a morada).
import type { TimeClockEntryWithRelations } from '@/lib/timeclock';
import { deriveWorkday } from '@/lib/workday';

export interface BoardEmployee {
  id: string;
  name: string;
  userId: string | null;
  companyId: string;
  companyName: string | null;
}

export type BoardState = 'working' | 'paused' | 'done' | 'not_started' | 'absent';
export type PlaceKind = 'office' | 'address' | 'none';

export interface BoardPerson {
  employee: BoardEmployee;
  state: BoardState;
  /** A trabalhar / em pausa desde. */
  since: string | null;
  startedAt: string | null;
  endedAt: string | null;
  workedMs: number;
  place: string | null;
  placeKind: PlaceKind | null;
  coords: { lat: number; lng: number } | null;
  /** Tipo da ausência de hoje (férias, baixa…), quando está ausente. */
  absenceType: string | null;
}

export interface BoardGroup {
  place: string;
  kind: PlaceKind;
  coords: { lat: number; lng: number } | null;
  people: BoardPerson[];
}

export const NO_PLACE = 'Sem localização';

interface BuildBoardInput {
  employees: BoardEmployee[];
  entries: TimeClockEntryWithRelations[];
  /** Quem usa o ponto (registou nos últimos dias): aparece em "Ainda não começou". */
  regulars: Set<string>;
  /** Ausentes hoje (aprovado), com o tipo. */
  absences: Map<string, string>;
  now?: Date;
}

const STATE_BY_STATUS = { working: 'working', paused: 'paused', closed: 'done' } as const;

/** Sítio do último registo de hoje que tem sítio: o escritório, a morada ou nenhum. */
const placeOf = (entries: TimeClockEntryWithRelations[]) => {
  for (const entry of [...entries].reverse()) {
    const coords =
      entry.latitude !== null && entry.longitude !== null
        ? { lat: entry.latitude, lng: entry.longitude }
        : null;
    if (entry.location?.name)
      return { place: entry.location.name, kind: 'office' as const, coords };
    if (entry.address) return { place: entry.address, kind: 'address' as const, coords };
  }
  return { place: NO_PLACE, kind: 'none' as const, coords: null };
};

/** Uma linha por pessoa: quem registou hoje, quem usa o ponto e ainda não começou, e ausentes. */
export const buildBoard = ({
  employees,
  entries,
  regulars,
  absences,
  now = new Date(),
}: BuildBoardInput): BoardPerson[] => {
  const byEmployee = new Map<string, TimeClockEntryWithRelations[]>();
  for (const entry of entries) {
    const list = byEmployee.get(entry.employee_id) ?? [];
    list.push(entry);
    byEmployee.set(entry.employee_id, list);
  }

  const people: BoardPerson[] = [];
  for (const employee of employees) {
    const workday = deriveWorkday(byEmployee.get(employee.id) ?? [], now);
    const absenceType = absences.get(employee.id) ?? null;
    const base = {
      employee,
      since: null,
      startedAt: null,
      endedAt: null,
      workedMs: 0,
      place: null,
      placeKind: null,
      coords: null,
      absenceType,
    };
    if (workday.entries.length > 0) {
      const { place, kind, coords } = placeOf(workday.entries);
      people.push({
        ...base,
        state: STATE_BY_STATUS[workday.status],
        since: workday.since,
        startedAt: workday.startedAt,
        endedAt: workday.endedAt,
        workedMs: workday.workedMs,
        place,
        placeKind: kind,
        coords,
      });
    } else if (absenceType) {
      people.push({ ...base, state: 'absent' });
    } else if (regulars.has(employee.id)) {
      people.push({ ...base, state: 'not_started' });
    }
  }
  return people;
};

const STATE_ORDER: Record<BoardState, number> = {
  working: 0,
  paused: 1,
  done: 2,
  not_started: 3,
  absent: 4,
};
const KIND_ORDER: Record<PlaceKind, number> = { office: 0, address: 1, none: 2 };

/**
 * Quem registou hoje, por sítio: escritórios primeiro (os com mais gente à frente), depois
 * moradas e, no fim, sem localização. Dentro de cada um: a trabalhar, em pausa, saiu.
 */
export const groupByPlace = (people: BoardPerson[]): BoardGroup[] => {
  const groups = new Map<string, BoardGroup>();
  for (const person of people) {
    if (!person.place || !person.placeKind) continue;
    const group = groups.get(person.place) ?? {
      place: person.place,
      kind: person.placeKind,
      coords: person.coords,
      people: [],
    };
    group.people.push(person);
    groups.set(person.place, group);
  }
  for (const group of groups.values())
    group.people.sort(
      (a, b) =>
        STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
        a.employee.name.localeCompare(b.employee.name)
    );
  return [...groups.values()].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      b.people.length - a.people.length ||
      a.place.localeCompare(b.place)
  );
};

export const boardCounts = (people: BoardPerson[]): Record<BoardState, number> => {
  const counts = { working: 0, paused: 0, done: 0, not_started: 0, absent: 0 };
  for (const person of people) counts[person.state] += 1;
  return counts;
};

/** Link do Google Maps para o sítio (coordenadas do registo). */
export const mapsUrl = (coords: { lat: number; lng: number }): string =>
  `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
