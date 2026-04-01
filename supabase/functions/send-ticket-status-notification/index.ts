import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TicketStatusNotificationRequest {
  ticketId: string;
  employeeEmail: string;
  employeeName: string;
  ticketSubject: string;
  oldStatus?: string;
  newStatus: string;
  adminNotes?: string;
  notificationType: 'status_change' | 'notes_added';
}

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Progresso",
  resolved: "Resolvido",
  closed: "Fechado",
};

const statusColors: Record<string, string> = {
  open: "#6b7280",
  in_progress: "#3b82f6",
  resolved: "#22c55e",
  closed: "#ef4444",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      employeeEmail, 
      employeeName, 
      ticketSubject, 
      oldStatus,
      newStatus, 
      adminNotes,
      notificationType 
    }: TicketStatusNotificationRequest = await req.json();

    console.log("Processing ticket status notification:", { employeeEmail, newStatus, notificationType });

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    if (!brevoApiKey) {
      console.error("BREVO_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const newStatusLabel = statusLabels[newStatus] || newStatus;
    const newStatusColor = statusColors[newStatus] || "#6b7280";
    
    const isStatusChange = notificationType === 'status_change';
    const emailTitle = isStatusChange 
      ? "📋 Atualização do seu Ticket de Suporte"
      : "💬 Nova Resposta no seu Ticket de Suporte";
    
    const emailSubject = isStatusChange
      ? `📋 Ticket Atualizado: ${ticketSubject} - ${newStatusLabel}`
      : `💬 Nova Resposta: ${ticketSubject}`;

    const statusChangeSection = isStatusChange && oldStatus !== newStatus ? `
      <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #1a1a2e; margin-top: 0; font-size: 18px; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
          Estado do Ticket
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 140px;"><strong>Novo Estado:</strong></td>
            <td style="padding: 8px 0;">
              <span style="background: ${newStatusColor}; color: white; padding: 6px 16px; border-radius: 12px; font-size: 14px; font-weight: bold;">
                ${newStatusLabel}
              </span>
            </td>
          </tr>
        </table>
      </div>
    ` : '';

    const notesSection = adminNotes ? `
      <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h2 style="color: #1a1a2e; margin-top: 0; font-size: 18px; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
          💬 Resposta do Técnico
        </h2>
        <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 0 8px 8px 0;">
          <p style="color: #333; margin: 0; white-space: pre-wrap; line-height: 1.6;">${adminNotes}</p>
        </div>
      </div>
    ` : '';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: #d4af37; margin: 0; font-size: 24px;">${emailTitle}</h1>
  </div>
  
  <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef; border-top: none;">
    <p style="font-size: 16px; color: #333; margin-bottom: 25px;">
      Olá <strong>${employeeName}</strong>,
    </p>
    
    <p style="font-size: 15px; color: #666; margin-bottom: 25px;">
      O seu ticket <strong>"${ticketSubject}"</strong> foi atualizado.
    </p>
    
    ${statusChangeSection}
    
    ${notesSection}
    
    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
      <p style="color: #666; font-size: 14px; margin: 0;">
        Aceda à plataforma para ver mais detalhes do seu ticket.
      </p>
    </div>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>Este email foi enviado automaticamente pelo sistema de gestão Realize.</p>
  </div>
</body>
</html>
    `;

    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": brevoApiKey,
      },
      body: JSON.stringify({
        sender: { name: "Realize Gestão", email: "noreply@dasprent.pt" },
        to: [{ email: employeeEmail, name: employeeName }],
        subject: emailSubject,
        htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Brevo API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errorText }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const responseData = await emailResponse.json();
    console.log("Ticket status notification sent successfully to:", employeeEmail);

    return new Response(
      JSON.stringify({ success: true, message: "Notification sent", data: responseData }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-ticket-status-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
