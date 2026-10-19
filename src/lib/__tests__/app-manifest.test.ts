import { describe, expect, it } from 'vitest';
import { appKindFor, applyAppManifest } from '../app-manifest';

describe('dois apps instaláveis', () => {
  it('o /admin é o app do admin; o resto é o do colaborador', () => {
    expect(appKindFor('/admin')).toBe('admin');
    expect(appKindFor('/admin/colaboradores')).toBe('admin');
    expect(appKindFor('/administracao')).toBe('colaborador');
    expect(appKindFor('/colaborador')).toBe('colaborador');
    expect(appKindFor('/')).toBe('colaborador');
  });

  it('troca o manifest, o ícone e o nome', () => {
    document.head.innerHTML =
      '<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="apple-mobile-web-app-title" content="Realize"><meta name="theme-color" content="#B7933D">';
    applyAppManifest('/admin/login');
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe(
      '/manifest-admin.webmanifest'
    );
    expect(
      document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content')
    ).toBe('Realize Admin');
    applyAppManifest('/colaborador');
    expect(document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')).toBe(
      '/apple-touch-icon.png'
    );
  });
});
