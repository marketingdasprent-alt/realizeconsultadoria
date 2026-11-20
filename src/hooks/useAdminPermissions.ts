import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  PERMISSIONS_CONFIG,
  MODULE_LABELS,
  ALL_MODULE_KEYS,
  getTopicConfig,
  isScopableModule,
  type PermissionScope,
} from '@/lib/permissions-config';

export interface TopicPermission {
  module_key: string;
  topic_key: string | null;
  can_view: boolean;
  can_edit: boolean;
  can_execute: boolean;
  /** 'team' se Ver ou Executar ficou limitado à equipa (decide se é preciso ler a equipa). */
  scope: PermissionScope;
  /**
   * Alcance de Ver e de Executar, em separado: um grupo com Ver em Todos não alarga o Executar
   * em equipa de outro grupo. Entre grupos que dão o mesmo, Todos ganha a equipa.
   */
  view_scope?: PermissionScope;
  execute_scope?: PermissionScope;
}

export interface AdminPermissions {
  permissions: TopicPermission[];
  isLoading: boolean;
  isSuperAdmin: boolean;
  canView: (moduleKey: string) => boolean;
  canEdit: (moduleKey: string) => boolean;
  canViewTopic: (moduleKey: string, topicKey: string) => boolean;
  canExecuteTopic: (moduleKey: string, topicKey: string) => boolean;
  /** Alcance da funcionalidade (sem permissão, 'all': quem decide é canViewTopic/canExecuteTopic). */
  scopeOf: (moduleKey: string, topicKey: string, field?: 'view' | 'execute') => PermissionScope;
  /** Colaboradores abaixo de quem tem sessão, pela cadeia de responsável direto. */
  teamEmployeeIds: ReadonlySet<string>;
  /** Fichas de quem tem sessão (só carregadas quando alguma funcionalidade usa a equipa). */
  ownEmployeeIds: readonly string[];
  /** Pode ver/executar a funcionalidade sobre este colaborador (respeita o alcance). */
  canViewTopicFor: (moduleKey: string, topicKey: string, employeeId: string) => boolean;
  canExecuteTopicFor: (moduleKey: string, topicKey: string, employeeId: string) => boolean;
  refetch: () => Promise<void>;
}

/** Alcance gravado na linha (coluna scope; sem ela, ou fora dos módulos com alcance, é 'all'). */
const scopeOfRow = (row: { module_key: string; scope?: unknown }): PermissionScope =>
  row.scope === 'team' && isScopableModule(row.module_key) ? 'team' : 'all';

/** Junta o alcance de duas fontes do mesmo direito (undefined = essa fonte não o dá). */
const mergeScope = (
  a: PermissionScope | undefined,
  b: PermissionScope | undefined
): PermissionScope | undefined => (a === 'all' || b === 'all' ? 'all' : (a ?? b));

/** Alcance de cada direito numa linha de grupo (só para os direitos que ela dá). */
const rowScopes = (p: {
  module_key: string;
  scope?: unknown;
  can_view: boolean;
  can_execute: boolean;
}) => {
  const scope = scopeOfRow(p);
  return {
    view_scope: p.can_view ? scope : undefined,
    execute_scope: p.can_execute ? scope : undefined,
  };
};

const overallScope = (view?: PermissionScope, execute?: PermissionScope): PermissionScope =>
  view === 'team' || execute === 'team' ? 'team' : 'all';

