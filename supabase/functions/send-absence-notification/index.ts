import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  employeeName: string;
  employeeEmail: string;
  companyName: string;
  absenceType: string;
  periods: Array<{
    startDate: string;
    endDate: string;
    businessDays: number;
  }>;
  notes?: string;
}

const absenceTypeLabels: Record<string, string> = {
  vacation: "Férias",
  sick_leave: "Baixa Médica",
  personal_leave: "Licença Pessoal",
  maternity: "Licença Maternidade",
  paternity: "Licença Paternidade",
  other: "Outro",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NotificationRequest = await req.json();
    
    console.log("Processing absence notification for:", payload.employeeName);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get active emails from notification_emails_absences
    const { data: emailRecords, error: emailsError } = await supabaseAdmin
      .from("notification_emails_absences")
      .select("email")
      .eq("is_active", true);

    if (emailsError) {
      console.error("Error fetching absence notification emails:", emailsError);
    }

    let recipientEmails: string[] = emailRecords?.map(r => r.email) || [];

    // Fallback to system_settings if no emails configured
    if (recipientEmails.length === 0) {
      console.log("No absence emails configured, checking fallback");
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

    console.log("Sending notification to:", recipientEmails);

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("BREVO_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Configuração de email em falta" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Format periods for email
    const periodsHtml = payload.periods.map(p => {
      const start = new Date(p.startDate).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
      const end = new Date(p.endDate).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
      return `<li style="margin-bottom: 8px;">${start} - ${end} <span style="color: #888;">(${p.businessDays} dias úteis)</span></li>`;
    }).join("");

    const totalDays = payload.periods.reduce((sum, p) => sum + p.businessDays, 0);
    const absenceTypeLabel = absenceTypeLabels[payload.absenceType] || payload.absenceType;

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
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">Novo Pedido de Ausência</h2>
              
              <table style="width: 100%; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
                    <strong style="color: #666;">Colaborador:</strong>
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">
                    ${payload.employeeName}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
                    <strong style="color: #666;">Empresa:</strong>
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">
                    ${payload.companyName}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
                    <strong style="color: #666;">Tipo:</strong>
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">
                    ${absenceTypeLabel}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
                    <strong style="color: #666;">Total dias úteis:</strong>
                  </td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: bold; color: #d5b884;">
                    ${totalDays}
                  </td>
                </tr>
              </table>

              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;"><strong>Períodos solicitados:</strong></p>
              <ul style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 25px 0; padding-left: 20px;">
                ${periodsHtml}
              </ul>

              ${payload.notes ? `
              <p style="color: #666666; font-size: 14px; margin: 0 0 10px 0;"><strong>Observações:</strong></p>
              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 0 0 25px 0; padding: 15px; background-color: #f9f9f9; border-radius: 6px;">
                ${payload.notes}
              </p>
              ` : ""}

              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: #d5b884; border-radius: 6px;">
                    <a href="https://realize.dasprent.pt/admin/pedidos" style="display: inline-block; padding: 16px 40px; color: #000000; text-decoration: none; font-weight: 600; font-size: 16px;">
                      Ver Pedidos
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

    // Send email to all recipients
    const emailPromises = recipientEmails.map(email => 
      fetch("https://api.brevo.com/v3/smtp/email", {
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
          to: [{ email }],
          subject: `Novo Pedido de Ausência - ${payload.employeeName}`,
          htmlContent: emailHtml,
        }),
      })
    );

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as Response).ok).length;
    const failCount = results.length - successCount;

    if (failCount > 0) {
      console.warn(`Email sending: ${successCount} succeeded, ${failCount} failed`);
    }

    console.log(`Emails sent successfully to ${successCount} recipients`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notificação enviada para ${successCount} destinatário(s)`,
        recipientCount: successCount
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-absence-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
