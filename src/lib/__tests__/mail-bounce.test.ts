import { describe, expect, it } from 'vitest';
import {
  bounceNotice,
  explainBounce,
  isBounce,
} from '../../../supabase/functions/_shared/mail/bounce';

describe('isBounce', () => {
  it('reconhece pelo remetente e pelo assunto', () => {
    expect(isBounce('MAILER-DAEMON@cpanel168.example.pt', 'Qualquer coisa')).toBe(true);
    expect(isBounce('x@y.pt', 'Undelivered Mail Returned to Sender')).toBe(true);
    expect(isBounce('postmaster@outlook.com', 'Undeliverable: Proposta')).toBe(true);
    expect(isBounce('x@y.pt', 'Mail delivery failed: returning message to sender')).toBe(true);
    expect(isBounce('valdir@cliente.pt', 'Re: Proposta de seguro')).toBe(false);
  });
});

describe('explainBounce', () => {
  it('demasiados anexos (caso do Valdir)', () => {
    const info = explainBounce(
      'This message was created automatically.\n<valdir@cliente.pt>: host mx.cliente.pt said: 550 5.7.0 Too many MIME parts: 121 > 100',
      'bia@realizeconsultadoria.pt'
    );
    expect(info.recipient).toBe('valdir@cliente.pt');
    expect(info.reason).toMatch(/demasiados anexos/);
  });

  it('endereço que não existe, pelo Final-Recipient', () => {
    const info = explainBounce(
      'Final-Recipient: rfc822; joao@exemplo.pt\nAction: failed\nStatus: 5.1.1\nDiagnostic-Code: smtp; 550 5.1.1 User unknown',
      'eu@realizeconsultadoria.pt'
    );
    expect(info.recipient).toBe('joao@exemplo.pt');
    expect(info.reason).toMatch(/não existe/);
    expect(info.detail).toMatch(/^550 5\.1\.1/);
  });

  it('caixa cheia e motivo desconhecido', () => {
    expect(explainBounce('552 5.2.2 Mailbox full').reason).toMatch(/cheia/);
    expect(explainBounce('algo estranho').reason).toMatch(/recusou/);
  });

  it('não confunde o próprio endereço com o destinatário', () => {
    const info = explainBounce(
      'From: eu@realizeconsultadoria.pt\nTo: outra@cliente.pt',
      'eu@realizeconsultadoria.pt'
    );
    expect(info.recipient).toBe('outra@cliente.pt');
  });
});

describe('bounceNotice', () => {
  it('mostra o assunto original quando o aviso o tem', () => {
    const text = bounceNotice(
      { recipient: 'a@b.pt', reason: 'a caixa de quem recebe está cheia', detail: null },
      'Undeliverable: Proposta'
    );
    expect(text).toBe(
      'O email para a@b.pt não foi entregue: a caixa de quem recebe está cheia. (Proposta)'
    );
  });
});
