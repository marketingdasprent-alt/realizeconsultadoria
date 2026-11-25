import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyViewer } from '../../lib/sharing';

const mocks = vi.hoisted(() => ({
  isSuperAdmin: false,
  viewers: { data: undefined as unknown, isLoading: false, error: null as unknown },
  access: {
    isLoading: false,
    companies: [] as { company_id: string; name: string; role: string }[],
  },
  run: vi.fn(),
  viewersRefetch: vi.fn(),
}));

vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({ isSuperAdmin: mocks.isSuperAdmin }),
}));
vi.mock('../../hooks/useCompanyMembership', () => ({
  useMoveAccess: () => mocks.access,
  useCompanyEmployeesWithAccount: () => ({ data: [], isLoading: false }),
  useMembershipAction: () => ({
    run: mocks.run,
    pending: false,
    reauthOpen: false,
    finishReauth: vi.fn(),
  }),
}));
vi.mock('../../hooks/useSharing', () => ({
  useCompanyViewers: () => ({ ...mocks.viewers, refetch: mocks.viewersRefetch }),
}));
vi.mock('../sharing/ReauthDialog', () => ({ ReauthDialog: () => null }));
vi.mock('../../services/companyMembershipService', () => ({
  companyMembershipService: { addAdmin: vi.fn(), removeAdmin: vi.fn() },
}));

import { CompanyAdminsSection } from '../CompanyAdminsSection';

const COMPANY = { id: 'c1', name: 'Acme Lda' };

const OWN_ADMIN: CompanyViewer = {
  user_id: 'u1',
  name: 'Joana Pires',
  email: 'joana@acme.pt',
  kind: 'admin_empresa',
  role: 'admin',
};
const SECOND_ADMIN: CompanyViewer = {
  user_id: 'u3',
  name: 'Pedro Lima',
  email: 'pedro@acme.pt',
  kind: 'admin_empresa',
  role: 'admin',
};
const MANAGER: CompanyViewer = {
  user_id: 'u4',
  name: 'Marta Gomes',
  email: 'marta@acme.pt',
  kind: 'gestor',
  role: 'gestor',
};
const PLATFORM: CompanyViewer = {
  user_id: 'u2',
  name: 'Ana Silva',
  email: 'ana@realize.pt',
  kind: 'super_admin',
  role: 'super_admin',
};

const NOTE = /A equipa da plataforma são os super administradores/;
const SUPER_ADMIN_HINT = 'Gerem-se em Empresas, separador Equipa da plataforma';

const renderSection = (viewers: CompanyViewer[], options: { superAdmin?: boolean } = {}) => {
  mocks.isSuperAdmin = options.superAdmin ?? false;
  mocks.viewers = { data: viewers, isLoading: false, error: null };
  return render(<CompanyAdminsSection company={COMPANY} />);
};

const row = (name: string) => {
  const item = screen.getByText(name, { selector: 'p' }).closest('li');
  if (!item) throw new Error(`Sem linha para ${name}`);
  return within(item);
};

