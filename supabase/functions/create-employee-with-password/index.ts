import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateEmployeeRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  position?: string;
  department?: string;
  company_id: string;
  nationality?: string;
  document_number?: string;
  vacation_days?: number;
  self_schedulable_days?: number | null;
  iban?: string;
  cartao_da?: string;
  cartao_refeicao?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: CreateEmployeeRequest = await req.json();
    const { name, email, password, phone, position, department, company_id, nationality, document_number, vacation_days, self_schedulable_days, iban, cartao_da, cartao_refeicao } = requestData;

    console.log("[create-employee-with-password] Processing request for:", email);

    // Validate required fields
    if (!name || !email || !password || !company_id) {
      return new Response(
        JSON.stringify({ error: "Nome, email, senha e empresa são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 8 caracteres" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if email already exists in employees
    const { data: existingEmployee } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (existingEmployee) {
      return new Response(
        JSON.stringify({ error: "Já existe um colaborador com este email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user already exists in auth - BLOCK if exists (separate accounts required)
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingAuthUser) {
      // BLOCK: Email already in use by another account (admin or other employee)
      console.log("[create-employee-with-password] Email already in use in auth.users:", email);
      return new Response(
        JSON.stringify({ 
          error: "Este email já está em uso no sistema. Por favor utilize um email diferente para o colaborador." 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create new user with password (always a fresh account)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true,
      user_metadata: { name: name },
    });

    if (createError) {
      console.error("[create-employee-with-password] Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar utilizador: " + createError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userId = newUser.user.id;
    console.log("[create-employee-with-password] Created new user:", userId);

    // Create employee record
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .insert({
        name,
        email: email.toLowerCase(),
        phone: phone || null,
        position: position || null,
        department: department || null,
        company_id,
        nationality: nationality || null,
        document_number: document_number || null,
        user_id: userId,
        is_active: true,
        iban: iban || null,
        cartao_da: cartao_da || null,
        cartao_refeicao: cartao_refeicao || null,
      })
      .select()
      .single();

    if (employeeError) {
      console.error("[create-employee-with-password] Error creating employee:", employeeError);
      // Try to clean up the created user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "Erro ao criar colaborador: " + employeeError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[create-employee-with-password] Employee created:", employee.id);

    // Add employee role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "employee" }, { onConflict: "user_id,role" });

    if (roleError) {
      console.error("[create-employee-with-password] Error adding role:", roleError);
    }

    // Create vacation balance for current year
    const currentYear = new Date().getFullYear();
    const vacationDays = vacation_days ?? 22;

    const { error: vacationError } = await supabaseAdmin
      .from("employee_vacation_balances")
      .insert({
        employee_id: employee.id,
        year: currentYear,
        total_days: vacationDays,
        used_days: 0,
        self_schedulable_days: self_schedulable_days ?? null,
      });

    if (vacationError) {
      console.error("[create-employee-with-password] Error creating vacation balance:", vacationError);
    } else {
      console.log("[create-employee-with-password] Vacation balance created:", vacationDays, "days for year", currentYear);
    }

    let emailSent = false;
    let emailErrorMessage = null;

    // Send welcome email with credentials via Brevo
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (brevoApiKey) {
      const loginUrl = "https://realizeconsultadoria.lovable.app/colaborador/login";
      
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
                <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">Bem-vindo(a), ${name}!</h2>
                <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                  A sua conta no portal de colaboradores da Realize Consultadoria foi criada com sucesso.
                </p>
                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #d5b884;">
                  <p style="color: #333333; font-size: 14px; margin: 0 0 10px 0;"><strong>Os seus dados de acesso:</strong></p>
                  <p style="color: #666666; font-size: 14px; margin: 0 0 8px 0;">📧 <strong>Email:</strong> ${email}</p>
                  <p style="color: #666666; font-size: 14px; margin: 0;">🔐 <strong>Senha:</strong> ${password}</p>
                </div>
                <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                  Clique no botão abaixo para aceder ao portal:
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
                  ⚠️ Por segurança, recomendamos que altere a sua senha após o primeiro acesso.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color: #000000; padding: 20px 30px; text-align: center;">
                <p style="color: #888888; font-size: 12px; margin: 0;">
                  © 2024 Realize Consultadoria. Todos os direitos reservados.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      try {
        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "api-key": brevoApiKey,
          },
          body: JSON.stringify({
            sender: {
              name: "Realize Consultadoria",
              email: "noreply@dasprent.pt",
            },
            to: [{ email: email.toLowerCase(), name: name }],
            subject: "Bem-vindo ao Portal Realize Consultadoria",
            htmlContent: emailHtml,
          }),
        });

        if (!brevoResponse.ok) {
          const brevoError = await brevoResponse.text();
          console.error("[create-employee-with-password] Brevo error:", brevoError);
          emailErrorMessage = "Erro no serviço de email (Brevo)";
        } else {
          console.log("[create-employee-with-password] Welcome email sent to:", email);
          emailSent = true;
        }
      } catch (emailError) {
        console.error("[create-employee-with-password] Error sending email:", emailError);
        emailErrorMessage = "Falha na conexão com serviço de email";
      }
    } else {
      emailErrorMessage = "Configuração de API de email ausente";
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        employee: employee,
        employeeId: employee.id,
        emailSent,
        emailError: emailErrorMessage,
        message: emailSent 
          ? "Colaborador criado com sucesso" 
          : `Colaborador criado, mas houve uma falha no email: ${emailErrorMessage}`
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[create-employee-with-password] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
