import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Respostas simuladas por tabela/RPC (cada teste define as suas).
const db: {
  superAdmin: unknown[];
  memberships: unknown[];
  groupPermissions: unknown[];
  team: unknown;
  teamError: unknown;
  own: unknown[];
  rpcCalls: string[];
} = {
  superAdmin: [],
  memberships: [],
  groupPermissions: [],
  team: [],
  teamError: null,
  own: [],
  rpcCalls: [],
};

const query = (resolve: (select: string) => unknown) => {
  let selected = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cadeia simulada do cliente
  const builder: any = {
    select: (s: string) => ((selected = s), builder),
    in: () => builder,
    or: () => builder,
    eq: () => builder,
    then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve({ data: resolve(selected), error: null }).then(ok, ko),
  };
  return builder;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'u-chefe' } } } })),
    },
    rpc: vi.fn(async (fn: string) => {
      db.rpcCalls.push(fn);
      if (fn === 'rz_identity_ids') return { data: ['u-chefe'], error: null };
      if (fn === 'rz_my_team_employee_ids') return { data: db.team, error: db.teamError };
      return { data: null, error: null };
    }),
    from: vi.fn((table: string) =>
      query(select => {
        if (table === 'admin_group_members')
          return select.includes('admin_groups') ? db.superAdmin : db.memberships;
        if (table === 'admin_group_permissions') return db.groupPermissions;
        if (table === 'employees') return db.own;
        return [];
      })
    ),
  },
}));

import { useAdminPermissions } from '../useAdminPermissions';

const row = (
  topic: string,
  can_view: boolean,
  can_execute: boolean,
  scope?: 'all' | 'team',
  module_key = 'employees'
) => ({
  module_key,
  topic_key: topic,
  can_view,
  can_edit: can_execute,
  can_execute,
  ...(scope ? { scope } : {}),
  admin_groups: { is_active: true },
});

const load = async () => {
  const hook = renderHook(() => useAdminPermissions());
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook.result.current;
};

