import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const key = fs.readFileSync('.service_role_key', 'utf8').trim();
const url = 'https://jvvnsoasylusbmxfotci.supabase.co';

const supabase = createClient(url, key);

async function promoteAdmin() {
    const email = 'dinis.silva@dasprent.pt';
    const password = 'Realize2026!'; // Temporary password if account needs creation

    console.log(`Checking for user: ${email}`);
    
    let user = null;
    let page = 1;
    const perPage = 100;
    
    while (true) {
        console.log(`Searching page ${page}...`);
        const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
            page,
            perPage
        });
        
        if (listError) {
            console.error('Error listing users:', listError.message);
            return;
        }
        
        user = usersData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (user || usersData.users.length < perPage) break;
        page++;
    }

    if (!user) {
        console.log('User not found. Creating new user...');
        const { data: newData, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name: 'Dinis Silva' }
        });

        if (createError) {
            console.error('Error creating user:', createError.message);
            return;
        }
        user = newData.user;
        console.log(`User created: ${user.id}`);
    } else {
        console.log(`User found: ${user.id}`);
    }

    // 2. Promote to admin in user_roles
    console.log('Adding admin role...');
    const { error: roleError } = await supabase.from('user_roles').upsert({
        user_id: user.id,
        role: 'admin'
    });

    if (roleError) {
        console.error('Error adding role:', roleError.message);
    } else {
        console.log('Successfully promoted to admin!');
    }

    // 3. Create profile if missing
    const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (!profile) {
        console.log('Creating profile...');
        await supabase.from('profiles').insert({
            user_id: user.id,
            name: 'Dinis Silva',
            email: email
        });
    }
}

promoteAdmin();
