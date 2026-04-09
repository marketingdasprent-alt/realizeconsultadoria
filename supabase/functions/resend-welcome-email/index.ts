import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendWelcomeRequest {
  employee_id: string;
}

const generateRandomPassword = () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employee_id }: ResendWelcomeRequest = await req.json();

    if (!employee_id) {
      return new Response(
        JSON.stringify({ error: "ID do colaborador é obrigatório" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get employee details
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("name, email")
      .eq("id", employee_id)
      .single();

    if (employeeError || !employee) {
      console.error("[resend-welcome-email] Error fetching employee:", employeeError);
      return new Response(
        JSON.stringify({ error: "Colaborador não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const newPassword = generateRandomPassword();

    // Find the user in Auth
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error("[resend-welcome-email] Error listing users:", listError);
      throw listError;
    }

    const authUser = users.users.find(u => u.email?.toLowerCase() === employee.email.toLowerCase());

    if (!authUser) {
      return new Response(
        JSON.stringify({ error: "Utilizador auth não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("[resend-welcome-email] Error updating password:", updateError);
      throw updateError;
    }

    // Send email via Brevo
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    let emailSent = false;
    let emailError = null;

    if (brevoApiKey) {
      const loginUrl = "https://realizeconsultadoria.lovable.app/colaborador/login";
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: sans-serif;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 40px auto;">
            <tr><td style="background-color: #000000; padding: 30px; text-align: center;">
              <h1 style="color: #d5b884; margin: 0; font-size: 28px;">REALIZE</h1>
            </td></tr>
            <tr><td style="background-color: #ffffff; padding: 40px 30px;">
              <h2>Olá ${employee.name},</h2>
              <p>Conforme solicitado, re-enviamos as suas credenciais de acesso ao portal da Realize Consultadoria.</p>
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; border-left: 4px solid #d5b884;">
                <p>📧 <strong>Email:</strong> ${employee.email}</p>
                <p>🔐 <strong>Nova Senha:</strong> ${newPassword}</p>
              </div>
              <p>Aceda aqui: <a href="${loginUrl}">${loginUrl}</a></p>
              <p style="color: #999999; font-size: 14px;">Recomendamos alterar a sua senha após o primeiro acesso.</p>
            </td></tr>
          </table>
        </body>
        </html>
      `;

      try {
        const brevoResp = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "api-key": brevoApiKey,
          },
          body: JSON.stringify({
            sender: { name: "Realize Consultadoria", email: "noreply@dasprent.pt" },
            to: [{ email: employee.email, name: employee.name }],
            subject: "Credenciais de Acesso - Realize Consultadoria",
            htmlContent: emailHtml,
          }),
        });

        if (brevoResp.ok) {
          emailSent = true;
        } else {
          emailError = await brevoResp.text();
          console.error("[resend-welcome-email] Brevo error:", emailError);
        }
      } catch (err) {
        emailError = err.message;
        console.error("[resend-welcome-email] Mail error:", err);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        password: newPassword, // Show the generated password to admin
        emailSent,
        emailError
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[resend-welcome-email] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
