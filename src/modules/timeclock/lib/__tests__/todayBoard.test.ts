import { describe, expect, it } from 'vitest';
import type { TimeClockEntryWithRelations } from '@/lib/timeclock';
import {
  boardCounts,
  buildBoard,
  groupByPlace,
  mapsUrl,
  NO_PLACE,
  type BoardEmployee,
} from '../todayBoard';

const NOW = new Date('2026-10-20T15:00:00');

let seq = 0;
const entry = (
  employee_id: string,
  entry_type: 'in' | 'out',
  kind: 'work' | 'break',
  local: string,
  extra: Partial<TimeClockEntryWithRelations> = {}
): TimeClockEntryWithRelations =>
  ({
    id: `e${++seq}`,
    employee_id,
    company_id: 'c1',
    entry_type,
    kind,
    punched_at: new Date(local).toISOString(),
    status: 'valid',
    flags: [],
    source: 'gps',
    latitude: 39.74,
    longitude: -8.8,
    address: null,
    location: null,
    ...extra,
  }) as TimeClockEntryWithRelations;

const person = (id: string, name: string): BoardEmployee => ({
  id,
  name,
  userId: null,
  companyId: 'c1',
  companyName: 'DASPRENT',
});

const office = { location: { name: 'Rua Das Oliveiras' } };

describe('buildBoard', () => {
  const employees = [
    person('ana', 'Ana'),
    person('rui', 'Rui'),
    person('eva', 'Eva'),
    person('ze', 'Zé'),
    person('lia', 'Lia'),
    person('bia', 'Bia'),
  ];
  const entries = [
    entry('ana', 'in', 'work', '2026-10-20T09:00:00', office),
    entry('rui', 'in', 'work', '2026-10-20T09:30:00', { address: 'Rua X 12, Leiria' }),
    entry('rui', 'out', 'break', '2026-10-20T13:00:00', { latitude: null, longitude: null }),
    entry('eva', 'in', 'work', '2026-10-20T08:00:00', office),
    entry('eva', 'out', 'work', '2026-10-20T12:00:00', office),
    // Ontem: não conta como hoje.
    entry('ze', 'in', 'work', '2026-10-19T09:00:00', office),
    entry('ze', 'out', 'work', '2026-10-19T17:00:00', office),
  ];
  const people = buildBoard({
    employees,
    entries,
    regulars: new Set(['ana', 'rui', 'eva', 'ze', 'lia']),
    absences: new Map([['lia', 'vacation']]),
    now: NOW,
  });
  const byId = Object.fromEntries(people.map(p => [p.employee.id, p]));

  it('gives each person the state of the day', () => {
    expect(byId.ana).toMatchObject({
      state: 'working',
      place: 'Rua Das Oliveiras',
      placeKind: 'office',
    });
    expect(byId.ana.workedMs).toBe(6 * 3_600_000);
    expect(byId.rui).toMatchObject({
      state: 'paused',
      place: 'Rua X 12, Leiria',
      placeKind: 'address',
    });
    expect(byId.eva).toMatchObject({ state: 'done', workedMs: 4 * 3_600_000 });
    expect(byId.ze.state).toBe('not_started');
    expect(byId.lia).toMatchObject({ state: 'absent', absenceType: 'vacation' });
  });

  it('leaves out who does not use the clock', () => {
    expect(byId.bia).toBeUndefined();
    expect(boardCounts(people)).toEqual({
      working: 1,
      paused: 1,
      done: 1,
      not_started: 1,
      absent: 1,
    });
  });

  it('groups by place: offices first, then addresses, no location last', () => {
    const noGps = buildBoard({
      employees: [person('x', 'Xavier')],
      entries: [
        entry('x', 'in', 'work', '2026-10-20T10:00:00', { latitude: null, longitude: null }),
      ],
      regulars: new Set(),
      absences: new Map(),
      now: NOW,
    });
    const groups = groupByPlace([...people, ...noGps]);
    expect(groups.map(g => [g.place, g.people.map(p => p.employee.name)])).toEqual([
      ['Rua Das Oliveiras', ['Ana', 'Eva']],
      ['Rua X 12, Leiria', ['Rui']],
      [NO_PLACE, ['Xavier']],
    ]);
    expect(groups[1].coords).toEqual({ lat: 39.74, lng: -8.8 });
  });

  it('links the place to Google Maps', () => {
    expect(mapsUrl({ lat: 39.7, lng: -8.8 })).toBe(
      'https://www.google.com/maps/search/?api=1&query=39.7,-8.8'
    );
  });
});
