import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    
    // 1. Create/Update group
    const { data: group, error: groupError } = await supabaseAdmin
      .from("admin_groups")
      .upsert({ name: "Jurídico", description: "Acesso exclusivo ao módulo jurídico", is_super_admin: false, is_active: true }, { onConflict: "name" })
      .select()
      .single();

    if (groupError) throw groupError;

    // 2. Add permission for module-level (topic_key = null)
    // We try to find existing first to avoid ON CONFLICT issues with complex indexes
    const { data: existing } = await supabaseAdmin
      .from("admin_group_permissions")
      .select("id")
      .eq("group_id", group.id)
      .eq("module_key", "legal")
      .is("topic_key", null)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from("admin_group_permissions")
        .update({ can_view: true, can_edit: true })
        .eq("id", existing.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("admin_group_permissions")
        .insert({ group_id: group.id, module_key: "legal", can_view: true, can_edit: true, topic_key: null });
      if (insertError) throw insertError;
    }

    return new Response("Successfully setup Jurídico group and permissions.");
  } catch(e: any) {
    return new Response("Error: " + e.message);
  }
});
