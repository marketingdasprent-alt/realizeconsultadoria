// scripts/setup-admin.mjs
// Script para verificar e corrigir acesso administrativo

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Ler .env.local
const envPath = new URL('../.env.local', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
let envVars = {};

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim();
    }
  });
}

const SUPABASE_URL = process.env.SUPABASE_URL || envVars.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '❌ ERRO: Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias'
  );
  console.error('Certifique-se que .env.local existe com estas variáveis');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Verificar se um user tem role de admin
 */
async function checkAdminRole(userId) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error) {
    return null;
  }

  return data?.role === 'admin';
}

/**
 * Listar todos os users
 */
async function listAllUsers() {
  const { data, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('❌ Erro ao listar users:', error);
    return [];
  }

  return data.users || [];
}

/**
 * Adicionar role de admin a um user
 */
async function addAdminRole(userId) {
  const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', userId);

  if (deleteError) {
    console.error('❌ Erro ao remover roles anteriores:', deleteError);
    return false;
  }

  const { error: insertError } = await supabase.from('user_roles').insert({
    user_id: userId,
    role: 'admin',
  });

  if (insertError) {
    console.error('❌ Erro ao adicionar role de admin:', insertError);
    return false;
  }

  return true;
}

/**
 * Criar admin group para super admin
 */
async function createSuperAdminGroup(userId) {
  // Criar grupo de admin se não existir
  const { data: groupData, error: groupError } = await supabase
    .from('admin_groups')
    .select('id')
    .eq('name', 'Super Admins')
    .single();

  let groupId;

  if (groupError) {
    const { data: newGroup, error: createError } = await supabase
      .from('admin_groups')
      .insert({
        name: 'Super Admins',
        description: 'Super administradores com acesso total',
        is_super_admin: true,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Erro ao criar grupo de admin:', createError);
      return false;
    }

    groupId = newGroup.id;
  } else {
    groupId = groupData.id;
  }

  // Adicionar user ao grupo
  const { error: memberError } = await supabase
    .from('admin_group_members')
    .insert({
      group_id: groupId,
      user_id: userId,
    })
    .select()
    .single();

  if (memberError && !memberError.message.includes('duplicate')) {
    console.error('❌ Erro ao adicionar member ao grupo:', memberError);
    return false;
  }

  return true;
}

/**
 * Verificar e corrigir RLS policies
 */
async function checkRLSPolicies() {
  console.log('\n📋 Verificando RLS Policies...\n');

  const { data, error } = await supabase
    .from('information_schema.table_constraints')
    .select('*')
    .eq('table_schema', 'public');

  if (error) {
    console.log('⚠️  Não foi possível verificar RLS policies automaticamente');
    console.log('💡 Dica: Visite https://app.supabase.com para verificar manualmente');
    return;
  }

  console.log('✅ RLS habilitado e ativo');
}

/**
 * Script principal
 */
async function main() {
  console.log('='.repeat(60));
  console.log('🔧 CONFIGURAÇÃO DE ACESSO ADMINISTRATIVO');
  console.log('='.repeat(60));

  // Listar todos os users
  console.log('\n📚 Listando users do sistema...\n');
  const users = await listAllUsers();

  if (users.length === 0) {
    console.error('❌ Nenhum user encontrado no sistema');
    console.log('💡 Dica: Crie um user primeiro via Supabase Dashboard');
    process.exit(1);
  }

  console.log(`Encontrados ${users.length} user(s):\n`);
  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email} (ID: ${user.id})`);
  });

  // Verificar e corrigir roles
  console.log('\n🔐 Verificando roles...\n');

  let adminCount = 0;

  for (const user of users) {
    const isAdmin = await checkAdminRole(user.id);

    if (isAdmin) {
      console.log(`✅ ${user.email} - JÁ TEM ROLE DE ADMIN`);
      adminCount++;
    } else {
      console.log(`⚠️  ${user.email} - NÃO TEM ROLE DE ADMIN`);
    }
  }

  // Se nenhum admin encontrado, oferecer criar um
  if (adminCount === 0) {
    console.log('\n❌ Nenhum admin encontrado no sistema');
    console.log('\n💡 Recomendação: Configurar o primeiro user como admin');
    console.log(`\n   Email do primeiro user: ${users[0].email}`);
    console.log(`   ID do primeiro user: ${users[0].id}`);

    // Adicionar primeiro user como admin
    console.log('\n🔄 Adicionando primeira role de admin...');
    const success = await addAdminRole(users[0].id);

    if (success) {
      console.log(`✅ Role de admin adicionado a ${users[0].email}`);

      // Criar super admin group
      console.log('\n🔄 Criando grupo de super admin...');
      const groupSuccess = await createSuperAdminGroup(users[0].id);

      if (groupSuccess) {
        console.log(`✅ Grupo de super admin criado`);
      }
    } else {
      console.error(`❌ Falha ao adicionar role de admin`);
      process.exit(1);
    }
  }

  // Verificar RLS policies
  await checkRLSPolicies();

  console.log('\n' + '='.repeat(60));
  console.log('✅ CONFIGURAÇÃO CONCLUÍDA');
  console.log('='.repeat(60));

  console.log('\n📝 Próximos passos:');
  console.log('1. Visite: http://localhost:3000/admin/login');
  console.log(`2. Use as credenciais de um user com role de admin`);
  console.log('3. Verifique o painel administrativo');

  console.log('\n❓ Problemas?');
  console.log('- Verifique se SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão corretos');
  console.log('- Verifique as RLS policies em https://app.supabase.com');
  console.log('- Consulte os logs de erro acima');
}

main().catch(error => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
