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
