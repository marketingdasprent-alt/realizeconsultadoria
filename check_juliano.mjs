import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jvvnsoasylusbmxfotci.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dm5zb2FzeWx1c2JteGZvdGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTA1MjQsImV4cCI6MjA5MDYyNjUyNH0.uTsDGNYrin5bemer5vciSYV14IaWC74kQ3L2l6zUalg";

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
