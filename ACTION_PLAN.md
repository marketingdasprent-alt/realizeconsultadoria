PLANO DE AÇÃO - REALIZE CONSULTADORIA
Refatoração e Melhoria de Qualidade
Data: 2026-05-11
Duração Estimada: 3 semanas


VISÃO GERAL
================================================================================

Este projeto é uma aplicação HR + Immigration Consulting que requer refatoração
significativa para atingir padrão enterprise. O trabalho foi dividido em 3 sprints
com prioridades claras.

Status Atual:
✅ Segurança: Vulnerabilidades corrigidas (keys regenerados)
⚠️  Autenticação: Funcionando mas desorganizada
⚠️  Admin: Não acessível, requer investigação
❌ Arquitetura: Código espalhado, sem padrões
❌ Testes: Nenhum teste unitário encontrado


SPRINT 1: CORREÇÃO CRÍTICA (3-4 dias)
================================================================================

Objetivo: Tornar aplicação minimamente funcional e segura

TAREFA 1.1: Configurar Acesso Admin [CRÍTICO]
───────────────────────────────────────────────────
Descrição: Permitir que user admin acesse painel administrativo

Subtarefas:
  1. Executar scripts/setup-admin.mjs
     comando: npm run setup:admin
     tempo: 30 min

  2. Verificar RLS policies no Supabase
     Localização: app.supabase.com > Table Editor > Policies
     Ação: Procurar policies com "true" sem condição
     Tempo: 1 hora

  3. Reparar RLS policies permissivas
     Arquivo: supabase/migrations/
     Ação: Criar migration que ativa RLS corretamente
     Exemplo: _fix_rls_policies.sql
     Tempo: 2 horas

  4. Testar login admin
     URL: http://localhost:3000/admin/login
     Dados: Email do primeiro user
     Expectativa: Acesso ao AdminDashboard
     Tempo: 30 min

Responsável: Dev Senior
Tempo Total: 4 horas
Resultado: Admin consegue fazer login

TAREFA 1.2: Refatorar Autenticação [CRÍTICO]
─────────────────────────────────────────────
Descrição: Centralizar lógica de autenticação

Subtarefas:
  1. Integrar AuthContext em App.tsx
     Arquivo: src/App.tsx
     Ação: Envolver <AuthProvider>
     Tempo: 30 min

  2. Refatorar AdminLoginPage.tsx
     Arquivo: src/pages/admin/AdminLoginPage.tsx
     Ação: Remover lógica local, usar useAuth()
     Tempo: 1 hora

  3. Refatorar AdminLayout.tsx
     Arquivo: src/components/layout/AdminLayout.tsx
     Ação: Usar ProtectedRoute e useAuth()
     Tempo: 1 hora

  4. Remover localStorage auth_preference
     Ação: Substituir por sessão segura
     Tempo: 1 hora

Responsável: Dev Senior
Tempo Total: 3.5 horas
Resultado: Autenticação centralizada e segura

TAREFA 1.3: Implementar Proteção de Rotas [CRÍTICO]
────────────────────────────────────────────────────
Descrição: Proteger rotas admin com ProtectedRoute

Subtarefas:
  1. Envolver rotas admin com ProtectedRoute
     Arquivo: src/App.tsx
     Ação: <ProtectedRoute requiredRole="admin">
     Tempo: 30 min

  2. Envolver com GlobalErrorBoundary
     Arquivo: src/App.tsx
     Ação: <GlobalErrorBoundary><App/></GlobalErrorBoundary>
     Tempo: 30 min

  3. Testar proteção
     Ação: Tentar acessar /admin sem login
     Expectativa: Redireciona para /admin/login
     Tempo: 30 min

Responsável: Dev Senior
Tempo Total: 1.5 horas
Resultado: Rotas protegidas adequadamente

TAREFA 1.4: Corrigir Sistema de Permissões [ALTO]
──────────────────────────────────────────────────
Descrição: Consolidar sistema fragmentado de permissões

Subtarefas:
  1. Revisar tabelas relacionadas
     Tabelas: user_roles, admin_groups, admin_permissions
     Ação: Documentar relacionamentos
     Tempo: 1 hora

  2. Criar migration para consolidar
     Ação: Simplificar para 1 tabela principal
     Tempo: 2 horas

  3. Atualizar useAdminPermissions.ts
     Arquivo: src/hooks/useAdminPermissions.ts
     Ação: Adaptar para novo schema
     Tempo: 1 hora

