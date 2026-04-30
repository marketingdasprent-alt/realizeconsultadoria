import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PERMISSIONS_CONFIG, MODULE_LABELS, ALL_MODULE_KEYS } from "@/lib/permissions-config";

export interface TopicPermission {
  module_key: string;
  topic_key: string | null;
  can_view: boolean;
  can_edit: boolean;
  can_execute: boolean;
}

export interface AdminPermissions {
  permissions: TopicPermission[];
  isLoading: boolean;
  isSuperAdmin: boolean;
  canView: (moduleKey: string) => boolean;
  canEdit: (moduleKey: string) => boolean;
  canViewTopic: (moduleKey: string, topicKey: string) => boolean;
  canExecuteTopic: (moduleKey: string, topicKey: string) => boolean;
  refetch: () => Promise<void>;
}

export const useAdminPermissions = (): AdminPermissions => {
  const [permissions, setPermissions] = useState<TopicPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchPermissions = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPermissions([]);
        setIsLoading(false);
        return;
      }

      // Check if user is in a super admin group
      const { data: superAdminCheck } = await supabase
        .from('admin_group_members')
        .select(`
          group_id,
          admin_groups!inner(is_super_admin, is_active)
        `)
        .eq('user_id', session.user.id);

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
        can_execute: false
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
            can_execute: true
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
              can_execute: true
            });
          });
        });
      }

      // 2. Fetch and add permissions from all groups (including 'legal' if present)
      const { data: memberships } = await supabase
        .from('admin_group_members')
        .select('group_id')
        .eq('user_id', session.user.id);

      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map(m => m.group_id);
        
        const { data: groupPermissions } = await supabase
          .from('admin_group_permissions')
          .select('module_key, topic_key, can_view, can_edit, can_execute, admin_groups!inner(is_active)')
          .in('group_id', groupIds);

        groupPermissions?.forEach((p: any) => {
          if (p.admin_groups?.is_active) {
            const key = `${p.module_key}:${p.topic_key || ''}`;
            const existing = permissionMap.get(key);
            
            if (existing) {
              permissionMap.set(key, {
                module_key: p.module_key,
                topic_key: p.topic_key,
                can_view: existing.can_view || p.can_view,
                can_edit: existing.can_edit || p.can_edit,
                can_execute: existing.can_execute || p.can_execute
              });
            } else {
              permissionMap.set(key, {
                module_key: p.module_key,
                topic_key: p.topic_key,
                can_view: p.can_view,
                can_edit: p.can_edit,
                can_execute: p.can_execute
              });
            }
          }
        });
      }

      // If no permissions at all (not super admin and no groups), give basic dashboard
      if (permissionMap.size === 0) {
        setPermissions([{
          module_key: 'dashboard',
          topic_key: null,
          can_view: true,
          can_edit: false,
          can_execute: false
        }]);
      } else {
        setPermissions(Array.from(permissionMap.values()));
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions([{
        module_key: 'dashboard',
        topic_key: null,
        can_view: true,
        can_edit: false,
        can_execute: false
      }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const canView = useCallback((moduleKey: string): boolean => {
    // We check module-level permission (topic_key = null)
    // or any topic with view permission in that module
    return permissions.some(p => 
      p.module_key === moduleKey && p.can_view
    );
  }, [permissions]);

  const canEdit = useCallback((moduleKey: string): boolean => {
    return permissions.some(p => 
      p.module_key === moduleKey && p.can_edit
    );
  }, [permissions]);

  const canViewTopic = useCallback((moduleKey: string, topicKey: string): boolean => {
    const topicPerm = permissions.find(p => 
      p.module_key === moduleKey && p.topic_key === topicKey
    );
    if (topicPerm?.can_view) return true;
    
    const modulePerm = permissions.find(p => 
      p.module_key === moduleKey && p.topic_key === null
    );
    return modulePerm?.can_view ?? false;
  }, [permissions]);

  const canExecuteTopic = useCallback((moduleKey: string, topicKey: string): boolean => {
    const topicPerm = permissions.find(p => 
      p.module_key === moduleKey && p.topic_key === topicKey
    );
    if (topicPerm?.can_execute) return true;
    
    const modulePerm = permissions.find(p => 
      p.module_key === moduleKey && p.topic_key === null
    );
    return modulePerm?.can_execute ?? false;
  }, [permissions]);

  return {
    permissions,
    isLoading,
    isSuperAdmin,
    canView,
    canEdit,
    canViewTopic,
    canExecuteTopic,
    refetch: fetchPermissions
  };
};

export { MODULE_LABELS, ALL_MODULE_KEYS };
