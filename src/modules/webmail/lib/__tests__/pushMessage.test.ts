import { describe, expect, it } from 'vitest';
import { internalPath, parseMailPush, parseOpenMessage } from '../pushMessage';

describe('parseMailPush', () => {
  it('aceita um email novo e limpa os textos', () => {
    expect(
      parseMailPush({ type: 'rz-push', kind: 'mail', title: ' Ana ', body: 'Orçamento', url: '/' })
    ).toEqual({ title: 'Ana', body: 'Orçamento', url: '/' });
  });
  it('sem título usa "Email novo"', () => {
    expect(parseMailPush({ type: 'rz-push', kind: 'mail' })?.title).toBe('Email novo');
  });
  it('ignora o que não é email novo', () => {
    expect(parseMailPush({ type: 'rz-push', kind: 'chat' })).toBeNull();
    expect(parseMailPush({ type: 'outra', kind: 'mail' })).toBeNull();
    expect(parseMailPush(null)).toBeNull();
    expect(parseMailPush('texto')).toBeNull();
  });
  it('corta textos enormes', () => {
    const mail = parseMailPush({
      type: 'rz-push',
      kind: 'mail',
      title: 'a'.repeat(500),
      body: 'b'.repeat(900),
    });
    expect(mail?.title).toHaveLength(120);
    expect(mail?.body).toHaveLength(240);
  });
});

describe('parseOpenMessage', () => {
  it('devolve o endereço pedido', () => {
    expect(parseOpenMessage({ type: 'rz-open', url: 'https://x.pt/a' })).toBe('https://x.pt/a');
  });
  it('ignora mensagens de outro tipo ou sem endereço', () => {
    expect(parseOpenMessage({ type: 'rz-push', url: '/' })).toBeNull();
    expect(parseOpenMessage({ type: 'rz-open' })).toBeNull();
    expect(parseOpenMessage(undefined)).toBeNull();
  });
});

describe('internalPath', () => {
  const origin = 'https://email.realizeconsultadoria.pt';
  it('aceita endereços desta origem, completos ou só o caminho', () => {
    expect(internalPath(`${origin}/?suporte=1#x`, origin)).toBe('/?suporte=1#x');
    expect(internalPath('/colaborador/email', origin)).toBe('/colaborador/email');
  });
  it('recusa outra origem (nunca navega para fora)', () => {
    expect(internalPath('https://app.realizeconsultadoria.pt/', origin)).toBeNull();
    expect(internalPath('https://evil.example/', origin)).toBeNull();
  });
});
