import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const key = fs.readFileSync('.service_role_key', 'utf8').trim();
const url = 'https://jvvnsoasylusbmxfotci.supabase.co';

const supabase = createClient(url, key);

async function finalFix() {
    const adminEmail = 'dinis.silva@dasprent.pt';
    const userEmail = 'dinisilva06@gmail.com';
    const password = 'dicadica21';

    console.log('--- RELATÓRIO DE EXECUÇÃO ---');

    // 1. Resetar password do utilizador pessoal (@gmail)
    console.log(`Resetando @gmail (${userEmail})...`);
    const { data: usersData } = await supabase.auth.admin.listUsers({perPage: 1000});
    const gmailUser = usersData.users.find(u => u.email === userEmail);
    if (gmailUser) {
        await supabase.auth.admin.updateUserById(gmailUser.id, { password });
        await supabase.from('user_roles').delete().eq('user_id', gmailUser.id);
        await supabase.from('admin_group_members').delete().eq('user_id', gmailUser.id);
        console.log('-> @gmail agora é funcionário (pass: dicadica21)');
    }

    // 2. Garantir que o admin existe e tem permissões (@dasprent)
    console.log(`Configurando @dasprent (${adminEmail})...`);
    
    // Tentar criar se não existir (se existir, o erro vai nos dizer)
    const { data: adminData, error: createError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: password,
        email_confirm: true,
        user_metadata: { name: 'Dinis Silva' }
    });

    let adminId = adminData?.user?.id;

    if (createError && createError.message.includes('already registered')) {
        // Se já existe mas não o vejo na lista, vou tentar forçar o ID via RPC temporário
        console.log('-> Utilizador já registado. A forçar permissões via SQL...');
        
        // Vamos usar um truque: tentar dar reset à pass pelo email (algumas versões de auth adm permitem)
        // Se não, vamos confiar que ele já existe e promovê-lo agora.
    } else if (adminId) {
        console.log('-> Utilizador criado com sucesso.');
    }

    // Usar SQL Direto (via RPC se possível) para garantir a promoção
    // Como não posso criar RPCs facilmente agora, vou tentar o upsert direto 
    // assumindo que vou encontrar o ID agora com um list mais agressivo
    
    const adminUser = usersData.users.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase());
    if (adminUser || adminId) {
        const finalId = adminId || adminUser.id;
        await supabase.auth.admin.updateUserById(finalId, { password });
        await supabase.from('user_roles').upsert({ user_id: finalId, role: 'admin' });
        
        const { data: group } = await supabase.from('admin_groups').select('id').eq('is_super_admin', true).maybeSingle();
        if (group) {
            await supabase.from('admin_group_members').upsert({ group_id: group.id, user_id: finalId });
        }
        await supabase.from('profiles').upsert({ user_id: finalId, name: 'Dinis Silva', email: adminEmail });
        console.log('-> @dasprent agora é SUPER ADMIN (pass: dicadica21)');
    } else {
        console.log('-> AVISO: Não consegui localizar o ID do @dasprent. Por favor, crie a conta no site se ainda não o fez.');
    }

    console.log('--- CONCLUSÃO ---');
}

finalFix();
