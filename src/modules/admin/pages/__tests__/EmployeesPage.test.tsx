import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmployeesPage from '../EmployeesPage';

const ANA = {
  id: 'e1',
  name: 'Ana Silva',
  email: 'ana@exemplo.pt',
  company_id: 'c1',
  is_active: true,
  companies: { id: 'c1', name: 'Acme Lda' },
};
const RUI = { ...ANA, id: 'e2', name: 'Rui Costa', is_active: false };

// Os ecrãs filhos pesados não interessam: guarda-se o que a página lhes passa.
const table = vi.hoisted(() => ({ props: null as null | Record<string, unknown> }));
vi.mock('../../components/employees/EmployeesTable', () => ({
  EmployeesTable: (props: Record<string, unknown>) => {
    table.props = props;
    return <div data-testid="tabela" />;
  },
}));
vi.mock('../../components/employees/EmployeesStats', () => ({ EmployeesStats: () => null }));
vi.mock('../../components/employees/EmployeesToolbar', () => ({ EmployeesToolbar: () => null }));
vi.mock('../../components/employees/MissingBirthdatesNotice', () => ({
  MissingBirthdatesNotice: () => null,
}));
vi.mock('../../components/employees/PendingDocumentsDialog', () => ({
  PendingDocumentsDialog: () => null,
}));
vi.mock('../../components/employees/MoveEmployeesDialog', () => ({
  MoveEmployeesDialog: () => null,
}));
vi.mock('@/components/admin/EmployeeAvisoDialog', () => ({ default: () => null }));
vi.mock('@/components/admin/DeleteConfirmDialog', () => ({ default: () => null }));
vi.mock('@/components/admin/ChangeEmployeePasswordDialog', () => ({ default: () => null }));
vi.mock('@/components/admin/ResendInviteSuccessDialog', () => ({ default: () => null }));
vi.mock('@/components/admin/CompanyScopeNotice', () => ({ CompanyScopeNotice: () => null }));

let canEdit = true;
let canOfferMove = true;
vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({
    canExecuteTopic: () => canEdit,
    canExecuteTopicFor: () => canEdit,
    scopeOf: () => 'all',
    teamEmployeeIds: new Set<string>(),
    isLoading: false,
  }),
}));
vi.mock('../../context/CompanyScopeContext', () => ({
  useCompanyScope: () => ({ ids: null, singleCompanyId: null }),
}));
vi.mock('../../hooks/useCompanyMembership', () => ({
  useMoveAccess: () => ({ canOfferMove: () => canOfferMove }),
}));
vi.mock('../../hooks/useDocumentAlerts', () => ({
  useDocumentAlerts: () => ({
    pending: [],
    expiringOf: () => [],
    pendingOf: () => [],
    refetch: vi.fn(),
  }),
}));
vi.mock('../../hooks/useEmployeeAvatars', () => ({ useEmployeeAvatars: () => () => null }));
vi.mock('../../hooks/useEmployeeLastSignIn', () => ({
  useEmployeeLastSignIn: () => ({ accessOf: () => null }),
}));
vi.mock('../../hooks/useEmployeeListActions', () => ({
  useEmployeeListActions: () => ({
    employees: [ANA, RUI],
    isLoading: false,
    resendingId: null,
    noticesFor: null,
    passwordFor: null,
    deleteFor: null,
    invite: null,
    isDeleting: false,
    setNoticesFor: vi.fn(),
    setPasswordFor: vi.fn(),
    setDeleteFor: vi.fn(),
    setInvite: vi.fn(),
    confirmDelete: vi.fn(),
    resend: vi.fn(),
    toggle: vi.fn(),
    refetch: vi.fn(),
  }),
}));
vi.mock('@/hooks/useCompanies', () => ({
  useCompanies: () => ({ companies: [{ id: 'c1', name: 'Acme Lda', is_active: true }] }),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/colaboradores']}>
      <EmployeesPage />
    </MemoryRouter>
  );

type CanMove = (employee: typeof ANA) => boolean;
const canMoveProp = () => table.props?.canMove as CanMove;

describe('EmployeesPage: lista de Colaboradores', () => {
  beforeEach(() => {
    table.props = null;
    canEdit = true;
    canOfferMove = true;
  });

  it('abre sem erro (a lista chama canMove a cada render)', () => {
    expect(() => renderPage()).not.toThrow();
    expect(table.props).not.toBeNull();
  });

  it('quem pode editar e administra a empresa pode mover colaboradores ativos', () => {
    renderPage();
    expect(canMoveProp()(ANA)).toBe(true);
  });

  it('não se move um colaborador inativo', () => {
    renderPage();
    expect(canMoveProp()(RUI)).toBe(false);
  });

  it('sem permissão de editar não se move ninguém', () => {
    canEdit = false;
    renderPage();
    expect(canMoveProp()(ANA)).toBe(false);
  });

  it('sem administrar a empresa atual da ficha não se move', () => {
    canOfferMove = false;
    renderPage();
    expect(canMoveProp()(ANA)).toBe(false);
  });
});
