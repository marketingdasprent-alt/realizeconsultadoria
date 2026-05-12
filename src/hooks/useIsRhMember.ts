import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Devolve `true` se o utilizador autenticado pertence ao grupo "RH"
 * (admin_groups.name = 'RH' AND is_active = true). É a gate de escrita
 * dos valores financeiros mensais.
 */
export const useIsRhMember = () => {
  const [isRhMember, setIsRhMember] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (active) {
            setIsRhMember(false);
            setIsLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from('admin_group_members')
          .select('admin_groups!inner(name, is_active)')
          .eq('user_id', session.user.id);

        if (!active) return;

        if (error) {
          setIsRhMember(false);
        } else {
          const memberOfRh = (data || []).some((row: unknown) => {
            const r = row as { admin_groups?: { name?: string; is_active?: boolean } };
            return r.admin_groups?.name === 'RH' && r.admin_groups?.is_active === true;
          });
          setIsRhMember(memberOfRh);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return { isRhMember, isLoading };
};
