import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { identityIds } from '@/lib/identityIds';

export interface SupportDepartment {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

interface UseSupportDepartmentsResult {
  departments: SupportDepartment[];
  userDepartmentIds: string[];
  isLoading: boolean;
  isSuperAdmin: boolean;
  canAccessDepartment: (departmentId: string | null) => boolean;
  refetch: () => Promise<void>;
}

export const useSupportDepartments = (): UseSupportDepartmentsResult => {
  const [departments, setDepartments] = useState<SupportDepartment[]>([]);
  const [userDepartmentIds, setUserDepartmentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchDepartments = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setDepartments([]);
        setUserDepartmentIds([]);
        setIsLoading(false);
        return;
      }

      // Fetch all active departments
      const { data: allDepartments } = await supabase
        .from('support_departments')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      setDepartments(allDepartments || []);

      // Conta unificada: os grupos podem estar na conta de admin ligada à ficha
      const userIds = await identityIds(session.user.id);

      // Super admin = platform_admins (a BD decide; o campo is_super_admin dos grupos já não conta).
      const untyped: SupabaseClient = supabase;
      const { data: superRpc, error: superError } = await untyped.rpc('rz_is_super_admin');
      if (superError) throw superError;
      const inSuperAdminGroup = superRpc === true;

      if (inSuperAdminGroup) {
        // Super admin has access to all departments
        setIsSuperAdmin(true);
        setUserDepartmentIds((allDepartments || []).map(d => d.id));
      } else {
        setIsSuperAdmin(false);

        // Get user's group memberships
        const { data: memberships } = await supabase
          .from('admin_group_members')
          .select('group_id')
          .in('user_id', userIds);

        if (!memberships || memberships.length === 0) {
          setUserDepartmentIds([]);
        } else {
          const groupIds = memberships.map(m => m.group_id);

          // Get department access for these groups
          const { data: groupDepartments } = await supabase
            .from('admin_group_support_departments')
            .select('department_id')
            .in('group_id', groupIds);

          const departmentIds = [...new Set((groupDepartments || []).map(gd => gd.department_id))];

          setUserDepartmentIds(departmentIds);
        }
      }
    } catch (error) {
      // Mantém o que já estava carregado: um erro de rede não apaga os departamentos.
      console.error('Error fetching support departments:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const canAccessDepartment = useCallback(
    (departmentId: string | null): boolean => {
      if (isSuperAdmin) return true;
      if (!departmentId) return true; // Tickets without department are accessible
      return userDepartmentIds.includes(departmentId);
    },
    [isSuperAdmin, userDepartmentIds]
  );

  return {
    departments,
    userDepartmentIds,
    isLoading,
    isSuperAdmin,
    canAccessDepartment,
    refetch: fetchDepartments,
  };
};
