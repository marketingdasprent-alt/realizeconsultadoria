import { describe, expect, it } from 'vitest';
import { DEFAULT_HOUR_BANK, formatBalance, monthHourBank, type BankAbsence } from '../hourBank';

// Outubro 2026: dia 1 é quinta; dia 5 é feriado. Conta até dia 8 (exclusive): úteis 1, 2, 6, 7.
const base = {
  month: new Date(2026, 9, 1),
  today: new Date(2026, 9, 8, 10),
  holidays: [{ date: '2026-10-05', name: 'Implantação' }],
  settings: DEFAULT_HOUR_BANK,
};
const absence = (overrides: Partial<BankAbsence>): BankAbsence => ({
  employee_id: 'e1',
  absence_type: 'appointment',
  status: 'approved',
  start_date: '2026-10-06',
  end_date: '2026-10-06',
  absence_periods: [],
  ...overrides,
});

describe('monthHourBank', () => {
  it('sair mais cedo num dia e ficar mais tarde noutro dá saldo zero', () => {
    const worked = new Map([
      ['2026-10-01', 420], // 7h (saiu 1h mais cedo)
      ['2026-10-02', 540], // 9h (compensou)
      ['2026-10-06', 480],
      ['2026-10-07', 480],
    ]);
    const bank = monthHourBank({ ...base, workedByDay: worked, absences: [] });
    // Feriado (5) e fim de semana não contam; dia 8 (hoje) ainda não.
    expect(bank.days.map(d => d.date)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-06',
      '2026-10-07',
    ]);
    expect(bank.expected).toBe(4 * 480);
    expect(bank.balance).toBe(0);
  });

  it('dia útil sem registo nem ausência fica em falta', () => {
    const bank = monthHourBank({
      ...base,
      workedByDay: new Map([['2026-10-01', 480]]),
      absences: [],
    });
    expect(bank.balance).toBe(-3 * 480);
  });

  it('consulta de 2h justificada não fica em falta; a compensar fica', () => {
    const workedByDay = new Map([
      ['2026-10-01', 480],
      ['2026-10-02', 480],
      ['2026-10-06', 360],
      ['2026-10-07', 480],
    ]);
    const absences = [
      absence({
        absence_periods: [
          {
            start_date: '2026-10-06',
            end_date: '2026-10-06',
            status: 'approved',
            period_type: 'partial',
            start_time: '09:00:00',
            end_time: '11:00:00',
          },
        ],
      }),
    ];
    expect(monthHourBank({ ...base, workedByDay, absences }).balance).toBe(0);
    const compensate = monthHourBank({
      ...base,
      workedByDay,
      absences,
      settings: { ...DEFAULT_HOUR_BANK, absenceRules: { appointment: 'compensate' } },
    });
    expect(compensate.balance).toBe(-120);
    expect(compensate.days.find(d => d.date === '2026-10-06')?.toCompensate).toBe(120);
  });

  it('férias de dia inteiro contam o dia; pendentes não', () => {
    const vacation = absence({
      absence_type: 'vacation',
      start_date: '2026-10-01',
      end_date: '2026-10-07',
    });
    const approved = monthHourBank({ ...base, workedByDay: new Map(), absences: [vacation] });
    expect(approved.balance).toBe(0);
    const pending = monthHourBank({
      ...base,
      workedByDay: new Map(),
      absences: [{ ...vacation, status: 'pending' }],
    });
    expect(pending.balance).toBe(-4 * 480);
  });

  it('trabalho ao fim de semana é tudo a mais', () => {
    const bank = monthHourBank({
      ...base,
      today: new Date(2026, 9, 5),
      workedByDay: new Map([
        ['2026-10-01', 480],
        ['2026-10-02', 480],
        ['2026-10-03', 120],
      ]),
      absences: [],
    });
    expect(bank.balance).toBe(120);
  });
});

describe('início do banco de horas', () => {
  it('os dias antes da data de início não contam', () => {
    const bank = monthHourBank({
      ...base,
      workedByDay: new Map([['2026-10-07', 480]]),
      absences: [],
      settings: { ...DEFAULT_HOUR_BANK, startsOn: '2026-10-07' },
    });
    expect(bank.days.map(d => d.date)).toEqual(['2026-10-07']);
    expect(bank.balance).toBe(0);
  });
});

describe('formatBalance', () => {
  it('mostra o sinal', () => {
    expect(formatBalance(80)).toBe('+1h20');
    expect(formatBalance(-45)).toBe('−0h45');
    expect(formatBalance(0)).toBe('0h00');
  });
});
