import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Employee {
  id: string;
  name: string;
  email: string;
  safety_checkup_date: string | null;
  safety_checkup_renewal_months: number | null;
  company: { name: string } | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting safety checkup reminders check...");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("BREVO_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get notification recipients
    const { data: emailRecords } = await supabaseAdmin
      .from("notification_emails_absences")
      .select("email")
      .eq("is_active", true);

    let recipientEmails: string[] = emailRecords?.map(r => r.email) || [];

    // Fallback to system_settings
    if (recipientEmails.length === 0) {
      const { data: setting } = await supabaseAdmin
        .from("system_settings")
        .select("value")
        .eq("key", "notification_email")
        .single();

      const fallbackEmail = setting?.value?.trim();
      if (fallbackEmail) {
        recipientEmails = [fallbackEmail];
      }
    }

    if (recipientEmails.length === 0) {
      console.log("No notification recipients configured");
      return new Response(
        JSON.stringify({ success: true, message: "Sem destinatários configurados" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get today's and tomorrow's dates in YYYY-MM-DD format
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`Checking for dates: today=${todayStr}, tomorrow=${tomorrowStr}`);

    // Get all active employees with safety checkup data
    const { data: employees, error: empError } = await supabaseAdmin
      .from("employees")
      .select(`
        id,
        name,
        email,
        safety_checkup_date,
        safety_checkup_renewal_months,
        company:companies(name)
      `)
      .eq("is_active", true)
      .not("safety_checkup_date", "is", null);

    if (empError) {
      console.error("Error fetching employees:", empError);
      throw empError;
    }

    console.log(`Found ${employees?.length || 0} employees with safety checkup data`);

    const checkupsToday: Employee[] = [];
    const checkupsTomorrow: Employee[] = [];
    const renewalsIn7Days: Employee[] = [];

    // Calculate 7 days from now
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

    for (const emp of (employees || [])) {
      if (!emp.safety_checkup_date) continue;

      // Check for checkups today/tomorrow
      if (emp.safety_checkup_date === todayStr) {
        checkupsToday.push(emp);
      }
      if (emp.safety_checkup_date === tomorrowStr) {
        checkupsTomorrow.push(emp);
      }

      // Calculate renewal date
      if (emp.safety_checkup_renewal_months) {
        const checkupDate = new Date(emp.safety_checkup_date);
        const renewalDate = new Date(checkupDate);
        renewalDate.setMonth(renewalDate.getMonth() + emp.safety_checkup_renewal_months);
        const renewalStr = renewalDate.toISOString().split('T')[0];

        if (renewalStr === sevenDaysStr) {
          renewalsIn7Days.push(emp);
        }
      }
    }

    console.log(`Checkups today: ${checkupsToday.length}, tomorrow: ${checkupsTomorrow.length}, renewals in 7 days: ${renewalsIn7Days.length}`);

    const emailsSent: string[] = [];

    // Send email for checkups today
    if (checkupsToday.length > 0) {
      const success = await sendReminderEmail(
        brevoApiKey,
        recipientEmails,
        "🏥 Consultas de Higiene e Segurança - HOJE",
        "Consultas Agendadas para Hoje",
        checkupsToday,
        "hoje"
      );
      if (success) emailsSent.push("checkups_today");
    }

    // Send email for checkups tomorrow
    if (checkupsTomorrow.length > 0) {
      const success = await sendReminderEmail(
        brevoApiKey,
        recipientEmails,
        "🏥 Consultas de Higiene e Segurança - AMANHÃ",
        "Consultas Agendadas para Amanhã",
        checkupsTomorrow,
        "amanhã"
      );
      if (success) emailsSent.push("checkups_tomorrow");
    }

    // Send email for renewals in 7 days
    if (renewalsIn7Days.length > 0) {
      const success = await sendRenewalReminderEmail(
        brevoApiKey,
        recipientEmails,
        "🔄 Renovações de Consulta - 7 Dias",
        "Renovações de Consulta em 7 Dias",
        renewalsIn7Days
      );
      if (success) emailsSent.push("renewals_7_days");
    }

    console.log(`Emails sent: ${emailsSent.join(", ") || "none"}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Verificação concluída`,
        stats: {
          checkupsToday: checkupsToday.length,
          checkupsTomorrow: checkupsTomorrow.length,
          renewalsIn7Days: renewalsIn7Days.length,
          emailsSent
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-safety-checkup-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

async function sendReminderEmail(
  apiKey: string,
  recipients: string[],
  subject: string,
  title: string,
  employees: Employee[],
  when: string
): Promise<boolean> {
  const employeeRows = employees.map(emp => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${emp.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${emp.company?.name || "N/A"}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${formatDate(emp.safety_checkup_date!)}</td>
    </tr>
  `).join("");

  const htmlContent = `
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
            <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">${title}</h2>
            <p style="color: #666666; font-size: 14px; line-height: 1.6;">
              Os seguintes colaboradores têm consultas de Higiene e Segurança agendadas para <strong>${when}</strong>:
            </p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f8f8f8;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d5b884;">Colaborador</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d5b884;">Empresa</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d5b884;">Data</th>
                </tr>
              </thead>
              <tbody>
                ${employeeRows}
              </tbody>
            </table>

            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px auto 0;">
              <tr>
                <td style="background-color: #d5b884; border-radius: 6px;">
                  <a href="https://realize.dasprent.pt/admin/colaboradores" style="display: inline-block; padding: 16px 40px; color: #000000; text-decoration: none; font-weight: 600; font-size: 16px;">
                    Ver Colaboradores
                  </a>
                </td>
              </tr>
            </table>
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

  return await sendEmail(apiKey, recipients, subject, htmlContent);
}

async function sendRenewalReminderEmail(
  apiKey: string,
  recipients: string[],
  subject: string,
  title: string,
  employees: Employee[]
): Promise<boolean> {
  const employeeRows = employees.map(emp => {
    const renewalDate = new Date(emp.safety_checkup_date!);
    renewalDate.setMonth(renewalDate.getMonth() + (emp.safety_checkup_renewal_months || 0));
    
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${emp.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${emp.company?.name || "N/A"}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${formatDate(renewalDate.toISOString().split('T')[0])}</td>
      </tr>
    `;
  }).join("");

  const htmlContent = `
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
            <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">${title}</h2>
            <p style="color: #666666; font-size: 14px; line-height: 1.6;">
              Os seguintes colaboradores precisam de agendar <strong>renovação da consulta</strong> de Higiene e Segurança:
            </p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f8f8f8;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d5b884;">Colaborador</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d5b884;">Empresa</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d5b884;">Data Renovação</th>
                </tr>
              </thead>
              <tbody>
                ${employeeRows}
              </tbody>
            </table>

            <div style="background-color: #fff3cd; border-left: 4px solid #d5b884; padding: 15px; margin: 20px 0; border-radius: 0 6px 6px 0;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                ⚠️ Estas renovações vencem em 7 dias. Por favor, agende as novas consultas.
              </p>
            </div>

            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 30px auto 0;">
              <tr>
                <td style="background-color: #d5b884; border-radius: 6px;">
                  <a href="https://realize.dasprent.pt/admin/colaboradores" style="display: inline-block; padding: 16px 40px; color: #000000; text-decoration: none; font-weight: 600; font-size: 16px;">
                    Ver Colaboradores
                  </a>
                </td>
              </tr>
            </table>
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

  return await sendEmail(apiKey, recipients, subject, htmlContent);
}

async function sendEmail(
  apiKey: string,
  recipients: string[],
  subject: string,
  htmlContent: string
): Promise<boolean> {
  try {
    const emailPromises = recipients.map(email =>
      fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          sender: {
            name: "Realize Consultadoria",
            email: "noreply@dasprent.pt",
          },
          to: [{ email }],
          subject,
          htmlContent,
        }),
      })
    );

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as Response).ok).length;
    
    console.log(`Email "${subject}" sent to ${successCount}/${recipients.length} recipients`);
    return successCount > 0;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

serve(handler);
