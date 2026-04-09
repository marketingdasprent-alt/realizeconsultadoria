import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://jvvnsoasylusbmxfotci.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dm5zb2FzeWx1c2JteGZvdGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNTA1MjQsImV4cCI6MjA5MDYyNjUyNH0.uTsDGNYrin5bemer5vciSYV14IaWC74kQ3L2l6zUalg";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runDiagnostic() {
    console.log("=== INVESTIGAÇÃO GERAL (OUTRAS TABELAS) ===");
    
    // 1. Verificar Profiles (Administradores/Utilizadores base)
    const { data: profiles } = await supabase.from('profiles').select('name, email');
    console.log(`\nProfiles no sistema: ${profiles?.length || 0}`);
    profiles?.forEach(p => console.log(`- Profile: ${p.name} (${p.email})`));

    // 2. Verificar Acessos (Onde guardas as senhas)
    const { data: accesses } = await supabase.from('accesses').select('title, username').ilike('username', '%juliano%');
    console.log(`\nAcessos com 'juliano': ${accesses?.length || 0}`);
    accesses?.forEach(a => console.log(`- Acesso: ${a.title} (${a.username})`));

    // 3. Verificar Employees novamente (com filtro mais largo)
    const { data: allEmps } = await supabase.from('employees').select('id, name');
    console.log(`\nContagem final na tabela Employees: ${allEmps?.length || 0}`);
}

runDiagnostic();
