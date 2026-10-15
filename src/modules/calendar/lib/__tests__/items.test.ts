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
