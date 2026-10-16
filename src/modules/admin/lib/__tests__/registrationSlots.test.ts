import { describe, expect, it } from 'vitest';
import type { EmployeeDocument } from '@/lib/documents';
import {
  payslipsByMonth,
  registrationHistory,
  sharedDocuments,
  slotStates,
} from '../registrationSlots';

const doc = (overrides: Partial<EmployeeDocument>): EmployeeDocument =>
  ({
    id: Math.random().toString(36),
    employee_id: 'e1',
    category: 'cartao_cidadao',
    status: 'approved',
    is_current: true,
    created_at: '2026-01-01T10:00:00Z',
    file_name: 'f.pdf',
    file_path: 'p',
    period_month: null,
    ...overrides,
  }) as EmployeeDocument;

describe('documentos de registo na ficha', () => {
  it('cada lugar mostra o documento atual e o que espera aprovação', () => {
    const states = slotStates([
      doc({ id: 'cc', category: 'cartao_cidadao' }),
      doc({ id: 'iban-new', category: 'iban', status: 'pending', is_current: false }),
    ]);
    const id = states.find(s => s.slot.key === 'id');
    const iban = states.find(s => s.slot.key === 'iban');
    expect(id?.current?.id).toBe('cc');
    expect(iban?.current).toBeNull();
    expect(iban?.pending.map(d => d.id)).toEqual(['iban-new']);
  });

  it('o passaporte também conta como identificação', () => {
    const [id] = slotStates([doc({ id: 'pp', category: 'passaporte' })]);
    expect(id.current?.id).toBe('pp');
  });

  it('um mês pode ter vários recibos (só os em vigor)', () => {
    const months = payslipsByMonth([
      doc({ id: 'a', category: 'recibo_vencimento', period_month: '2026-09-01' }),
      doc({
        id: 'b',
        category: 'recibo_vencimento',
        period_month: '2026-09-01',
        created_at: '2026-09-30T10:00:00Z',
      }),
      doc({
        id: 'old',
        category: 'recibo_vencimento',
        period_month: '2026-09-01',
        is_current: false,
      }),
    ]);
    expect(months.get('2026-09')?.map(d => d.id)).toEqual(['a', 'b']);
  });

  it('separa histórico, partilhados e recibos', () => {
    const docs = [
      doc({ id: 'old', category: 'cartao_cidadao', is_current: false }),
      doc({ id: 'rej', category: 'nif', status: 'rejected', is_current: false }),
      doc({ id: 'com', category: 'comunicado' }),
      doc({ id: 'r1', category: 'recibo_vencimento', period_month: '2026-09-01' }),
    ];
    expect(
      registrationHistory(docs)
        .map(d => d.id)
        .sort()
    ).toEqual(['old', 'rej']);
    expect(sharedDocuments(docs).map(d => d.id)).toEqual(['com']);
    expect(
      payslipsByMonth(docs)
        .get('2026-09')
        ?.map(d => d.id)
    ).toEqual(['r1']);
  });
});
