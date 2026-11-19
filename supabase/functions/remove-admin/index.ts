import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticatedCaller, denyUnlessSuperAdmin } from '../_shared/admin-caller.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RemoveAdminRequest {
  user_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Conta de administrador global: só super admin (o admin de empresa usa o ecrã Administradores)
    const caller = await authenticatedCaller(req, corsHeaders);
    if (caller instanceof Response) return caller;
    const notSuper = await denyUnlessSuperAdmin(caller, corsHeaders);
    if (notSuper) return notSuper;
    const requesterId = caller.userId;
    const requesterEmail = caller.email;

    const { user_id }: RemoveAdminRequest = await req.json();

    // Prevent self-removal
    if (user_id === requesterId) {
      return new Response(
        JSON.stringify({ error: 'Não pode remover o seu próprio acesso de administrador' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${requesterEmail} is removing admin role from user: ${user_id}`);

    // Remove admin role
    const { error: deleteError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', user_id)
      .eq('role', 'admin');

    if (deleteError) {
      console.error('Error removing admin role:', deleteError);
      return new Response(
        JSON.stringify({ error: `Erro ao remover role admin: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Removed admin role from user ${user_id}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Acesso de administrador removido com sucesso' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in remove-admin function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
