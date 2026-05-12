# 🛠️ AÇÕES URGENTES - Checklist de Correção

## 1️⃣ REMOVER CHAVES EXPOSTAS (HOJE!)

### Passo 1: Limpar arquivos
```bash
# Remover arquivo com service role key
Remove-Item -Path ".service_role_key" -Force

# Remover chaves de arquivos .mjs
# Editar: check_beatriz.mjs, check_emails.mjs
# Substituir URLs/chaves hardcoded por variáveis de ambiente
```

### Passo 2: Atualizar .gitignore
```bash
# Adicionar ao .gitignore (raiz do projeto):
.env
.env.local
.service_role_key
*.key
.env.*.local
dist/
node_modules/
```

### Passo 3: Limpar histórico Git
```bash
# CUIDADO: Isso reescreve o histórico!
git filter-branch --tree-filter 'rm -f .service_role_key' -- --all

# Ou usar git filter-repo (mais seguro):
pip install git-filter-repo
git filter-repo --path .service_role_key --invert-paths
```

### Passo 4: Revogar Chaves no Supabase
1. Aceder a https://app.supabase.com
2. Ir para Project Settings > API > Keys & Tokens
3. **Regenerar** Anonymous Key (VITE_SUPABASE_PUBLISHABLE_KEY)
4. **Regenerar** Service Role Key
5. Copiar nova **Anonymous Key** → `.env.local`

## 2️⃣ CONFIGURAR VARIÁVEIS DE AMBIENTE

### Criar .env.local com:
```bash
VITE_SUPABASE_URL=https://jvvnsoasylusbmxfotci.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<NOVA_CHAVE_ANONIMA_AQUI>
```

### Criar .env.example (SEM valores reais):
```bash
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
BREVO_API_KEY=your_brevo_api_key_here
```

## 3️⃣ CORRIGIR ARQUIVOS .mjs (Scripts)

### Converter para usar variáveis de ambiente

**Antes:**
```typescript
const SUPABASE_URL = "https://jvvnsoasylusbmxfotci.supabase.co";
const SUPABASE_KEY = "eyJhbGc...";
```

**Depois:**
```typescript
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}
```

**Arquivos a corrigir:**
- check_beatriz.mjs
- check_emails.mjs
- check_juliano.mjs
- check_marta.mjs
- migrate.mjs
- E outros .mjs files

## 4️⃣ INVESTIGAÇÃO: Erro ao Criar Conta

### Possíveis Causas:
1. ✅ **Supabase não configurado** → Sem variáveis de ambiente
2. ❓ **Função Edge falha** → Verificar logs do Supabase
3. ❓ **Email não é único** → Tenta criar conta com email já existente
4. ❓ **Company_id inválido** → Empresa não existe ou não está ativa
5. ❓ **Brevo API offline** → Email não consegue enviar

### Como Diagnosticar:
1. Abrir DevTools (F12) → Console
2. Criar nova conta via Admin
3. Procurar erros na aba Network
4. Verificar resposta da função `create-employee-with-password`

### Logs no Supabase:
1. https://app.supabase.com
2. Project > Logs > Edge Functions
3. Procurar erros em `create-employee-with-password`

## 5️⃣ TESTES A FAZER

- [ ] Criar novo colaborador via admin
- [ ] Verificar se email foi recebido
- [ ] Logar com credenciais da nova conta
- [ ] Verificar se acesso é negado se not employee
- [ ] Testar recuperação de senha
- [ ] Testar login admin
- [ ] Verificar RLS policies (queries não autorizadas devem falhar)

## 6️⃣ CÓDIGO EXEMPLO - Corrigir .mjs

**check_beatriz.mjs (ANTES):**
```typescript
const SUPABASE_URL = "https://jvvnsoasylusbmxfotci.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

**check_beatriz.mjs (DEPOIS):**
```typescript
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ ERRO: Configure as variáveis de ambiente:');
  console.error('  set SUPABASE_URL=your_url');
  console.error('  set SUPABASE_SERVICE_ROLE_KEY=your_key');
  process.exit(1);
}
```

---

## ⏰ CRONOGRAMA

**HOJE (máxima prioridade):**
- [ ] Remover .service_role_key do projeto
- [ ] Remover chaves de arquivos .mjs
- [ ] Adicionar .gitignore
- [ ] Regenerar chaves no Supabase
- [ ] Atualizar .env.local

**ESTA SEMANA:**
- [ ] Converter todos .mjs para usar env vars
- [ ] Criar .env.example
- [ ] Revisar RLS policies
- [ ] Diagnosticar erro de login/criar conta

**Feedback do usuário:**
- [ ] Quando tiver chaves regeneradas, atualizar .env.local
- [ ] Testar criação de conta e reportar erro específico
