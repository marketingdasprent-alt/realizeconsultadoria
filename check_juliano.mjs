import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ ERRO: Configure as variáveis de ambiente:');
  console.error('  set SUPABASE_URL=your_url');
  console.error('  set SUPABASE_SERVICE_ROLE_KEY=your_key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkJuliano() {
  console.log('Checking Employee juliano_cury@yahoo.com.br...');

  const email = 'juliano_cury@yahoo.com.br';

  const { data: employee, error: eError } = await supabase
    .from('employees')
    .select('id, name, email, user_id, is_active')
    .eq('email', email)
    .maybeSingle();

  if (eError) {
    console.log('Error fetching employee:', eError.message);
  } else if (!employee) {
    console.log('No employee found with this email.');
  } else {
    console.log('Employee record:', JSON.stringify(employee, null, 2));

    if (employee.user_id) {
      console.log('Checking roles for user_id:', employee.user_id);
      const { data: roles, error: rError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', employee.user_id);

      if (rError) console.log('Error roles:', rError.message);
      else console.log('Roles:', JSON.stringify(roles, null, 2));

      // Try logging in with a test password? We can't do that.
      // However, we can check profiles.
      const { data: profile, error: pError } = await supabase
        .from('profiles')
        .select('email, name')
        .eq('user_id', employee.user_id)
        .maybeSingle();

      console.log('Profile associated with user_id:', JSON.stringify(profile, null, 2));
    } else {
      console.log('WARNING: Employee does NOT have a user_id assigned!');
    }
  }
}

checkJuliano();
