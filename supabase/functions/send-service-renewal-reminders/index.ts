import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const TARGET_EMAIL = 'marketing@dasprent.pt';

/** Avisa deste número de dias antes da renovação/débito. */
const RENEWAL_WARNING_DAYS = 7;
/** Avisa deste número de dias antes do fim da fidelização, para dar tempo de renegociar. */
const FIDELITY_WARNING_DAYS = 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TYPE_LABELS: Record<string, string> = {
  internet: 'Internet',
  subscription: 'Assinatura',
};

const CYCLE_LABELS: Record<string, string> = {
  monthly: '/mês',
  yearly: '/ano',
};

const daysBetween = (target: Date, today: Date) =>
  Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

const formatEuro = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value ?? 0);

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

    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: allServices, error } = await supabase
      .from('recurring_services')
      .select('*, companies(name)')
      .order('renewal_date', { ascending: true });

    if (error) {
      throw error;
    }

    const expiringServices: any[] = [];
    const endingFidelity: any[] = [];

    allServices?.forEach(service => {
      const renewalDate = new Date(`${service.renewal_date}T00:00:00`);
      const daysUntil = daysBetween(renewalDate, today);

      // Incluído se renova dentro da janela de aviso OU já passou (daysUntil < 0)
      if (daysUntil <= RENEWAL_WARNING_DAYS) {
        expiringServices.push({ ...service, renewalDate, daysUntil, isExpired: daysUntil < 0 });
      }

      if (service.fidelity_end) {
        const fidelityDate = new Date(`${service.fidelity_end}T00:00:00`);
        const daysUntilFidelity = daysBetween(fidelityDate, today);

        // Só avisa enquanto a fidelização ainda está a decorrer: depois de acabar
        // deixa de ser notícia e não vale a pena repetir o email todos os dias.
        if (daysUntilFidelity >= 0 && daysUntilFidelity <= FIDELITY_WARNING_DAYS) {
          endingFidelity.push({ ...service, fidelityDate, daysUntilFidelity });
        }
      }
    });

    console.log(
      `Found ${expiringServices.length} services to renew and ${endingFidelity.length} fidelity periods ending.`
    );

    if (expiringServices.length === 0 && endingFidelity.length === 0) {
      return new Response(JSON.stringify({ message: 'Nothing to alert.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let emailHtml = '<h2>Alerta de Serviços (Internet e Assinaturas)</h2>';

    if (expiringServices.length > 0) {
      emailHtml += `
        <p>Os seguintes serviços renovam dentro de ${RENEWAL_WARNING_DAYS} dias ou já passaram da data:</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 700px;">
          <thead>
            <tr style="background-color: #f3f4f6; text-align: left;">
              <th>Serviço</th>
              <th>Tipo</th>
              <th>Empresa</th>
              <th>Próxima Renovação</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
      `;

      expiringServices.forEach(service => {
        const formattedDate = service.renewalDate.toLocaleDateString('pt-PT');
        const rowStyle = service.isExpired ? 'color: #dc2626; font-weight: bold;' : '';

        emailHtml += `
          <tr style="${rowStyle}">
            <td>${service.name}${service.provider ? ` (${service.provider})` : ''}</td>
            <td>${TYPE_LABELS[service.service_type] ?? service.service_type}</td>
            <td>${service.companies?.name ?? '—'}</td>
            <td>${formattedDate} ${service.isExpired ? '(Em atraso)' : ''}</td>
            <td>${formatEuro(service.amount)}${CYCLE_LABELS[service.billing_cycle] ?? ''}</td>
          </tr>
        `;
      });

      emailHtml += '</tbody></table>';
    }

    if (endingFidelity.length > 0) {
      emailHtml += `
        <p style="margin-top: 24px;">Fidelizações a acabar nos próximos ${FIDELITY_WARNING_DAYS} dias (altura de renegociar):</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 700px;">
          <thead>
            <tr style="background-color: #f3f4f6; text-align: left;">
              <th>Serviço</th>
              <th>Empresa</th>
              <th>Fim da Fidelização</th>
              <th>Faltam</th>
            </tr>
          </thead>
          <tbody>
      `;

      endingFidelity.forEach(service => {
        emailHtml += `
          <tr>
            <td>${service.name}${service.provider ? ` (${service.provider})` : ''}</td>
            <td>${service.companies?.name ?? '—'}</td>
            <td>${service.fidelityDate.toLocaleDateString('pt-PT')}</td>
            <td>${service.daysUntilFidelity} ${service.daysUntilFidelity === 1 ? 'dia' : 'dias'}</td>
          </tr>
        `;
      });

      emailHtml += '</tbody></table>';
    }

    emailHtml += `
      <p style="margin-top: 20px; color: #6b7280; font-size: 12px;">
        Este é um email automático gerado pelo sistema Realize Consultadoria.
      </p>
    `;

    const resResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Realize Consultadoria <onboarding@resend.dev>', // Or your verified domain
        to: [TARGET_EMAIL],
        subject: '🚨 Alerta: Serviços a renovar',
        html: emailHtml,
      }),
    });

    if (!resResponse.ok) {
      const errorData = await resResponse.text();
      console.error('Resend API error:', errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const resData = await resResponse.json();
    console.log('Email sent successfully:', resData);

    return new Response(JSON.stringify({ success: true, message: 'Emails sent successfully.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error in send-service-renewal-reminders function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
