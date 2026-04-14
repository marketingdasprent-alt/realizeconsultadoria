import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jvvnsoasylusbmxfotci.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dm5zb2FzeWx1c2JteGZvdGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTA1MjQsImV4cCI6MjA5MDYyNjUyNH0.uTsDGNYrin5bemer5vciSYV14IaWC74kQ3L2l6zUalg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkMarta() {
  console.log('Searching for Marta in employees table...');
  
  const { data, error } = await supabase
    .from('employees')
    .select('id, name, email, created_at, user_id')
    .ilike('name', '%Marta%');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  if (data.length === 0) {
    console.log('No employee found with "Marta" in the name.');
  } else {
    console.log('Found:', JSON.stringify(data, null, 2));
  }
}

checkMarta();
