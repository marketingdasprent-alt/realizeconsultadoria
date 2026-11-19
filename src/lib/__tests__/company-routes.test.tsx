import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '../constants';

let role: string | null = 'employee';
let access = { isAdmin: false, isLoading: false };
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ role }) }));
vi.mock('@/modules/workspace/hooks/useIsAdmin', () => ({ useAdminAccess: () => access }));
vi.mock('@/components/admin/PrintPreviewHost', () => ({ PrintPreviewHost: () => null }));
vi.mock('@/components/ProtectedRoute', () => ({ ProtectedRoute: () => null }));
vi.mock('@/modules/auth/components/MfaGate', () => ({ MfaGate: () => null }));
vi.mock('@/modules/timeclock/context/WorkdayProvider', () => ({ WorkdayProvider: () => null }));
vi.mock('@/modules/workspace/components/WorkspaceLayout', () => ({ default: () => null }));
vi.mock('@/modules/workspace/components/WorkspacePage', () => ({ WorkspacePage: () => null }));
vi.mock('@/modules/admin/context/CompanyScopeContext', () => ({
  CompanyScopeProvider: () => null,
}));
vi.mock('@/components/layout/AdminLayout', () => ({ default: () => null }));

const renderAt = async (path: string) => {
  const { AdminGate } = await import('@/components/layout/AdminArea');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AdminGate />}>
          <Route path="/admin/empresas" element={<div>lista</div>} />
          <Route path="/admin/empresas/nova" element={<div>criação</div>} />
          <Route path="/admin/empresas/:id" element={<div>edição</div>} />
        </Route>
        <Route path={ROUTES.EMPLOYEE.DASHBOARD} element={<div>workspace</div>} />
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => {
  role = 'employee';
  access = { isAdmin: false, isLoading: false };
});

describe('rotas das empresas', () => {
  it('constantes da lista, da criação e da edição', () => {
    expect(ROUTES.ADMIN.COMPANIES).toBe('/admin/empresas');
    expect(ROUTES.ADMIN.COMPANY_NEW).toBe('/admin/empresas/nova');
    expect(ROUTES.ADMIN.COMPANY_EDIT).toBe('/admin/empresas/:id');
  });

  it('o App regista as duas rotas novas dentro do AdminGate, ao lado da lista', () => {
    const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf-8');
    const gate = app.indexOf('<Route element={<AdminGate />}>');
    for (const path of ['/admin/empresas', '/admin/empresas/nova', '/admin/empresas/:id']) {
      const at = app.indexOf(`path="${path}"`);
      expect(at, path).toBeGreaterThan(gate);
    }
    expect(app).toContain("import('./modules/admin/pages/CompanyFormPage')");
  });

  it('AdminGate real: quem não é admin vai para o Workspace nas três rotas', async () => {
    for (const path of ['/admin/empresas', '/admin/empresas/nova', '/admin/empresas/c1']) {
      const { unmount } = await renderAt(path);
      expect(screen.getByText('workspace')).toBeInTheDocument();
      unmount();
    }
  });

  it('AdminGate real: um admin vê a lista, a criação e a edição', async () => {
    role = 'admin';
    const expected: Record<string, string> = {
      '/admin/empresas': 'lista',
      '/admin/empresas/nova': 'criação',
      '/admin/empresas/c1': 'edição',
    };
    for (const [path, text] of Object.entries(expected)) {
      const { unmount } = await renderAt(path);
      expect(screen.getByText(text)).toBeInTheDocument();
      unmount();
    }
  });

  it('AdminGate real: conta unificada (colaborador com acesso de admin) também entra', async () => {
    access = { isAdmin: true, isLoading: false };
    await renderAt('/admin/empresas/c1');
    expect(screen.getByText('edição')).toBeInTheDocument();
  });
});
