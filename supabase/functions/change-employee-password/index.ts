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

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      employee.user_id,
      { password: new_password }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email if requested
    if (send_email && brevoApiKey) {
      const baseUrl = "https://realizeconsultadoria.lovable.app";

      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 40px auto;">
    <tr>
      <td style="background-color: #000000; padding: 30px; text-align: center;">
        <h1 style="color: #d5b884; margin: 0; font-size: 28px; letter-spacing: 2px;">REALIZE</h1>
        <p style="color: #d5b884; margin: 5px 0 0 0; font-size: 12px; letter-spacing: 4px;">CONSULTADORIA</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #ffffff; padding: 40px 30px;">
        <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">Olá ${employee.name || ""},</h2>
        <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
          A sua palavra-passe de acesso ao Portal do Colaborador foi alterada por um administrador.
        </p>
        
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
          <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 16px;">Os seus dados de acesso:</h3>
          <p style="color: #666666; font-size: 14px; line-height: 1.8; margin: 0;">
            <strong>Email:</strong> ${employee.email}<br>
            <strong>Nova Palavra-passe:</strong> ${new_password}
          </p>
        </div>
        
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
          <tr>
            <td style="background-color: #d5b884; border-radius: 6px;">
              <a href="${baseUrl}/colaborador/login" style="display: inline-block; padding: 16px 40px; color: #000000; text-decoration: none; font-weight: 600; font-size: 16px;">
                Aceder ao Portal
              </a>
            </td>
          </tr>
        </table>
        
        <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
          Recomendamos que altere a sua palavra-passe após o primeiro acesso.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #000000; padding: 20px 30px; text-align: center;">
        <p style="color: #888888; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Realize Consultadoria. Todos os direitos reservados.
        </p>
      </td>
    </tr>
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
          console.error("Brevo email error:", await emailResponse.text());
        } else {
          console.log(`Password change email sent to ${employee.email}`);
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
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
