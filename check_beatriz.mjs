import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jvvnsoasylusbmxfotci.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dm5zb2FzeWx1c2JteGZvdGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTA1MjQsImV4cCI6MjA5MDYyNjUyNH0.uTsDGNYrin5bemer5vciSYV14IaWC74kQ3L2l6zUalg";

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
