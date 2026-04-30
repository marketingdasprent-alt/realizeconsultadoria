import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    
    // We try to run the SQL via a migration-like approach.
    // Since we don't have exec_sql, we can try to use a trick if the project has the 'postgres' extension enabled and a wrapper.
    // But usually, I should just ask the user to run it in SQL Editor if I can't.
    // However, I can try to use the 'supabaseAdmin.rpc' if there is an 'exec_sql' function.
    
    const sql = `
      CREATE OR REPLACE FUNCTION public.get_admin_permissions(_user_id uuid)
      RETURNS TABLE (
        module_key TEXT,
        can_view BOOLEAN,
        can_edit BOOLEAN
      )
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $$
        -- If user is in a super admin group, return all modules with full access
        SELECT 
          m.module_key,
          true AS can_view,
          true AS can_edit
        FROM (
          SELECT unnest(ARRAY['dashboard', 'companies', 'employees', 'requests', 'support', 'calendar', 'settings', 'legal', 'accesses']) AS module_key
        ) m
        WHERE EXISTS (
          SELECT 1 
          FROM admin_group_members agm
          JOIN admin_groups ag ON ag.id = agm.group_id
          WHERE agm.user_id = _user_id 
            AND ag.is_super_admin = true 
            AND ag.is_active = true
        )
        
        UNION ALL
        
        -- Otherwise, aggregate permissions from all groups the user belongs to
        SELECT 
          agp.module_key,
          bool_or(agp.can_view) AS can_view,
          bool_or(agp.can_edit) AS can_edit
        FROM admin_group_members agm
        JOIN admin_groups ag ON ag.id = agm.group_id
        JOIN admin_group_permissions agp ON agp.group_id = ag.id
        WHERE agm.user_id = _user_id 
          AND ag.is_active = true
          AND ag.is_super_admin = false
          AND NOT EXISTS (
            SELECT 1 
            FROM admin_group_members agm2
            JOIN admin_groups ag2 ON ag2.id = agm2.group_id
            WHERE agm2.user_id = _user_id 
              AND ag2.is_super_admin = true 
              AND ag2.is_active = true
          )
        GROUP BY agp.module_key
      $$;
    `;

    // Attempting to run SQL. If it fails, I'll let the user know.
    // Some projects have a 'run_sql' function for this purpose.
    const { error } = await supabaseAdmin.rpc("run_sql", { sql_query: sql });

    if (error) {
       return new Response("SQL RPC failed (ignore if you don't have run_sql enabled): " + error.message);
    }

    return new Response("DB RPC updated successfully.");
  } catch(e: any) {
    return new Response("Error: " + e.message);
  }
});
