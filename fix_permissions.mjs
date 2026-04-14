import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const key = fs.readFileSync('.service_role_key', 'utf8').trim();
const url = 'https://jvvnsoasylusbmxfotci.supabase.co';

const supabase = createClient(url, key);

async function fixPermissions() {
    const userId = '6ccc73ae-6fe0-4c0d-9927-7448a2659389'; // dinisilva06@gmail.com
    console.log(`Fixing permissions for user: ${userId}`);

    // 1. Ensure Super Admin group exists
    let { data: groups, error: groupError } = await supabase
        .from('admin_groups')
        .select('id')
        .eq('is_super_admin', true)
        .eq('is_active', true)
        .maybeSingle();

    if (groupError) {
        console.error('Error fetching admin groups:', groupError.message);
        return;
    }

    let superAdminGroupId;
    if (!groups) {
        console.log('Super Admin group not found. Creating it...');
        const { data: newGroup, error: createError } = await supabase
            .from('admin_groups')
            .insert({
                name: 'Super Admin',
                description: 'Acesso total a todos os módulos do sistema',
                is_super_admin: true,
                is_active: true
            })
            .select()
            .single();

        if (createError) {
            console.error('Error creating Super Admin group:', createError.message);
            return;
        }
        superAdminGroupId = newGroup.id;
        console.log(`Super Admin group created: ${superAdminGroupId}`);
    } else {
        superAdminGroupId = groups.id;
        console.log(`Super Admin group found: ${superAdminGroupId}`);
    }

    // 2. Add user to the group
    console.log('Adding user to Super Admin group...');
    const { error: memberError } = await supabase
        .from('admin_group_members')
        .upsert({
            group_id: superAdminGroupId,
            user_id: userId
        });

    if (memberError) {
        console.error('Error adding user to group:', memberError.message);
    } else {
        console.log('Successfully added user to Super Admin group!');
    }
}

fixPermissions();