describe('useAdminPermissions: alcance de equipa', () => {
  beforeEach(() => {
    db.superAdmin = [];
    db.memberships = [{ group_id: 'g1' }, { group_id: 'g2' }];
    db.groupPermissions = [];
    db.team = [];
    db.teamError = null;
    db.own = [{ id: 'emp-chefe' }];
    db.rpcCalls = [];
  });

  it('linhas sem coluna scope (migração por aplicar) ficam com alcance Todos e não pedem a equipa', async () => {
    db.groupPermissions = [row('edit', true, true)];
    const p = await load();
    expect(p.scopeOf('employees', 'edit')).toBe('all');
    expect(p.canExecuteTopicFor('employees', 'edit', 'qualquer')).toBe(true);
    expect(db.rpcCalls).not.toContain('rz_my_team_employee_ids');
    expect(p.teamEmployeeIds.size).toBe(0);
    expect(p.ownEmployeeIds).toEqual([]);
  });

  it('com Só a minha equipa, só vale para quem está na equipa (RPC devolve texto ou objeto)', async () => {
    db.groupPermissions = [row('view', true, false, 'team'), row('edit', true, true, 'team')];
    db.team = ['emp-rui', { rz_my_team_employee_ids: 'emp-ana' }];
    const p = await load();
    expect(p.scopeOf('employees', 'view')).toBe('team');
    expect([...p.teamEmployeeIds].sort()).toEqual(['emp-ana', 'emp-rui']);
    expect(p.ownEmployeeIds).toEqual(['emp-chefe']);
    expect(p.canViewTopicFor('employees', 'view', 'emp-rui')).toBe(true);
    expect(p.canExecuteTopicFor('employees', 'edit', 'emp-ana')).toBe(true);
    expect(p.canExecuteTopicFor('employees', 'edit', 'emp-fora')).toBe(false);
    // A própria ficha não conta como equipa.
    expect(p.canExecuteTopicFor('employees', 'edit', 'emp-chefe')).toBe(false);
  });

  it('um grupo com Todos ganha a outro com equipa na mesma funcionalidade', async () => {
    db.groupPermissions = [row('edit', true, true, 'team'), row('edit', true, true, 'all')];
    const p = await load();
    expect(p.scopeOf('employees', 'edit')).toBe('all');
    expect(p.canExecuteTopicFor('employees', 'edit', 'emp-fora')).toBe(true);
  });

  it('alcance por funcionalidade: ver todos, editar só a equipa', async () => {
    db.groupPermissions = [row('view', true, false, 'all'), row('edit', true, true, 'team')];
    db.team = ['emp-rui'];
    const p = await load();
    expect(p.canViewTopicFor('employees', 'view', 'emp-fora')).toBe(true);
    expect(p.canExecuteTopicFor('employees', 'edit', 'emp-fora')).toBe(false);
    expect(p.canExecuteTopicFor('employees', 'edit', 'emp-rui')).toBe(true);
  });

  it('team fora de Colaboradores é ignorado (só esse módulo tem alcance)', async () => {
    db.groupPermissions = [row('view', true, true, 'team', 'companies')];
    const p = await load();
    expect(p.scopeOf('companies', 'view')).toBe('all');
    expect(db.rpcCalls).not.toContain('rz_my_team_employee_ids');
  });

  it('sem permissão, ...For continua a negar mesmo com alcance Todos', async () => {
    db.groupPermissions = [row('view', true, false, 'all')];
    const p = await load();
    expect(p.canExecuteTopicFor('employees', 'delete', 'emp-rui')).toBe(false);
  });

  it('erro ao ler a equipa: equipa vazia, nada fora dela fica permitido', async () => {
    db.groupPermissions = [row('edit', true, true, 'team')];
    db.teamError = { message: 'function does not exist' };
    db.team = null;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const p = await load();
    spy.mockRestore();
    expect(p.teamEmployeeIds.size).toBe(0);
    expect(p.canExecuteTopicFor('employees', 'edit', 'emp-rui')).toBe(false);
  });

  it('super admin tem tudo com alcance Todos', async () => {
    db.superAdmin = [{ group_id: 'g', admin_groups: { is_super_admin: true, is_active: true } }];
    db.memberships = [];
    const p = await load();
    expect(p.scopeOf('employees', 'edit')).toBe('all');
    expect(p.canExecuteTopicFor('employees', 'delete', 'qualquer')).toBe(true);
  });

  // Relatório de QA 20/11: o Todos do Ver de um grupo não pode alargar o Executar em equipa de outro.
  it('ver(Todos) num grupo não alarga o executar(equipa) de outro grupo', async () => {
    db.groupPermissions = [row('edit', true, false, 'all'), row('edit', true, true, 'team')];
    db.team = ['emp-rui'];
    const p = await load();
    expect(p.canExecuteTopicFor('employees', 'edit', 'emp-fora')).toBe(false);
  });

  it('a própria ficha vê-se com Ver em equipa, mas não se executa sobre ela', async () => {
    db.groupPermissions = [row('view', true, false, 'team'), row('edit', false, true, 'team')];
    db.team = ['emp-rui'];
    const p = await load();
    expect(p.canViewTopicFor('employees', 'view', 'emp-chefe')).toBe(true);
    expect(p.canViewTopicFor('employees', 'view', 'emp-fora')).toBe(false);
    expect(p.canExecuteTopicFor('employees', 'edit', 'emp-chefe')).toBe(false);
    expect(p.canExecuteTopicFor('employees', 'edit', 'emp-rui')).toBe(true);
  });

  it('scopeOf sem campo: Ver nos tópicos de ver, Executar nos de executar', async () => {
    db.groupPermissions = [
      row('view', true, false, 'team'),
      row('edit', true, false, 'all'),
      row('edit', false, true, 'team'),
    ];
    const p = await load();
    expect(p.scopeOf('employees', 'view')).toBe('team');
    expect(p.scopeOf('employees', 'edit')).toBe('team');
    expect(p.scopeOf('employees', 'edit', 'view')).toBe('all');
    expect(p.scopeOf('employees', 'edit', 'execute')).toBe('team');
    expect(p.scopeOf('employees', 'delete')).toBe('all');
  });

  it('dois grupos com o mesmo Executar: Todos continua a ganhar à equipa', async () => {
    db.groupPermissions = [row('edit', false, true, 'team'), row('edit', false, true, 'all')];
    const p = await load();
    expect(p.scopeOf('employees', 'edit')).toBe('all');
    expect(p.canExecuteTopicFor('employees', 'edit', 'emp-fora')).toBe(true);
  });
});
