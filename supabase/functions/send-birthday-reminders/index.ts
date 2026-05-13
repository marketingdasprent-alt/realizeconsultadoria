import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Employee {
  id: string;
  name: string;
  birth_date: string;
  company: { name: string } | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting birthday reminders check...');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    if (!brevoApiKey) {
      console.error('BREVO_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get notification recipients
    const { data: emailRecords } = await supabaseAdmin
      .from('notification_emails_birthdays')
      .select('email')
      .eq('is_active', true);

    const recipientEmails: string[] = emailRecords?.map((r: { email: string }) => r.email) || [];

    if (recipientEmails.length === 0) {
      console.log('No birthday notification recipients configured');
      return new Response(
        JSON.stringify({ success: true, message: 'Sem destinatários configurados' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get today's month and day (ignore year — birthday is annual)
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    console.log(`Checking birthdays for ${todayDay}/${todayMonth}`);

    // Fetch all active employees that have a birth_date
    const { data: employees, error: empError } = await supabaseAdmin
      .from('employees')
      .select('id, name, birth_date, company:companies(name)')
      .eq('is_active', true)
      .not('birth_date', 'is', null);

    if (empError) {
      console.error('Error fetching employees:', empError);
      throw empError;
    }

    // Filter to employees whose birthday is today
    const birthdayEmployees: Employee[] = (employees || []).filter((emp: Employee) => {
      if (!emp.birth_date) return false;
      const d = new Date(emp.birth_date);
      return d.getMonth() + 1 === todayMonth && d.getDate() === todayDay;
    });

    console.log(`Found ${birthdayEmployees.length} birthday(s) today`);

    if (birthdayEmployees.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Sem aniversários hoje', count: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const sent = await sendBirthdayEmail(brevoApiKey, recipientEmails, birthdayEmployees, today);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email enviado para ${birthdayEmployees.length} aniversariante(s)`,
        count: birthdayEmployees.length,
        emailSent: sent,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('Error in send-birthday-reminders:', error);
    return new Response(JSON.stringify({ error: error.message || 'Erro interno' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

async function sendBirthdayEmail(
  apiKey: string,
  recipients: string[],
  employees: Employee[],
  today: Date
): Promise<boolean> {
  const todayFormatted = today.toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const employeeRows = employees
    .map(emp => {
      const birthDate = new Date(emp.birth_date);
      const age = today.getFullYear() - birthDate.getFullYear();
      return `
        <tr>
          <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0;">
            <span style="font-weight: 600; color: #1a1a1a;">${emp.name}</span>
          </td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0; color: #666666;">
            ${emp.company?.name || '—'}
          </td>
          <td style="padding: 14px 16px; border-bottom: 1px solid #f0f0f0; text-align: center;">
            <span style="background-color: #d5b884; color: #000000; padding: 3px 10px; border-radius: 12px; font-weight: 700; font-size: 13px;">
              ${age} anos
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  const plural = employees.length > 1;
  const subject = plural
    ? `🎂 ${employees.length} Aniversários hoje — ${today.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}`
    : `🎂 Aniversário: ${employees[0].name} — ${today.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background-color: #000000; padding: 28px 30px; text-align: center;">
            <h1 style="color: #d5b884; margin: 0; font-size: 26px; letter-spacing: 2px;">REALIZE</h1>
            <p style="color: #d5b884; margin: 4px 0 0 0; font-size: 11px; letter-spacing: 4px;">CONSULTADORIA</p>
          </td>
        </tr>

        <!-- Birthday banner -->
        <tr>
          <td style="background: linear-gradient(135deg, #d5b884 0%, #c9a96e 100%); padding: 24px 30px; text-align: center;">
            <p style="margin: 0 0 8px 0; font-size: 36px;">🎉</p>
            <h2 style="margin: 0 0 6px 0; color: #000000; font-size: 22px; font-weight: 700;">
              ${plural ? `${employees.length} Aniversários hoje` : 'Aniversário hoje'}
            </h2>
            <p style="margin: 0; color: #333333; font-size: 13px; text-transform: capitalize;">${todayFormatted}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 30px 30px 20px;">
            <p style="margin: 0 0 20px 0; color: #555555; font-size: 14px; line-height: 1.6;">
              ${
                plural
                  ? `Os seguintes <strong>${employees.length} colaboradores</strong> fazem anos hoje:`
                  : 'O seguinte colaborador faz anos hoje:'
              }
            </p>

            <table style="width: 100%; border-collapse: collapse; border: 1px solid #eeeeee; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background-color: #f8f8f8;">
                  <th style="padding: 10px 16px; text-align: left; font-size: 11px; color: #999999; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #eeeeee;">
                    Colaborador
                  </th>
                  <th style="padding: 10px 16px; text-align: left; font-size: 11px; color: #999999; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #eeeeee;">
                    Empresa
                  </th>
                  <th style="padding: 10px 16px; text-align: center; font-size: 11px; color: #999999; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #eeeeee;">
                    Idade
                  </th>
                </tr>
              </thead>
              <tbody>
                ${employeeRows}
              </tbody>
            </table>

            <div style="margin-top: 24px; padding: 14px 16px; background-color: #fffbf0; border-left: 3px solid #d5b884; border-radius: 0 6px 6px 0;">
              <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.5;">
                💡 Não se esqueça de desejar os parabéns ${plural ? 'aos colaboradores' : 'ao colaborador'}!
              </p>
            </div>

            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px auto 0;">
              <tr>
                <td style="background-color: #d5b884; border-radius: 6px;">
                  <a href="https://realize.dasprent.pt/admin/colaboradores"
                    style="display: inline-block; padding: 14px 36px; color: #000000; text-decoration: none; font-weight: 600; font-size: 15px;">
                    Ver Colaboradores
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #000000; padding: 18px 30px; text-align: center;">
            <p style="color: #666666; font-size: 12px; margin: 0;">
              © ${today.getFullYear()} Realize Consultadoria. Todos os direitos reservados.
            </p>
          </td>
        </tr>

      </table>
    </body>
    </html>
  `;

  try {
    const emailPromises = recipients.map(email =>
      fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          sender: { name: 'Realize Consultadoria', email: 'noreply@dasprent.pt' },
          to: [{ email }],
          subject,
          htmlContent,
        }),
      })
    );

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(
      r => r.status === 'fulfilled' && (r.value as Response).ok
    ).length;

    console.log(`Birthday email sent to ${successCount}/${recipients.length} recipients`);
    return successCount > 0;
  } catch (error) {
    console.error('Error sending birthday email:', error);
    return false;
  }
}

serve(handler);
