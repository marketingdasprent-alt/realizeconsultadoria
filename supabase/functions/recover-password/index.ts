import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RecoverPasswordRequest {
  email: string;
  redirectTo: string;
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

    const { email, redirectTo }: RecoverPasswordRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`Generating recovery link for: ${normalizedEmail}`);

    // Try to generate link with provided email
    let authEmail = normalizedEmail;
    let { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo }
    });

    // If not found, look up the auth email via employees table (personal email fallback)
    if (linkError) {
      console.log(`Direct lookup failed, searching employees table for: ${normalizedEmail}`);

      const { data: empData, error: empError } = await supabaseAdmin
        .from("employees")
        .select("user_id, email")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (!empError && empData?.user_id) {
        // Get the auth user by user_id to find their auth email
        const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(empData.user_id);

        if (!authUserError && authUser?.user?.email) {
          authEmail = authUser.user.email;
          console.log(`Found auth email via employees: ${authEmail}`);

          // Try again with the auth email
          const result = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: authEmail,
            options: { redirectTo }
          });
          data = result.data;
          linkError = result.error;
        }
      }
    }

    if (linkError || !data) {
      console.error("Error generating link:", linkError);
      return new Response(
        JSON.stringify({ error: "Não foi possível processar o pedido. Verifique o email inserido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recoveryLink = data.properties.action_link;
    console.log(`Recovery link generated for ${normalizedEmail} (auth: ${authEmail})`);

    // Send to the original email the user typed (so they get it in their inbox)
    const sendToEmail = normalizedEmail;

    if (brevoApiKey) {
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
                <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">Recuperação de Palavra-passe</h2>
                <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                  Recebemos um pedido para redefinir a palavra-passe da sua conta no Portal Realize Consultadoria.
                </p>
                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #d5b884;">
                  <p style="color: #333333; font-size: 14px; margin: 0;"><strong>Conta a recuperar:</strong> ${authEmail}</p>
                  <p style="color: #666666; font-size: 12px; margin: 5px 0 0 0;">(Utilize este email para fazer login após redefinir a senha)</p>
                </div>
                <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                  Clique no botão abaixo para escolher uma nova palavra-passe:
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                  <tr>
                    <td style="background-color: #d5b884; border-radius: 6px;">
                      <a href="${recoveryLink}" style="display: inline-block; padding: 16px 40px; color: #000000; text-decoration: none; font-weight: 600; font-size: 16px;">
                        Redefinir Palavra-passe
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                  Se não solicitou esta alteração, pode ignorar este email com segurança. O link é válido por 24 horas.
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
            to: [{ email: sendToEmail }],
            subject: "Recuperação de Palavra-passe - Realize Consultadoria",
            htmlContent: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const emailError = await emailResponse.text();
          console.error("Brevo email error:", emailError);
          return new Response(
            JSON.stringify({ error: "Erro ao enviar email de recuperação" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (err: any) {
        console.error("Error sending email:", err);
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.error("Brevo API key missing");
      return new Response(
        JSON.stringify({ error: "Configuração de email ausente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
