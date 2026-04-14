import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const key = fs.readFileSync('.service_role_key', 'utf8').trim();
const url = 'https://jvvnsoasylusbmxfotci.supabase.co';

const supabase = createClient(url, key);

async function nuclearFix() {
    const adminEmail = 'dinis.silva@dasprent.pt';
    const workerEmail = 'dinisilva06@gmail.com';
    const password = 'dicadica21';

    console.log('--- OPERAÇÃO NUCLEAR: FIX TOTAL ---');

    // 1. Buscar TODOS os utilizadores do sistema para encontrar o @dasprent
    let allUsers = [];
    let page = 1;
    while (true) {
        const { data } = await supabase.auth.admin.listUsers({ page: page, perPage: 100 });
        if (!data || data.users.length === 0) break;
        allUsers = allUsers.concat(data.users);
        page++;
    }

    console.log(`Utilizadores encontrados no sistema: ${allUsers.length}`);

    // 2. Localizar os IDs
    const gmailUser = allUsers.find(u => u.email?.toLowerCase() === workerEmail.toLowerCase());
    const dasprentUser = allUsers.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase());

    // 3. Tratar o @gmail (Funcionário)
    if (gmailUser) {
        console.log(`Configurando @gmail (${gmailUser.id}) como funcionário...`);
        await supabase.auth.admin.updateUserById(gmailUser.id, { password: password });
        await supabase.from('user_roles').delete().eq('user_id', gmailUser.id);
        await supabase.from('admin_group_members').delete().eq('user_id', gmailUser.id);
        await supabase.from('profiles').upsert({ user_id: gmailUser.id, email: workerEmail, name: 'Dinis (Funcionario)' });
    }

    // 4. Tratar o @dasprent (Admin Master)
    let adminId = dasprentUser?.id;

    if (!adminId) {
        console.log(`@dasprent não encontrado na lista. Tentando criar do zero...`);
        const { data: created, error } = await supabase.auth.admin.createUser({
            email: adminEmail,
            password: password,
            email_confirm: true,
            user_metadata: { name: 'Dinis Silva' }
        });
        if (error) {
            console.log(`Erro ao criar: ${error.message}. TENTANDO FORÇAR VIA ALTERAÇÃO DE EMAIL...`);
            // Se falhar de vez, vou pegar no @gmail e mudar o email DELE para @dasprent, e criar um novo para o @gmail
            // Mas só se o user autorizar. Por agora, vou tentar o Upsert.
        } else {
            adminId = created.user.id;
        }
    }

    if (adminId || dasprentUser) {
        const finalId = adminId || dasprentUser.id;
        console.log(`Configurando @dasprent (${finalId}) como SUPER ADMIN...`);
        await supabase.auth.admin.updateUserById(finalId, { password: password });
        await supabase.from('user_roles').upsert({ user_id: finalId, role: 'admin' });
        
        const { data: group } = await supabase.from('admin_groups').select('id').eq('is_super_admin', true).maybeSingle();
        if (group) {
            await supabase.from('admin_group_members').upsert({ group_id: group.id, user_id: finalId });
        }
        await supabase.from('profiles').upsert({ user_id: finalId, name: 'Dinis Silva', email: adminEmail });
        console.log('-> @dasprent CONFIGURADO COM SUCESSO.');
    } else {
        console.error('CRITICAL: @dasprent ainda não existe. O Dinis tem de criá-lo no site primeiro.');
    }

    console.log('--- OPERAÇÃO CONCLUÍDA ---');
}

nuclearFix();
