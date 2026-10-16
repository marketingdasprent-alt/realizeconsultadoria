import { describe, expect, it } from 'vitest';
import type { AbsenceRow } from '../absenceRules';
import { buildPeriodItems, groupPeriodItems, yearSegments } from '../periodItems';

const NOW = new Date(2026, 9, 15, 12);

const period = (id: string, start: string, end: string, status = 'approved', days = 1) => ({
  id,
  start_date: start,
  end_date: end,
  business_days: days,
  status,
  period_type: 'full_day',
});

const absence = (over: Partial<AbsenceRow>): AbsenceRow => ({
  id: 'a1',
  start_date: '2026-04-27',
  end_date: '2027-01-04',
  absence_type: 'vacation',
  status: 'approved',
  notes: null,
  ...over,
});

describe('férias por período', () => {
  it('um pedido com períodos passado e futuro: só o futuro se edita', () => {
    const items = buildPeriodItems(
      [
        absence({
          absence_periods: [
            period('p1', '2026-04-27', '2026-04-27'),
            period('p2', '2026-12-28', '2027-01-04', 'approved', 5),
          ],
        }),
      ],
      NOW
    );
    expect(items.find(i => i.id === 'p1')).toMatchObject({ group: 'history', canEdit: false });
    expect(items.find(i => i.id === 'p2')).toMatchObject({
      group: 'upcoming',
      canEdit: true,
      canCancel: false,
      siblings: 2,
    });
  });

  it('em curso não se edita; hoje conta como em curso', () => {
    const [item] = buildPeriodItems(
      [absence({ absence_periods: [period('p', '2026-10-14', '2026-10-16')] })],
      NOW
    );
    expect(item).toMatchObject({ inProgress: true, canEdit: false, group: 'upcoming' });
  });

  it('rejeitado futuro precisa de atenção; pendente cancela-se; aprovado só se remarca', () => {
    const items = buildPeriodItems(
      [
        absence({
          id: 'r',
          status: 'rejected',
          rejection_reason: 'Fecho de contas',
          absence_periods: [period('pr', '2026-11-02', '2026-11-03', 'rejected', 2)],
        }),
        absence({
          id: 'w',
          status: 'pending',
          absence_periods: [period('pw', '2026-11-10', '2026-11-12', 'pending', 3)],
        }),
      ],
      NOW
    );
    const rejected = items.find(i => i.id === 'pr');
    expect(rejected).toMatchObject({
      group: 'attention',
      rejectionReason: 'Fecho de contas',
      canEdit: false,
      canCancel: true,
    });
    expect(items.find(i => i.id === 'pw')).toMatchObject({ canEdit: true, canCancel: true });
  });

  it('só férias se editam; consultas não', () => {
    const [item] = buildPeriodItems(
      [
        absence({
          absence_type: 'appointment',
          absence_periods: [period('c', '2026-11-04', '2026-11-04')],
        }),
      ],
      NOW
    );
    expect(item.canEdit).toBe(false);
  });

  it('pedidos antigos sem períodos aparecem, mas sem ações de edição', () => {
    const [item] = buildPeriodItems(
      [absence({ start_date: '2026-11-10', end_date: '2026-11-12', status: 'pending' })],
      NOW
    );
    expect(item).toMatchObject({ id: 'a:a1', canEdit: false, canCancel: false });
  });

  it('grupos ordenados: próximos por data, histórico do mais recente', () => {
    const items = buildPeriodItems(
      [
        absence({
          absence_periods: [
            period('b', '2026-12-01', '2026-12-02'),
            period('a', '2026-11-01', '2026-11-02'),
            period('x', '2026-03-01', '2026-03-02'),
            period('y', '2026-09-01', '2026-09-02'),
          ],
        }),
      ],
      NOW
    );
    const groups = groupPeriodItems(items);
    expect(groups.upcoming.map(i => i.id)).toEqual(['a', 'b']);
    expect(groups.history.map(i => i.id)).toEqual(['y', 'x']);
  });

  it('faixa do ano: um segmento por período, só do ano pedido', () => {
    const items = buildPeriodItems(
      [
        absence({
          absence_periods: [
            period('p1', '2026-01-01', '2026-01-01'),
            period('p2', '2026-12-31', '2027-01-04'),
          ],
        }),
      ],
      NOW
    );
    const segments = yearSegments(items, 2026);
    expect(segments).toHaveLength(2);
    expect(segments[0].left).toBe(0);
    expect(segments[1].left + segments[1].width).toBeLessThanOrEqual(100.01);
    expect(yearSegments(items, 2025)).toHaveLength(0);
  });
});
