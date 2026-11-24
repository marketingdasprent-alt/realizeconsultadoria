// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isImapAuthFailure } from '../../../supabase/functions/_shared/mail/imap-auth';

describe('classificação de recusas IMAP', () => {
  it.each([
    { responseText: 'NO [UNAVAILABLE] Authentication failed' },
    { responseCode: 'TRYLATER' },
    { responseCode: 'INUSE' },
    { responseCode: 'LIMIT' },
    { code: 'ECONNRESET' },
    { code: 'ECONNREFUSED' },
    { code: 'ETIMEDOUT' },
    { code: 'ESOCKET' },
    { message: 'Temporary authentication failure' },
    { message: 'Too many connections' },
    { message: 'Rate limit exceeded' },
    { message: 'Connection closed' },
    { message: 'Unexpected close' },
    { message: 'Try again later' },
    { message: 'Login timed out' },
  ])('sinal temporário prevalece sobre authenticationFailed: %j', detail => {
    expect(isImapAuthFailure({ authenticationFailed: true, ...detail })).toBe(false);
  });
  it.each([
    { authenticationFailed: true },
    { responseCode: 'AUTHENTICATIONFAILED' },
    { responseText: 'Invalid credentials' },
    { message: 'Authentication failed' },
    { message: 'LOGIN failed' },
  ])('recusa verdadeira continua autenticação: %j', detail => {
    expect(isImapAuthFailure(detail)).toBe(true);
  });
  it.each([null, undefined, 'erro genérico', new Error('falha desconhecida'), {}])(
    'não inventa erro de credenciais: %j',
    error => {
      expect(isImapAuthFailure(error)).toBe(false);
    }
  );
});
