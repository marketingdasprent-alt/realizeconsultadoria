import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateEmailRequest {
  employee_id: string;
  new_email: string;
  new_password?: string; // Opcional - se não fornecida, mantém a senha atual
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { employee_id, new_email, new_password }: UpdateEmailRequest = await req.json();

    // Validate required fields (password is now optional)
    if (!employee_id || !new_email) {
      return new Response(
        JSON.stringify({ error: "employee_id e new_email são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password length only if provided
    if (new_password && new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get employee data
    const { data: employee, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("id, name, email, user_id, companies(name)")
      .eq("id", employee_id)
      .single();

    if (employeeError || !employee) {
      console.error("Error fetching employee:", employeeError);
      return new Response(
        JSON.stringify({ error: "Colaborador não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const employeeData = employee as unknown as { id: string; name: string; email: string; user_id: string | null; companies: { name: string } | null };

    if (!employeeData.user_id) {
      return new Response(
        JSON.stringify({ error: "Colaborador não tem conta de utilizador associada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const oldEmail = employeeData.email;
    const normalizedNewEmail = new_email.toLowerCase().trim();

    // Check if email already exists in employees table (different employee)
    const { data: existingEmployee } = await supabaseAdmin
      .from("employees")
      .select("id")
      .ilike("email", normalizedNewEmail)
      .neq("id", employee_id)
      .maybeSingle();

    if (existingEmployee) {
      return new Response(
        JSON.stringify({ error: "Este email já está a ser utilizado por outro colaborador" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email already exists in auth.users (different user - could be an admin)
    const { data: existingAuthUsers, error: authListError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (!authListError && existingAuthUsers?.users) {
      // Find if any other user has this email
      const userWithEmail = existingAuthUsers.users.find(
        (u) => u.email?.toLowerCase() === normalizedNewEmail && u.id !== employeeData.user_id
      );
      
      if (userWithEmail) {
        // Check if that user is an admin
        const { data: userRoles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userWithEmail.id);
        
        const isAdmin = userRoles?.some(r => r.role === "admin");
        
        if (isAdmin) {
          return new Response(
            JSON.stringify({ 
              error: "Este email pertence a uma conta de administrador. Por favor utilize um email diferente." 
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Block anyway - emails must be unique across accounts
        return new Response(
          JSON.stringify({ 
            error: `O email "${normalizedNewEmail}" já está a ser utilizado por outro utilizador no sistema` 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update auth user - only include password if provided
    const updateAuthData: { email: string; email_confirm: boolean; password?: string } = { 
      email: normalizedNewEmail,
      email_confirm: true
    };
    
    if (new_password && new_password.length >= 8) {
      updateAuthData.password = new_password;
    }

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      employeeData.user_id,
      updateAuthData
    );

    if (authUpdateError) {
      console.error("Error updating auth user:", authUpdateError);
      return new Response(
        JSON.stringify({ error: `Erro ao atualizar credenciais: ${authUpdateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update employee email in database
    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ email: normalizedNewEmail })
      .eq("id", employee_id);

    if (updateError) {
      console.error("Error updating employee email:", updateError);
      // Try to rollback auth changes
      await supabaseAdmin.auth.admin.updateUserById(employeeData.user_id, { 
        email: oldEmail,
        email_confirm: true 
      });
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar email do colaborador" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email notification via Brevo
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (brevoApiKey) {
      try {
        const companyName = employeeData.companies?.name || "Realize Consultadoria";
        const loginUrl = "https://realizeconsultadoria.lovable.app/colaborador/login";

        // Build credentials section based on whether password was changed
        const credentialsSection = new_password 
          ? `
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Novo Email:</strong> ${normalizedNewEmail}</p>
              <p style="margin: 0;"><strong>Nova Senha:</strong> ${new_password}</p>
            </div>
            <p>Por favor, utilize estas novas credenciais para aceder ao portal:</p>
            <p style="color: #666; font-size: 14px;">
              Recomendamos que altere a sua senha após o primeiro acesso.
            </p>
          `
          : `
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Novo Email:</strong> ${normalizedNewEmail}</p>
            </div>
            <p>Continue a utilizar a sua <strong>senha atual</strong> para aceder ao portal.</p>
          `;

        const emailContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #B8860B; margin: 0;">Realize Consultadoria</h1>
            </div>
            
            <h2 style="color: #333;">O seu email de acesso foi atualizado</h2>
            
            <p>Olá <strong>${employeeData.name}</strong>,</p>
            
            <p>O seu email de acesso ao Portal do Colaborador foi atualizado.</p>
            
            ${credentialsSection}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background-color: #B8860B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Aceder ao Portal
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              ${companyName} - Portal do Colaborador<br>
              Este é um email automático, por favor não responda.
            </p>
          </div>
        `;

        const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "api-key": brevoApiKey,
          },
          body: JSON.stringify({
            sender: { name: "Realize Consultadoria", email: "noreply@dasprent.pt" },
            to: [{ email: normalizedNewEmail, name: employeeData.name }],
            subject: "Os seus dados de acesso foram atualizados",
            htmlContent: emailContent,
          }),
        });

        if (!brevoResponse.ok) {
          const brevoError = await brevoResponse.text();
          console.error("Brevo email error:", brevoError);
        } else {
          console.log("Email sent successfully to:", normalizedNewEmail);
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email atualizado com sucesso. O colaborador receberá as novas credenciais por email." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in update-employee-email:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
