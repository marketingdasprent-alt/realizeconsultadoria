import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_CATEGORIES,
  formatPeriodMonth,
  getExpiryInfo,
  matchPayslipFiles,
  toPeriodMonth,
} from '../documents';

describe('getExpiryInfo', () => {
  const today = new Date('2026-09-24T12:00:00');

  it('classifies validity relative to today', () => {
    expect(getExpiryInfo(null, today).state).toBe('none');
    expect(getExpiryInfo('2030-01-01', today)).toMatchObject({ state: 'valid' });
    expect(getExpiryInfo('2026-10-20', today)).toMatchObject({ state: 'expiring', daysLeft: 26 });
    expect(getExpiryInfo('2026-09-24', today)).toMatchObject({
      state: 'expiring',
      label: 'Expira hoje',
    });
    expect(getExpiryInfo('2026-09-01', today)).toMatchObject({ state: 'expired', daysLeft: -23 });
  });
});

describe('period helpers', () => {
  it('formats and builds payslip months', () => {
    expect(toPeriodMonth('2026-09')).toBe('2026-09-01');
    expect(formatPeriodMonth('2026-09-01')).toBe('setembro 2026');
    expect(formatPeriodMonth(null)).toBe('—');
  });
});

describe('DOCUMENT_CATEGORIES', () => {
  it('keeps the legacy category values used by existing rows', () => {
    const values = DOCUMENT_CATEGORIES.map(c => c.value);
    for (const legacy of [
      'contrato',
      'ficha_admissao',
      'certificado',
      'documento_identificacao',
      'comunicado',
      'outro',
    ]) {
      expect(values).toContain(legacy);
    }
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('matchPayslipFiles', () => {
  const employees = [
    { id: 'e1', name: 'João Pedro Silva', document_number: '123456789' },
    { id: 'e2', name: 'Maria João Costa', document_number: null },
    { id: 'e3', name: 'Ana Silva', document_number: null },
  ];

  it('matches by full normalised name, ignoring accents and separators', () => {
    const [m] = matchPayslipFiles([{ name: 'Recibo_2026-09_Joao-Pedro-SILVA.pdf' }], employees);
    expect(m).toMatchObject({ employeeId: 'e1', confidence: 'exact' });
  });

  it('matches by first + last name when the middle name is missing', () => {
    const [m] = matchPayslipFiles([{ name: 'maria costa setembro.pdf' }], employees);
    expect(m).toMatchObject({ employeeId: 'e2', confidence: 'partial' });
  });

  it('matches by document number', () => {
    const [m] = matchPayslipFiles([{ name: 'recibo 123456789.pdf' }], employees);
    expect(m).toMatchObject({ employeeId: 'e1', confidence: 'exact' });
  });

  it('leaves ambiguous or unknown files unmatched', () => {
    const [ambiguous, unknown] = matchPayslipFiles(
      [{ name: 'silva.pdf' }, { name: 'recibo setembro.pdf' }],
      employees
    );
    expect(ambiguous.employeeId).toBeNull();
    expect(unknown.employeeId).toBeNull();
  });
});
