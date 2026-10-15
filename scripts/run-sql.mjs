#!/usr/bin/env node
// Corre SQL na BD de produção da Realize (Supabase jvvnsoasylusbmxfotci) pela Management API.
//
// Uso:
//   node scripts/run-sql.mjs supabase/migrations/<ficheiro>.sql
//   node scripts/run-sql.mjs --query "SELECT count(*) FROM public.employees"
//
// O ficheiro corre como um único pedido: se uma instrução falhar, nada fica aplicado.
// Mostra o resultado da última instrução.
//
// Token: variável de ambiente SUPABASE_ACCESS_TOKEN (token pessoal "sbp_…", criado em
// supabase.com → Account → Access Tokens). No Windows, se o processo ainda não a tem
// (o setx só vale para programas abertos depois), lê-a das variáveis do utilizador.
// O token nunca é impresso.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'jvvnsoasylusbmxfotci';
const MAX_ROWS = 200;

const readToken = () => {
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
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

const readSql = args => {
  if (args[0] === '--query') return args.slice(1).join(' ');
  if (args[0]) return fs.readFileSync(args[0], 'utf8');
  return null;
};

const main = async () => {
  const sql = readSql(process.argv.slice(2));
  if (!sql?.trim()) {
    console.error('Uso: node scripts/run-sql.mjs <ficheiro.sql> | --query "SQL"');
    return 2;
  }
  const token = readToken();
  if (!token) {
    console.error(
      'Falta o token: defina SUPABASE_ACCESS_TOKEN (supabase.com → Account → Access Tokens).'
    );
    return 2;
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Erro ${res.status}: ${text.slice(0, 2000)}`);
    return 1;
  }

  const rows = text ? JSON.parse(text) : [];
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('OK (sem linhas devolvidas)');
    return 0;
  }
  for (const row of rows.slice(0, MAX_ROWS)) console.log(JSON.stringify(row));
  if (rows.length > MAX_ROWS) console.log(`… mais ${rows.length - MAX_ROWS} linhas`);
  return 0;
};

// exitCode em vez de process.exit: no Windows o exit com pedidos ainda abertos rebenta o libuv.
main().then(
  code => {
    process.exitCode = code;
  },
  error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
);
