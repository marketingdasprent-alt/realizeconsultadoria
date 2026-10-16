import { describe, expect, it } from 'vitest';
import type { EmployeeDocument } from '@/lib/documents';
import { buildRegistration } from '../registration';

const doc = (id: string, category: string, extra: Partial<EmployeeDocument> = {}) =>
  ({
    id,
    category,
    status: 'approved',
    is_current: true,
    file_name: `${id}.pdf`,
    created_at: '2026-10-01T10:00:00Z',
    ...extra,
  }) as EmployeeDocument;

describe('documentos de registo', () => {
  it('separa identificação/IBAN de comunicados e recibos', () => {
    const { rows, others, missing } = buildRegistration([
      doc('tr', 'titulo_residencia'),
      doc('com', 'comunicado'),
      doc('rec', 'recibo_vencimento'),
      doc('out', 'outro'),
    ]);
    expect(rows.map(r => r.doc.id)).toEqual(['tr']);
    expect(others.map(d => d.id)).toEqual(['com', 'out']);
    expect(missing.map(m => m.key)).toEqual(['iban']);
  });

  it('assinala a substituição à espera de aprovação', () => {
    const { rows } = buildRegistration([
      doc('cc', 'cartao_cidadao'),
      doc('cc2', 'cartao_cidadao', { status: 'pending', is_current: false }),
    ]);
    expect(rows[0].pendingReplacement).toBe(true);
  });

  it('sem documentos: faltam identificação e IBAN (e mostra se já foram enviados)', () => {
    const { missing } = buildRegistration([
      doc('i', 'iban', { status: 'pending', is_current: false }),
    ]);
    expect(missing).toMatchObject([
      { key: 'id', pending: false },
      { key: 'iban', pending: true },
    ]);
  });
});