Responsável: Dev Senior
Tempo Total: 4 horas
Resultado: Sistema de permissões simplificado

Tempo Total Sprint 1: ~13 horas (2 dias de trabalho)
Resultado: Acesso admin funcionando, autenticação segura


SPRINT 2: ARQUITETURA E QUALIDADE (5-6 dias)
================================================================================

Objetivo: Refatorar código para padrão enterprise

TAREFA 2.1: Reorganizar Estrutura de Pastas [ALTO]
───────────────────────────────────────────────────
Descrição: Mover código para estrutura modular

Subtarefas:
  1. Criar nova estrutura
     mkdir -p src/modules/{admin,employee,auth}/pages
     mkdir -p src/modules/{admin,employee}/components
     mkdir -p src/modules/{admin,employee}/hooks
     mkdir -p src/modules/{admin,employee}/services
     Tempo: 30 min

  2. Mover arquivos admin
     Origem: src/pages/admin/*
     Destino: src/modules/admin/pages/*
     Ação: Move, atualiza imports
     Tempo: 1 hora

  3. Mover arquivos employee
     Origem: src/pages/employee/*
     Destino: src/modules/employee/pages/*
     Ação: Move, atualiza imports
     Tempo: 1 hora

  4. Criar barrel exports
     Arquivo: src/modules/*/index.ts
     Ação: Exportar componentes principais
     Tempo: 30 min

  5. Atualizar App.tsx
     Arquivo: src/App.tsx
     Ação: Atualizar todos os imports
     Tempo: 1 hora

Responsável: Dev Senior
Tempo Total: 4 horas
Resultado: Estrutura modular implementada

TAREFA 2.2: Quebrar Componentes Grandes [ALTO]
───────────────────────────────────────────────
Descrição: Dividir componentes >200 linhas

Arquivos Alvo:
  • src/pages/admin/AdminLoginPage.tsx (~250 linhas)
    Dividir em: LoginForm, ForgotPasswordForm, etc
    Tempo: 2 horas

  • src/pages/admin/AdminDashboard.tsx (~150 linhas)
    Dividir em: DashboardStats, DashboardCharts, etc
    Tempo: 1.5 horas

  • src/components/layout/AdminLayout.tsx (~200 linhas)
    Dividir em: AdminSidebar, AdminHeader, AdminNav
    Tempo: 1.5 horas

Responsável: Dev Senior
Tempo Total: 5 horas
Resultado: Componentes pequenos e focados

TAREFA 2.3: Implementar Camada de Serviços [ALTO]
──────────────────────────────────────────────────
Descrição: Criar serviços para cada entidade

Serviços a Criar:
  • employeeService.ts (métodos para employees)
  • companyService.ts (métodos para companies)
  • absenceService.ts (métodos para absences)
  • ticketService.ts (métodos para tickets)
  • authService.ts (métodos auth específicos)
  • accessService.ts (métodos de acessos)

Cada serviço deve:
  • Usar apiClient para requisições
  • Ter TypeScript tipado
  • Documentado com JSDoc
  • Error handling consistente

Tempo: 6 horas (1.5h cada serviço)

Responsável: Dev Senior
Tempo Total: 6 horas
Resultado: Camada de serviços implementada

TAREFA 2.4: Implementar Validação com Zod [MÉDIO]
──────────────────────────────────────────────────
Descrição: Adicionar validação tipada em formulários

Schema a Criar:
  • createEmployeeSchema
  • updateEmployeeSchema
  • createCompanySchema
  • loginSchema
  • resetPasswordSchema

Uso:
  const { formState: { errors } } = useForm({
    resolver: zodResolver(createEmployeeSchema),
  });

Tempo: 3 horas

Responsável: Dev Middleman
Tempo Total: 3 horas
Resultado: Validação centralizada

Tempo Total Sprint 2: ~18 horas (3 dias de trabalho)
Resultado: Arquitetura enterprise, componentes modulares


SPRINT 3: TESTES E DOCUMENTAÇÃO (3-4 dias)
================================================================================

