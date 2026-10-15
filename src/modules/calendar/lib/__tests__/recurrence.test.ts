import { describe, expect, it } from 'vitest';
import { expandOccurrences } from '../recurrence';

const event = (overrides: Partial<Parameters<typeof expandOccurrences>[0]>) => ({
  startsAt: new Date(2026, 9, 5, 10, 0).toISOString(),
  endsAt: new Date(2026, 9, 5, 11, 0).toISOString(),
  recurrence: null,
  recurrenceUntil: null,
  ...overrides,
});

const oct = [new Date(2026, 9, 1), new Date(2026, 9, 31, 23, 59)] as const;

describe('ocorrências de eventos', () => {
  it('sem recorrência: uma ocorrência, se calhar no intervalo', () => {
    expect(expandOccurrences(event({}), ...oct)).toHaveLength(1);
    expect(
      expandOccurrences(event({}), new Date(2026, 10, 1), new Date(2026, 10, 30))
    ).toHaveLength(0);
  });

  it('semanal: todas as segundas de outubro a partir do dia 5', () => {
    const starts = expandOccurrences(event({ recurrence: 'weekly' }), ...oct).map(o =>
      o.start.getDate()
    );
    expect(starts).toEqual([5, 12, 19, 26]);
  });

  it('respeita a data de fim da recorrência', () => {
    const occ = expandOccurrences(
      event({ recurrence: 'daily', recurrenceUntil: '2026-10-07' }),
      ...oct
    );
    expect(occ.map(o => o.start.getDate())).toEqual([5, 6, 7]);
  });

  it('mensal a partir de 31: não escorrega para o dia 28', () => {
    const jan31 = event({
      startsAt: new Date(2026, 0, 31, 9).toISOString(),
      endsAt: new Date(2026, 0, 31, 10).toISOString(),
      recurrence: 'monthly',
    });
    const march = expandOccurrences(jan31, new Date(2026, 2, 1), new Date(2026, 2, 31, 23));
    expect(march.map(o => o.start.getDate())).toEqual([31]);
  });

  it('mantém a duração em cada ocorrência', () => {
    const [occ] = expandOccurrences(
      event({ recurrence: 'weekly' }),
      new Date(2026, 9, 12),
      new Date(2026, 9, 13)
    );
    expect(occ.end.getTime() - occ.start.getTime()).toBe(3_600_000);
  });
});
