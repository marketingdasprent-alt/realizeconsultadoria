import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const email = "mcarlosparracho@gmail.com";
    const name = "Maria Carlos Rocha";
    
    let report = "";

    // 1. Find by email in employees
    const { data: empByEmail } = await supabaseAdmin.from("employees").select("id, name, email").ilike("email", email);
    if (empByEmail && empByEmail.length > 0) {
      for (const e of empByEmail) {
        const { error } = await supabaseAdmin.from("employees").delete().eq("id", e.id);
        report += `Deleted employee by email: ${e.name} (${e.id}). Error: ${error?.message || "none"}\n`;
      }
    }

    // 2. Find by name in employees (case insensitive search)
    const { data: empByName } = await supabaseAdmin.from("employees").select("id, name, email").ilike("name", `%${name}%`);
    if (empByName && empByName.length > 0) {
      for (const e of empByName) {
        const { error } = await supabaseAdmin.from("employees").delete().eq("id", e.id);
        report += `Deleted employee by name: ${e.name} (${e.id}). Error: ${error?.message || "none"}\n`;
      }
    }

    // 3. Find and delete from auth.users
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = authData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (authUser) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      report += `Deleted auth user: ${authUser.id}. Error: ${error?.message || "none"}\n`;
    }

    if (!report) report = "No records found for " + email + " or " + name;

    return new Response(report);
  } catch(e: any) {
    return new Response("Internal Error: " + e.message);
  }
});
