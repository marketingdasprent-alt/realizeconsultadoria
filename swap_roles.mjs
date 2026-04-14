import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const key = fs.readFileSync('.service_role_key', 'utf8').trim();
const url = 'https://jvvnsoasylusbmxfotci.supabase.co';

const supabase = createClient(url, key);

async function swapRoles() {
    const adminEmail = 'dinis.silva@dasprent.pt';
    const userEmail = 'dinisilva06@gmail.com';

    console.log(`Swapping roles: ${adminEmail} (-> Admin) and ${userEmail} (-> User)`);

    // 1. Find or Create the @dasprent user
    console.log(`Checking for ${adminEmail}...`);
    let adminUser = null;
    
    // Attempt to list to find ID
    const { data: listData } = await supabase.auth.admin.listUsers({perPage: 1000});
    adminUser = listData?.users?.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase());

    if (!adminUser) {
        console.log(`${adminEmail} not found in list. Attempting creation...`);
        const { data: createData, error: createError } = await supabase.auth.admin.createUser({
            email: adminEmail,
            password: 'Realize2026!',
            email_confirm: true,
            user_metadata: { name: 'Dinis Silva (Adm)' }
        });

        if (createError) {
            console.log(`Creation failed: ${createError.message}. It might be an orphan user.`);
            // If it already exists but we can't list it, we have a problem. 
            // But let's check common casing.
        } else {
            adminUser = createData.user;
            console.log(`User created: ${adminUser.id}`);
        }
    }

    if (adminUser) {
        console.log(`Found/Created Admin User ID: ${adminUser.id}`);
        
        // Promote to Admin Role
        console.log('Promoting to admin role...');
        await supabase.from('user_roles').upsert({ user_id: adminUser.id, role: 'admin' });
        
        // Find Super Admin Group
        const { data: group } = await supabase.from('admin_groups').select('id').eq('is_super_admin', true).maybeSingle();
        if (group) {
            console.log('Adding to Super Admin group...');
            await supabase.from('admin_group_members').upsert({ group_id: group.id, user_id: adminUser.id });
        }
        
        // Ensure profile exists
        await supabase.from('profiles').upsert({
            user_id: adminUser.id,
            name: 'Dinis Silva',
            email: adminEmail
        });
        
        console.log(`SUCCESS: ${adminEmail} is now Super Admin.`);
    } else {
        console.error(`CRITICAL: Could not find or create ${adminEmail}.`);
    }

    // 2. Demote the @gmail user
    console.log(`Checking for ${userEmail} to demote...`);
    const gmailUser = listData?.users?.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());
    
    if (gmailUser) {
        console.log(`Demoting ${userEmail} (ID: ${gmailUser.id})...`);
        // Remove from roles and groups
        await supabase.from('user_roles').delete().eq('user_id', gmailUser.id);
        await supabase.from('admin_group_members').delete().eq('user_id', gmailUser.id);
        
        console.log(`SUCCESS: ${userEmail} is now a regular user.`);
    } else {
        console.log(`User ${userEmail} not found, skipping demotion.`);
    }
}

swapRoles();
