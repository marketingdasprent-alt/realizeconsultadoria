import { describe, it, expect } from 'vitest';
import { addDays, format } from 'date-fns';

import {
  advanceRenewalDate,
  isCyclePaid,
  getCycleStatus,
  getFidelityStatus,
  FIDELITY_WARNING_DAYS,
} from '../recurring-services';

const today = new Date('2026-09-11T00:00:00');

describe('advanceRenewalDate', () => {
  it('avança um mês num serviço mensal', () => {
    expect(advanceRenewalDate('2026-09-11', 'monthly')).toBe('2026-10-11');
  });

  it('avança um ano num serviço anual', () => {
    expect(advanceRenewalDate('2026-09-11', 'yearly')).toBe('2027-09-11');
  });

  it('encosta ao último dia quando o mês seguinte é mais curto', () => {
    // 31/01 + 1 mês não existe; date-fns encosta a 28/02.
    expect(advanceRenewalDate('2026-01-31', 'monthly')).toBe('2026-02-28');
  });
});

describe('isCyclePaid', () => {
  it('considera pago quando a última data paga é o período anterior', () => {
    expect(
      isCyclePaid({
        renewal_date: '2026-10-11',
        billing_cycle: 'monthly',
        last_paid_date: '2026-09-11',
      })
    ).toBe(true);
  });

  it('considera pendente quando nunca foi pago', () => {
    expect(
      isCyclePaid({
        renewal_date: '2026-10-11',
        billing_cycle: 'monthly',
        last_paid_date: null,
      })
    ).toBe(false);
  });

  it('considera pendente quando a última data paga é de um ciclo antigo', () => {
    // Pagou Agosto mas a renovação já é a de Novembro: o ciclo actual está por pagar.
    expect(
      isCyclePaid({
        renewal_date: '2026-11-11',
        billing_cycle: 'monthly',
        last_paid_date: '2026-08-11',
      })
    ).toBe(false);
  });

  it('continua pago quando o mês seguinte é mais curto', () => {
    // 31/01 + 1 mês encosta a 28/02. Comparar pelo caminho inverso dava 28/01 ≠ 31/01
    // e o serviço aparecia como pendente logo a seguir a ser marcado como pago.
    expect(
      isCyclePaid({
        renewal_date: '2026-02-28',
        billing_cycle: 'monthly',
        last_paid_date: '2026-01-31',
      })
    ).toBe(true);
  });

  it('usa o ciclo anual para decidir o período anterior', () => {
    expect(
      isCyclePaid({
        renewal_date: '2027-09-11',
        billing_cycle: 'yearly',
        last_paid_date: '2026-09-11',
      })
    ).toBe(true);
  });
});

describe('getCycleStatus', () => {
  it('marca como regular quando falta mais de um mês', () => {
    const status = getCycleStatus('2026-12-25', today);
    expect(status.tone).toBe('ok');
    expect(status.daysUntil).toBe(105);
  });

  it('marca como atrasado quando a data já passou', () => {
    const status = getCycleStatus('2026-09-01', today);
    expect(status.tone).toBe('overdue');
    expect(status.label).toBe('Expirado há 10 dias');
  });

  it('usa o singular quando está atrasado um só dia', () => {
    expect(getCycleStatus('2026-09-10', today).label).toBe('Expirado há 1 dia');
  });

  it('marca como urgente quando renova hoje', () => {
    const status = getCycleStatus('2026-09-11', today);
    expect(status.tone).toBe('urgent');
    expect(status.label).toBe('Renova hoje');
  });

  it('marca como urgente até sete dias antes', () => {
    expect(getCycleStatus('2026-09-18', today).tone).toBe('urgent');
  });

  it('marca como próximo entre oito e trinta dias', () => {
    const status = getCycleStatus('2026-09-19', today);
    expect(status.tone).toBe('soon');
    expect(status.label).toBe('Renova em 8 dias');
  });
});

describe('getFidelityStatus', () => {
  it('devolve null quando não há fidelização', () => {
    expect(getFidelityStatus(null, today)).toBeNull();
  });

  it('marca como terminada quando a data já passou', () => {
    const status = getFidelityStatus('2026-09-10', today);
    expect(status?.tone).toBe('ended');
    expect(status?.label).toBe('Sem fidelização');
  });

  it('avisa dentro da janela de aviso', () => {
    const status = getFidelityStatus('2026-10-11', today);
    expect(status?.tone).toBe('soon');
    expect(status?.label).toBe('Acaba em 30 dias');
  });

  it('não avisa fora da janela de aviso', () => {
    const forat = getFidelityStatus('2027-09-11', today);
    expect(forat?.tone).toBe('ok');
    expect(forat?.label).toBe('Até 11/09/2027');
  });

  it('trata o limite da janela como aviso', () => {
    const limite = format(addDays(today, FIDELITY_WARNING_DAYS), 'yyyy-MM-dd');
    const status = getFidelityStatus(limite, today);
    expect(status?.tone).toBe('soon');
  });
});
