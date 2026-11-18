import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fold } from '../../../supabase/functions/_shared/ai/time';

// index.ts da função ai-chat usa Deno.serve e imports remotos: não se importa no Vitest.
// Lê-se o código-fonte e extrai-se o literal de FILES_HINT, para testar o regex que corre de facto.
const source = readFileSync('supabase/functions/ai-chat/index.ts', 'utf-8');
const literal = /const FILES_HINT =\s*(?:\/\/[^\n]*\n\s*)*\/(.+)\/([a-z]*);/.exec(source);

describe('FILES_HINT (pedidos de ficheiros na IA)', () => {
  it('o literal existe e não tem caracteres de controlo (0x08 no lugar de \b)', () => {
    expect(literal).not.toBeNull();
    // eslint-disable-next-line no-control-regex
    expect(/[\x00-\x08\x0b-\x1f]/.test(literal![1])).toBe(false);
  });

  const hint = new RegExp(literal![1], literal![2]);

  it.each([
    'Encontra o contrato da Urbango',
    'onde está a pasta de faturas?',
    'procura o ficheiro das férias',
  ])('casa: %s', text => {
    expect(hint.test(fold(text))).toBe(true);
  });

  it.each(['Quantos dias de férias tenho?', 'O que tenho amanhã?', 'pastagem e contratos'])(
    'não casa: %s',
    text => {
      expect(hint.test(fold(text))).toBe(false);
    }
  );
});
