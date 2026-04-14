import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const key = fs.readFileSync('.service_role_key', 'utf8').trim();
const url = 'https://jvvnsoasylusbmxfotci.supabase.co';

const supabase = createClient(url, key);

async function findOrphan() {
    const target = 'dinis.silva@dasprent.pt';
    console.log(`Deep search for: ${target}`);

    let page = 1;
    let found = false;

    while (true) {
        console.log(`Scanning page ${page}...`);
        const { data, error } = await supabase.auth.admin.listUsers({
            page: page,
            perPage: 100
        });

        if (error) {
            console.error('List error:', error.message);
            break;
        }

        if (data.users.length === 0) {
            console.log('End of list reached.');
            break;
        }

        const user = data.users.find(u => u.email?.toLowerCase() === target.toLowerCase());
        if (user) {
            console.log('--- FOUND ---');
            console.log(`ID: ${user.id}`);
            console.log(`Email: ${user.email}`);
            console.log(`Created: ${user.created_at}`);
            console.log(`Confirmed: ${user.email_confirmed_at}`);
            
            // Promote immediately
            console.log('Promoting found user...');
            await supabase.from('user_roles').upsert({ user_id: user.id, role: 'admin' });
            const { data: group } = await supabase.from('admin_groups').select('id').eq('is_super_admin', true).maybeSingle();
            if (group) {
                await supabase.from('admin_group_members').upsert({ group_id: group.id, user_id: user.id });
            }
            await supabase.from('profiles').upsert({ user_id: user.id, name: 'Dinis Silva', email: target });
            console.log('DONE.');
            found = true;
            break;
        }

        page++;
    }

    if (!found) {
        console.log('User still not found. This is a ghost user. Trying to delete and recreate...');
        // We can't delete what we can't find by ID, but maybe we can use a raw SQL if we find the ID via SQL.
    }
}

findOrphan();
