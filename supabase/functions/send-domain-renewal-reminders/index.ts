import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
const TARGET_EMAIL = 'marketing@dasprent.pt';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async req => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    if (!BREVO_API_KEY) {
      throw new Error('Missing BREVO_API_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date and the date 7 days from now
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    sevenDaysFromNow.setHours(23, 59, 59, 999);

    console.log(
      'Checking domains expiring between:',
      today.toISOString(),
      'and',
      sevenDaysFromNow.toISOString()
    );

    // Fetch ALL domains
    const { data: allDomains, error } = await supabase
      .from('site_domains')
      .select('*')
      .order('renewal_date', { ascending: true });

    if (error) {
      throw error;
    }

    const expiringDomains = [];

    allDomains?.forEach(domain => {
      const renewalDate = new Date(`${domain.renewal_date}T00:00:00`);

      const daysUntil = Math.floor(
        (renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Included if it's within 7 days of renewing OR expired (daysUntil < 0)
      if (daysUntil <= 7) {
        expiringDomains.push({
          ...domain,
          renewalDate,
          daysUntil,
          isExpired: daysUntil < 0,
        });
      }
    });

    console.log(`Found ${expiringDomains.length} domains to alert.`);

    if (expiringDomains.length === 0) {
      return new Response(JSON.stringify({ message: 'No domains renewing within 7 days.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Format the email content
    let emailHtml = `
      <h2>Alerta de Renovação de Domínios</h2>
      <p>Os seguintes domínios necessitam de renovação em breve (dentro de 7 dias) ou já expiraram:</p>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <thead>
          <tr style="background-color: #f3f4f6; text-align: left;">
            <th>Domínio</th>
            <th>Próxima Renovação</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
    `;

    expiringDomains.forEach(domain => {
      const formattedDate = domain.renewalDate.toLocaleDateString('pt-PT');
      const formattedValue = new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
      }).format(domain.renewal_value);

      const rowStyle = domain.isExpired ? 'color: #dc2626; font-weight: bold;' : '';

      emailHtml += `
        <tr style="${rowStyle}">
          <td>${domain.domain_name}</td>
          <td>${formattedDate} ${domain.isExpired ? '(Expirado)' : ''}</td>
          <td>${formattedValue}</td>
        </tr>
      `;
    });

    emailHtml += `
        </tbody>
      </table>
      <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">
        Este é um email automático gerado pelo sistema Realize Consultadoria.
      </p>
    `;

    // Send the email using Brevo
    const resResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: 'Realize Consultadoria', email: 'noreply@dasprent.pt' },
        to: [{ email: TARGET_EMAIL }],
        subject: '🚨 Alerta: Renovação de Domínios Próxima',
        htmlContent: emailHtml,
      }),
    });

    if (!resResponse.ok) {
      const errorData = await resResponse.text();
      console.error('Brevo API error:', errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const resData = await resResponse.json();
    console.log('Email sent successfully:', resData);

    return new Response(JSON.stringify({ success: true, message: 'Emails sent successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error in send-domain-renewal-reminders function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
