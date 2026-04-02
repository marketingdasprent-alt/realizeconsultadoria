import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';

const ACCESS_TOKEN = 'sbp_1f7d2c31efdf191009f56bc3041e9cf3ee373168';
const PROJECT_REF = 'jvvnsoasylusbmxfotci';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dm5zb2FzeWx1c2JteGZvdGNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA1MDUyNCwiZXhwIjoyMDkwNjI2NTI0fQ.bSpoekoIJMo4gwZDYNHVCqL7VOauKSryvShBN_p2tog';
const SUPABASE_URL = 'https://jvvnsoasylusbmxfotci.supabase.co';

const MIGRATIONS_DIR = './supabase/migrations';
const CSV_DIR = './Importar';

const TABLE_ORDER = [
  'companies',
  'system_settings',
  'holidays',
  'equipment_categories',
  'access_categories',
  'support_departments',
  'support_ticket_subjects',
  'admin_groups',
  'profiles',
  'user_roles',
  'admin_group_members',
  'admin_group_permissions',
  'admin_group_support_departments',
  'employees',
  'employee_attachments',
  'employee_documents',
  'employee_vacation_balances',
  'employee_department_emails',
  'absences',
  'absence_periods',
  'absence_documents',
  'accesses',
  'assignments',
  'assignment_items',
  'equipments',
  'phones',
  'notifications',
  'notification_emails_absences',
  'notification_emails_support',
  'support_tickets',
  'support_ticket_attachments',
  'support_ticket_replies',
];

async function executeSQL(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

async function runMigrations() {
  console.log('\n📦 A executar migrations...');
  const files = fs.readdirSync(MIGRATIONS_DIR).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await executeSQL(sql);
      console.log(`  ✓ ${file}`);
    } catch (e) {
      const msg = e.message;
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log(`  ~ ${file}: já existe`);
      } else {
        console.log(`  ⚠ ${file}: ${msg.slice(0, 120)}`);
      }
    }
  }
}

async function createAuthUsers() {
  console.log('\n👤 A criar utilizadores em auth.users...');
  const content = fs.readFileSync(path.join(CSV_DIR, 'profiles.csv'), 'utf8');
  const profiles = parse(content, { columns: true, skip_empty_lines: true });

  let created = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: profile.user_id,
        email: profile.email,
        email_confirm: true,
        password: 'Realize2026!',
      }),
    });

    const data = await res.json();
    if (res.ok) {
      created++;
    } else if (data.msg?.includes('already been registered') || data.code === 'email_exists' || res.status === 422) {
      skipped++;
    } else {
      console.log(`  ⚠ ${profile.email}: ${data.msg || data.message || res.status}`);
    }
  }

  console.log(`  ✓ ${created} utilizadores criados, ${skipped} já existiam`);
}

async function importCSV(table) {
  const filePath = path.join(CSV_DIR, `${table}.csv`);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠ ${table}: ficheiro não encontrado`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true, cast: false });

  if (rows.length === 0) {
    console.log(`  - ${table}: vazio`);
    return;
  }

  const BATCH = 100;
  let inserted = 0;
  let errors = 0;
  let lastError = '';

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const cleaned = batch.map(row =>
      Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === '' ? null : v]))
    );

    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(cleaned),
    });

    if (res.ok || res.status === 201) {
      inserted += cleaned.length;
    } else {
      const err = await res.json().catch(() => ({}));
      errors += cleaned.length;
      lastError = err.message || err.hint || String(res.status);
    }
  }

  if (errors > 0) {
    console.log(`  ⚠ ${table}: ${inserted} inseridas, ${errors} erros — ${lastError.slice(0, 100)}`);
  } else {
    console.log(`  ✓ ${table}: ${inserted} linhas inseridas`);
  }
}

async function main() {
  console.log('🚀 A iniciar migração para novo Supabase...');

  await runMigrations();
  await createAuthUsers();

  console.log('\n📥 A importar dados...');
  for (const table of TABLE_ORDER) {
    await importCSV(table);
  }

  console.log('\n✅ Migração concluída!');
}

main().catch(e => {
  console.error('Erro fatal:', e.message);
  process.exit(1);
});