describe('CompanyAdminsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSuperAdmin = false;
    mocks.viewers = { data: undefined, isLoading: false, error: null };
    mocks.access = {
      isLoading: false,
      companies: [{ company_id: 'c1', name: 'Acme Lda', role: 'admin' }],
    };
  });

  describe('acesso à secção', () => {
    it('enquanto se sabe o que a conta administra não mostra a lista', () => {
      mocks.access = { isLoading: true, companies: [] };
      render(<CompanyAdminsSection company={COMPANY} />);
      expect(screen.queryByRole('heading', { name: 'Administradores' })).not.toBeInTheDocument();
    });

    it('quem não administra a empresa só vê a explicação, sem lista', () => {
      mocks.access = {
        isLoading: false,
        companies: [{ company_id: 'outra', name: 'Outra', role: 'admin' }],
      };
      render(<CompanyAdminsSection company={COMPANY} />);
      expect(
        screen.getByText(
          'Só os administradores desta empresa podem ver e alterar quem a administra.'
        )
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Administradores' })).not.toBeInTheDocument();
    });

    it('um super admin (papel super_admin na empresa) vê a lista', () => {
      mocks.access = {
        isLoading: false,
        companies: [{ company_id: 'c1', name: 'Acme Lda', role: 'super_admin' }],
      };
      renderSection([OWN_ADMIN]);
      expect(screen.getByRole('heading', { name: 'Administradores' })).toBeInTheDocument();
    });
  });

  describe('equipa da plataforma', () => {
    it('aparece identificada pelo nome, com o selo Equipa da plataforma', () => {
      renderSection([OWN_ADMIN, PLATFORM]);
      expect(row('Ana Silva').getByText('ana@realize.pt')).toBeInTheDocument();
      expect(row('Ana Silva').getByText('Equipa da plataforma')).toBeInTheDocument();
    });

    it('não se retira aqui: em vez de Retirar diz "Gerido pela plataforma"', () => {
      renderSection([OWN_ADMIN, SECOND_ADMIN, PLATFORM]);
      expect(row('Ana Silva').getByText('Gerido pela plataforma')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Retirar Ana Silva' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retirar Joana Pires' })).toBeInTheDocument();
    });

    it('vai depois dos administradores e gestores da própria empresa', () => {
      renderSection([PLATFORM, OWN_ADMIN, MANAGER]);
      const names = screen
        .getAllByRole('listitem')
        .map(item => within(item).getAllByText(/Silva|Pires|Gomes/)[0].textContent);
      expect(names).toEqual(['Joana Pires', 'Marta Gomes', 'Ana Silva']);
    });

    it('mostra a nota explicativa quando há equipa da plataforma', () => {
      renderSection([OWN_ADMIN, PLATFORM]);
      const note = screen.getByText(NOTE);
      expect(note).toHaveTextContent('veem todas as empresas, por isso aparecem em todas');
      expect(note).toHaveTextContent('Não se retiram aqui.');
    });

    it('não mostra a nota quando não há ninguém da plataforma', () => {
      renderSection([OWN_ADMIN, SECOND_ADMIN]);
      expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
      expect(screen.queryByText('Equipa da plataforma')).not.toBeInTheDocument();
    });

    it('a frase "Gerem-se em Empresas, separador Equipa da plataforma" só aparece para super admin', () => {
      renderSection([OWN_ADMIN, PLATFORM], { superAdmin: true });
      expect(screen.getByText(NOTE)).toHaveTextContent(SUPER_ADMIN_HINT);
    });

    it('um administrador de empresa que não é super admin não vê essa frase', () => {
      renderSection([OWN_ADMIN, PLATFORM], { superAdmin: false });
      expect(screen.getByText(NOTE)).toBeInTheDocument();
      expect(screen.queryByText(new RegExp(SUPER_ADMIN_HINT))).not.toBeInTheDocument();
    });

    it('um super admin da plataforma que também administra a empresa mostra o selo extra', () => {
      renderSection([OWN_ADMIN, { ...PLATFORM, is_company_admin: true }]);
      expect(row('Ana Silva').getByText('Equipa da plataforma')).toBeInTheDocument();
      expect(row('Ana Silva').getByText('Administrador da empresa')).toBeInTheDocument();
    });

    it('sem ser administrador da empresa, o super admin não leva o selo extra', () => {
      renderSection([OWN_ADMIN, { ...PLATFORM, is_company_admin: false }]);
      expect(row('Ana Silva').queryByText('Administrador da empresa')).not.toBeInTheDocument();
    });

    it('a equipa da plataforma não conta para impedir retirar o último administrador', () => {
      renderSection([OWN_ADMIN, PLATFORM]);
      const retire = screen.getByRole('button', { name: 'Retirar Joana Pires' });
      expect(retire).toBeDisabled();
      expect(retire).toHaveAttribute(
        'title',
        expect.stringContaining('pelo menos um administrador')
      );
    });
  });

  describe('lista da empresa', () => {
    it('mostra administradores e gestores com o seu papel', () => {
      renderSection([OWN_ADMIN, MANAGER]);
      expect(row('Joana Pires').getByText('Administrador da empresa')).toBeInTheDocument();
      expect(row('Marta Gomes').getByText('Gestor')).toBeInTheDocument();
    });

    it('com vários administradores deixa retirar cada um', () => {
      renderSection([OWN_ADMIN, SECOND_ADMIN]);
      expect(screen.getByRole('button', { name: 'Retirar Joana Pires' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Retirar Pedro Lima' })).toBeEnabled();
    });

    it('sem ninguém mostra o estado vazio', () => {
      renderSection([]);
      expect(screen.getByText('Ainda não há administradores')).toBeInTheDocument();
    });
  });
});
