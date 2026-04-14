import { parse } from 'csv-parse/sync';
import fs from 'fs';

const CSV_DIR = './Importar';
const TOKEN = 'sbp_1f7d2c31efdf191009f56bc3041e9cf3ee373168';
const REF = 'jvvnsoasylusbmxfotci';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dm5zb2FzeWx1c2JteGZvdGNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA1MDUyNCwiZXhwIjoyMDkwNjI2NTI0fQ.bSpoekoIJMo4gwZDYNHVCqL7VOauKSryvShBN_p2tog';
const SUPABASE_URL = 'https://jvvnsoasylusbmxfotci.supabase.co';

async function sqlQuery(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || JSON.stringify(d));
  return d;
}

async function insertBatch(table, rows) {
  const cleaned = rows.map(row =>
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.hint || String(res.status));
  }
  return cleaned.length;
}

function readCSV(table) {
  return parse(fs.readFileSync(`${CSV_DIR}/${table}.csv`, 'utf8'), {
    columns: true, skip_empty_lines: true, relaxQuotes: true, relaxColumnCount: true
  });
}

// ── DIAGNOSTICS ──────────────────────────────────────────────────────────────
console.log('🔍 Verificando contagens...\n');
const tables = ['absences','accesses','notifications','support_tickets'];
const issues = [];

for (const t of tables) {
  const rows = readCSV(t);
  const [{ count }] = await sqlQuery(`SELECT COUNT(*) FROM public."${t}"`);
  const diff = rows.length - Number(count);
  const status = diff === 0 ? '✅' : `❌ faltam ${diff}`;
  console.log(`  ${t.padEnd(25)} CSV: ${rows.length}  DB: ${count}  ${status}`);
  if (diff > 0) issues.push({ table: t, rows, dbCount: Number(count) });
}

if (issues.length === 0) {
  console.log('\n✅ Tudo migrado!');
  process.exit(0);
}

// ── FIXES ─────────────────────────────────────────────────────────────────────
console.log('\n🔧 A corrigir...\n');

for (const { table, rows } of issues) {
  if (table === 'accesses') {
    // password NOT NULL — fill empty password with placeholder
    let ok = 0, fail = 0;
    for (const row of rows) {
      const cleaned = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, v === '' ? null : v])
      );
      if (!cleaned.password) cleaned.password = '(sem password)';
      const res = await fetch(`${SUPABASE_URL}/rest/v1/accesses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=ignore-duplicates,return=minimal',
        },
        body: JSON.stringify([cleaned]),
      });
      if (res.ok) ok++; else fail++;
    }
    console.log(`  ✓ accesses: ${ok} inseridas, ${fail} erros`);
  } else {
    // For absences, notifications, support_tickets — retry full table
    const BATCH = 50;
    let inserted = 0, errors = 0, lastErr = '';
    for (let i = 0; i < rows.length; i += BATCH) {
      try {
        inserted += await insertBatch(table, rows.slice(i, i + BATCH));
      } catch (e) {
        errors += Math.min(BATCH, rows.length - i);
        lastErr = e.message.slice(0, 120);
      }
    }
    if (errors > 0) {
      console.log(`  ⚠ ${table}: ${inserted} inseridas, ${errors} erros — ${lastErr}`);
    } else {
      console.log(`  ✓ ${table}: ${inserted} (total, duplicados ignorados)`);
    }
  }
}

// ── FINAL CHECK ───────────────────────────────────────────────────────────────
console.log('\n📊 Contagem final:\n');
for (const t of tables) {
  const rows = readCSV(t);
  const [{ count }] = await sqlQuery(`SELECT COUNT(*) FROM public."${t}"`);
  const diff = rows.length - Number(count);
  console.log(`  ${t.padEnd(25)} CSV: ${rows.length}  DB: ${count}  ${diff === 0 ? '✅' : `❌ faltam ${diff}`}`);
}
