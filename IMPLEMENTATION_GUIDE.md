// GUIA DE IMPLEMENTAÇÃO - Refatoração de Autenticação
// Este arquivo documenta as mudanças necessárias para implementar o novo sistema de autenticação

/*
╔════════════════════════════════════════════════════════════════════════════╗
║                    IMPLEMENTAÇÃO - STEP BY STEP                           ║
╚════════════════════════════════════════════════════════════════════════════╝

FASE 1: PREPARAÇÃO (1-2 horas)
═══════════════════════════════════════════════════════════════════════════

✅ Já Criado:
  • src/contexts/AuthContext.tsx - Contexto centralizado de auth
  • src/components/ProtectedRoute.tsx - Componente de proteção de rotas
  • src/lib/constants.ts - Constantes centralizadas
  • src/services/adminService.ts - Serviço de operações admin
  • src/utils/apiClient.ts - Cliente centralizado de API
  • scripts/setup-admin.mjs - Script para configurar admin

TAREFAS PENDENTES:

1. Atualizar src/App.tsx
   - Envolver aplicação com AuthProvider
   - Envolver rotas admin com ProtectedRoute
   - Envolver com GlobalErrorBoundary

2. Atualizar src/pages/admin/AdminLoginPage.tsx
   - Remover lógica local de auth
   - Usar useAuth() hook
   - Simplificar componente

3. Atualizar src/components/layout/AdminLayout.tsx
   - Usar useAuth() hook
   - Remover verificação de role (feita em ProtectedRoute)
   - Simplificar componente

4. Eliminar localStorage usage
   - Remover "auth_preference"
   - Usar Session Storage ou cookie seguro

5. Criar testes unitários
   - useAuth hook
   - AuthContext
   - ProtectedRoute


FASE 2: IMPLEMENTAÇÃO (2-3 horas)
═══════════════════════════════════════════════════════════════════════════

Passo 1: Atualizar App.tsx
──────────────────────────

import { AuthProvider } from '@/contexts/AuthContext';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Envolver a aplicação

export default function App() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<ComingSoonPage />} />
                ...

                {/* Admin Routes */}
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route 
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/admin" element={<AdminDashboard />} />
                  ...
                </Route>
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}


Passo 2: Refatorar AdminLoginPage.tsx
─────────────────────────────────────

import { useAuth } from '@/contexts/AuthContext';
import { ROUTES, ERROR_MESSAGES } from '@/lib/constants';

export default function AdminLoginPage() {
  const { login, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await login(email, password);
      toast({
        title: "Login efetuado",
        description: "Bem-vindo ao painel de administração.",
      });
      navigate(ROUTES.ADMIN.DASHBOARD);
    } catch (err: any) {
      toast({
        title: "Erro no login",
        description: err.message || ERROR_MESSAGES.AUTH.UNEXPECTED,
        variant: "destructive",
      });
    }
  };

  // ... resto do componente


Passo 3: Refatorar AdminLayout.tsx
──────────────────────────────────

import { useAuth } from '@/contexts/AuthContext';

