#!/usr/bin/env node
// Lê os registos das edge functions (tempos de resposta, erros) pela Management API da Supabase.
// Uso: node scripts/edge-logs.mjs "<SQL sobre function_edge_logs>" [horas]
// Token: o mesmo do run-sql.mjs (SUPABASE_ACCESS_TOKEN no ambiente ou no registo HKCU).
import { execFileSync } from 'node:child_process';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'jvvnsoasylusbmxfotci';

const readToken = () => {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (fromEnv && fromEnv.length > 20) return fromEnv;
  if (process.platform !== 'win32') return null;
  try {
    const key = ['HKCU', 'Environment'].join(String.fromCharCode(92));
    const out = execFileSync('reg', ['query', key, '/v', 'SUPABASE_ACCESS_TOKEN'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.match(/SUPABASE_ACCESS_TOKEN\s+REG_\w+\s+(\S+)/)?.[1] ?? null;
  } catch {
    return null;
  }
};

const sql = process.argv[2];
const hours = Number(process.argv[3] ?? 24);
if (!sql) {
  console.error('Uso: node scripts/edge-logs.mjs "<SQL>" [horas]');
  process.exit(2);
}
const token = readToken();
if (!token) {
  console.error('Falta o token (SUPABASE_ACCESS_TOKEN).');
  process.exit(2);
}
const end = new Date();
const start = new Date(end.getTime() - hours * 3_600_000);
const url = new URL(`https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs`);
url.searchParams.set('sql', sql);
url.searchParams.set('iso_timestamp_start', start.toISOString());
url.searchParams.set('iso_timestamp_end', end.toISOString());
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const text = await res.text();
if (!res.ok) {
  console.error(`Erro ${res.status}: ${text.slice(0, 500)}`);
  process.exit(1);
}
const body = JSON.parse(text);
if (body.error) {
  console.error(JSON.stringify(body.error).slice(0, 800));
  process.exit(1);
}
for (const row of body.result ?? []) console.log(JSON.stringify(row));
