import { describe, expect, it } from 'vitest';
import {
  cleanCode,
  groupSecret,
  isMfaUnavailable,
  isValidCode,
  mfaErrorMessage,
  needsChallenge,
  qrSource,
} from '../mfa';

describe('confirmação em dois passos: regras', () => {
  it('o código são 6 dígitos (espaços de quem copia não contam)', () => {
    expect(cleanCode('123 456')).toBe('123456');
    expect(isValidCode('123456')).toBe(true);
    expect(isValidCode('123 456')).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('1234567')).toBe(false);
    expect(isValidCode('12345a')).toBe(false);
    expect(isValidCode('')).toBe(false);
  });

  it('o QR vira um endereço de imagem, com ou sem prefixo', () => {
    expect(qrSource('<svg/>')).toBe('data:image/svg+xml;utf-8,<svg/>');
    expect(qrSource('data:image/svg+xml;utf-8,<svg/>')).toBe('data:image/svg+xml;utf-8,<svg/>');
  });

  it('a chave aparece em grupos de 4', () => {
    expect(groupSecret('ABCDEFGHIJ')).toBe('ABCD EFGH IJ');
    expect(groupSecret('ABCD EFGH')).toBe('ABCD EFGH');
  });

  it('só pede o código quando há segundo passo e a sessão ainda não o fez', () => {
    expect(needsChallenge({ currentLevel: 'aal1', nextLevel: 'aal2' })).toBe(true);
    expect(needsChallenge({ currentLevel: 'aal2', nextLevel: 'aal2' })).toBe(false);
    expect(needsChallenge({ currentLevel: 'aal1', nextLevel: 'aal1' })).toBe(false);
    expect(needsChallenge(null)).toBe(false);
    expect(needsChallenge(undefined)).toBe(false);
  });

  it('as mensagens de erro são para a pessoa, nunca o texto técnico', () => {
    expect(mfaErrorMessage({ code: 'mfa_verification_failed' })).toMatch(/Código inválido/);
    expect(mfaErrorMessage({ message: 'Invalid TOTP code entered' })).toMatch(/Código inválido/);
    expect(mfaErrorMessage({ status: 429 })).toMatch(/Demasiadas tentativas/);
    expect(mfaErrorMessage({ code: 'mfa_totp_enroll_not_enabled' })).toMatch(
      /ainda não está disponível/
    );
    const unknown = mfaErrorMessage(new Error('boom: stack trace'));
    expect(unknown).not.toMatch(/boom|stack/);
    expect(mfaErrorMessage(undefined)).toMatch(/Não foi possível concluir/);
  });

  it('sabe quando o servidor não tem o recurso ligado', () => {
    expect(isMfaUnavailable({ code: 'mfa_totp_enroll_not_enabled' })).toBe(true);
    expect(isMfaUnavailable({ code: 'other' })).toBe(false);
    expect(isMfaUnavailable(null)).toBe(false);
  });
});
