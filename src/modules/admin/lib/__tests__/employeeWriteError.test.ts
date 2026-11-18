import { describe, expect, it } from 'vitest';
import {
  ONE_COMPANY_INDEX,
  ONE_COMPANY_MESSAGE,
  friendlyEmployeeWriteError,
  isOneCompanyViolation,
} from '../employeeWriteError';

const pgError = (code: string, message: string) => ({ code, message, details: null });

describe('employeeWriteError', () => {
  const oneCompany = pgError(
    '23505',
    `duplicate key value violates unique constraint "${ONE_COMPANY_INDEX}"`
  );

  it('reconhece o 23505 do índice "um colaborador, uma empresa ativa"', () => {
    expect(isOneCompanyViolation(oneCompany)).toBe(true);
  });

  it('não confunde com outro duplicado (email na mesma empresa)', () => {
    const email = pgError(
      '23505',
      'duplicate key value violates unique constraint "employees_email_company_id_key"'
    );
    expect(isOneCompanyViolation(email)).toBe(false);
    expect(friendlyEmployeeWriteError(email)).toBe(email);
  });

  it('o mesmo texto com outro código não conta', () => {
    expect(isOneCompanyViolation(pgError('23514', ONE_COMPANY_INDEX))).toBe(false);
  });

  it('dá a frase clara em português, sem código nem nome do índice', () => {
    const friendly = friendlyEmployeeWriteError(oneCompany);
    expect(friendly).toBeInstanceOf(Error);
    const message = (friendly as Error).message;
    expect(message).toBe(ONE_COMPANY_MESSAGE);
    expect(message).not.toContain('23505');
    expect(message).not.toContain(ONE_COMPANY_INDEX);
  });

  it('aceita o nome do índice também em details', () => {
    expect(
      isOneCompanyViolation({ code: '23505', message: 'duplicate key', details: ONE_COMPANY_INDEX })
    ).toBe(true);
  });

  it('erros que não são da base passam como estavam', () => {
    const error = new Error('rede em baixo');
    expect(friendlyEmployeeWriteError(error)).toBe(error);
    expect(friendlyEmployeeWriteError(null)).toBeNull();
  });
});
