# 🔒 RELATÓRIO DE SEGURANÇA - Realize Consultadoria

## ⚠️ CRÍTICO - Falhas Graves de Segurança

### 1️⃣ CHAVES SUPABASE EXPOSTAS NO REPOSITÓRIO
**Severity: 🔴 CRÍTICO**

#### Arquivo `.service_role_key`
- **Localização:** Raiz do projeto
- **Conteúdo:** Service role JWT token com acesso total à base de dados
- **Risco:** Qualquer pessoa com acesso ao repositório pode manipular dados
- **Ação Necessária:** 
  - ❌ Remover do repositório imediatamente
  - ❌ Revogar esta chave no Supabase
  - ✅ Gerar nova chave
  - ✅ Adicionar `.service_role_key` ao `.gitignore`

#### Arquivos .mjs com Chaves Hardcoded
- `check_beatriz.mjs` (linhas 3-4)
  - SUPABASE_URL: https://jvvnsoasylusbmxfotci.supabase.co
  - SUPABASE_KEY: [chave anon exposta]
  
- `check_emails.mjs` (linha 5)
  - supabaseUrl: https://jvvnsoasylusbmxfotci.supabase.co

**Risco:** Chaves expostas no histórico Git permanentemente
**Ação Necessária:** Executar `git filter-branch` para remover do histórico

### 2️⃣ SCRIPTS DE MANUTENÇÃO SEM PROTEÇÃO
**Severity: 🟠 ALTO**

Arquivos que precisam de .env:
- `check_beatriz.mjs`
- `check_emails.mjs` 
- `check_juliano.mjs`
- `check_marta.mjs`
- `migrate.mjs`
- `final_fix.mjs`
- Etc...

**Problema:** Usam variáveis de ambiente sem validação
**Solução:** Adicionar validação e documentação .env.example

### 3️⃣ .env.local NÃO CONFIGURADO
**Severity: 🟡 MÉDIO**
- Criado arquivo `.env.local` com valores placeholder
- Precisa de credenciais reais do Supabase
- Sem isso, a app mostra tela branca

## 🔍 PROBLEMAS FUNCIONAIS

### Erro ao Criar Nova Conta
**Status:** Investigando...

Fluxo encontrado:
1. Função: `/supabase/functions/create-employee-with-password/`
2. Requer: `company_id` obrigatório
3. Validações:
   - Email único na tabela `employees`
   - Email único na tabela `auth.users`
   - Senha mínimo 8 caracteres

**Possível causa do erro:**
- Falta de `company_id` válido
- Email já existe no sistema
- Erro na função Brevo (envio de email)

## ✅ RECOMENDAÇÕES IMEDIATAS

### 1. Limpar Repositório
```bash
# Adicionar ao .gitignore
.env.local
.env
.service_role_key
*.key
dist/
node_modules/
```

### 2. Revogar Chaves Expostas
- Ir ao Supabase Dashboard
- Regenerar anonymous key
- Regenerar service role key
- Rever todos os tokens gerados

### 3. Configurar Variáveis de Ambiente
```
VITE_SUPABASE_URL=https://jvvnsoasylusbmxfotci.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[sua-chave-nova]
```

### 4. Revisar RLS Policies
Verificar que todas as tabelas têm Row Level Security ativado:
- `employees`
- `user_roles`
- `profiles`
- `employee_vacation_balances`

### 5. Documentação .env.example
```bash
# .env.example (SEM valores reais)
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
BREVO_API_KEY=your_brevo_api_key_here
```

## 🔐 CHECKLIST DE SEGURANÇA

- [ ] Remover `.service_role_key` do repositório
- [ ] Remover chaves de arquivos .mjs
- [ ] Revogar todas as chaves no Supabase
- [ ] Gerar novas chaves
- [ ] Atualizar `.env.local` com novas chaves
- [ ] Adicionar `.env.local` ao `.gitignore`
- [ ] Fazer git filter-branch para limpar histórico
- [ ] Revisar RLS policies de todas as tabelas
- [ ] Adicionar `.env.example` ao repositório
- [ ] Testar fluxo de login/criar conta
