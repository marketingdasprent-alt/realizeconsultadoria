// Login único (/): depois de entrar, cada conta vai para a sua área. Volta à página de onde veio
// (ex.: /ponto/nfc?t=… vindo de uma tag NFC) só se for dessa mesma área.
import { ROUTES } from './constants';

type Role = 'admin' | 'company_admin' | 'employee';

const isUnder = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

export const loginRedirect = (role: Role, state: unknown): string => {
  const from = (state as { from?: { pathname?: string; search?: string } } | null)?.from;
  const path = from?.pathname ?? '';
  const back = `${path}${from?.search ?? ''}`;
  if (role === 'employee') {
    return isUnder(path, ROUTES.EMPLOYEE.DASHBOARD) || path.startsWith('/ponto/')
      ? back
      : ROUTES.EMPLOYEE.DASHBOARD;
  }
  return isUnder(path, ROUTES.ADMIN.DASHBOARD) && path !== '/admin/login'
    ? back
    : ROUTES.ADMIN.DASHBOARD;
};
