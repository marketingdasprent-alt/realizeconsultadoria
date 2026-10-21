// Login único: o admin e o Workspace (área do colaborador) estão no mesmo endereço e na mesma
// app instalada; quem é das duas passa de uma para a outra pelo botão do topo. Com duas contas
// (uma de admin, outra de colaborador) a passagem leva um código de uso único (switch-account)
// que /auth/trocar troca pela sessão da outra conta.
import { isAdminHost } from './app-manifest';
import { ROUTES } from './constants';

export type SwitchTarget = 'admin' | 'workspace';

export const AREA_HOME: Record<SwitchTarget, string> = {
  admin: ROUTES.ADMIN.DASHBOARD,
  workspace: ROUTES.EMPLOYEE.DASHBOARD,
};

const isUnder = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/**
 * Área de uma página: /admin… é o admin, /colaborador… o Workspace; as outras (login, /auth…)
 * são da área do endereço (admin.realizeconsultadoria.pt → admin).
 */
export const areaFor = (pathname: string, hostname: string): SwitchTarget => {
  if (isUnder(pathname, ROUTES.ADMIN.DASHBOARD)) return 'admin';
  if (isUnder(pathname, ROUTES.EMPLOYEE.DASHBOARD)) return 'workspace';
  return isAdminHost(hostname) ? 'admin' : 'workspace';
};

/** Endereço que abre a área já com a sessão (o código vai no #, que não chega ao servidor). */
export const switchUrl = (to: SwitchTarget, tokenHash: string): string =>
  `${ROUTES.AUTH.SWITCH}#${new URLSearchParams({ token_hash: tokenHash, to })}`;

export const parseSwitchHash = (hash: string): { tokenHash: string; to: SwitchTarget } | null => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const tokenHash = params.get('token_hash');
  const to = params.get('to');
  if (!tokenHash || (to !== 'admin' && to !== 'workspace')) return null;
  return { tokenHash, to };
};
