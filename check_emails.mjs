import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Tentar carregar variáveis do .env ou do client.ts se existir
const supabaseUrl = 'https://jvvnsoasylusbmxfotci.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Preciso de service role para ver tudo se RLS travar

if (!supabaseKey) {
  console.log('ERRO: SUPABASE_SERVICE_ROLE_KEY não encontrada. Usa:');
  console.log('$env:SUPABASE_SERVICE_ROLE_KEY="TUA_CHAVE_AQUI" ; node check_emails.mjs');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmails() {
  console.log('=== DIAGNÓSTICO DE EMAILS DESALINHADOS ===');

  // 1. Obter todos os utilizadores no Supabase Auth
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error('Erro a ler auth.users:', authErr);
    return;
  }
  const authUsers = authData.users;
  console.log(`Encontrados ${authUsers.length} utilizadores no Auth.`);

  // 2. Obter todos os colaboradores na tabela employees
  const { data: employees, error: empErr } = await supabase
    .from('employees')
    .select('id, name, email, user_id');

  if (empErr) {
    console.error('Erro a ler employees:', empErr);
    return;
  }
  console.log(`Encontrados ${employees.length} colaboradores.\n`);

  console.log('--- Colaboradores com email diferente ou sem auth_user ---');
  let badCount = 0;

  for (const emp of employees) {
    let authUser = null;
    
    // Tentar achar pelo user_id
    if (emp.user_id) {
      authUser = authUsers.find(u => u.id === emp.user_id);
    } 
    
    // Fallback: tentar achar pelo email se user_id nulas (devido a migrações manuais)
    if (!authUser) {
      authUser = authUsers.find(u => u.email === emp.email);
    }

    if (!authUser) {
      console.log(`⚠️ ${emp.name} (${emp.email}): Conta Auth NÃO ENCONTRADA!`);
      badCount++;
    } else if (authUser.email !== emp.email) {
      console.log(`❌ ${emp.name}:\n   - Email na Ficha: ${emp.email}\n   - Email no Login (Auth): ${authUser.email}`);
      badCount++;
    }
  }

  if (badCount === 0) {
    console.log('✅ Todos os colaboradores estão com os emails alinhados!');
  } else {
    console.log(`\nForam encontrados ${badCount} colaboradores com problemas.`);
  }
}

checkEmails();
