import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RepairMixedAccountRequest {
  admin_user_id: string;
  employee_password: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { admin_user_id, employee_password }: RepairMixedAccountRequest = await req.json();

    console.log("[repair-mixed-account] Starting repair for user:", admin_user_id);

    // Validate required fields
    if (!admin_user_id || !employee_password) {
      return new Response(
        JSON.stringify({ error: "admin_user_id e employee_password são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (employee_password.length < 8) {
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

    // Step 1: Get the profile (has the correct admin email)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", admin_user_id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error("[repair-mixed-account] Profile not found:", profileError);
      return new Response(
        JSON.stringify({ error: "Perfil de administrador não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const adminEmail = profile.email; // This is the correct admin email (corporate)
    console.log("[repair-mixed-account] Admin email from profile:", adminEmail);

    // Step 2: Get current auth user email
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(admin_user_id);

    if (authError || !authUser?.user) {
      console.error("[repair-mixed-account] Auth user not found:", authError);
      return new Response(
        JSON.stringify({ error: "Utilizador não encontrado na autenticação" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const currentAuthEmail = authUser.user.email?.toLowerCase();
    console.log("[repair-mixed-account] Current auth email:", currentAuthEmail);

    // If emails match, no repair needed
    if (currentAuthEmail === adminEmail.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: "Esta conta não precisa de reparação - os emails já coincidem" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Step 3: Find the employee that uses this user_id
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("*")
      .eq("user_id", admin_user_id)
      .maybeSingle();

    if (employeeError) {
      console.error("[repair-mixed-account] Error finding employee:", employeeError);
      return new Response(
        JSON.stringify({ error: "Erro ao procurar colaborador: " + employeeError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!employee) {
      console.log("[repair-mixed-account] No employee linked to this user_id, just restoring admin email");
      
      // Just restore the admin email
      const { error: restoreError } = await supabaseAdmin.auth.admin.updateUserById(
        admin_user_id,
        { email: adminEmail.toLowerCase() }
      );

      if (restoreError) {
        console.error("[repair-mixed-account] Error restoring admin email:", restoreError);
        return new Response(
          JSON.stringify({ error: "Erro ao restaurar email do admin: " + restoreError.message }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Email de administrador restaurado para " + adminEmail,
          employee_created: false
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const employeeEmail = employee.email.toLowerCase();
    console.log("[repair-mixed-account] Employee email:", employeeEmail);

    // Step 4: Check if the employee email already exists as ANOTHER user (not the admin we're repairing)
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUserWithEmployeeEmail = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === employeeEmail && u.id !== admin_user_id
    );

    if (existingUserWithEmployeeEmail) {
      console.error("[repair-mixed-account] Employee email already in use by another account");
      return new Response(
        JSON.stringify({ 
          error: "O email do colaborador (" + employeeEmail + ") já está em uso por outra conta. Primeiro altere o email do colaborador para um email único." 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Step 5: FIRST restore admin email to corporate email (to free up the personal email)
    console.log("[repair-mixed-account] Restoring admin email to:", adminEmail);
    const { error: restoreAdminError } = await supabaseAdmin.auth.admin.updateUserById(
      admin_user_id,
      { email: adminEmail.toLowerCase() }
    );

    if (restoreAdminError) {
      console.error("[repair-mixed-account] Error restoring admin email:", restoreAdminError);
      return new Response(
        JSON.stringify({ error: "Erro ao restaurar email do admin: " + restoreAdminError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[repair-mixed-account] Admin email restored to:", adminEmail);

    // Step 6: NOW create new user account for the employee (email is now free)
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: employeeEmail,
      password: employee_password,
      email_confirm: true,
      user_metadata: { name: employee.name },
    });

    if (createUserError) {
      console.error("[repair-mixed-account] Error creating new user:", createUserError);
      // Rollback: restore the admin email back to the employee email
      await supabaseAdmin.auth.admin.updateUserById(admin_user_id, { email: employeeEmail });
      return new Response(
        JSON.stringify({ error: "Erro ao criar conta de colaborador: " + createUserError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const newEmployeeUserId = newUser.user.id;
    console.log("[repair-mixed-account] New employee user created:", newEmployeeUserId);

    // Step 7: Update employee.user_id to point to the new account
    const { error: updateEmployeeError } = await supabaseAdmin
      .from("employees")
      .update({ user_id: newEmployeeUserId })
      .eq("id", employee.id);

    if (updateEmployeeError) {
      console.error("[repair-mixed-account] Error updating employee user_id:", updateEmployeeError);
      // Rollback: delete the new user and restore admin email
      await supabaseAdmin.auth.admin.deleteUser(newEmployeeUserId);
      await supabaseAdmin.auth.admin.updateUserById(admin_user_id, { email: employeeEmail });
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar colaborador: " + updateEmployeeError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Step 8: Add employee role to new user
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: newEmployeeUserId, role: "employee" }, { onConflict: "user_id,role" });

    if (roleError) {
      console.error("[repair-mixed-account] Error adding employee role:", roleError);
    }

    // Step 9: Send welcome email to employee with credentials
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
                <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">Novos Dados de Acesso</h2>
                <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                  Olá ${employee.name}, os seus dados de acesso ao portal de colaboradores foram atualizados.
                </p>
                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #d5b884;">
                  <p style="color: #333333; font-size: 14px; margin: 0 0 10px 0;"><strong>Os seus novos dados de acesso:</strong></p>
                  <p style="color: #666666; font-size: 14px; margin: 0 0 8px 0;">📧 <strong>Email:</strong> ${employeeEmail}</p>
                  <p style="color: #666666; font-size: 14px; margin: 0;">🔐 <strong>Senha:</strong> ${employee_password}</p>
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
            to: [{ email: employeeEmail, name: employee.name }],
            subject: "Novos Dados de Acesso - Portal Realize",
            htmlContent: emailHtml,
          }),
        });

        if (!brevoResponse.ok) {
          const brevoError = await brevoResponse.text();
          console.error("[repair-mixed-account] Brevo error:", brevoError);
        } else {
          console.log("[repair-mixed-account] Welcome email sent to:", employeeEmail);
        }
      } catch (emailError) {
        console.error("[repair-mixed-account] Error sending email:", emailError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Conta reparada com sucesso. Admin restaurado para ${adminEmail}, colaborador separado para ${employeeEmail}`,
        admin_email: adminEmail,
        employee_email: employeeEmail,
        employee_created: true
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[repair-mixed-account] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
