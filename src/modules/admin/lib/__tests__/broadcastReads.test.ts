import { describe, expect, it } from 'vitest';
import type { BroadcastEmployee } from '../broadcast';
import { confirmationsOf } from '../broadcastReads';

const person = (id: string, company_id = 'c1', is_active = true): BroadcastEmployee => ({
  id,
  name: id,
  email: `${id}@x.pt`,
  company_id,
  companyName: null,
  department: null,
  is_active,
  user_id: `u-${id}`,
});

const team = [person('ana'), person('rui'), person('eva', 'c2'), person('zé', 'c1', false)];

describe('confirmationsOf', () => {
  it('counts each reached person once, with their first confirmation', () => {
    const result = confirmationsOf(
      [{ id: 'n1', company_id: 'c1', employee_id: null }],
      [
        { notification_id: 'n1', employee_id: 'rui', read_at: '2026-10-21T16:00:00Z' },
        { notification_id: 'other', employee_id: 'ana', read_at: '2026-10-21T16:00:00Z' },
      ],
      team
    );
    expect(result.confirmed.map(c => c.employee.id)).toEqual(['rui']);
    expect(result.pending.map(p => p.id)).toEqual(['ana']);
  });

  it('handles one notice per person and a notice for everyone', () => {
    const individual = confirmationsOf(
      [
        { id: 'a', company_id: null, employee_id: 'ana' },
        { id: 'e', company_id: null, employee_id: 'eva' },
      ],
      [{ notification_id: 'e', employee_id: 'eva', read_at: '2026-10-21T16:00:00Z' }],
      team
    );
    expect(individual.pending.map(p => p.id)).toEqual(['ana']);
    expect(individual.noticeOf.get('ana')).toBe('a');

    const everyone = confirmationsOf([{ id: 'g', company_id: null, employee_id: null }], [], team);
    expect(everyone.pending).toHaveLength(3);
  });
});
