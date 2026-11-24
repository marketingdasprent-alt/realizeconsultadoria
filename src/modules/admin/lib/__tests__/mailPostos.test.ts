import { describe, expect, it } from 'vitest';
import type { MailPosto, PostoBox } from '../../services/mailPostosService';
import { boxState, postoInScope, postoState } from '../mailPostos';

const posto = (over: Partial<MailPosto> = {}): MailPosto => ({
  id: 'p1',
  userId: 'u1',
  name: 'Receção Lisboa',
  createdAt: '2026-11-13T10:00:00Z',
  lastLoginAt: null,
  disabledAt: null,
  inviteExpiresAt: null,
  boxes: [],
  ...over,
});

const box = (over: Partial<PostoBox> = {}): PostoBox => ({
  accessId: 'a1',
  title: 'Geral',
  email: 'geral@empresa.pt',
  accountId: 'm1',
  companyId: 'c1',
  status: 'active',
  lastError: null,
  ...over,
});

describe('postoState', () => {
  it('sem link nem acesso: sem link enviado', () => {
    expect(postoState(posto())).toBe('no-link');
  });
  it('com link por usar: à espera de instalar', () => {
    expect(postoState(posto({ inviteExpiresAt: '2026-11-20T10:00:00Z' }))).toBe('invited');
  });
  it('já entrou: em uso', () => {
    expect(postoState(posto({ lastLoginAt: '2026-11-14T09:00:00Z' }))).toBe('active');
  });
  it('desligado ganha a tudo', () => {
    expect(
      postoState(posto({ disabledAt: '2026-11-15T09:00:00Z', lastLoginAt: '2026-11-14T09:00:00Z' }))
    ).toBe('disabled');
  });
});

describe('boxState', () => {
  it('ligada, por ligar, palavra-passe a rever e erro', () => {
    expect(boxState(box())).toEqual({ label: 'Ligada', tone: 'ok' });
    expect(boxState(box({ status: 'pending', accountId: null }))).toEqual({
      label: 'Por ligar',
      tone: 'wait',
    });
    expect(boxState(box({ status: 'reauth' })).tone).toBe('error');
    expect(boxState(box({ status: 'error' })).label).toBe('Com erro');
  });
});

describe('postoInScope: os postos seguem o seletor de empresa', () => {
  const doisSitios = posto({
    boxes: [box({ companyId: 'c1' }), box({ accessId: 'a2', companyId: 'c2' })],
  });

  it('sem escolha (Todas as empresas) todos os postos contam', () => {
    expect(postoInScope(doisSitios, null)).toBe(true);
  });

  it('com uma empresa escolhida, conta se alguma caixa for dela', () => {
    expect(postoInScope(doisSitios, new Set(['c2']))).toBe(true);
  });

  it('com uma empresa escolhida, não conta se nenhuma caixa for dela', () => {
    expect(postoInScope(doisSitios, new Set(['c9']))).toBe(false);
  });

  it('um posto sem caixas só aparece sem escolha', () => {
    expect(postoInScope(posto({ boxes: [] }), null)).toBe(true);
    expect(postoInScope(posto({ boxes: [] }), new Set(['c1']))).toBe(false);
  });
});
