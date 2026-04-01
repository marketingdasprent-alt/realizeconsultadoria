import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TicketNotificationRequest {
  employeeName: string;
  employeeEmail: string;
  companyName: string;
  subject: string;
  priority: string;
  message: string;
  departmentId: string;
}

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

const priorityColors: Record<string, string> = {
  low: "#6b7280",
  medium: "#3b82f6",
  high: "#f97316",
  urgent: "#ef4444",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeName, employeeEmail, companyName, subject, priority, message, departmentId }: TicketNotificationRequest = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get active notification emails for this department
    const { data: emailRecords, error: emailsError } = await supabase
      .from("notification_emails_support")
      .select("email")
      .eq("department_id", departmentId)
      .eq("is_active", true);

    if (emailsError) {
      console.error("Error fetching notification emails:", emailsError);
    }

    let recipientEmails: string[] = emailRecords?.map(r => r.email).filter(Boolean) || [];

    // Fallback to system_settings if no emails configured for this department
    if (recipientEmails.length === 0) {
      console.log("No department emails found, checking fallback email");
      const { data: settingsData, error: settingsError } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "notification_email")
        .maybeSingle();

      if (settingsError) {
        console.error("Error fetching notification email:", settingsError);
        return new Response(
          JSON.stringify({ error: "Failed to fetch notification email" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const fallbackEmail = settingsData?.value?.trim();
      if (fallbackEmail) {
        recipientEmails = [fallbackEmail];
      }
    }

    if (recipientEmails.length === 0) {
      console.log("No notification recipients configured");
      return new Response(
        JSON.stringify({ message: "No notification recipients configured, skipping" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Sending ticket notification to:", recipientEmails);

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    if (!brevoApiKey) {
      console.error("BREVO_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const priorityLabel = priorityLabels[priority] || priority;
    const priorityColor = priorityColors[priority] || "#6b7280";

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: #d4af37; margin: 0; font-size: 24px;">🎫 Novo Ticket de Suporte</h1>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef; border-top: none;">
    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="color: #1a1a2e; margin-top: 0; font-size: 18px; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
        Informações do Colaborador
      </h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 140px;"><strong>Nome:</strong></td>
          <td style="padding: 8px 0;">${employeeName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Email:</strong></td>
          <td style="padding: 8px 0;">${employeeEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Empresa:</strong></td>
          <td style="padding: 8px 0;">${companyName}</td>
        </tr>
      </table>
    </div>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="color: #1a1a2e; margin-top: 0; font-size: 18px; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
        Detalhes do Ticket
      </h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 140px;"><strong>Assunto:</strong></td>
          <td style="padding: 8px 0;">${subject}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Prioridade:</strong></td>
          <td style="padding: 8px 0;">
            <span style="background: ${priorityColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">
              ${priorityLabel}
            </span>
          </td>
        </tr>
      </table>
    </div>
    
    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="color: #1a1a2e; margin-top: 0; font-size: 18px; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
        Mensagem
      </h2>
      <p style="color: #333; white-space: pre-wrap;">${message}</p>
    </div>
    
    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
      <p style="color: #666; font-size: 14px; margin: 0;">
        Aceda à plataforma para responder a este ticket.
      </p>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>Este email foi enviado automaticamente pelo sistema de gestão Realize.</p>
  </div>
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
          sender: { name: "Realize Gestão", email: "noreply@dasprent.pt" },
          to: [{ email }],
          subject: `🎫 Novo Ticket de Suporte: ${subject} [${priorityLabel}]`,
          htmlContent,
        }),
      })
    );

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as Response).ok).length;
    const failCount = results.length - successCount;

    if (failCount > 0) {
      console.warn(`Email sending: ${successCount} succeeded, ${failCount} failed`);
      for (const result of results) {
        if (result.status === 'rejected') {
          console.error("Email send error:", result.reason);
        } else if (!(result.value as Response).ok) {
          const errorText = await (result.value as Response).text();
          console.error("Brevo API error:", errorText);
        }
      }
    }

    console.log(`Ticket notification emails sent to ${successCount} recipients`);

    return new Response(
      JSON.stringify({ success: true, message: `Notification sent to ${successCount} recipient(s)` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-ticket-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
