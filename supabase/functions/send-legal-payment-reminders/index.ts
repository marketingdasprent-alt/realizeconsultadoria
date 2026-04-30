import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LegalInstallment {
  amount: number;
  due_date: string;
  status: string;
}

interface LegalClient {
  id: string;
  name: string;
  litigation_value: number;
  deadline_date: string | null;
  company: { name: string } | null;
  legal_installments: LegalInstallment[];
}

interface ReportItem {
  clientName: string;
  companyName: string;
  amount: number;
  date: string;
  type: "installment" | "deadline";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting legal payment reminders check...");

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

    // Get Jurídico department for notifications
    const { data: department } = await supabaseAdmin
      .from("support_departments")
      .select("id")
      .eq("name", "Jurídico")
      .maybeSingle();

    let recipientEmails: string[] = [];

    if (department) {
      const { data: emailRecords } = await supabaseAdmin
        .from("notification_emails_support")
        .select("email")
        .eq("department_id", department.id)
        .eq("is_active", true);
      
      recipientEmails = emailRecords?.map(r => r.email).filter(Boolean) as string[] || [];
    }

    // Fallback to general system settings
    if (recipientEmails.length === 0) {
      const { data: setting } = await supabaseAdmin
        .from("system_settings")
        .select("value")
        .eq("key", "notification_email")
        .maybeSingle();

      const fallbackEmail = setting?.value?.trim();
      if (fallbackEmail) {
        recipientEmails = [fallbackEmail];
      }
    }

    // Adiciona o email específico solicitado pelo utilizador
    if (!recipientEmails.includes("dinisilva06@gmail.com")) {
      recipientEmails.push("dinisilva06@gmail.com");
    }

    if (recipientEmails.length === 0) {
      console.log("No notification recipients configured");
      return new Response(
        JSON.stringify({ success: true, message: "Sem destinatários configurados" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Dates for categorization
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const inTwoDays = new Date(today);
    inTwoDays.setDate(today.getDate() + 2);
    const inTwoDaysStr = inTwoDays.toISOString().split('T')[0];

    // Get all relevant clients
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from("legal_clients")
      .select(`
        id,
        name,
        litigation_value,
        deadline_date,
        company:companies(name),
        legal_installments(*)
      `)
      .neq('status', 'Arquivado')
      .neq('status', 'Resolvido')
      .neq('status', 'Inativo');

    if (clientsError) throw clientsError;

    const overdue: ReportItem[] = [];
    const dueToday: ReportItem[] = [];
    const dueInTwoDays: ReportItem[] = [];

    for (const client of (clients || []) as LegalClient[]) {
      let hasCategorizedAsOverdue = false;

      // Check installments
      if (client.legal_installments && client.legal_installments.length > 0) {
        client.legal_installments.forEach(inst => {
          if (inst.status === 'Pendente' && inst.due_date) {
            const item: ReportItem = {
              clientName: client.name,
              companyName: client.company?.name || "N/A",
              amount: Number(inst.amount) || 0,
              date: inst.due_date,
              type: "installment"
            };

            if (inst.due_date < todayStr) {
              overdue.push(item);
              hasCategorizedAsOverdue = true;
            } else if (inst.due_date === todayStr) {
              dueToday.push(item);
            } else if (inst.due_date === inTwoDaysStr) {
              dueInTwoDays.push(item);
            }
          }
        });
      }

      // If no installments are overdue, check the deadline_date
      if (!hasCategorizedAsOverdue && client.deadline_date) {
        const paidSum = client.legal_installments
          .filter(inst => inst.status === 'Pago')
          .reduce((s, i) => s + (Number(i.amount) || 0), 0);
        
        const remaining = (Number(client.litigation_value) || 0) - paidSum;

        if (remaining > 0) {
          const item: ReportItem = {
            clientName: client.name,
            companyName: client.company?.name || "N/A",
            amount: remaining,
            date: client.deadline_date,
            type: "deadline"
          };

          if (client.deadline_date < todayStr) {
            overdue.push(item);
          } else if (client.deadline_date === todayStr) {
            dueToday.push(item);
          } else if (client.deadline_date === inTwoDaysStr) {
            dueInTwoDays.push(item);
          }
        }
      }
    }

    if (overdue.length === 0 && dueToday.length === 0 && dueInTwoDays.length === 0) {
      console.log("No reminders to send today.");
      return new Response(
        JSON.stringify({ success: true, message: "Sem lembretes para hoje" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build Email Content
    const formatCurrency = (val: number) => 
      new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

    const formatDate = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    };

    const renderTable = (items: ReportItem[], color: string) => {
      if (items.length === 0) return "";
      
      const rows = items.map(item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.clientName}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.companyName}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: ${color}; text-align: right;">${formatCurrency(item.amount)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatDate(item.date)}</td>
        </tr>
      `).join("");

      return `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
          <thead>
            <tr style="background-color: #f8f8f8;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid ${color}; font-size: 13px;">Cliente</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid ${color}; font-size: 13px;">Empresa</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid ${color}; font-size: 13px;">Valor</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid ${color}; font-size: 13px;">Data</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: sans-serif;">
        <table width="100%" cellspacing="0" cellpadding="0" style="max-width: 700px; margin: 30px auto;">
          <tr>
            <td style="background-color: #1a1a2e; padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #d4af37; margin: 0; font-size: 28px; letter-spacing: 2px;">REALIZE GESTÃO</h1>
              <p style="color: #d4af37; opacity: 0.8; margin: 10px 0 0 0; font-size: 14px; letter-spacing: 3px;">PAGAMENTOS JURÍDICOS</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 40px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin: 0 0 25px 0; font-size: 20px; border-bottom: 1px solid #eee; padding-bottom: 15px;">Resumo Diário de Cobranças</h2>
              
              ${overdue.length > 0 ? `
                <div style="margin-bottom: 10px; display: flex; align-items: center;">
                  <span style="background-color: #ef4444; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-right: 10px;">🔴 EM ATRASO</span>
                </div>
                ${renderTable(overdue, "#ef4444")}
              ` : ""}

              ${dueToday.length > 0 ? `
                <div style="margin-bottom: 10px; display: flex; align-items: center;">
                  <span style="background-color: #f97316; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-right: 10px;">🟠 VENCE HOJE</span>
                </div>
                ${renderTable(dueToday, "#f97316")}
              ` : ""}

              ${dueInTwoDays.length > 0 ? `
                <div style="margin-bottom: 10px; display: flex; align-items: center;">
                  <span style="background-color: #d4af37; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-right: 10px;">🟡 VENCE EM 2 DIAS</span>
                </div>
                ${renderTable(dueInTwoDays, "#d4af37")}
              ` : ""}

              <div style="margin-top: 40px; text-align: center;">
                <a href="https://realize.dasprent.pt/admin/juridico" style="background-color: #d4af37; color: #1a1a2e; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">ACEDER AO PAINEL JURÍDICO</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; text-align: center; color: #999; font-size: 11px;">
              Este é um email automático gerado pelo sistema Realize Consultadoria.
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
          sender: { name: "Realize Gestão", email: "noreply@dasprent.pt" },
          to: [{ email }],
          subject: `⚖️ Resumo Jurídico: ${overdue.length + dueToday.length + dueInTwoDays.length} pagamentos pendentes`,
          htmlContent,
        }),
      })
    );

    await Promise.allSettled(emailPromises);

    console.log("Legal reminders email sent successfully.");

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent_to: recipientEmails.length,
        stats: { overdue: overdue.length, today: dueToday.length, in_2_days: dueInTwoDays.length } 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-legal-payment-reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
