import { describe, expect, it } from 'vitest';
import { findDrift } from '../equipmentDrift';

const equipment = (id: string, employee_id: string | null) => ({
  id,
  label: `Equipamento ${id}`,
  company_id: 'c1',
  employee_id,
  holderName: employee_id,
});

describe('findDrift', () => {
  it('finds equipment whose record disagrees with the active delivery', () => {
    const drift = findDrift(
      [
        equipment('a', 'ana'),
        equipment('b', 'rui'),
        equipment('c', null),
        equipment('d', 'eva'),
        equipment('e', null),
      ],
      [
        { equipment_id: 'a', employee_id: 'ana', employeeName: 'Ana' },
        { equipment_id: 'b', employee_id: 'ana', employeeName: 'Ana' },
        { equipment_id: 'c', employee_id: 'ze', employeeName: 'Zé' },
      ]
    );
    expect(drift.map(d => [d.kind, d.equipment.id])).toEqual([
      ['mismatch', 'b'],
      ['mismatch', 'c'],
      ['no_delivery', 'd'],
    ]);
  });
});
