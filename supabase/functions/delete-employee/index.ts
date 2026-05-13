import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { employee_id } = await req.json();

    if (!employee_id) {
      return new Response(JSON.stringify({ error: 'employee_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch employee to get the associated auth user_id
    const { data: employee, error: fetchError } = await supabaseAdmin
      .from('employees')
      .select('id, name, user_id')
      .eq('id', employee_id)
      .single();

    if (fetchError || !employee) {
      return new Response(JSON.stringify({ error: 'Colaborador não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Soft delete: mark employee as inactive
    const { error: deactivateError } = await supabaseAdmin
      .from('employees')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', employee_id);

    if (deactivateError) {
      console.error('[delete-employee] Error deactivating employee:', deactivateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao desativar colaborador: ' + deactivateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[delete-employee] Employee deactivated:', employee_id);

    // Ban the auth user so they can no longer login
    if (employee.user_id) {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
        employee.user_id,
        { ban_duration: '876000h' } // ~100 years
      );

      if (banError) {
        console.warn(
          '[delete-employee] Could not ban auth user:',
          employee.user_id,
          banError.message
        );
      } else {
        console.log('[delete-employee] Auth user banned:', employee.user_id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Colaborador eliminado com sucesso' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[delete-employee] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
