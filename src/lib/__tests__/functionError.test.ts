// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { functionErrorMessage } from '../functionError';

const withBody = (body: BodyInit | null, status = 403) => ({
  context: new Response(body, { status }),
});

describe('functionErrorMessage', () => {
  it('devolve o motivo do corpo JSON', async () => {
    const error = withBody(JSON.stringify({ error: 'Colaborador não encontrado' }), 404);
    expect(await functionErrorMessage(error, 'geral')).toBe('Colaborador não encontrado');
  });

  it('corpo sem motivo, não JSON ou sem contexto: mensagem geral', async () => {
    expect(await functionErrorMessage(withBody('{}'), 'geral')).toBe('geral');
    expect(await functionErrorMessage(withBody('<html>'), 'geral')).toBe('geral');
    expect(await functionErrorMessage(new Error('non-2xx'), 'geral')).toBe('geral');
    expect(await functionErrorMessage(null, 'geral')).toBe('geral');
  });
});
