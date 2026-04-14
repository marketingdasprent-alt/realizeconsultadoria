import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const key = fs.readFileSync('.service_role_key', 'utf8').trim();
const url = 'https://jvvnsoasylusbmxfotci.supabase.co';

const supabase = createClient(url, key);

async function finalSolution() {
    const adminEmail = 'dinis.silva@dasprent.pt';
    const workerEmail = 'dinisilva06@gmail.com';
    const password = 'dicadica21';

    console.log('1. Limpando conta pessoal (@gmail)...');
    const { data: userData } = await supabase.auth.admin.listUsers({perPage: 1000});
    const gmailUser = userData.users.find(u => u.email === workerEmail);
    
    if (gmailUser) {
        await supabase.auth.admin.updateUserById(gmailUser.id, { password });
        await supabase.from('user_roles').delete().eq('user_id', gmailUser.id);
        await supabase.from('admin_group_members').delete().eq('user_id', gmailUser.id);
        // Atualizar o perfil para o email correto para não haver confusão
        await supabase.from('profiles').upsert({ user_id: gmailUser.id, email: workerEmail, name: 'Dinis Silva (Funcionario)' });
        console.log('-> @gmail configurado como FUNCIONÁRIO.');
    }

    console.log(`2. Tentando criar/corrigir conta empresa (@dasprent)...`);
    
    // Forçar a criação. Se falhar porque existe, vamos tentar um reset de password forçado
    const { data: newAdmin, error: createError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: password,
        email_confirm: true,
        user_metadata: { name: 'Dinis Silva' }
    });

    let adminId = newAdmin?.user?.id;

    if (createError) {
        console.log(`-> Erro ao criar: ${createError.message}. Tentando localizar utilizador existente...`);
        // Se já existe, vamos procurar o ID em todas as páginas (raro mas possível)
        // Mas vamos tentar dar update à password dele assumindo que o ID é o que falta.
    } else {
        console.log('-> @dasprent criado com sucesso.');
    }

    if (adminId) {
        console.log('3. Atribuindo poderes de SUPER ADMIN ao @dasprent...');
        await supabase.from('user_roles').upsert({ user_id: adminId, role: 'admin' });
        const { data: group } = await supabase.from('admin_groups').select('id').eq('is_super_admin', true).maybeSingle();
        if (group) {
            await supabase.from('admin_group_members').upsert({ group_id: group.id, user_id: adminId });
        }
        await supabase.from('profiles').upsert({ user_id: adminId, name: 'Dinis Silva', email: adminEmail });
        console.log('-> @dasprent promovido a SUPER ADMIN.');
    } else {
        console.error('ERRO CRÍTICO: Não consegui gerar um utilizador para o @dasprent. Por favor, remova o utilizador dinis.silva@dasprent.pt manualmente no painel AUTH > USERS do Supabase e avise-me.');
    }
}

finalSolution();
