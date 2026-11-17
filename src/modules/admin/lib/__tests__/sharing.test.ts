import { describe, expect, it } from 'vitest';
import {
  SharingError,
  formatShareCode,
  groupGrantable,
  normalizeShareCode,
  sharingErrorText,
  sortRequests,
  toSharingError,
  type Capability,
  type ShareRequest,
} from '../sharing';

const cap = (over: Partial<Capability>): Capability => ({
  capability: 'tickets.read',
  module: 'tickets',
  kind: 'read',
  grantable: true,
  sensitive: false,
  min_role: 'colaborador',
  description: 'Ver tickets',
  ...over,
});

const request = (over: Partial<ShareRequest>): ShareRequest => ({
  request_id: 'r1',
  status: 'pedido',
  created_at: '2026-11-10T10:00:00Z',
  expires_at: '2026-11-24T10:00:00Z',
  other_company_id: null,
  other_company_name: null,
  ask: [],
  offer: [],
  decided_at: null,
  decision_note: null,
  ...over,
});

describe('toSharingError', () => {
  it('usa o message como código estável', () => {
    const error = toSharingError({
      message: 'already_pending',
      details: 'Já existe.',
      code: '55000',
    });
    expect(error.code).toBe('already_pending');
    expect(error.detail).toBe('Já existe.');
  });

  it('reconhece a reautenticação e o limite de tentativas pelo SQLSTATE', () => {
    expect(toSharingError({ message: 'x', code: 'RZ401' }).code).toBe('reauth_required');
    expect(toSharingError({ message: 'x', code: 'RZ429' }).code).toBe('rate_limited');
  });

  it('função inexistente quer dizer que a migração ainda não foi aplicada', () => {
    expect(toSharingError({ message: 'Could not find the function', code: 'PGRST202' }).code).toBe(
      'unavailable'
    );
  });

  it('mensagem que não é um código vira erro desconhecido', () => {
    expect(toSharingError({ message: 'Failed to fetch' }).code).toBe('unknown');
  });
});

describe('sharingErrorText', () => {
  it('nunca mostra o código em bruto', () => {
    expect(sharingErrorText(new SharingError('already_pending'))).not.toMatch(/already_pending/);
    expect(sharingErrorText(new Error('boom'))).toBe('Não foi possível concluir. Tente outra vez.');
  });

  it('um código novo do servidor usa a frase do servidor', () => {
    expect(sharingErrorText(new SharingError('novo_codigo', 'Frase do servidor.'))).toBe(
      'Frase do servidor.'
    );
  });
});

describe('códigos da empresa', () => {
  it('normaliza espaços, hífenes e minúsculas', () => {
    expect(normalizeShareCode(' abcde-fghjk ')).toEqual({ code: 'ABCDEFGHJK', valid: true });
  });

  it('recusa letras e números que o alfabeto não tem (I, O, 0, 1) e tamanhos errados', () => {
    expect(normalizeShareCode('ABCDEFGHJ0').valid).toBe(false);
    expect(normalizeShareCode('ABCDEFGHIK').valid).toBe(false);
    expect(normalizeShareCode('ABC').valid).toBe(false);
  });

  it('mostra o código em dois blocos de cinco', () => {
    expect(formatShareCode('ABCDEFGHJK')).toBe('ABCDE FGHJK');
  });
});

describe('groupGrantable', () => {
  it('deixa de fora o que não se pode partilhar e agrupa por módulo', () => {
    const groups = groupGrantable([
      cap({}),
      cap({ capability: 'tickets.write' }),
      cap({ capability: 'hr.read', module: 'hr', grantable: false }),
      cap({ capability: 'mail.use', module: 'mail' }),
    ]);
    expect(groups.map(g => g.module)).toEqual(['tickets', 'mail']);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].label).toBe('Tickets');
  });
});

describe('sortRequests', () => {
  it('põe os pedidos por responder primeiro e depois os mais recentes', () => {
    const sorted = sortRequests([
      request({ request_id: 'velho', status: 'recusado', created_at: '2026-11-01T00:00:00Z' }),
      request({ request_id: 'aberto', created_at: '2026-11-05T00:00:00Z' }),
      request({ request_id: 'recente', status: 'aprovado', created_at: '2026-11-09T00:00:00Z' }),
    ]);
    expect(sorted.map(r => r.request_id)).toEqual(['aberto', 'recente', 'velho']);
  });
});
