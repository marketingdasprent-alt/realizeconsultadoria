import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jvvnsoasylusbmxfotci.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dm5zb2FzeWx1c2JteGZvdGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTA1MjQsImV4cCI6MjA5MDYyNjUyNH0.uTsDGNYrin5bemer5vciSYV14IaWC74kQ3L2l6zUalg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debugJuliano() {
  console.log('--- DB DEBUG: Juliano ---');
  
  // 1. Check all employees matching 'juliano'
  const { data: employees, error: eError } = await supabase
    .from('employees')
    .select('id, name, email, user_id')
    .ilike('email', '%juliano%');

  if (eError) {
    console.log('Error fetching employees:', eError.message);
    return;
  }

  console.log('Found Employees:', JSON.stringify(employees, null, 2));

  for (const emp of employees) {
    if (emp.user_id) {
        // Check if profile exists for this user_id
        const { data: profile } = await supabase
            .from('profiles')
            .select('email, name')
            .eq('user_id', emp.user_id)
            .maybeSingle();
        console.log(`User ID ${emp.user_id} has Profile:`, JSON.stringify(profile, null, 2));
        
        // Check if there are internal logs or access records
        const { data: accesses } = await supabase
            .from('accesses')
            .select('title, username, password')
            .eq('employee_id', emp.id);
        console.log(`Accesses for ${emp.name}:`, JSON.stringify(accesses, null, 2));
    }
  }
}

debugJuliano();
