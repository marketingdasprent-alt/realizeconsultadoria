import { describe, expect, it } from 'vitest';
import type { AbsenceRow } from '@/modules/absences/lib/absenceRules';
import { buildItems } from '../items';

const base = { myUserId: 'me', events: [], holidays: [], tasks: [] };

describe('calendário: férias com vários períodos', () => {
  it('desenha cada período, não o intervalo do primeiro ao último dia', () => {
    const absence: AbsenceRow = {
      id: 'a1',
      start_date: '2026-04-27',
      end_date: '2027-01-04',
      absence_type: 'vacation',
      status: 'approved',
      notes: null,
      absence_periods: [
        {
          id: 'p1',
          start_date: '2026-04-27',
          end_date: '2026-04-27',
          business_days: 1,
          status: 'approved',
        },
        {
          id: 'p2',
          start_date: '2026-09-21',
          end_date: '2026-09-25',
          business_days: 5,
          status: 'approved',
        },
        {
          id: 'p3',
          start_date: '2026-12-28',
          end_date: '2027-01-04',
          business_days: 5,
          status: 'approved',
        },
      ],
    };
    const october = buildItems({
      ...base,
      from: new Date(2026, 9, 1),
      to: new Date(2026, 9, 31, 23, 59),
      absences: [absence],
    });
    expect(october).toHaveLength(0);

    const september = buildItems({
      ...base,
      from: new Date(2026, 8, 1),
      to: new Date(2026, 8, 30, 23, 59),
      absences: [absence],
    });
    expect(september.map(i => i.start.getDate())).toEqual([21]);
    expect(september[0].end.getDate()).toBe(25);
  });

  it('sem períodos usa as datas do pedido', () => {
    const items = buildItems({
      ...base,
      from: new Date(2026, 9, 1),
      to: new Date(2026, 9, 31),
      absences: [
        {
          id: 'a2',
          start_date: '2026-10-05',
          end_date: '2026-10-06',
          absence_type: 'vacation',
          status: 'pending',
          notes: null,
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain('pendente');
  });
});

describe('calendário: detalhe das ausências e feriados (lateral)', () => {
  it('cada bloco traz o detalhe e os outros períodos do pedido', () => {
    const absence: AbsenceRow = {
      id: 'a2',
      start_date: '2026-10-19',
      end_date: '2026-11-03',
      absence_type: 'vacation',
      status: 'approved',
      notes: 'Viagem',
      absence_periods: [
        {
          id: 'p1',
          start_date: '2026-10-19',
          end_date: '2026-10-21',
          business_days: 3,
          status: 'approved',
        },
        {
          id: 'p2',
          start_date: '2026-11-02',
          end_date: '2026-11-03',
          business_days: 2,
          status: 'pending',
        },
      ],
    };
    const items = buildItems({
      ...base,
      from: new Date(2026, 9, 1),
      to: new Date(2026, 10, 30),
      absences: [absence],
      holidays: [
        { id: 'h1', date: '2026-11-01', name: 'Todos os Santos', year: 2026, is_national: true },
      ],
    });
    const first = items.find(i => i.key === 'abs-a2-p1')?.info;
    expect(first).toMatchObject({ kind: 'absence', days: 3, pending: false, notes: 'Viagem' });
    expect(first?.kind === 'absence' && first.siblings).toHaveLength(1);
    expect(items.find(i => i.key === 'abs-a2-p2')?.info).toMatchObject({ pending: true });
    expect(items.find(i => i.key === 'hol-h1')?.info).toEqual({
      kind: 'holiday',
      name: 'Todos os Santos',
      national: true,
    });
  });
});
