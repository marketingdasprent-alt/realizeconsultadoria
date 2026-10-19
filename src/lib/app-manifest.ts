// Dois apps instaláveis no mesmo site: o do colaborador (/colaborador) e o do admin (/admin).
// Cada um tem o seu manifest (nome, ícone, cor, início); a página aponta para o certo conforme
// o endereço, e é esse que o browser instala ("Instalar app" / "Adicionar ao ecrã principal").

export type AppKind = 'colaborador' | 'admin';

const APPS: Record<AppKind, { manifest: string; title: string; icon: string; theme: string }> = {
  colaborador: {
    manifest: '/manifest.webmanifest',
    title: 'Realize',
    icon: '/apple-touch-icon.png',
    theme: '#B7933D',
  },
  admin: {
    manifest: '/manifest-admin.webmanifest',
    title: 'Realize Admin',
    icon: '/admin-apple-touch-icon.png',
    theme: '#6949E8',
  },
};

/** O endereço próprio do admin (admin.realizeconsultadoria.pt): aí tudo é o app do admin. */
export const isAdminHost = (hostname: string): boolean => hostname.startsWith('admin.');

export const appKindFor = (pathname: string, hostname = ''): AppKind =>
  isAdminHost(hostname) || pathname === '/admin' || pathname.startsWith('/admin/')
    ? 'admin'
    : 'colaborador';

const setAttribute = (selector: string, attribute: string, value: string) => {
  const element = document.querySelector(selector);
  if (element && element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
};

/** Manifest, ícone do iPhone, nome e cor do app a que pertence este endereço. */
export const applyAppManifest = (pathname: string, hostname = window.location.hostname): void => {
  const app = APPS[appKindFor(pathname, hostname)];
  setAttribute('link[rel="manifest"]', 'href', app.manifest);
  setAttribute('link[rel="apple-touch-icon"]', 'href', app.icon);
  setAttribute('meta[name="apple-mobile-web-app-title"]', 'content', app.title);
  setAttribute('meta[name="theme-color"]', 'content', app.theme);
};
