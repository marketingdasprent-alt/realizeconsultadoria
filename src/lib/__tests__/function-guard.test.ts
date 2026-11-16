// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  bearerToken,
  escapeHtml,
  isRecent,
  isSystemCall,
  safeEqual,
  systemCallDenied,
} from '../../../supabase/functions/_shared/guard';

const SERVICE = 'service-key-de-teste';
const SYSTEM = 'token-de-sistema-de-teste';
const secrets = { serviceKey: SERVICE, systemToken: SYSTEM };
const cors = { 'Access-Control-Allow-Origin': '*' };

const call = (headers: Record<string, string> = {}) =>
  new Request('https://exemplo.test/functions/v1/send-birthday-reminders', {
    method: 'POST',
    headers,
  });

describe('safeEqual', () => {
  it('iguais e diferentes, incluindo tamanhos diferentes e vazio', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('abcd', 'abc')).toBe(false);
    expect(safeEqual('', '')).toBe(true);
    expect(safeEqual('', 'a')).toBe(false);
  });
});

describe('bearerToken', () => {
  it('lê o token do Authorization e ignora o que não é Bearer', () => {
    expect(bearerToken(call({ Authorization: 'Bearer abc.def' }))).toBe('abc.def');
    expect(bearerToken(call({ Authorization: 'bearer   abc' }))).toBe('abc');
    expect(bearerToken(call({ Authorization: 'Basic abc' }))).toBeNull();
    expect(bearerToken(call({ Authorization: 'Bearer' }))).toBeNull();
    expect(bearerToken(call())).toBeNull();
  });
});

describe('isSystemCall: só o sistema passa', () => {
  it('a chave de serviço no Authorization serve', () => {
    expect(isSystemCall(call({ Authorization: `Bearer ${SERVICE}` }), secrets)).toBe(true);
  });
  it('o token de sistema no cabeçalho x-system-token serve (o que a base de dados envia)', () => {
    expect(isSystemCall(call({ 'x-system-token': SYSTEM }), secrets)).toBe(true);
  });
  it('sem credencial (como o agendador de hoje) é recusado', () => {
    expect(isSystemCall(call(), secrets)).toBe(false);
  });
  it('a chave pública (anon) ou o JWT de um utilizador não servem', () => {
    expect(isSystemCall(call({ Authorization: 'Bearer eyJhbGciOi.anon.jwt' }), secrets)).toBe(
      false
    );
    expect(
      isSystemCall(call({ Authorization: 'Bearer eyJ.utilizador.jwt', apikey: 'anon' }), secrets)
    ).toBe(false);
  });
  it('credencial errada ou trocada entre os dois cabeçalhos é recusada', () => {
    expect(isSystemCall(call({ Authorization: `Bearer ${SERVICE}x` }), secrets)).toBe(false);
    expect(isSystemCall(call({ 'x-system-token': `${SYSTEM}x` }), secrets)).toBe(false);
    expect(isSystemCall(call({ Authorization: `Bearer ${SYSTEM}` }), secrets)).toBe(false);
    expect(isSystemCall(call({ 'x-system-token': SERVICE }), secrets)).toBe(false);
  });
  it('segredo em falta no ambiente nunca deixa passar uma credencial vazia', () => {
    expect(isSystemCall(call({ 'x-system-token': '' }), { serviceKey: '', systemToken: '' })).toBe(
      false
    );
    expect(
      isSystemCall(call({ Authorization: 'Bearer x' }), { serviceKey: null, systemToken: null })
    ).toBe(false);
    expect(isSystemCall(call({ 'x-system-token': SYSTEM }), { serviceKey: SERVICE })).toBe(false);
  });
});

describe('systemCallDenied', () => {
  it('chamada do sistema: null (a função continua)', () => {
    expect(systemCallDenied(call({ 'x-system-token': SYSTEM }), secrets, cors)).toBeNull();
  });
  it('qualquer outra: resposta 401 com CORS, sem revelar segredos', async () => {
    const response = systemCallDenied(call({ Authorization: 'Bearer outra' }), secrets, cors);
    expect(response?.status).toBe(401);
    expect(response?.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const text = await response!.text();
    expect(text).toContain('Não autorizado');
    expect(text).not.toContain(SERVICE);
    expect(text).not.toContain(SYSTEM);
  });
});

describe('escapeHtml', () => {
  it('o texto aparece como foi escrito, sem executar HTML', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)"> & \'a\'')).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;a&#39;'
    );
    expect(escapeHtml('Olá, tudo bem?')).toBe('Olá, tudo bem?');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('isRecent (aviso só para o que acabou de ser criado)', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  it('aceita até 15 minutos e uma folga de 1 minuto no futuro', () => {
    expect(isRecent('2026-11-16T11:59:30Z', now)).toBe(true);
    expect(isRecent('2026-11-16T11:45:30Z', now)).toBe(true);
    expect(isRecent('2026-11-16T12:00:30Z', now)).toBe(true);
  });
  it('recusa o antigo, o muito futuro e datas inválidas', () => {
    expect(isRecent('2026-11-16T11:44:00Z', now)).toBe(false);
    expect(isRecent('2026-11-16T12:05:00Z', now)).toBe(false);
    expect(isRecent('lixo', now)).toBe(false);
  });
});
