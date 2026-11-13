// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  POSTO_INVITE_DAYS,
  hashInviteToken,
  inviteExpiry,
  inviteLink,
  isInviteToken,
  newInviteToken,
  parsePostoBoxes,
  parsePostoName,
} from '../../../supabase/functions/_shared/mail/posto';

const ID_A = '0b5f7a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const ID_B = '1c6a8b4f-2d3e-4f60-9bac-1d2e3f4a5b6c';

describe('parsePostoName', () => {
  it('aceita um nome e tira os espaços a mais', () => {
    expect(parsePostoName('  Receção   Lisboa ')).toBe('Receção Lisboa');
  });
  it('recusa vazio, só espaços, não texto e acima de 80 caracteres', () => {
    expect(parsePostoName('')).toBeNull();
    expect(parsePostoName('   ')).toBeNull();
    expect(parsePostoName(42)).toBeNull();
    expect(parsePostoName('a'.repeat(81))).toBeNull();
    expect(parsePostoName('a'.repeat(80))).toBe('a'.repeat(80));
  });
});

describe('parsePostoBoxes', () => {
  it('aceita ids válidos e tira os repetidos', () => {
    expect(parsePostoBoxes([ID_A, ID_B, ID_A.toUpperCase()])).toEqual([ID_A, ID_B]);
  });
  it('aceita lista vazia (quem chama decide se é permitido)', () => {
    expect(parsePostoBoxes([])).toEqual([]);
  });
  it('recusa o que não é lista de ids, ou mais de 20 caixas', () => {
    expect(parsePostoBoxes('x')).toBeNull();
    expect(parsePostoBoxes([ID_A, 'não-é-id'])).toBeNull();
    expect(parsePostoBoxes([ID_A, 7])).toBeNull();
    const many = Array.from(
      { length: 21 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
    );
    expect(parsePostoBoxes(many)).toBeNull();
    expect(parsePostoBoxes(many.slice(0, 20))).toHaveLength(20);
  });
});

describe('código do convite', () => {
  it('é aleatório, tem 43 caracteres e só letras, números, - e _', () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(isInviteToken(a)).toBe(true);
  });
  it('recusa códigos com formato errado', () => {
    expect(isInviteToken('curto')).toBe(false);
    expect(isInviteToken('a'.repeat(44))).toBe(false);
    expect(isInviteToken(`${'a'.repeat(42)}!`)).toBe(false);
    expect(isInviteToken(null)).toBe(false);
    expect(isInviteToken(undefined)).toBe(false);
  });
  it('o hash é estável, em hexadecimal, e não deixa ver o código', async () => {
    const token = newInviteToken();
    const hash = await hashInviteToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashInviteToken(token)).toBe(hash);
    expect(await hashInviteToken(newInviteToken())).not.toBe(hash);
    expect(hash).not.toContain(token);
  });
});

describe('validade e link do convite', () => {
  it('expira ao fim de 7 dias', () => {
    const now = Date.parse('2026-11-13T10:00:00Z');
    expect(POSTO_INVITE_DAYS).toBe(7);
    expect(inviteExpiry(now)).toBe('2026-11-20T10:00:00.000Z');
  });
  it('o link abre a Realize Mail com o código, sem barras a mais', () => {
    expect(inviteLink('https://email.realizeconsultadoria.pt/', 'abc')).toBe(
      'https://email.realizeconsultadoria.pt/?posto=abc'
    );
  });
});
