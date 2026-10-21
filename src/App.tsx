import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppManifestSync } from '@/components/AppManifestSync';
import { isAdminHost } from '@/lib/app-manifest';
import { ROUTES } from '@/lib/constants';
import { persistQueries, restoreQueries } from '@/lib/query-persist';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import AdminLayout from './components/layout/AdminLayout';
import { WorkdayProvider } from './modules/timeclock/context/WorkdayProvider';
import WorkspaceLayout from './modules/workspace/components/WorkspaceLayout';
import { ALL_MODULES } from './modules/workspace/lib/navigation';
import MessengerPage from './modules/messenger/pages/MessengerPage';
import RequestsRedirect from './modules/admin/pages/RequestsRedirect';

const ComingSoonPage = lazy(() => import('./pages/ComingSoonPage'));
const Index = lazy(() => import('./pages/Index'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const CookiesPolicyPage = lazy(() => import('./pages/CookiesPolicyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const AdminLoginPage = lazy(() => import('./modules/admin/pages/AdminLoginPage'));
const AdminDashboard = lazy(() => import('./modules/admin/pages/AdminDashboard'));
const CompaniesPage = lazy(() => import('./modules/admin/pages/CompaniesPage'));
const EmployeesPage = lazy(() => import('./modules/admin/pages/EmployeesPage'));
const EmployeeFormPage = lazy(() => import('./modules/admin/pages/EmployeeFormPage'));
const CalendarPage = lazy(() => import('./modules/admin/pages/CalendarPage'));
const SettingsPage = lazy(() => import('./modules/admin/pages/SettingsPage'));
const FinancePage = lazy(() => import('./modules/admin/pages/FinancePage'));
const SupportTicketsPage = lazy(() => import('./modules/admin/pages/SupportTicketsPage'));
const AccessesPage = lazy(() => import('./modules/admin/pages/AccessesPage'));
const LegalPage = lazy(() => import('./modules/admin/pages/LegalPage'));
const EmployeeLoginPage = lazy(() => import('./modules/employee/pages/EmployeeLoginPage'));
const SupportPage = lazy(() => import('./modules/support/pages/SupportPage'));
const MyDocumentsPage = lazy(() => import('./modules/documents/pages/MyDocumentsPage'));
const PersonalDocumentsPage = lazy(() => import('./modules/documents/pages/PersonalDocumentsPage'));
const MyTimeClockPage = lazy(() => import('./modules/timeclock/pages/MyTimeClockPage'));
const TimeClockNfcPage = lazy(() => import('./modules/timeclock/pages/TimeClockNfcPage'));
const TimeClockAdminPage = lazy(() => import('./modules/timeclock/pages/TimeClockAdminPage'));
const ModuleComingSoonPage = lazy(() => import('./modules/workspace/pages/ModuleComingSoonPage'));
const ProfilePage = lazy(() => import('./modules/workspace/pages/ProfilePage'));
const AccountSettingsPage = lazy(() => import('./modules/workspace/pages/SettingsPage'));
const WebmailPage = lazy(() => import('./modules/webmail/pages/WebmailPage'));
const TasksPage = lazy(() => import('./modules/tasks/pages/TasksPage'));
const MyCalendarPage = lazy(() => import('./modules/calendar/pages/CalendarPage'));
const OrgChartPage = lazy(() => import('./modules/social/pages/OrgChartPage'));
const FeedPage = lazy(() => import('./modules/social/pages/FeedPage'));
const AbsencesPage = lazy(() => import('./modules/absences/pages/AbsencesPage'));
const PeoplePage = lazy(() => import('./modules/social/pages/PeoplePage'));
const AiPage = lazy(() => import('./modules/ai/pages/AiPage'));
const ColleagueProfilePage = lazy(() => import('./modules/social/pages/ColleagueProfilePage'));
const AppreciationsPage = lazy(() => import('./modules/social/pages/AppreciationsPage'));
const AuthCallbackPage = lazy(() => import('./pages/auth/AuthCallbackPage'));
const SetPasswordPage = lazy(() => import('./pages/auth/SetPasswordPage'));
const AccountSwitchPage = lazy(() => import('./pages/auth/AccountSwitchPage'));
const InstallPage = lazy(() => import('./pages/InstallPage'));
const DeleteAccountPage = lazy(() => import('./pages/DeleteAccountPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Dados em cache durante 1 min: voltar a uma página mostra-a logo (e atualiza em segundo plano);
// sem pedidos novos só por mudar de janela.
const queryClient = new QueryClient({
  defaultOptions: {
    // gcTime longo: o que veio do aparelho (query-persist) não se perde antes de abrir a página.
    queries: { staleTime: 60_000, gcTime: 24 * 3600_000, refetchOnWindowFocus: false, retry: 1 },
  },
});
// O que se viu da última vez aparece logo; a versão nova chega em segundo plano.
restoreQueries(queryClient);
persistQueries(queryClient);

// Pré-visualização do Realize 2.0 com dados de exemplo: só em desenvolvimento.
const WorkspacePreview = import.meta.env.DEV
  ? lazy(() => import('./modules/workspace/preview/WorkspacePreview'))
  : null;

// Módulos do Realize 2.0 ainda por construir (página "Em construção").
// (o Webmail já tem o ecrã de escolha da caixa de correio)
const PLANNED_MODULES = ALL_MODULES.filter(module => !module.ready);

const App = () => (
  <GlobalErrorBoundary>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppManifestSync />
            <Suspense fallback={null}>
              <Routes>
                {/* Public Routes */}
                <Route
                  path="/"
                  element={
                    // admin.realizeconsultadoria.pt abre logo o painel de administração.
                    isAdminHost(window.location.hostname) ? (
                      <Navigate to={ROUTES.ADMIN.DASHBOARD} replace />
                    ) : (
                      <ComingSoonPage />
                    )
                  }
                />
                <Route path="/site" element={<Index />} />
                <Route path="/instalar" element={<InstallPage />} />
                <Route path="/politica-privacidade" element={<PrivacyPolicyPage />} />
                <Route path="/cookies" element={<CookiesPolicyPage />} />
                <Route path="/termos-condicoes" element={<TermsPage />} />
                <Route path="/eliminar-conta" element={<DeleteAccountPage />} />

                {/* Auth Callback */}
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/auth/set-password" element={<SetPasswordPage />} />
                <Route path={ROUTES.AUTH.SWITCH} element={<AccountSwitchPage />} />

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
                  <Route path="/admin/juridico" element={<LegalPage />} />
                  <Route path="/admin/empresas" element={<CompaniesPage />} />
                  <Route path="/admin/colaboradores" element={<EmployeesPage />} />
                  <Route path="/admin/colaboradores/novo" element={<EmployeeFormPage />} />
                  <Route path="/admin/colaboradores/:id" element={<EmployeeFormPage />} />
                  <Route path="/admin/calendario" element={<CalendarPage />} />
                  {/* Pedidos passou para Férias e Ausências (aba Pedidos) */}
                  <Route path="/admin/pedidos" element={<RequestsRedirect />} />
                  <Route path="/admin/suporte" element={<SupportTicketsPage />} />
                  <Route path="/admin/acessos" element={<AccessesPage />} />
                  <Route path="/admin/ponto" element={<TimeClockAdminPage />} />
                  {/* Documentos passou para Colaboradores (aprovar, importar recibos, validades) */}
                  <Route
                    path="/admin/documentos"
                    element={<Navigate to="/admin/colaboradores" replace />}
                  />
                  <Route path="/admin/financeiro" element={<FinancePage />} />
                  <Route path="/admin/configuracoes" element={<SettingsPage />} />
                </Route>

                {/* Employee Routes */}
                <Route path="/colaborador/login" element={<EmployeeLoginPage />} />
                <Route
                  element={
                    <ProtectedRoute requiredRole="employee" fallbackPath="/colaborador/login">
                      {/* Realize 2.0: jornada (relógio da barra superior) partilhada por toda a
                        área; menu lateral + barra superior, as páginas renderizam no Outlet */}
                      <WorkdayProvider>
                        <WorkspaceLayout />
                      </WorkdayProvider>
                    </ProtectedRoute>
                  }
                >
                  {/* O Messenger é a página inicial (briefing §2) */}
                  <Route path="/colaborador" element={<MessengerPage />} />
                  <Route path="/colaborador/perfil" element={<ProfilePage />} />
                  {/* Páginas atuais, sem alterações, até serem redesenhadas (Fase 3) */}
                  <Route path="/colaborador/pedidos" element={<AbsencesPage />} />
                  <Route path="/colaborador/tickets" element={<SupportPage />} />
                  <Route path="/colaborador/documentos" element={<MyDocumentsPage />} />
                  <Route
                    path="/colaborador/definicoes/documentos"
                    element={<PersonalDocumentsPage />}
                  />
                  <Route path="/colaborador/ponto" element={<MyTimeClockPage />} />
                  {/* Fase 2: Feed (com os avisos dos RH), colegas e apreciações */}
                  <Route path="/colaborador/feed" element={<FeedPage />} />
                  <Route
                    path="/colaborador/avisos"
                    element={<Navigate to="/colaborador/feed?filtro=comunicados" replace />}
                  />
                  <Route path="/colaborador/pessoas" element={<PeoplePage />} />
                  <Route path="/colaborador/pessoas/:userId" element={<ColleagueProfilePage />} />
                  <Route path="/colaborador/apreciacoes" element={<AppreciationsPage />} />
                  <Route path="/colaborador/email" element={<WebmailPage />} />
                  <Route path="/colaborador/tarefas" element={<TasksPage />} />
                  <Route path="/colaborador/calendario" element={<MyCalendarPage />} />
                  <Route path="/colaborador/organograma" element={<OrgChartPage />} />
                  <Route path="/colaborador/ai" element={<AiPage />} />
                  <Route path="/colaborador/definicoes" element={<AccountSettingsPage />} />
                  {/* O antigo "Mais" passou para o Menu (telemóvel) e para as Definições */}
                  <Route
                    path="/colaborador/mais"
                    element={<Navigate to="/colaborador/definicoes" replace />}
                  />
                  {PLANNED_MODULES.map(module => (
                    <Route
                      key={module.key}
                      path={`/colaborador/${module.path}`}
                      element={<ModuleComingSoonPage moduleKey={module.key} />}
                    />
                  ))}
                </Route>

                {WorkspacePreview && (
                  <Route
                    path="/dev/realize-2/*"
                    element={
                      <Suspense fallback={null}>
                        <WorkspacePreview />
                      </Suspense>
                    }
                  />
                )}

                {/* Registo de ponto por tag NFC: aberto pelo telemóvel ao encostar à tag.
                  Sem sessão → login do colaborador, que depois regressa aqui. */}
                <Route
                  path="/ponto/nfc"
                  element={
                    <ProtectedRoute fallbackPath="/colaborador/login">
                      <WorkdayProvider>
                        <TimeClockNfcPage />
                      </WorkdayProvider>
                    </ProtectedRoute>
                  }
                />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  </GlobalErrorBoundary>
);

export default App;