export default function AdminLayout() {
  const { user, isLoading, logout } = useAuth();
  
  // Remover: const { data: hasAdminRole, error: rolesError } = ...
  // Já está protegido em ProtectedRoute

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  // ... resto do componente


Passo 4: Executar setup-admin.mjs
─────────────────────────────────

npm run setup:admin

Este script irá:
- Listar todos os users do sistema
- Verificar se algum tem role de admin
- Se não tiver, criar role de admin para o primeiro user
- Criar grupo de super admin


FASE 3: TESTES E VALIDAÇÃO (1-2 horas)
═══════════════════════════════════════════════════════════════════════════

Checklist de Testes:

[  ] 1. Login Admin
     - Navegar para http://localhost:3000/admin/login
     - Fazer login com credenciais de admin
     - Verificar redirecionamento para /admin
     - Verificar que dados são carregados

[  ] 2. Proteção de Rotas
     - Tentar acessar /admin sem estar logado
     - Verificar redirecionamento para /admin/login
     - Fazer logout
     - Verificar que rotas admin não são acessíveis

[  ] 3. Permissões
     - Login com user de employee
     - Verificar que não consegue acessar /admin
     - Tentar acessar diretamente /admin/login
     - Verificar mensagem de "Acesso Negado"

[  ] 4. Sessão Persistente
     - Login e recarregar página
     - Verificar que continua logado
     - Fechar browser e abrir novamente
     - Verificar que sessão foi mantida (cookies)

[  ] 5. Logout
     - Fazer logout
     - Verificar redirecionamento para /admin/login
     - Verificar que dados de user não estão em localStorage

[  ] 6. Error Handling
     - Fazer login com credenciais inválidas
     - Verificar mensagem de erro apropriada
     - Tentar fazer logout com erro
     - Verificar que error boundary mostra mensagem


FASE 4: OTIMIZAÇÕES ADICIONAIS (1 dia)
═══════════════════════════════════════════════════════════════════════════

Itens Opcionais:

1. Adicionar Refresh Token Rotation
   - Token expira a cada 1 hora
   - Refresh token permite renovação automática
   - Implementar em AuthContext

2. Implementar Session Timeout
   - Logout automático após 30 minutos de inatividade
   - Mostrar aviso antes de expirar

3. Adicionar Two-Factor Authentication (2FA)
   - Supabase suporta nativamente
   - Adicionar UI para verificação

4. Implementar Password Reset Flow
   - Usar edge function recover-password
   - Integrar com AuthContext

5. Adicionar Logging Estruturado
   - Registrar tentativas de login
   - Registrar erros de autenticação
   - Usar Sentry ou similar


PROBLEMAS CONHECIDOS E SOLUÇÕES
═══════════════════════════════════════════════════════════════════════════

Problema 1: User não consegue fazer login
Causa Provável: User não tem role de admin
Solução: Executar scripts/setup-admin.mjs

Problema 2: Rota admin redireciona para login mesmo estando logado
Causa Provável: RLS policy está bloqueando acesso
Solução: Verificar RLS policies em Supabase > Table Editor > Policies

Problema 3: Sessão não persiste após recarregar página
Causa Provável: Cookie não está siendo salvo
Solução: Verificar se navegador permite cookies
        Verificar se Supabase está configurado com httpOnly

Problema 4: Error Boundary mostra mensagem genérica
Causa Provável: Erro não foi capturado corretamente
Solução: Verificar console.log/error para mensagem de erro original


PRÓXIMOS PASSOS RECOMENDADOS
═══════════════════════════════════════════════════════════════════════════

1. Implementar Validação com Zod
   - Criar schemas para formulários
   - Validar dados antes de enviar para API

2. Criar Testes Unitários
   - useAuth hook
   - AuthContext
   - ProtectedRoute

3. Documentar API
   - JSDoc em todas as funções
   - README com exemplos de uso

4. Implementar Logging
   - Sentry para error tracking
   - Analytics para user actions

5. Melhorar Performance
   - Code splitting com lazy loading
   - Otimizar bundle size
   - Implementar caching

6. Revisar Segurança
   - Audit de XSS vulnerabilities
   - Audit de CSRF protection
   - Audit de RLS policies
*/

// Exemplo de uso do useAuth hook:

/*
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { 
    user,           // User logado (null se não logado)
    role,           // Role do user ('admin', 'employee', etc)
    isLoading,      // Se está carregando autenticação
    isAuthenticated, // Se user está autenticado
    login,          // Função para fazer login
    logout,         // Função para fazer logout
    error,          // Mensagem de erro
    clearError,     // Limpar mensagem de erro
  } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <div>
      <p>Bem-vindo, {user?.email}</p>
      <p>Role: {role}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
*/

export {};
