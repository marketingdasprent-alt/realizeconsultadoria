import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteAdminRequest {
  email: string;
  name?: string;
  password: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the requester is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth context to validate token
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
    const requesterEmail = claimsData.claims.email;

    // Check if requester is admin
    const { data: requesterRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requesterId)
      .eq("role", "admin")
      .maybeSingle();

    if (!requesterRole) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem criar novos admins" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, name, password }: InviteAdminRequest = await req.json();
    const normalizedEmail = email.toLowerCase().trim();

    // Validate password
    if (!password || password.length < 8) {
      return new Response(
        JSON.stringify({ error: "A palavra-passe deve ter pelo menos 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Admin ${requesterEmail} is creating new admin: ${normalizedEmail}`);

    // Check if email already exists in employees table - BLOCK if exists
    const { data: existingEmployee } = await supabaseAdmin
      .from("employees")
      .select("id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (existingEmployee) {
      console.log(`Email already in use by employee: ${normalizedEmail}`);
      return new Response(
        JSON.stringify({ 
          error: "Este email já está associado a um colaborador. Por favor utilize um email diferente para o administrador." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists in auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);

    let userId: string;
    const displayName = name || normalizedEmail.split("@")[0];

    if (existingUser) {
      // Check if already admin
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", existingUser.id)
        .eq("role", "admin")
        .maybeSingle();

      if (existingRole) {
        return new Response(
          JSON.stringify({ error: "Este utilizador já é administrador" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Email exists in auth but not in employees and not admin - this means it's an orphan account
      // Block anyway to ensure clean separation
      console.log(`Email exists in auth but not employees, blocking: ${normalizedEmail}`);
      return new Response(
        JSON.stringify({ 
          error: "Este email já está em uso no sistema. Por favor utilize um email diferente." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new user with password directly (always a fresh account)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true,
      user_metadata: { 
        name: displayName
      }
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: `Erro ao criar utilizador: ${createError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    userId = newUser.user.id;
    console.log(`Created new user with ID: ${userId}`);

    // Add admin role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });

    if (roleError) {
      console.error("Error adding admin role:", roleError);
      return new Response(
        JSON.stringify({ error: `Erro ao adicionar role admin: ${roleError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Added admin role to user ${userId}`);

    const loginUrl = "https://realizeconsultadoria.lovable.app/admin/login";

    // Send welcome email via Brevo (always new user now)
    if (brevoApiKey) {
      const emailSubject = "Bem-vindo ao Portal Realize - Dados de Acesso";
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
        <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">Olá ${displayName},</h2>
        <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
          A sua conta de <strong>administrador(a)</strong> foi criada no Portal Realize Consultadoria.
        </p>
        
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
          <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 16px;">Os seus dados de acesso:</h3>
          <p style="color: #666666; font-size: 14px; line-height: 1.8; margin: 0;">
            <strong>Email:</strong> ${normalizedEmail}<br>
            <strong>Palavra-passe:</strong> ${password}
          </p>
        </div>
        
        <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
          Clique no botão abaixo para aceder ao painel de administração:
        </p>
        
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
          <tr>
            <td style="background-color: #d5b884; border-radius: 6px;">
              <a href="${loginUrl}" style="display: inline-block; padding: 16px 40px; color: #000000; text-decoration: none; font-weight: 600; font-size: 16px;">
                Aceder ao Portal
              </a>
            </td>
          </tr>
        </table>
        
        <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
          Recomendamos que altere a sua palavra-passe após o primeiro acesso, em Configurações → Segurança.
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
            to: [{ email: normalizedEmail, name: displayName }],
            subject: emailSubject,
            htmlContent: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error("Brevo API error:", errorText);
        } else {
          console.log(`Welcome email sent to ${normalizedEmail}`);
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
      }
    } else {
      console.warn("BREVO_API_KEY not configured, skipping email");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Novo administrador criado e email enviado",
        userId 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in invite-admin function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
