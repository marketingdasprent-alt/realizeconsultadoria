import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  authenticatedCaller,
  denyUnlessCompanyAdmin,
  isSuperAdmin,
} from '../_shared/admin-caller.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteAdminRequest {
  email: string;
  name?: string;
  password: string;
  /** Empresa de que a conta passa a ser administradora (e só dessa). */
  company_id: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const json = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Resposta única quando o email já existe: não revela a quem convida se o email é de outra empresa. */
const EMAIL_TAKEN = 'Não foi possível criar um administrador com este email.';

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const brevoApiKey = Deno.env.get('BREVO_API_KEY');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Cria uma conta de administrador LIGADA a uma empresa (nunca global): só o administrador dessa
    // empresa ou o super admin. Mantém o contrato (200 com error).
    const caller = await authenticatedCaller(req, corsHeaders);
    if (caller instanceof Response) {
      return new Response(await caller.text(), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { email, name, password, company_id }: InviteAdminRequest = await req.json();
    const denied = await denyUnlessCompanyAdmin(caller, corsHeaders, company_id);
    if (denied) {
      return new Response(await denied.text(), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return json({ error: 'Dados inválidos.' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (normalizedEmail.length > 254 || !EMAIL_RE.test(normalizedEmail)) {
      return json({ error: 'Indique um email válido.' });
    }
    const cleanName = typeof name === 'string' ? name.trim().slice(0, 100) : '';
    // O super admin vê o motivo exato; um admin de empresa recebe sempre a mesma resposta.
    const callerIsSuper = await isSuperAdmin(caller);
    const taken = (detail: string) => json({ error: callerIsSuper ? detail : EMAIL_TAKEN });

    // Validate password
    if (!password || password.length < 8) {
      return new Response(
        JSON.stringify({ error: 'A palavra-passe deve ter pelo menos 8 caracteres' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Email já associado a um colaborador (de qualquer empresa): igualdade exata, sem curingas, e a
    // falhar fechado (um erro aqui não deixa passar). O gatilho de registo ligaria a conta nova às
    // fichas com este email, e dava acesso cruzado entre empresas.
    const { count: employeeCount, error: employeeError } = await supabaseAdmin
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .ilike(
        'email',
        normalizedEmail.replace(/[\\%_]/g, ch => `\\${ch}`)
      );
    if (employeeError) {
      console.error('invite-admin: erro ao verificar colaboradores');
      return json({ error: 'Não foi possível verificar o email. Tente novamente.' });
    }
    if ((employeeCount ?? 0) > 0) {
      return taken(
        'Este email já está associado a um colaborador. Por favor utilize um email diferente para o administrador.'
      );
    }

    const displayName = cleanName || normalizedEmail.split('@')[0];

    // Se o email já tem conta (listUsers só devolve a primeira página; o createUser abaixo falha em duplicados)
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      u => u.email?.toLowerCase() === normalizedEmail
    );
    if (existingUser) {
      return taken('Este email já está em uso no sistema. Por favor utilize um email diferente.');
    }

    let userId: string;

    // Create new user with password directly (always a fresh account)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: displayName,
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return new Response(
        JSON.stringify({ error: `Erro ao criar utilizador: ${createError.message}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    userId = newUser.user.id;

    // Liga a conta à empresa como administradora (pertença ativa). Não há papel admin global em
    // user_roles: o poder é só sobre esta empresa (a BD limita os dados por pertença).
    const { error: membershipError } = await supabaseAdmin.from('company_memberships').insert({
      company_id,
      user_id: userId,
      role: 'admin',
      origin: 'convite',
      status: 'ativo',
      created_by: caller.userId,
    });

    if (membershipError) {
      console.error('Error adding company admin membership:', membershipError);
      // Não deixa uma conta órfã sem empresa: apaga a conta acabada de criar.
      const { error: cleanupError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (cleanupError) {
        console.error('invite-admin: falhou a limpeza da conta criada', userId);
      }
      return new Response(
        JSON.stringify({
          error: `Erro ao ligar o administrador à empresa: ${membershipError.message}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create profile
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      user_id: userId,
      name: displayName,
      email: normalizedEmail,
    });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // We don't block here as user and role are already created,
      // but we log it for troubleshooting
    } else {
      console.log(`Created profile for user ${userId}`);
    }

    const loginUrl = 'https://admin.realizeconsultadoria.pt/admin/login';

    // Send welcome email via Brevo (always new user now)
    if (brevoApiKey) {
      const emailSubject = 'Bem-vindo ao Portal Realize - Dados de Acesso';
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
        <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 22px;">Olá ${escapeHtml(displayName)},</h2>
        <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
          A sua conta de <strong>administrador(a)</strong> foi criada no Portal Realize Consultadoria.
        </p>
        
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
          <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 16px;">Os seus dados de acesso:</h3>
          <p style="color: #666666; font-size: 14px; line-height: 1.8; margin: 0;">
            <strong>Email:</strong> ${escapeHtml(normalizedEmail)}<br>
            <strong>Palavra-passe:</strong> ${escapeHtml(password)}
          </p>
        </div>
        
        <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
          Clique no botão abaixo para aceder ao painel de administração:
        </p>
        
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
          <tr>
            <td style="background-color: #d5b884; border-radius: 6px;">
              <a href="${loginUrl}" style="display: inline-block; padding: 16px 40px; color: #000000; text-decoration: none; font-weight: 600; font-size: 16px;">
                Aceder ao Portal
              </a>
            </td>
          </tr>
        </table>
        
        <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
          Recomendamos que altere a sua palavra-passe após o primeiro acesso, em Configurações → Segurança.
        </p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #000000; padding: 20px 30px; text-align: center;">
        <p style="color: #888888; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Realize Consultadoria. Todos os direitos reservados.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      try {
        const emailResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: 'Realize Consultadoria', email: 'noreply@dasprent.pt' },
            to: [{ email: normalizedEmail, name: displayName }],
            subject: emailSubject,
            htmlContent: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error('Brevo API error:', errorText.slice(0, 200));
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
      }
    } else {
      console.warn('BREVO_API_KEY not configured, skipping email');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Novo administrador criado e email enviado',
        userId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in invite-admin function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
