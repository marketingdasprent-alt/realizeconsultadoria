import { describe, expect, it } from 'vitest';
import {
  cycleSentence,
  emptyPaidForm,
  parseAmount,
  paidFormFrom,
  renewalFor,
  validatePaidForm,
} from '../paidServiceForm';
import { fromService } from '../paidServices';

const TODAY = new Date(2026, 9, 20);

const existing = fromService({
  id: 's1',
  service_type: 'subscription',
  name: 'Microsoft 365',
  provider: 'Microsoft',
  company_id: 'c1',
  location: null,
  amount: 344.12,
  billing_cycle: 'monthly',
  renewal_date: '2026-10-05',
  last_paid_date: null,
  fidelity_end: null,
  notes: null,
});

describe('formulário de serviço pago', () => {
  it('reads amounts written the Portuguese way', () => {
    expect(parseAmount('32,90')).toBe(32.9);
    expect(parseAmount('1 200,5')).toBe(1200.5);
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });

  it('asks for name, value and start date', () => {
    expect(validatePaidForm(emptyPaidForm('domain'))).toEqual({
      name: 'Indique o domínio.',
      amount: 'Valor inválido.',
      startDate: 'Indique a data de início.',
    });
  });

  it('uses the renewal day as start for old services', () => {
    expect(paidFormFrom(existing)).toMatchObject({ startDate: '2026-10-05', amount: '344,12' });
  });

  it('keeps the renewal (and paid state) when start and cycle did not change', () => {
    expect(renewalFor(paidFormFrom(existing), existing, TODAY)).toEqual({
      renewalDate: '2026-10-05',
      keepPaid: true,
    });
  });

  it('computes the next renewal from the start date and the cycle', () => {
    const form = {
      ...paidFormFrom(existing),
      startDate: '2025-01-31',
      cycle: 'quarterly' as const,
    };
    expect(renewalFor(form, existing, TODAY)).toEqual({
      renewalDate: '2026-10-31',
      keepPaid: false,
    });
    const domain = {
      ...emptyPaidForm('domain'),
      name: 'x.pt',
      amount: '10',
      startDate: '2024-03-05',
    };
    expect(renewalFor(domain, null, TODAY).renewalDate).toBe('2027-03-05');
  });

  it('describes the cycle', () => {
    expect(cycleSentence('monthly', '2026-01-05')).toBe('Todos os meses, no dia 5');
    expect(cycleSentence('yearly', '2026-03-05')).toBe('Todos os anos, a 5 de março');
    expect(cycleSentence('quarterly', '2026-03-05')).toBe('De 3 em 3 meses');
  });
});
