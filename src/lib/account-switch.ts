// Login único: o admin e o Workspace (área do colaborador) aceitam qualquer conta e cada um
// abre a área certa; quem é das duas passa de uma para a outra pelo botão do topo.
// Em produção cada área tem o seu endereço (sessões separadas): a passagem leva um código de
// uso único (switch-account) que o outro site troca pela sessão em /auth/trocar.
import { ROUTES } from './constants';

export type SwitchTarget = 'admin' | 'workspace';

export const AREA_HOME: Record<SwitchTarget, string> = {
  admin: ROUTES.ADMIN.DASHBOARD,
  workspace: ROUTES.EMPLOYEE.DASHBOARD,
};

const PRODUCTION_ORIGINS: Record<SwitchTarget, string> = {
  admin: 'https://admin.realizeconsultadoria.pt',
  workspace: 'https://app.realizeconsultadoria.pt',
};

const PRODUCTION_HOSTS = new Set(
  Object.values(PRODUCTION_ORIGINS).map(origin => new URL(origin).hostname)
);

interface SiteLocation {
  hostname: string;
  origin: string;
}

/** Onde abre cada área: nos dois endereços da Realize, o seu; nos outros, o mesmo site. */
export const targetOrigin = (to: SwitchTarget, site: SiteLocation): string =>
  PRODUCTION_HOSTS.has(site.hostname) ? PRODUCTION_ORIGINS[to] : site.origin;

/** A área está noutro endereço (é preciso levar a sessão). */
export const isOtherSite = (to: SwitchTarget, site: SiteLocation): boolean =>
  targetOrigin(to, site) !== site.origin;

/** Endereço que abre a área já com a sessão (o código vai no #, que não chega ao servidor). */
export const switchUrl = (to: SwitchTarget, tokenHash: string, site: SiteLocation): string =>
  `${targetOrigin(to, site)}${ROUTES.AUTH.SWITCH}#${new URLSearchParams({ token_hash: tokenHash, to })}`;

export const parseSwitchHash = (hash: string): { tokenHash: string; to: SwitchTarget } | null => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const tokenHash = params.get('token_hash');
  const to = params.get('to');
  if (!tokenHash || (to !== 'admin' && to !== 'workspace')) return null;
  return { tokenHash, to };
};
