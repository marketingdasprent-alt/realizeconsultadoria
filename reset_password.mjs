import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const key = fs.readFileSync('.service_role_key', 'utf8').trim();
const url = 'https://jvvnsoasylusbmxfotci.supabase.co';

const supabase = createClient(url, key);

async function resetPassword() {
    const email = 'dinisilva06@gmail.com';
    const newPassword = 'Realize2026!';

    console.log(`Resetting password for: ${email}`);
    
    const { data: userData, error: listError } = await supabase.auth.admin.listUsers();
    const user = userData.users.find(u => u.email === email);

    if (!user) {
        console.error('User not found');
        return;
    }

    const { error } = await supabase.auth.admin.updateUserById(user.id, {
        password: newPassword
    });

    if (error) {
        console.error('Error updating password:', error.message);
    } else {
        console.log('Password updated successfully!');
    }
}

resetPassword();
