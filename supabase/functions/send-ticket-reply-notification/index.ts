import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReplyNotificationRequest {
  ticketId: string;
  employeeName: string;
  employeeEmail: string;
  companyName: string;
  subject: string;
  message: string;
  departmentId: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeName, employeeEmail, companyName, subject, message, departmentId }: ReplyNotificationRequest = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get notification emails for the department
    let recipientEmails: string[] = [];

    if (departmentId) {
      const { data: emailRecords } = await supabase
        .from("notification_emails_support")
        .select("email")
        .eq("department_id", departmentId)
        .eq("is_active", true);
      recipientEmails = emailRecords?.map(r => r.email).filter(Boolean) || [];
    }

    // Fallback to system_settings
    if (recipientEmails.length === 0) {
      const { data: settingsData } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "notification_email")
        .maybeSingle();
      const fallbackEmail = settingsData?.value?.trim();
      if (fallbackEmail) recipientEmails = [fallbackEmail];
    }

    if (recipientEmails.length === 0) {
      console.log("No notification recipients configured, skipping");
      return new Response(
        JSON.stringify({ message: "No recipients configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("BREVO_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: #d4af37; margin: 0; font-size: 24px;">💬 Nova Resposta num Ticket</h1>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef; border-top: none;">
    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="color: #1a1a2e; margin-top: 0; font-size: 18px; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
        Informações
      </h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 140px;"><strong>Colaborador:</strong></td>
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
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Assunto:</strong></td>
          <td style="padding: 8px 0;">${subject}</td>
        </tr>
      </table>
    </div>
    
    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h2 style="color: #1a1a2e; margin-top: 0; font-size: 18px; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
        Mensagem do Colaborador
      </h2>
      <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 0 8px 8px 0;">
        <p style="color: #333; margin: 0; white-space: pre-wrap; line-height: 1.6;">${message}</p>
      </div>
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
          subject: `💬 Nova Resposta: ${subject} - ${employeeName}`,
          htmlContent,
        }),
      })
    );

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as Response).ok).length;
    console.log(`Reply notification sent to ${successCount}/${recipientEmails.length} recipients`);

    return new Response(
      JSON.stringify({ success: true, message: `Sent to ${successCount} recipient(s)` }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-ticket-reply-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
