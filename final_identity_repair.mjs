import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const key = fs.readFileSync('.service_role_key', 'utf8').trim();
const url = 'https://jvvnsoasylusbmxfotci.supabase.co';

const supabase = createClient(url, key);

async function finalFix() {
    const adminId = '102879ff-74e3-4148-9366-e000bc851208'; // dinis.silva@dasprent.pt
    const gmailId = '6ccc73ae-6fe0-4c0d-9927-7448a2659389'; // dinisilva06@gmail.com
    const password = 'dicadica21';

    console.log('--- FIX FINAL: CONTAS SEPARADAS ---');

    // 1. Configurar ADMIN MASTER (@dasprent)
    console.log('Configurando conta Empresa como ADMIN MASTER...');
    await supabase.auth.admin.updateUserById(adminId, { password });
    await supabase.from('user_roles').upsert({ user_id: adminId, role: 'admin' });
    const { data: group } = await supabase.from('admin_groups').select('id').eq('is_super_admin', true).maybeSingle();
    if (group) {
        await supabase.from('admin_group_members').upsert({ group_id: group.id, user_id: adminId });
    }
    await supabase.from('profiles').upsert({ user_id: adminId, email: 'dinis.silva@dasprent.pt', name: 'Dinis Silva' });
    console.log('-> @dasprent: ADMIN MASTER OK.');

    // 2. Configurar FUNCIONÁRIO (@gmail)
    console.log('Configurando conta Pessoal como FUNCIONÁRIO...');
    await supabase.auth.admin.updateUserById(gmailId, { password });
    await supabase.from('user_roles').delete().eq('user_id', gmailId);
    await supabase.from('admin_group_members').delete().eq('user_id', gmailId);
    // Reparar o perfil do @gmail (estava com o email errado)
    await supabase.from('profiles').upsert({ user_id: gmailId, email: 'dinisilva06@gmail.com', name: 'Dinis (Pessoal)' });
    console.log('-> @gmail: FUNCIONÁRIO OK.');

    console.log('--- TUDO PRONTO! ---');
}

finalFix();