export const useAdminPermissions = (): AdminPermissions => {
  const [permissions, setPermissions] = useState<TopicPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [teamEmployeeIds, setTeamEmployeeIds] = useState<ReadonlySet<string>>(new Set());
  const [ownEmployeeIds, setOwnEmployeeIds] = useState<readonly string[]>([]);

  const fetchPermissions = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setPermissions([]);
        setIsLoading(false);
        return;
      }

      // Conta unificada: a conta de colaborador conta também com os grupos da conta de admin
      // ligada à ficha (employees.admin_user_id); a BD decide quais são (rz_identity_ids).
      const untyped: SupabaseClient = supabase;
      const { data: identity } = await untyped.rpc('rz_identity_ids', {
        _user_id: session.user.id,
      });
      const userIds: string[] =
        Array.isArray(identity) && identity.length ? (identity as string[]) : [session.user.id];

      // Check if user is in a super admin group
      const { data: superAdminCheck } = await supabase
        .from('admin_group_members')
        .select(
          `
          group_id,
          admin_groups!inner(is_super_admin, is_active)
        `
        )
        .in('user_id', userIds);

      const inSuperAdminGroup = superAdminCheck?.some(
        (m: any) => m.admin_groups?.is_super_admin && m.admin_groups?.is_active
      );

      setIsSuperAdmin(inSuperAdminGroup || false);

      // Start with empty permissions
      const permissionMap = new Map<string, TopicPermission>();

      // 1. Always add 'dashboard' view permission for any authenticated admin
      permissionMap.set('dashboard:', {
        module_key: 'dashboard',
        topic_key: null,
        can_view: true,
        can_edit: false,
        can_execute: false,
        scope: 'all',
      });

      // 2. If Super Admin, add everything except 'legal'
      if (inSuperAdminGroup) {
        ALL_MODULE_KEYS.forEach(moduleKey => {
          if (moduleKey === 'legal' || moduleKey === 'dashboard') return;

          const key = `${moduleKey}:`;
          permissionMap.set(key, {
            module_key: moduleKey,
            topic_key: null,
            can_view: true,
            can_edit: true,
            can_execute: true,
            scope: 'all',
          });
        });

        PERMISSIONS_CONFIG.forEach(module => {
          if (module.moduleKey === 'legal' || module.moduleKey === 'dashboard') return;

          module.topics.forEach(topic => {
            const key = `${module.moduleKey}:${topic.key}`;
            permissionMap.set(key, {
              module_key: module.moduleKey,
              topic_key: topic.key,
              can_view: true,
              can_edit: true,
              can_execute: true,
              scope: 'all',
            });
          });
        });
      }

      // 2. Fetch and add permissions from all groups (including 'legal' if present)
      const { data: memberships } = await supabase
        .from('admin_group_members')
        .select('group_id')
        .in('user_id', userIds);

      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map(m => m.group_id);

        const { data: groupPermissions } = await supabase
          .from('admin_group_permissions')
          .select('*, admin_groups!inner(is_active)')
          .in('group_id', groupIds);

        groupPermissions?.forEach((p: any) => {
          if (p.admin_groups?.is_active) {
            const key = `${p.module_key}:${p.topic_key || ''}`;
            const existing = permissionMap.get(key);

            const row = rowScopes(p);
            // Super Admin e entradas fixas não têm alcance por direito: valem como Todos.
            const before = existing
              ? {
                  view_scope: existing.can_view ? (existing.view_scope ?? 'all') : undefined,
                  execute_scope: existing.can_execute
                    ? (existing.execute_scope ?? 'all')
                    : undefined,
                }
              : { view_scope: undefined, execute_scope: undefined };
            const view_scope = mergeScope(before.view_scope, row.view_scope);
            const execute_scope = mergeScope(before.execute_scope, row.execute_scope);
            permissionMap.set(key, {
              module_key: p.module_key,
              topic_key: p.topic_key,
              can_view: (existing?.can_view ?? false) || p.can_view,
              can_edit: (existing?.can_edit ?? false) || p.can_edit,
              can_execute: (existing?.can_execute ?? false) || p.can_execute,
              scope: overallScope(view_scope, execute_scope),
              view_scope,
              execute_scope,
            });
          }
        });
      }

      // Equipa: só é preciso quando alguma funcionalidade ficou limitada a ela.
      const usesTeam = [...permissionMap.values()].some(p => p.scope === 'team');
      if (usesTeam) {
        const ids = userIds.join(',');
        const [{ data: team, error: teamError }, { data: own }] = await Promise.all([
          untyped.rpc('rz_my_team_employee_ids'),
          supabase
            .from('employees')
            .select('id')
            .or(`user_id.in.(${ids}),admin_user_id.in.(${ids})`),
        ]);
        if (teamError) console.error('Error fetching team:', teamError);
        setOwnEmployeeIds((own ?? []).map(row => row.id));
        setTeamEmployeeIds(
          new Set(
            (Array.isArray(team) ? team : []).map((row: unknown) =>
              typeof row === 'string' ? row : String(Object.values(row as object)[0])
            )
          )
        );
      } else {
        setTeamEmployeeIds(new Set());
        setOwnEmployeeIds([]);
      }

      // If no permissions at all (not super admin and no groups), give basic dashboard
      if (permissionMap.size === 0) {
        setPermissions([
          {
            module_key: 'dashboard',
            topic_key: null,
            can_view: true,
            can_edit: false,
            can_execute: false,
            scope: 'all',
          },
        ]);
      } else {
        setPermissions(Array.from(permissionMap.values()));
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions([
        {
          module_key: 'dashboard',
          topic_key: null,
          can_view: true,
          can_edit: false,
          can_execute: false,
          scope: 'all',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const canView = useCallback(
    (moduleKey: string): boolean => {
      // We check module-level permission (topic_key = null)
      // or any topic with view permission in that module
      return permissions.some(p => p.module_key === moduleKey && p.can_view);
    },
    [permissions]
  );

  const canEdit = useCallback(
    (moduleKey: string): boolean => {
      return permissions.some(p => p.module_key === moduleKey && p.can_edit);
    },
    [permissions]
  );

  const canViewTopic = useCallback(
    (moduleKey: string, topicKey: string): boolean => {
      const topicPerm = permissions.find(
        p => p.module_key === moduleKey && p.topic_key === topicKey
      );
      if (topicPerm?.can_view) return true;

      const modulePerm = permissions.find(p => p.module_key === moduleKey && p.topic_key === null);
      return modulePerm?.can_view ?? false;
    },
    [permissions]
  );

  const canExecuteTopic = useCallback(
    (moduleKey: string, topicKey: string): boolean => {
      const topicPerm = permissions.find(
        p => p.module_key === moduleKey && p.topic_key === topicKey
      );
      if (topicPerm?.can_execute) return true;

      const modulePerm = permissions.find(p => p.module_key === moduleKey && p.topic_key === null);
      return modulePerm?.can_execute ?? false;
    },
    [permissions]
  );

  /** Sem `field`: Executar nas funcionalidades de executar (ex.: edit), Ver nas de ver. */
  const scopeOf = useCallback(
    (moduleKey: string, topicKey: string, field?: 'view' | 'execute'): PermissionScope => {
      const topicPerm = permissions.find(
        p => p.module_key === moduleKey && p.topic_key === topicKey
      );
      if (!topicPerm) return 'all';
      const kind = field ?? (getTopicConfig(moduleKey, topicKey)?.hasExecute ? 'execute' : 'view');
      return (kind === 'view' ? topicPerm.view_scope : topicPerm.execute_scope) ?? 'all';
    },
    [permissions]
  );

  const canViewTopicFor = useCallback(
    (moduleKey: string, topicKey: string, employeeId: string) =>
      canViewTopic(moduleKey, topicKey) &&
      (scopeOf(moduleKey, topicKey, 'view') === 'all' ||
        teamEmployeeIds.has(employeeId) ||
        // A própria ficha vê-se sempre (não conta para a equipa nem para executar).
        ownEmployeeIds.includes(employeeId)),
    [canViewTopic, scopeOf, teamEmployeeIds, ownEmployeeIds]
  );

  const canExecuteTopicFor = useCallback(
    (moduleKey: string, topicKey: string, employeeId: string) =>
      canExecuteTopic(moduleKey, topicKey) &&
      (scopeOf(moduleKey, topicKey, 'execute') === 'all' || teamEmployeeIds.has(employeeId)),
    [canExecuteTopic, scopeOf, teamEmployeeIds]
  );

  return {
    permissions,
    isLoading,
    isSuperAdmin,
    canView,
    canEdit,
    canViewTopic,
    canExecuteTopic,
    scopeOf,
    teamEmployeeIds,
    ownEmployeeIds,
    canViewTopicFor,
    canExecuteTopicFor,
    refetch: fetchPermissions,
  };
};

export { MODULE_LABELS, ALL_MODULE_KEYS };
