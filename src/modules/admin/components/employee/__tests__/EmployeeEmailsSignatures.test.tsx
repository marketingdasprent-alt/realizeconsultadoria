import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ficha do colaborador → Emails: botão «Assinaturas» (pedido do Thiago, Isabella). Tudo simulado.
const h = vi.hoisted(() => ({ state: { employee: null as unknown, emails: [] as unknown[] } }));
vi.mock('../../../hooks/useEmployeeEmails', () => ({
  useEmployeeEmails: () => ({
    data: { isLoading: false, refresh: vi.fn() },
    employee: h.state.employee,
    emails: h.state.emails,
    busy: null,
    add: vi.fn(),
    remove: vi.fn(),
    test: vi.fn(),
  }),
}));
vi.mock('../EmployeeEmailPicker', () => ({
  EmployeeEmailPicker: () => <div>Escolher um dos Acessos</div>,
}));
vi.mock('../../accesses/panel/AccessPanel', () => ({ AccessPanel: () => null }));
vi.mock('@/modules/workspace/components/PersonSignaturesTab', () => ({
  PersonSignaturesTab: ({ userId }: { userId: string }) => <p>Assinaturas da conta {userId}</p>,
}));
vi.mock('@/modules/workspace/lib/personAccessQuery', () => ({
  accessKey: (id?: string) => ['person-access', id],
  fetchAccess: vi.fn(async () => ({ folders: [], mailboxes: [] })),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() }, auth: { getSession: vi.fn() } },
}));

import EmployeeEmailsTab from '../EmployeeEmailsTab';

const isabella = {
  id: 'emp-1',
  user_id: 'user-isabella',
  name: 'Isabella Costa',
  company_id: 'c1',
};
const email = (mailbox: unknown) => ({
  credential: {
    id: `cred-${Math.random()}`,
    username: 'isabella@empresa.pt',
    access_categories: { name: 'Email Pessoal' },
  },
  role: 'owner',
  department: false,
  mailbox,
});
const box = {
  access_id: 'a1',
  account_id: 'acc-1',
  status: 'active',
  last_error: null,
  provider: 'imap',
  members: [],
};

const renderTab = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EmployeeEmailsTab employeeId="emp-1" />
    </QueryClientProvider>
  );
const signaturesButton = () => screen.getByRole('button', { name: /Assinaturas/ });

beforeEach(() => {
  h.state.employee = isabella;
  h.state.emails = [email(box)];
});

describe('Ficha → Emails: Assinaturas', () => {
  it('com conta e caixa ligada: abre no separador Assinaturas da pessoa certa e fecha', async () => {
    renderTab();
    const user = userEvent.setup();
    expect(signaturesButton()).toBeEnabled();
    expect(signaturesButton()).toHaveAttribute(
      'title',
      'Assinaturas de email deste colaborador, em cada caixa'
    );
    await user.click(signaturesButton());
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Acessos de Isabella Costa')).toBeInTheDocument();
    expect(within(dialog).getByRole('tab', { name: /Assinaturas/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(within(dialog).getByText('Assinaturas da conta user-isabella')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    // Volta a abrir, outra vez nas Assinaturas
    await user.click(signaturesButton());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('sem conta na app: desativado, com a explicação', () => {
    h.state.employee = { ...isabella, user_id: null };
    renderTab();
    expect(signaturesButton()).toBeDisabled();
    expect(signaturesButton()).toHaveAttribute(
      'title',
      'Disponível quando o colaborador tiver conta na app'
    );
  });

  it('com conta mas sem caixa ligada: desativado, com a explicação', () => {
    h.state.emails = [email(undefined)];
    renderTab();
    expect(signaturesButton()).toBeDisabled();
    expect(signaturesButton()).toHaveAttribute('title', 'Ligue primeiro uma caixa de email');
  });

  it('«Ligar email» continua a abrir a escolha dos Acessos', async () => {
    renderTab();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Ligar email/ }));
    expect(screen.getByText('Escolher um dos Acessos')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('teclado: Tab chega ao botão e Enter abre as Assinaturas', async () => {
    renderTab();
    const user = userEvent.setup();
    let guard = 0;
    while (document.activeElement !== signaturesButton() && guard++ < 20) await user.tab();
    expect(signaturesButton()).toHaveFocus();
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('tab', { name: /Assinaturas/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