Objetivo: Garantir qualidade e manutenibilidade

TAREFA 3.1: Implementar Testes Unitários [CRÍTICO]
──────────────────────────────────────────────────
Descrição: Adicionar testes para funções críticas

Setup:
  npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
  Criar vitest.config.ts

Testes a Implementar:

  1. useAuth hook (auth.test.ts)
     • Test login com credenciais válidas
     • Test login com credenciais inválidas
     • Test logout
     • Test checkAuth ao carregar
     Cobertura: 80%
     Tempo: 2 horas

  2. AuthContext (AuthContext.test.tsx)
     • Test provider initialization
     • Test user state changes
     • Test role verification
     Cobertura: 75%
     Tempo: 1.5 horas

  3. ProtectedRoute (ProtectedRoute.test.tsx)
     • Test acesso com role correto
     • Test acesso com role errado
     • Test acesso sem autenticação
     Cobertura: 85%
     Tempo: 1.5 horas

  4. adminService (adminService.test.ts)
     • Test getCompanies
     • Test getEmployees
     • Test createEmployee error handling
     Cobertura: 70%
     Tempo: 2 horas

Total Testes: 7 horas
Cobertura Mínima: 70%

Responsável: Dev QA + Dev Senior
Tempo Total: 7 horas
Resultado: Suite de testes implementada

TAREFA 3.2: Testes E2E [MÉDIO]
──────────────────────────────
Descrição: Adicionar testes end-to-end

Setup:
  npm install --save-dev cypress

Casos de Teste:
  1. Login admin flow
     • Navegar para /admin/login
     • Preencher form
     • Verificar redirecionamento
     • Verificar dados carregados
     Tempo: 2 horas

  2. Criar novo colaborador
     • Login como admin
     • Navegar para /admin/colaboradores/novo
     • Preencher form
     • Verificar sucesso
     Tempo: 2 horas

  3. Logout flow
     • Login
     • Clicar logout
     • Verificar redirecionamento
     • Verificar que rotas privadas não são acessíveis
     Tempo: 1 hora

Total Testes E2E: 5 horas

Responsável: Dev QA
Tempo Total: 5 horas
Resultado: Testes E2E coverage de happy path

TAREFA 3.3: Documentação [MÉDIO]
─────────────────────────────────
Descrição: Documentar código e processos

Documentação a Criar:

  1. README.md atualizado
     • Setup do projeto
     • Variáveis de ambiente
     • Scripts disponíveis
     • Troubleshooting
     Tempo: 1 hora

  2. API Documentation
     Arquivo: SUPABASE_API.md
     Conteúdo: Edge functions, RPCs, tabelas
     Tempo: 2 horas

  3. JSDoc em funções principais
     Componentes: ~20 funções principais
     Tempo: 2 horas

  4. Guia de Contribuição
     Arquivo: CONTRIBUTING.md
     Conteúdo: Git workflow, padrões, PR process
     Tempo: 1 hora

  5. Changelog
     Arquivo: CHANGELOG.md
     Conteúdo: Versões, mudanças, breaking changes
     Tempo: 1 hora

Total Documentação: 7 horas

Responsável: Dev Senior + Tech Writer
Tempo Total: 7 horas
Resultado: Documentação completa

TAREFA 3.4: CI/CD Setup [MÉDIO]
─────────────────────────────────
Descrição: Automatizar testes e deploy

Setup GitHub Actions:

  1. Lint & Format
     Arquivo: .github/workflows/lint.yml
     Ação: ESLint + Prettier em cada PR
     Tempo: 30 min

  2. Test
     Arquivo: .github/workflows/test.yml
     Ação: Rodar testes unitários em cada PR
     Tempo: 30 min

  3. Build
     Arquivo: .github/workflows/build.yml
     Ação: Build do Vite em cada commit
     Tempo: 30 min

  4. Deploy
     Arquivo: .github/workflows/deploy.yml
     Ação: Deploy automático ao Vercel
     Tempo: 1 hora

Total CI/CD: 2.5 horas

Responsável: DevOps Engineer
Tempo Total: 2.5 horas
Resultado: Pipelines de CI/CD funcionando

Tempo Total Sprint 3: ~21.5 horas (3-4 dias de trabalho)
Resultado: Testes, documentação, CI/CD implementados


