import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    
    // Find Maria Carlos Rocha
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, name")
      .ilike("name", "%Maria Carlos Rocha%");

    if (!profiles || profiles.length === 0) {
      return new Response("Maria not found");
    }

    const userId = profiles[0].user_id;

    // Check her groups
    const { data: memberships } = await supabaseAdmin
      .from("admin_group_members")
      .select("group_id, admin_groups(name, is_super_admin)")
      .eq("user_id", userId);

    // Check permissions for those groups
    const groupIds = memberships?.map(m => m.group_id) || [];
    const { data: permissions } = await supabaseAdmin
      .from("admin_group_permissions")
      .select("group_id, module_key, can_view")
      .in("group_id", groupIds);

    return new Response(JSON.stringify({
      user: profiles[0],
      memberships,
      permissions
    }, null, 2));
  } catch(e: any) {
    return new Response("Error: " + e.message);
  }
});
