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

async function checkBeatrizAdmin() {
  console.log('Checking Beatriz Veloso (beatrizveloso@dasprent.pt) roles...');

  // 1. Find profile
  const { data: profile, error: pError } = await supabase
    .from('profiles')
    .select('user_id, name, email')
    .eq('email', 'beatrizveloso@dasprent.pt')
    .maybeSingle();

  if (pError || !profile) {
    console.log('Profile not found for beatrizveloso@dasprent.pt');
    return;
  }

  console.log('Profile:', JSON.stringify(profile, null, 2));

  // 2. Find roles
  const { data: roles, error: rError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', profile.user_id);

  if (rError) {
    console.log('Error fetching roles:', rError.message);
  } else {
    console.log('Roles:', JSON.stringify(roles, null, 2));
  }

  // 3. Find if she is also an employee
  const { data: employee, error: eError } = await supabase
    .from('employees')
    .select('id, name, email, user_id')
    .eq('user_id', profile.user_id)
    .maybeSingle();

  if (eError) {
    console.log('Error fetching employee:', eError.message);
  } else {
    console.log('Is also employee?', !!employee);
    if (employee) console.log('Employee record:', JSON.stringify(employee, null, 2));
  }
}

checkBeatrizAdmin();
