import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
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

    if (!BREVO_API_KEY) {
      throw new Error('Missing BREVO_API_KEY');
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

    const overdueCount = expiringServices.filter(s => s.isExpired).length;
    const totalDue = expiringServices.reduce((sum, s) => sum + Number(s.amount ?? 0), 0);

    // Só a primeira letra em maiúscula: o text-transform: capitalize do CSS poria
    // maiúscula em cada palavra ("11 De Setembro De 2026"), que em português é errado.
    const rawToday = today.toLocaleDateString('pt-PT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const todayFormatted = rawToday.charAt(0).toUpperCase() + rawToday.slice(1);

    const th = (align: 'left' | 'center' | 'right') =>
      `padding: 10px 16px; text-align: ${align}; font-size: 11px; color: #999999; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #eeeeee;`;
    const td = (align: 'left' | 'center' | 'right') =>
      `padding: 12px 16px; text-align: ${align}; font-size: 14px; color: #333333; border-bottom: 1px solid #f2f2f2;`;

    // O título diz o que é preciso fazer hoje: os atrasados mandam, porque são os que
    // arriscam corte de serviço. Sem atrasados, é só um aviso de que o débito se aproxima.
    const headline = overdueCount
      ? `${overdueCount} ${overdueCount === 1 ? 'serviço em atraso' : 'serviços em atraso'}`
      : expiringServices.length
        ? `${expiringServices.length} ${expiringServices.length === 1 ? 'serviço a renovar' : 'serviços a renovar'}`
        : `${endingFidelity.length} ${endingFidelity.length === 1 ? 'fidelização a acabar' : 'fidelizações a acabar'}`;

    const renewalRows = expiringServices
      .map(service => {
        const nameColor = service.isExpired ? '#b91c1c' : '#333333';
        const status = service.isExpired
          ? `<span style="display: inline-block; padding: 3px 10px; border-radius: 999px; white-space: nowrap; background-color: #fee2e2; color: #b91c1c; font-size: 12px; font-weight: 600;">Em atraso</span>`
          : service.daysUntil === 0
            ? `<span style="display: inline-block; padding: 3px 10px; border-radius: 999px; white-space: nowrap; background-color: #ffedd5; color: #9a3412; font-size: 12px; font-weight: 600;">Hoje</span>`
            : `<span style="display: inline-block; padding: 3px 10px; border-radius: 999px; white-space: nowrap; background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 600;">${service.daysUntil} ${service.daysUntil === 1 ? 'dia' : 'dias'}</span>`;

        return `
          <tr>
            <td style="${td('left')}">
              <span style="color: ${nameColor}; font-weight: 600;">${service.name}</span>
              <span style="display: block; color: #999999; font-size: 12px; margin-top: 2px;">
                ${[TYPE_LABELS[service.service_type] ?? service.service_type, service.provider, service.companies?.name].filter(Boolean).join(' · ')}
              </span>
            </td>
            <td style="${td('center')}">${service.renewalDate.toLocaleDateString('pt-PT')}</td>
            <td style="${td('center')}">${status}</td>
            <td style="${td('right')}; white-space: nowrap;">
              <strong>${formatEuro(service.amount)}</strong><span style="color: #999999; font-size: 12px;">${CYCLE_LABELS[service.billing_cycle] ?? ''}</span>
            </td>
          </tr>
        `;
      })
      .join('');

    const fidelityRows = endingFidelity
      .map(
        service => `
          <tr>
            <td style="${td('left')}">
              <span style="font-weight: 600;">${service.name}</span>
              <span style="display: block; color: #999999; font-size: 12px; margin-top: 2px;">
                ${[service.provider, service.companies?.name].filter(Boolean).join(' · ')}
              </span>
            </td>
            <td style="${td('center')}">${service.fidelityDate.toLocaleDateString('pt-PT')}</td>
            <td style="${td('right')}">${service.daysUntilFidelity} ${service.daysUntilFidelity === 1 ? 'dia' : 'dias'}</td>
          </tr>
        `
      )
      .join('');

    const renewalSection = expiringServices.length
      ? `
        <p style="margin: 0 0 16px 0; color: #555555; font-size: 14px; line-height: 1.6;">
          ${
            expiringServices.length === 1
              ? 'O seguinte serviço renova nos próximos'
              : 'Os seguintes serviços renovam nos próximos'
          } ${RENEWAL_WARNING_DAYS} dias ou já passaram da data de pagamento:
        </p>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #eeeeee; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f8f8f8;">
              <th style="${th('left')}">Serviço</th>
              <th style="${th('center')}">Renovação</th>
              <th style="${th('center')}">Estado</th>
              <th style="${th('right')}">Valor</th>
            </tr>
          </thead>
          <tbody>${renewalRows}</tbody>
          <tfoot>
            <tr style="background-color: #fafafa;">
              <td colspan="3" style="padding: 12px 16px; text-align: right; font-size: 12px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Total</td>
              <td style="padding: 12px 16px; text-align: right; font-size: 15px; color: #333333;"><strong>${formatEuro(totalDue)}</strong></td>
            </tr>
          </tfoot>
        </table>
      `
      : '';

    const fidelitySection = endingFidelity.length
      ? `
        <p style="margin: ${expiringServices.length ? '32px' : '0'} 0 16px 0; color: #555555; font-size: 14px; line-height: 1.6;">
          ${endingFidelity.length === 1 ? 'Esta fidelização acaba' : 'Estas fidelizações acabam'}
          nos próximos ${FIDELITY_WARNING_DAYS} dias — boa altura para renegociar:
        </p>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #eeeeee; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f8f8f8;">
              <th style="${th('left')}">Serviço</th>
              <th style="${th('center')}">Fim</th>
              <th style="${th('right')}">Faltam</th>
            </tr>
          </thead>
          <tbody>${fidelityRows}</tbody>
        </table>
      `
      : '';

    const overdueCallout = overdueCount
      ? `
        <div style="margin-top: 24px; padding: 14px 16px; background-color: #fef2f2; border-left: 3px solid #dc2626; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.5;">
            ⚠️ ${overdueCount === 1 ? 'Há 1 serviço' : `Há ${overdueCount} serviços`} com a data de pagamento
            ultrapassada. Se já ${overdueCount === 1 ? 'foi pago' : 'foram pagos'}, marque como pago em
            Acessos &rsaquo; Serviços para a data avançar.
          </p>
        </div>
      `
      : '';

    const emailHtml = `
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

        <!-- Banner -->
        <tr>
          <td style="background: linear-gradient(135deg, #d5b884 0%, #c9a96e 100%); padding: 24px 30px; text-align: center;">
            <p style="margin: 0 0 8px 0; font-size: 36px;">${overdueCount ? '⚠️' : '🔔'}</p>
            <h2 style="margin: 0 0 6px 0; color: #000000; font-size: 22px; font-weight: 700;">${headline}</h2>
            <p style="margin: 0; color: #333333; font-size: 13px;">${todayFormatted}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 30px 30px 20px;">
            ${renewalSection}
            ${fidelitySection}
            ${overdueCallout}

            <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px auto 0;">
              <tr>
                <td style="background-color: #d5b884; border-radius: 6px;">
                  <a href="https://realize.dasprent.pt/admin/acessos"
                    style="display: inline-block; padding: 14px 36px; color: #000000; text-decoration: none; font-weight: 600; font-size: 15px;">
                    Ver Serviços
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
        subject: overdueCount ? `⚠️ ${headline}` : `🔔 ${headline}`,
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
    console.error('Error in send-service-renewal-reminders function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
