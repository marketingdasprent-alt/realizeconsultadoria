import { describe, expect, it } from 'vitest';
import { isOtherSite, parseSwitchHash, switchUrl, targetOrigin } from '../account-switch';

const app = {
  hostname: 'app.realizeconsultadoria.pt',
  origin: 'https://app.realizeconsultadoria.pt',
};
const admin = {
  hostname: 'admin.realizeconsultadoria.pt',
  origin: 'https://admin.realizeconsultadoria.pt',
};
const local = { hostname: 'localhost', origin: 'http://localhost:8080' };

describe('account switch', () => {
  it('opens each area on its own address in production, and on the same site elsewhere', () => {
    expect(targetOrigin('admin', app)).toBe('https://admin.realizeconsultadoria.pt');
    expect(targetOrigin('workspace', admin)).toBe('https://app.realizeconsultadoria.pt');
    expect(targetOrigin('admin', local)).toBe('http://localhost:8080');
    expect(isOtherSite('admin', app)).toBe(true);
    expect(isOtherSite('admin', admin)).toBe(false);
    expect(isOtherSite('workspace', local)).toBe(false);
  });

  it('carries the one-time code in the hash and reads it back', () => {
    const url = switchUrl('admin', 'abc123', app);
    expect(url).toBe(
      'https://admin.realizeconsultadoria.pt/auth/trocar#token_hash=abc123&to=admin'
    );
    expect(parseSwitchHash(new URL(url).hash)).toEqual({ tokenHash: 'abc123', to: 'admin' });
    expect(parseSwitchHash('#token_hash=abc&to=root')).toBeNull();
    expect(parseSwitchHash('')).toBeNull();
  });
});
