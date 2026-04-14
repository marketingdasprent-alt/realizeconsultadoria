import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';

const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dm5zb2FzeWx1c2JteGZvdGNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA1MDUyNCwiZXhwIjoyMDkwNjI2NTI0fQ.bSpoekoIJMo4gwZDYNHVCqL7VOauKSryvShBN_p2tog';
const SUPABASE_URL = 'https://jvvnsoasylusbmxfotci.supabase.co';
const ACCESS_TOKEN = 'sbp_1f7d2c31efdf191009f56bc3041e9cf3ee373168';
const PROJECT_REF = 'jvvnsoasylusbmxfotci';
const CSV_DIR = './Importar';

async function executeSQL(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || JSON.stringify(data));
  return data;
}

async function importCSV(table) {
  const filePath = path.join(CSV_DIR, `${table}.csv`);
  if (!fs.existsSync(filePath)) { console.log(`  ⚠ ${table}: não encontrado`); return; }

  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true, cast: false });
  if (rows.length === 0) { console.log(`  - ${table}: vazio`); return; }

  const BATCH = 100;
  let inserted = 0, errors = 0, lastError = '';

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
    console.log(`  ⚠ ${table}: ${inserted} inseridas, ${errors} erros — ${lastError.slice(0, 120)}`);
  } else {
    console.log(`  ✓ ${table}: ${inserted} linhas inseridas`);
  }
}

async function main() {
  console.log('🔁 A re-importar tabelas com falhas...\n');

  // Fix accesses: username NOT NULL — use title as username fallback
  // First check what's failing
  await importCSV('absences');
  await importCSV('absence_periods');
  await importCSV('absence_documents');

  // Fix accesses: use SQL to insert with coalesce for username
  console.log('  📋 accesses: a importar via SQL direto...');
  const accessContent = fs.readFileSync(path.join(CSV_DIR, 'accesses.csv'), 'utf8');
  const accesses = parse(accessContent, { columns: true, skip_empty_lines: true, cast: false });
  let accInserted = 0, accErrors = 0;
  for (const row of accesses) {
    const username = row.username || row.title || row.email || 'sem-username';
    const vals = [
      row.id, row.company_id || null, row.category_id || null, row.employee_id || null,
      row.title || null, username, row.password || null, row.url || null,
      row.notes || null, row.created_at || null, row.updated_at || null
    ];
    try {
      await executeSQL(
        `INSERT INTO public.accesses (id,company_id,category_id,employee_id,title,username,password,url,notes,created_at,updated_at)
         VALUES ('${vals[0]}',${vals[1] ? `'${vals[1]}'` : 'NULL'},${vals[2] ? `'${vals[2]}'` : 'NULL'},${vals[3] ? `'${vals[3]}'` : 'NULL'},${vals[4] ? `'${vals[4].replace(/'/g,"''")}'` : 'NULL'},'${vals[5].replace(/'/g,"''")}',${vals[6] ? `'${vals[6].replace(/'/g,"''")}'` : 'NULL'},${vals[7] ? `'${vals[7].replace(/'/g,"''")}'` : 'NULL'},${vals[8] ? `'${vals[8].replace(/'/g,"''")}'` : 'NULL'},${vals[9] ? `'${vals[9]}'` : 'NULL'},${vals[10] ? `'${vals[10]}'` : 'NULL'})
         ON CONFLICT DO NOTHING`
      );
      accInserted++;
    } catch (e) {
      accErrors++;
      if (accErrors <= 2) console.log(`    erro: ${e.message.slice(0, 100)}`);
    }
  }
  console.log(`  ✓ accesses: ${accInserted} inseridas, ${accErrors} erros`);

  // Fix order: equipments before assignment_items
  await importCSV('assignment_items');

  // employee_department_emails references accesses
  await importCSV('employee_department_emails');

  console.log('\n✅ Re-importação concluída!');
}

main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