TAREFAS OPCIONAIS (Nice to Have)
================================================================================

TAREFA 4.1: Implementar Session Timeout [BAIXO]
────────────────────────────────────────────────
Descrição: Logout automático após inatividade
Tempo: 2 horas
Prioridade: Baixa

TAREFA 4.2: Adicionar 2FA [BAIXO]
─────────────────────────────────
Descrição: Two-factor authentication
Tempo: 4 horas
Prioridade: Baixa

TAREFA 4.3: Implementar Logging com Sentry [MÉDIO]
───────────────────────────────────────────────────
Descrição: Error tracking em produção
Tempo: 3 horas
Prioridade: Média

TAREFA 4.4: Otimizar Bundle Size [MÉDIO]
──────────────────────────────────────────
Descrição: Code splitting, lazy loading
Tempo: 2 horas
Prioridade: Média

TAREFA 4.5: Implementar Performance Monitoring [BAIXO]
──────────────────────────────────────────────────────
Descrição: Web Vitals, análise de performance
Tempo: 2 horas
Prioridade: Baixa


TIMELINE RESUMIDA
================================================================================

Semana 1 (Sprint 1):
  Segunda: Configurar Admin + Refatorar Autenticação (8h)
  Terça: Proteção de Rotas + Sistema de Permissões (5h)

Semana 2-3 (Sprint 2):
  Seg-Ter: Reorganizar Estrutura (8h)
  Qua-Qui: Quebrar Componentes + Serviços (11h)
  Sex: Validação com Zod (3h)

Semana 3-4 (Sprint 3):
  Seg-Ter: Testes Unitários (7h)
  Qua: Testes E2E (5h)
  Qui-Sex: Documentação + CI/CD (9.5h)


CRITÉRIOS DE SUCESSO
================================================================================

✅ Autenticação:
   • User admin consegue fazer login
   • Rotas são protegidas corretamente
   • Session persiste ao recarregar página
   • Logout remove session adequadamente

✅ Arquitetura:
   • Código organizado em módulos
   • Sem duplicação de lógica
   • Componentes <150 linhas em média
   • Services para todas as operações

✅ Qualidade:
   • ESLint passa em todos os arquivos
   • 70%+ cobertura de testes
   • Sem console.log em produção
   • TypeScript sem erros

✅ Segurança:
   • RLS policies funcionando
   • Sem hardcoded secrets
   • CSRF protection implementada
   • Rate limiting no login

✅ Performance:
   • Bundle size < 500KB (gzipped)
   • Time to Interactive < 3s
   • Lighthouse score > 80


RESPONSABILIDADES
================================================================================

Dev Senior:
  • Sprints 1, 2 (arquitetura)
  • Code review
  • Documentação arquitetura

Dev Middleman:
  • Implementar Zod validation
  • Quebrar componentes
  • Testes

Dev QA:
  • Testes E2E
  • Verificação de funcionalidades
  • Documentação de casos de teste

DevOps:
  • CI/CD setup
  • Deploy automation
  • Monitoring


RISCOS E MITIGAÇÕES
================================================================================

Risco 1: Admin não consegue fazer login mesmo após fix
Mitigation:
  • Verificar RLS policies
  • Verificar user_roles table
  • Consultar Supabase logs
  • Timeout: 1 dia, escalar se não resolver

Risco 2: Break de funcionalidade durante refatoração
Mitigation:
  • Fazer testes antes e depois de cada mudança
  • Usar branches para cada feature
  • Code review obrigatório

Risco 3: Testes ficam desatualizados com código
Mitigation:
  • Manter testes junto com código
  • TDD quando possível
  • Review de testes em PR


PRÓXIMOS PASSOS (APÓS OS 3 SPRINTS)
================================================================================

1. Performance Optimization
   • Lazy loading de componentes
   • Otimizar queries
   • Cache estratégico

2. Adicionar Mais Funcionalidades
   • 2FA
   • Password reset flow
   • User profile management

3. Melhorar UX
   • Animations
   • Micro-interactions
   • Accessibility improvements

4. Analytics
   • User behavior tracking
   • Error tracking com Sentry
   • Performance monitoring


---
Plano preparado por: Dev Senior
Data: 2026-05-11
Próxima Review: 2026-05-18
