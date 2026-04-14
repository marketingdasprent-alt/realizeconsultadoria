import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Tentar carregar variáveis do .env ou do client.ts se existir
const supabaseUrl = 'https://jvvnsoasylusbmxfotci.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Preciso de service role para ver tudo se RLS travar

if (!supabaseKey) {
  console.log('ERRO: SUPABASE_SERVICE_ROLE_KEY não encontrada no ambiente.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJuliano() {
  console.log('=== DIAGNÓSTICO SALDO JULIANO ===');

  // 1. Encontrar Juliano
  const { data: employees, error: empErr } = await supabase
    .from('employees')
    .select('id, name, email')
    .ilike('name', '%Juliano%');

  if (empErr || !employees?.length) {
    console.error('Juliano não encontrado:', empErr || 'Nenhum resultado');
    return;
  }

  const juliano = employees[0];
  console.log(`Juliano ID: ${juliano.id} (${juliano.name})`);

  // 2. Ver saldo
  const { data: balance, error: balErr } = await supabase
    .from('employee_vacation_balances')
    .select('*')
    .eq('employee_id', juliano.id)
    .eq('year', 2026);

  console.log('\n--- Saldo em 2026 ---');
  console.table(balance);

  // 3. Ver ausências
  const { data: absences, error: absErr } = await supabase
    .from('absences')
    .select('id, absence_type, status, start_date, end_date')
    .eq('employee_id', juliano.id);

  console.log('\n--- Ausências ---');
  console.table(absences || []);

  // 4. Ver períodos
  if (absences?.length) {
    const { data: periods, error: perErr } = await supabase
      .from('absence_periods')
      .select('id, absence_id, start_date, end_date, business_days, status')
      .in('absence_id', absences.map(a => a.id));

    console.log('\n--- Períodos ---');
    console.table(periods || []);
    
    // Calcular o que o TRIGGER deveria estar a calcular
    const filteredPeriods = (periods || []).filter(p => {
        const abs = absences.find(a => a.id === p.absence_id);
        return abs && abs.status === 'approved' && (abs.absence_type === 'vacation' || abs.absence_type === 'ferias');
    });

    const totalBusinessDays = filteredPeriods.reduce((sum, p) => sum + p.business_days, 0);
    console.log(`\nSoma calculada de dias de férias aprovados: ${totalBusinessDays}`);
  } else {
    console.log('Nenhuma ausência encontrada.');
  }
}

checkJuliano();
