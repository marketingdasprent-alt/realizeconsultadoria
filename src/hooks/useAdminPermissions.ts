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

      if (inSuperAdminGroup) {
        // Super admin has full access to all modules and topics
        setIsSuperAdmin(true);
        const allPermissions: TopicPermission[] = [];
        
        // Add module-level permissions
        ALL_MODULE_KEYS.forEach(moduleKey => {
          allPermissions.push({
            module_key: moduleKey,
            topic_key: null,
            can_view: true,
            can_edit: true,
            can_execute: true
          });
        });
        
        // Add topic-level permissions
        PERMISSIONS_CONFIG.forEach(module => {
          module.topics.forEach(topic => {
            allPermissions.push({
              module_key: module.moduleKey,
              topic_key: topic.key,
              can_view: true,
              can_edit: true,
              can_execute: true
            });
          });
        });
        
        setPermissions(allPermissions);
      } else {
        // Check if user has any group memberships
        const { data: memberships } = await supabase
          .from('admin_group_members')
          .select('group_id')
          .eq('user_id', session.user.id);

        if (!memberships || memberships.length === 0) {
          // No group membership - give basic dashboard access
          setIsSuperAdmin(false);
          setPermissions([{
            module_key: 'dashboard',
            topic_key: null,
            can_view: true,
            can_edit: false,
            can_execute: false
          }]);
        } else {
          // Fetch aggregated permissions from all groups
          const groupIds = memberships.map(m => m.group_id);
          
          const { data: groupPermissions } = await supabase
            .from('admin_group_permissions')
            .select('module_key, topic_key, can_view, can_edit, can_execute, admin_groups!inner(is_active)')
            .in('group_id', groupIds);

          // Aggregate permissions (union of all groups)
          const permissionMap = new Map<string, TopicPermission>();
          
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

          setIsSuperAdmin(false);
          setPermissions(Array.from(permissionMap.values()));
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
      // On error, give basic dashboard access
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

  // Module-level permission checks (backwards compatible)
  const canView = useCallback((moduleKey: string): boolean => {
    if (isSuperAdmin) return true;
    // Check module-level or any topic with view permission
    return permissions.some(p => 
      p.module_key === moduleKey && 
      (p.topic_key === null || p.can_view) &&
      p.can_view
    );
  }, [permissions, isSuperAdmin]);

  const canEdit = useCallback((moduleKey: string): boolean => {
    if (isSuperAdmin) return true;
    // Check module-level or any topic with edit permission
    return permissions.some(p => 
      p.module_key === moduleKey && 
      (p.topic_key === null || p.can_edit) &&
      p.can_edit
    );
  }, [permissions, isSuperAdmin]);

  // Topic-level permission checks
  const canViewTopic = useCallback((moduleKey: string, topicKey: string): boolean => {
    if (isSuperAdmin) return true;
    
    // Check specific topic permission
    const topicPerm = permissions.find(p => 
      p.module_key === moduleKey && p.topic_key === topicKey
    );
    if (topicPerm?.can_view) return true;
    
    // Check module-level permission (null topic = all topics)
    const modulePerm = permissions.find(p => 
      p.module_key === moduleKey && p.topic_key === null
    );
    return modulePerm?.can_view ?? false;
  }, [permissions, isSuperAdmin]);

  const canExecuteTopic = useCallback((moduleKey: string, topicKey: string): boolean => {
    if (isSuperAdmin) return true;
    
    // Check specific topic permission
    const topicPerm = permissions.find(p => 
      p.module_key === moduleKey && p.topic_key === topicKey
    );
    if (topicPerm?.can_execute) return true;
    
    // Check module-level permission (null topic = all topics)
    const modulePerm = permissions.find(p => 
      p.module_key === moduleKey && p.topic_key === null
    );
    return modulePerm?.can_execute ?? false;
  }, [permissions, isSuperAdmin]);

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

// Re-export for backwards compatibility
export { MODULE_LABELS, ALL_MODULE_KEYS };
