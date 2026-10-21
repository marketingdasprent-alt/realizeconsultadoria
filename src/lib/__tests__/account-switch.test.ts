import { describe, expect, it } from 'vitest';
import { areaFor, parseSwitchHash, switchUrl } from '../account-switch';

describe('account switch', () => {
  it('tells the area of a page, by path and then by address', () => {
    expect(areaFor('/admin/colaboradores', 'app.realizeconsultadoria.pt')).toBe('admin');
    expect(areaFor('/colaborador/ponto', 'admin.realizeconsultadoria.pt')).toBe('workspace');
    expect(areaFor('/', 'admin.realizeconsultadoria.pt')).toBe('admin');
    expect(areaFor('/auth/trocar', 'app.realizeconsultadoria.pt')).toBe('workspace');
    expect(areaFor('/administracao', 'localhost')).toBe('workspace');
  });

  it('carries the one-time code in the hash, on the same address, and reads it back', () => {
    const url = switchUrl('admin', 'abc123');
    expect(url).toBe('/auth/trocar#token_hash=abc123&to=admin');
    expect(parseSwitchHash(url.slice(url.indexOf('#')))).toEqual({
      tokenHash: 'abc123',
      to: 'admin',
    });
    expect(parseSwitchHash('#token_hash=abc&to=root')).toBeNull();
    expect(parseSwitchHash('')).toBeNull();
  });
});
