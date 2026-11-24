import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import { MAIL_ERRORS, mailErrorText, type MailError } from '../../services/mailService';

// Descrição do aviso «O rascunho não abriu» (WebmailPage.openSavedDraft), com o mesmo recurso.
const FALLBACK = 'O servidor de email não devolveu o rascunho. Tente outra vez.';
const description = (error: MailError | null) => mailErrorText(error) || FALLBACK;

describe('«O rascunho não abriu»: motivo do servidor', () => {
  it('código conhecido: o texto do mapa (mesmo com mensagem do servidor)', () => {
    expect(description({ code: 'unavailable', message: '' })).toBe(MAIL_ERRORS.unavailable);
    expect(description({ code: 'reauth', message: 'outra coisa' })).toBe(MAIL_ERRORS.reauth);
  });

  it('código desconhecido com mensagem do servidor: a mensagem', () => {
    expect(
      description({ code: 'message_gone', message: 'A mensagem já não existe nesta caixa.' })
    ).toBe('A mensagem já não existe nesta caixa.');
  });

  it('data nulo sem erro (ou erro sem texto): a frase de recurso', () => {
    expect(description(null)).toBe(FALLBACK);
    expect(description({ code: 'error', message: '' })).toBe(FALLBACK);
  });
});
