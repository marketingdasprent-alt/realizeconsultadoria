import { describe, it, expect, vi } from 'vitest';

// O módulo absence-overlap importa o supabase client (usado por findApprovedConflicts).
// As funções testadas aqui são puras e não lhe tocam, mas o simples import inicializa
// o client — e no CI os jobs de teste correm sem .env, pelo que createClient rebenta
// com "supabaseUrl is required". Mockar evita isso (padrão de mocking do projeto).
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { periodsConflict, findSelfConflicts, describeConflicts } from '../absence-overlap';

const fullDay = (start: string, end = start) => ({
  start_date: start,
  end_date: end,
  period_type: 'full_day',
  start_time: null,
  end_time: null,
});

const partial = (day: string, startTime: string, endTime: string) => ({
  start_date: day,
  end_date: day,
  period_type: 'partial',
  start_time: startTime,
  end_time: endTime,
});

describe('periodsConflict', () => {
  it('não deteta conflito em dias diferentes', () => {
    expect(periodsConflict(fullDay('2026-08-10'), fullDay('2026-08-11'))).toBe(false);
  });

  it('deteta conflito no mesmo dia inteiro', () => {
    expect(periodsConflict(fullDay('2026-08-10'), fullDay('2026-08-10'))).toBe(true);
  });

  it('deteta um dia solto dentro de um intervalo maior', () => {
    // O caso do Lourenço: 05/08 solto dentro de 15/07–11/08.
    expect(periodsConflict(fullDay('2026-08-05'), fullDay('2026-07-15', '2026-08-11'))).toBe(true);
  });

  it('deteta intervalos que se cruzam parcialmente', () => {
    expect(
      periodsConflict(fullDay('2026-08-03', '2026-08-07'), fullDay('2026-08-07', '2026-08-13'))
    ).toBe(true);
  });

  it('permite dois períodos parciais no mesmo dia em horas diferentes', () => {
    // O caso da Christielly: formação de manhã + consulta à tarde.
    expect(
      periodsConflict(
        partial('2026-03-05', '09:00', '13:00'),
        partial('2026-03-05', '16:00', '17:00')
      )
    ).toBe(false);
  });

  it('deteta dois períodos parciais no mesmo dia com horas sobrepostas', () => {
    expect(
      periodsConflict(
        partial('2026-03-05', '09:00', '13:00'),
        partial('2026-03-05', '11:00', '12:00')
      )
    ).toBe(true);
  });

  it('trata horas coladas como não sobrepostas', () => {
    expect(
      periodsConflict(
        partial('2026-03-05', '09:00', '13:00'),
        partial('2026-03-05', '13:00', '17:00')
      )
    ).toBe(false);
  });

  it('aceita horas no formato HH:MM:SS vindo da base de dados', () => {
    expect(
      periodsConflict(
        partial('2026-03-05', '09:00:00', '13:00:00'),
        partial('2026-03-05', '16:00:00', '17:00:00')
      )
    ).toBe(false);
  });

  it('um período de dia inteiro bloqueia sempre um parcial no mesmo dia', () => {
    expect(periodsConflict(fullDay('2026-03-05'), partial('2026-03-05', '16:00', '17:00'))).toBe(
      true
    );
  });

  it('trata como dia inteiro um parcial sem horas preenchidas', () => {
    const semHoras = { start_date: '2026-03-05', end_date: '2026-03-05', period_type: 'partial' };
    expect(periodsConflict(semHoras, partial('2026-03-05', '16:00', '17:00'))).toBe(true);
  });
});

describe('findSelfConflicts', () => {
  it('devolve null quando os períodos do pedido não colidem entre si', () => {
    expect(findSelfConflicts([fullDay('2026-08-10'), fullDay('2026-08-12')])).toBeNull();
  });

  it('devolve o par em conflito quando o utilizador repete um dia', () => {
    expect(
      findSelfConflicts([fullDay('2026-08-10'), fullDay('2026-08-12'), fullDay('2026-08-10')])
    ).toEqual([0, 2]);
  });
});

describe('describeConflicts', () => {
  it('descreve um conflito de dia inteiro', () => {
    const msg = describeConflicts([
      {
        absenceId: 'a',
        absenceType: 'vacation',
        date: '2026-08-05',
        startTime: null,
        endTime: null,
      },
    ]);
    expect(msg).toBe('Já existe uma ausência aprovada em 05/08/2026 (Férias).');
  });

  it('inclui as horas num conflito parcial', () => {
    const msg = describeConflicts([
      {
        absenceId: 'a',
        absenceType: 'appointment',
        date: '2026-03-05',
        startTime: '16:00',
        endTime: '17:00',
      },
    ]);
    expect(msg).toContain('05/03/2026 (Consultas, 16:00-17:00)');
  });

  it('resume quando há mais de três conflitos', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      absenceId: `a${i}`,
      absenceType: 'vacation',
      date: `2026-08-0${i + 1}`,
      startTime: null,
      endTime: null,
    }));
    expect(describeConflicts(many)).toContain('e mais 2');
  });
});
