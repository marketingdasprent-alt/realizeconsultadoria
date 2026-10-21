import { describe, expect, it } from 'vitest';
import { loginRedirect } from '../login-redirect';

const from = (pathname: string, search = '') => ({ from: { pathname, search } });

describe('loginRedirect', () => {
  it('sends each account to its area', () => {
    expect(loginRedirect('employee', null)).toBe('/colaborador');
    expect(loginRedirect('admin', null)).toBe('/admin');
  });

  it('goes back to the page it came from only within the same area', () => {
    expect(loginRedirect('employee', from('/ponto/nfc', '?t=abc'))).toBe('/ponto/nfc?t=abc');
    expect(loginRedirect('employee', from('/colaborador/ponto'))).toBe('/colaborador/ponto');
    expect(loginRedirect('employee', from('/admin/ponto'))).toBe('/colaborador');
    expect(loginRedirect('admin', from('/admin/comunicados'))).toBe('/admin/comunicados');
    expect(loginRedirect('admin', from('/colaborador'))).toBe('/admin');
    expect(loginRedirect('admin', from('/admin/login'))).toBe('/admin');
  });
});
