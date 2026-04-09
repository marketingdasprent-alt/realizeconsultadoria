import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChangePasswordRequest {
  employee_id: string;
  new_password: string;
  send_email?: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Validate caller is admin using getClaims (same pattern as invite-admin)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);

    if (claimsError || !claimsData?.claims?.sub) {
      console.error("Token validation error:", claimsError);
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requesterId = claimsData.claims.sub;

    // Check if caller is admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem alterar senhas" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { employee_id, new_password, send_email }: ChangePasswordRequest = await req.json();

    if (!employee_id || !new_password) {
      return new Response(
        JSON.stringify({ error: "employee_id e new_password são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: "A palavra-passe deve ter pelo menos 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get employee data
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("id, name, email, user_id")
      .eq("id", employee_id)
      .maybeSingle();

    if (employeeError || !employee) {
      return new Response(
        JSON.stringify({ error: "Colaborador não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!employee.user_id) {
      return new Response(
        JSON.stringify({ error: "Colaborador não tem conta de utilizador associada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the actual auth user to see what email they login with
    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(employee.user_id);
    const authEmail = authUser?.user?.email || employee.email;

    // Update password AND force confirm email / clear any blocks
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      employee.user_id,
      { 
        password: new_password,
        email_confirm: true
      }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let email_success = false;
    let email_error = null;

    // Send email if requested
    if (send_email) {
      if (brevoApiKey) {
        const baseUrl = "https://realizeconsultadoria.lovable.app";
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 40px auto;">
              <tr><td style="background-color: #000000; padding: 30px; text-align: center;">
                <h1 style="color: #d5b884; margin: 0; font-size: 28px;">REALIZE</h1>
              </td></tr>
              <tr><td style="background-color: #ffffff; padding: 40px 30px;">
                <h2>Olá ${employee.name || ""},</h2>
                <p>A sua palavra-passe de acesso ao portal da Realize Consultadoria foi alterada.</p>
                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; border-left: 4px solid #d5b884;">
                  <p>📧 <strong>Email de Login:</strong> ${authEmail}</p>
                  <p>🔐 <strong>Nova Palavra-passe:</strong> ${new_password}</p>
                </div>
                ${authEmail.toLowerCase() !== employee.email.toLowerCase() ? `<p style="color: #eab308; font-size: 13px;">Nota: O seu email de login (${authEmail}) é diferente do seu email de contacto profissional.</p>` : ''}
                <p>Aceda aqui: <a href="${baseUrl}/colaborador/login">${baseUrl}/colaborador/login</a></p>
              </td></tr>
            </table>
          </body>
          </html>
        `;

        try {
          const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "accept": "application/json",
              "api-key": brevoApiKey,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              sender: { name: "Realize Consultadoria", email: "noreply@dasprent.pt" },
              to: [{ email: employee.email, name: employee.name || employee.email }],
              subject: "Realize - A sua palavra-passe foi alterada",
              htmlContent: emailHtml,
            }),
          });

          if (!emailResponse.ok) {
            email_error = await emailResponse.text();
            console.error("Brevo email error:", email_error);
          } else {
            console.log(`Password change email sent to ${employee.email}`);
            email_success = true;
          }
        } catch (err: any) {
          console.error("Error sending email:", err);
          email_error = err.message;
        }
      } else {
        email_error = "Configuração BREVO_API_KEY ausente no Supabase";
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_success, 
        email_error 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in change-employee-password:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
