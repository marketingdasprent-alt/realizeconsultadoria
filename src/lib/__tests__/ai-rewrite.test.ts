import { describe, expect, it } from 'vitest';
import {
  cleanRewrite,
  rewritePrompt,
  rewriteUserMessage,
} from '../../../supabase/functions/_shared/ai/rewrite';

describe('Usar IA no email', () => {
  it('limpa o que o modelo junta à volta do texto', () => {
    expect(
      cleanRewrite(
        'Aqui está o email reescrito:\n\nAssunto: Reunião\n\nBom dia,\n\n\n\n**Obrigado**'
      )
    ).toBe('Bom dia,\n\nObrigado');
    expect(cleanRewrite('"Olá Ana, tudo bem?"')).toBe('Olá Ana, tudo bem?');
    expect(cleanRewrite('   ')).toBe('');
  });

  it('o pedido leva o assunto e o email original só como contexto', () => {
    const message = rewriteUserMessage('envio amanha', 'Proposta', 'Bom dia, enviam a proposta?');
    expect(message).toContain('Assunto: Proposta');
    expect(message).toContain('só para contexto');
    expect(message.endsWith('Texto a reescrever:\nenvio amanha')).toBe(true);
    expect(rewriteUserMessage('olá', '', '')).toBe('Texto a reescrever:\nolá');
  });

  it('as instruções pedem português de Portugal e o objetivo escolhido', () => {
    const prompt = rewritePrompt('short', 'Thiago');
    expect(prompt).toContain('português de Portugal');
    expect(prompt).toContain('mais curto');
    expect(prompt).toContain('Thiago');
  });
});
