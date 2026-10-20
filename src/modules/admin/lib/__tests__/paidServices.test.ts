import { describe, expect, it } from 'vitest';
import {
  filterPaid,
  fromDomain,
  fromService,
  monthlyCost,
  summarizePaid,
  togglePaidPatch,
  type ServiceRow,
} from '../paidServices';

const TODAY = new Date(2026, 9, 20);

const service = (overrides: Partial<ServiceRow> = {}): ServiceRow => ({
  id: 's1',
  service_type: 'subscription',
  name: 'Microsoft 365',
  provider: 'Microsoft',
  company_id: 'c1',
  location: null,
  amount: 120,
  billing_cycle: 'monthly',
  renewal_date: '2026-11-05',
  last_paid_date: null,
  fidelity_end: null,
  notes: null,
  companies: { name: 'DASPRENT' },
  ...overrides,
});

describe('fromDomain / fromService', () => {
  it('turns a domain into a yearly paid service', () => {
    const domain = fromDomain({
      id: 'd1',
      domain_name: 'realize.pt',
      renewal_value: 29.9,
      renewal_date: '2027-02-06',
      last_paid_year: 2026,
    });
    expect(domain).toMatchObject({ kind: 'domain', cycle: 'yearly', amount: 29.9, paid: true });
    expect(
      fromDomain({
        id: 'd2',
        domain_name: 'x.pt',
        renewal_value: 10,
        renewal_date: '2026-12-17',
        last_paid_year: null,
      }).paid
    ).toBe(false);
  });

  it('keeps the service type, company and paid state', () => {
    const paid = fromService(service({ last_paid_date: '2026-10-05' }));
    expect(paid).toMatchObject({ kind: 'subscription', companyName: 'DASPRENT', paid: true });
    expect(fromService(service({ service_type: 'internet' })).kind).toBe('internet');
  });
});

describe('totals and filters', () => {
  const list = [
    fromService(service()),
    fromService(
      service({
        id: 's2',
        name: 'NOS Fibra',
        service_type: 'internet',
        amount: 40,
        renewal_date: '2026-10-18',
      })
    ),
    fromDomain({
      id: 'd1',
      domain_name: 'dasprent.pt',
      renewal_value: 36,
      renewal_date: '2027-05-01',
      last_paid_year: 2026,
    }),
  ];

  it('adds up the monthly equivalent (yearly / 12)', () => {
    expect(monthlyCost({ amount: 36, cycle: 'yearly' })).toBe(3);
    const summary = summarizePaid(list, TODAY);
    expect(summary.perMonth).toBe(163);
    expect(summary.perYear).toBe(1956);
    expect(summary).toMatchObject({ dueSoon: 2, dueSoonAmount: 160, overdue: 1 });
  });

  it('filters by type, company and text, soonest renewal first', () => {
    expect(filterPaid(list, { kind: 'all', companyId: 'all', search: '' }).map(s => s.id)).toEqual([
      's2',
      's1',
      'd1',
    ]);
    expect(filterPaid(list, { kind: 'domain', companyId: 'all', search: '' })).toHaveLength(1);
    expect(filterPaid(list, { kind: 'all', companyId: 'c1', search: '' })).toHaveLength(2);
    expect(
      filterPaid(list, { kind: 'all', companyId: 'all', search: 'fibra' }).map(s => s.id)
    ).toEqual(['s2']);
  });
});

describe('togglePaidPatch', () => {
  it('moves a domain renewal one year forward, and back', () => {
    const unpaid = fromDomain({
      id: 'd',
      domain_name: 'x.pt',
      renewal_value: 10,
      renewal_date: '2026-12-17',
      last_paid_year: null,
    });
    expect(togglePaidPatch(unpaid)).toEqual({
      table: 'site_domains',
      patch: { renewal_date: '2027-12-17', last_paid_year: 2026 },
    });
    const paid = fromDomain({
      id: 'd',
      domain_name: 'x.pt',
      renewal_value: 10,
      renewal_date: '2027-12-17',
      last_paid_year: 2026,
    });
    expect(togglePaidPatch(paid).patch).toEqual({
      renewal_date: '2026-12-17',
      last_paid_year: null,
    });
  });

  it('moves a monthly service one month forward and restores the saved date to undo', () => {
    expect(togglePaidPatch(fromService(service({ renewal_date: '2026-01-31' })))).toEqual({
      table: 'recurring_services',
      patch: { renewal_date: '2026-02-28', last_paid_date: '2026-01-31' },
    });
    const paid = fromService(service({ renewal_date: '2026-02-28', last_paid_date: '2026-01-31' }));
    expect(togglePaidPatch(paid).patch).toEqual({
      renewal_date: '2026-01-31',
      last_paid_date: null,
    });
  });
});
