import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

type Res = { data: unknown; error: unknown };
const st: {
  superRes: Res;
  adminRes: Res;
  groupMembers: unknown[];
  groupPermissions: unknown[];
} = {
  superRes: { data: false, error: null },
  adminRes: { data: [], error: null },
  groupMembers: [],
  groupPermissions: [],
};

const query = (resolve: () => unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cadeia simulada do cliente
  const b: any = {
    select: () => b,
    in: () => b,
    or: () => b,
    eq: () => b,
    then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve({ data: resolve(), error: null }).then(ok, ko),
  };
  return b;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u1' } } } })) },
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'rz_identity_ids') return { data: ['u1'], error: null };
      if (fn === 'rz_is_super_admin') return st.superRes;
      if (fn === 'rz_my_admin_company_ids') return st.adminRes;
      return { data: null, error: null };
    }),
    from: vi.fn((table: string) =>
      query(() => {
        if (table === 'admin_group_members') return st.groupMembers;
        if (table === 'admin_group_permissions') return st.groupPermissions;
        return [];
      })
    ),
  },
}));

import { useAdminPermissions } from '../useAdminPermissions';

const load = async () => {
  const hook = renderHook(() => useAdminPermissions());
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook.result.current;
};

const rhGroup = () => {
  st.groupMembers = [{ group_id: 'g-rh' }];
  st.groupPermissions = [
    {
      module_key: 'employees',
      topic_key: '',
      can_view: true,
      can_edit: false,
      can_execute: false,
      admin_groups: { is_active: true, is_super_admin: false },
    },
  ];
};

describe('QA multi-org PR1: useAdminPermissions por papel', () => {
  beforeEach(() => {
    st.superRes = { data: false, error: null };
    st.adminRes = { data: [], error: null };
    st.groupMembers = [];
    st.groupPermissions = [];
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('super admin: tudo, incluindo grupos de admin e marketing', async () => {
    st.superRes = { data: true, error: null };
    const p = await load();
    expect(p.isSuperAdmin).toBe(true);
    expect(p.canViewTopic('settings', 'groups')).toBe(true);
    expect(p.canView('marketing')).toBe(true);
    expect(p.canView('employees')).toBe(true);
  });

  it('admin de empresa (A): gere colaboradores, sem plataforma nem super admin', async () => {
    st.adminRes = { data: ['empresa-a'], error: null };
    const p = await load();
    expect(p.isSuperAdmin).toBe(false);
    expect(p.canView('employees')).toBe(true);
    for (const m of ['marketing', 'legal', 'accesses', 'support']) {
      expect(p.canView(m)).toBe(false);
    }
    // PR3: o ponto passou a ter âmbito por empresa na BD, por isso o admin de empresa tem o módulo.
    expect(p.canView('timeclock')).toBe(true);
    expect(p.canViewTopic('settings', 'groups')).toBe(false);
    expect(p.canViewTopic('settings', 'support_subjects')).toBe(false);
  });

  it('colaborador: sem nenhuma permissão de admin', async () => {
    const p = await load();
    expect(p.isSuperAdmin).toBe(false);
    expect(p.canView('employees')).toBe(false);
    expect(p.canView('companies')).toBe(false);
    expect(p.canViewTopic('settings', 'groups')).toBe(false);
  });

  it('grupo is_super_admin (linhas de permissões servidas) não dá nada', async () => {
    st.groupMembers = [{ group_id: 'g-super' }];
    st.groupPermissions = [
      {
        module_key: 'employees',
        topic_key: '',
        can_view: true,
        can_edit: true,
        can_execute: true,
        admin_groups: { is_active: true, is_super_admin: true },
      },
    ];
    const p = await load();
    expect(p.isSuperAdmin).toBe(false);
    expect(p.canView('employees')).toBe(false);
  });

  it('grupo normal (RH) continua a dar as suas permissões', async () => {
    rhGroup();
    const p = await load();
    expect(p.isSuperAdmin).toBe(false);
    expect(p.canView('employees')).toBe(true);
  });

  it('falha em rz_is_super_admin nunca promove a super admin', async () => {
    st.superRes = { data: null, error: { message: 'boom' } };
    st.adminRes = { data: ['empresa-a'], error: null };
    const p = await load();
    expect(p.isSuperAdmin).toBe(false);
    expect(p.canViewTopic('settings', 'groups')).toBe(false);
  });

  // HIGH da Visão (useAdminPermissions.ts:107-113): o frontend pode sair antes da migração (RPC novo
  // por existir). O super admin não pode ficar sem acesso por isso.
  it('RPC rz_my_admin_company_ids em erro não tira o ecrã ao super admin', async () => {
    st.superRes = { data: true, error: null };
    st.adminRes = { data: null, error: { message: 'function does not exist', code: '42883' } };
    const p = await load();
    expect(p.isSuperAdmin).toBe(true);
    expect(p.canView('employees')).toBe(true);
  });

  it('RPC rz_my_admin_company_ids em erro não tira os grupos de RH a quem os tem', async () => {
    st.adminRes = { data: null, error: { message: 'function does not exist', code: '42883' } };
    rhGroup();
    const p = await load();
    expect(p.canView('employees')).toBe(true);
  });
});
