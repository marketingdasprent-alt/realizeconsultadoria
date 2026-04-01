import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ChangePasswordRequest {
  user_id: string;
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
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { user_id, new_password, send_email }: ChangePasswordRequest = await req.json();

    if (!user_id || !new_password) {
      return new Response(
        JSON.stringify({ error: "user_id e new_password são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: "A palavra-passe deve ter pelo menos 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is an admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Utilizador não é um administrador" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
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
      // Get user profile
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("name, email")
        .eq("user_id", user_id)
        .maybeSingle();

      if (profile?.email) {
        const baseUrl = "https://realizeconsultadoria.lovable.app";

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Palavra-passe Alterada</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center" style="padding: 40px 0;">
                  <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <tr>
                      <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e4e4e7;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #B8860B;">Realize Consultoria</h1>
                        <p style="margin: 8px 0 0; font-size: 14px; color: #71717a;">Gestão de Ausências</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 40px;">
                        <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #18181b;">Palavra-passe Alterada</h2>
                        <p style="margin: 0 0 24px; font-size: 16px; color: #52525b; line-height: 1.6;">
                          Olá${profile.name ? ` <strong>${profile.name}</strong>` : ''},
                        </p>
                        <p style="margin: 0 0 24px; font-size: 16px; color: #52525b; line-height: 1.6;">
                          A sua palavra-passe de acesso ao painel de administração foi alterada por outro administrador.
                        </p>
                        <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
                          <p style="margin: 0 0 12px; font-size: 14px; color: #92400e; font-weight: 600;">Novos Dados de Acesso:</p>
                          <p style="margin: 0; font-size: 14px; color: #78350f;">
                            <strong>Email:</strong> ${profile.email}<br>
                            <strong>Nova Palavra-passe:</strong> ${new_password}
                          </p>
                        </div>
                        <table role="presentation" style="width: 100%;">
                          <tr>
                            <td align="center">
                              <a href="${baseUrl}/admin/login" style="display: inline-block; padding: 14px 32px; background-color: #B8860B; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">
                                Aceder ao Portal
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 24px 0 0; font-size: 14px; color: #71717a; line-height: 1.6;">
                          Se não reconhece esta atividade, contacte imediatamente a equipa de suporte.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7; border-radius: 0 0 8px 8px;">
                        <p style="margin: 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                          © ${new Date().getFullYear()} Realize Consultoria. Todos os direitos reservados.
                        </p>
                      </td>
                    </tr>
                  </table>
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
              sender: {
                name: "Realize Consultoria",
                email: "noreply@dasprent.pt",
              },
              to: [{ email: profile.email, name: profile.name || profile.email }],
              subject: "Realize - A sua palavra-passe foi alterada",
              htmlContent: emailHtml,
            }),
          });

          if (!emailResponse.ok) {
            console.error("Brevo email error:", await emailResponse.text());
          }
        } catch (emailError) {
          console.error("Error sending email:", emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in change-admin-password:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
