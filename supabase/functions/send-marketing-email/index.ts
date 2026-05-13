import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BATCH_SIZE = 10;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Attachment {
  name: string;
  path: string;
  type: string;
  size: number;
}

interface MarketingEmailRequest {
  subject: string;
  message: string;
  senderName: string;
  recipients: string[];
  cc: string[];
  attachments?: Attachment[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: MarketingEmailRequest = await req.json();

    console.log('Processando envio de e-mail de marketing:', payload.subject);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    if (!brevoApiKey) {
      console.error('BREVO_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'Configuração de email em falta' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Generate signed URLs for attachments — avoids loading file bytes into memory
    const emailAttachments: { url: string; name: string }[] = [];
    if (payload.attachments && payload.attachments.length > 0) {
      console.log(`Gerando URLs para ${payload.attachments.length} anexos...`);
      for (const att of payload.attachments) {
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
          .from('marketing-emails')
          .createSignedUrl(att.path, 3600); // valid for 1 hour

        if (signedError || !signedData?.signedUrl) {
          console.error(`Erro ao gerar URL para ${att.path}:`, signedError);
          continue;
        }

        emailAttachments.push({ url: signedData.signedUrl, name: att.name });
      }
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
          <tr>
            <td style="background-color: #000000; padding: 30px; text-align: center;">
              <h1 style="color: #d5b884; margin: 0; font-size: 28px; letter-spacing: 2px;">REALIZE</h1>
              <p style="color: #d5b884; margin: 5px 0 0 0; font-size: 12px; letter-spacing: 4px;">CONSULTADORIA</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <div style="color: #333333; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${payload.message}</div>

              <div style="margin-top: 40px; border-top: 1px solid #eeeeee; padding-top: 20px;">
                <p style="margin: 0; color: #666666; font-size: 14px;">Com os melhores cumprimentos,</p>
                <p style="margin: 5px 0 0 0; font-weight: bold; color: #333333;">${payload.senderName}</p>
                <p style="margin: 5px 0 0 0; font-size: 13px; color: #888888;">Realize Consultadoria</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                Esta é uma comunicação interna oficial.
                <br>© 2024 Realize Consultadoria. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    let successCount = 0;

    // Send in batches to avoid memory pressure from many parallel requests
    for (let i = 0; i < payload.recipients.length; i += BATCH_SIZE) {
      const batch = payload.recipients.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(email => {
        const emailPayload: Record<string, unknown> = {
          sender: {
            name: payload.senderName || 'Marketing Dasprent',
            email: 'marketing@dasprent.pt',
          },
          to: [{ email }],
          subject: payload.subject,
          htmlContent: emailHtml,
        };

        if (emailAttachments.length > 0) {
          emailPayload.attachment = emailAttachments;
        }

        return fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'api-key': brevoApiKey,
          },
          body: JSON.stringify(emailPayload),
        });
      });

      const results = await Promise.allSettled(batchPromises);
      successCount += results.filter(
        r => r.status === 'fulfilled' && (r.value as Response).ok
      ).length;

      const firstError = results.find(r => r.status === 'fulfilled' && !(r.value as Response).ok);
      if (firstError && firstError.status === 'fulfilled') {
        const errorText = await (firstError.value as Response).text();
        console.error('Exemplo de erro Brevo:', errorText);
      }
    }

    const failCount = payload.recipients.length - successCount;
    if (failCount > 0) {
      console.warn(`Envio de email: ${successCount} com sucesso, ${failCount} falharam`);
    }

    console.log(`Emails enviados com sucesso para ${successCount} destinatários`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Comunicação enviada para ${successCount} destinatário(s)`,
        successCount,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('Error in send-marketing-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno ao processar e-mail' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
