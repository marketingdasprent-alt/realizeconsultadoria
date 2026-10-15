import { describe, expect, it } from 'vitest';
import {
  calculateBusinessDaysFromHours,
  calculateHoursBetween,
  countBusinessDays,
  countTotalBusinessDays,
  isBusinessDay,
  type Holiday,
} from '../vacation-utils';

const holiday = (date: string): Holiday => ({
  id: date,
  date,
  name: 'Feriado',
  year: Number(date.slice(0, 4)),
  is_national: true,
});

describe('dias úteis (regra das férias)', () => {
  it('fim de semana não conta', () => {
    expect(isBusinessDay(new Date(2026, 9, 17), [])).toBe(false); // sábado
    expect(isBusinessDay(new Date(2026, 9, 18), [])).toBe(false); // domingo
    expect(isBusinessDay(new Date(2026, 9, 19), [])).toBe(true); // segunda
  });

  it('feriado não conta', () => {
    expect(isBusinessDay(new Date(2026, 11, 8), [holiday('2026-12-08')])).toBe(false);
  });

  it('conta uma semana completa como 5 dias e inclui as duas pontas', () => {
    expect(countBusinessDays(new Date(2026, 9, 19), new Date(2026, 9, 25), [])).toBe(5);
    expect(countBusinessDays(new Date(2026, 9, 19), new Date(2026, 9, 19), [])).toBe(1);
  });

  it('soma vários períodos', () => {
    const total = countTotalBusinessDays(
      [
        { from: new Date(2026, 9, 19), to: new Date(2026, 9, 23), periodType: 'full_day' },
        { from: new Date(2026, 11, 7), to: new Date(2026, 11, 9), periodType: 'full_day' },
      ],
      [holiday('2026-12-08')]
    );
    expect(total).toBe(7);
  });
});

describe('períodos parciais (horas)', () => {
  it('8 h = 1 dia; arredonda a 0,25', () => {
    expect(calculateBusinessDaysFromHours(8)).toBe(1);
    expect(calculateBusinessDaysFromHours(4)).toBe(0.5);
    expect(calculateBusinessDaysFromHours(2)).toBe(0.25);
    // Meios arredondam para cima (Math.round): 3 h = 0,375 → 0,5; 5 h = 0,625 → 0,75.
    expect(calculateBusinessDaysFromHours(3)).toBe(0.5);
    expect(calculateBusinessDaysFromHours(5)).toBe(0.75);
  });

  it('horas entre duas horas do dia', () => {
    expect(calculateHoursBetween('09:00', '13:30')).toBe(4.5);
  });
});
