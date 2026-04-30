import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const email = "mcarlosparracho@gmail.com";
    const name = "Maria Carlos Rocha";
    
    // 1. Find user in auth
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = authData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!authUser) {
      return new Response("User not found in auth: " + email);
    }

    // 2. Check if profile exists
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (profile) {
      // Update
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ name, email })
        .eq("user_id", authUser.id);
      return new Response("Updated profile for: " + name + ". Error: " + (error?.message || "none"));
    } else {
      // Insert
      const { error } = await supabaseAdmin
        .from("profiles")
        .insert({ user_id: authUser.id, name, email });
      return new Response("Created profile for: " + name + ". Error: " + (error?.message || "none"));
    }
  } catch(e: any) {
    return new Response("Internal Error: " + e.message);
  }
});
