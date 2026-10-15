import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import AdminLayout from './components/layout/AdminLayout';
import ComingSoonPage from './pages/ComingSoonPage';
import Index from './pages/Index';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import CookiesPolicyPage from './pages/CookiesPolicyPage';
import TermsPage from './pages/TermsPage';
import AdminLoginPage from './modules/admin/pages/AdminLoginPage';
import AdminDashboard from './modules/admin/pages/AdminDashboard';
import CompaniesPage from './modules/admin/pages/CompaniesPage';
import EmployeesPage from './modules/admin/pages/EmployeesPage';
import EmployeeFormPage from './modules/admin/pages/EmployeeFormPage';
import CalendarPage from './modules/admin/pages/CalendarPage';
import SettingsPage from './modules/admin/pages/SettingsPage';
import AbsenceRequestsPage from './modules/admin/pages/AbsenceRequestsPage';
import SupportTicketsPage from './modules/admin/pages/SupportTicketsPage';
import AccessesPage from './modules/admin/pages/AccessesPage';
import LegalPage from './modules/admin/pages/LegalPage';
import EmployeeLoginPage from './modules/employee/pages/EmployeeLoginPage';
import SupportPage from './modules/support/pages/SupportPage';
import MyDocumentsPage from './modules/documents/pages/MyDocumentsPage';
import MyTimeClockPage from './modules/timeclock/pages/MyTimeClockPage';
import TimeClockNfcPage from './modules/timeclock/pages/TimeClockNfcPage';
import TimeClockAdminPage from './modules/timeclock/pages/TimeClockAdminPage';
import { WorkdayProvider } from './modules/timeclock/context/WorkdayProvider';
import DocumentsAdminPage from './modules/documents/pages/DocumentsAdminPage';
import WorkspaceLayout from './modules/workspace/components/WorkspaceLayout';
import { ALL_MODULES } from './modules/workspace/lib/navigation';
import ModuleComingSoonPage from './modules/workspace/pages/ModuleComingSoonPage';
import ProfilePage from './modules/workspace/pages/ProfilePage';
import AccountSettingsPage from './modules/workspace/pages/SettingsPage';
import WebmailPage from './modules/webmail/pages/WebmailPage';
import TasksPage from './modules/tasks/pages/TasksPage';
import MyCalendarPage from './modules/calendar/pages/CalendarPage';
import OrgChartPage from './modules/social/pages/OrgChartPage';
import FeedPage from './modules/social/pages/FeedPage';
import AbsencesPage from './modules/absences/pages/AbsencesPage';
import PeoplePage from './modules/social/pages/PeoplePage';
import ColleagueProfilePage from './modules/social/pages/ColleagueProfilePage';
import AppreciationsPage from './modules/social/pages/AppreciationsPage';
import MessengerPage from './modules/messenger/pages/MessengerPage';
import AuthCallbackPage from './pages/auth/AuthCallbackPage';
import SetPasswordPage from './pages/auth/SetPasswordPage';
import InstallPage from './pages/InstallPage';
import DeleteAccountPage from './pages/DeleteAccountPage';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

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
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<ComingSoonPage />} />
              <Route path="/site" element={<Index />} />
              <Route path="/instalar" element={<InstallPage />} />
              <Route path="/politica-privacidade" element={<PrivacyPolicyPage />} />
              <Route path="/cookies" element={<CookiesPolicyPage />} />
              <Route path="/termos-condicoes" element={<TermsPage />} />
              <Route path="/eliminar-conta" element={<DeleteAccountPage />} />

              {/* Auth Callback */}
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/auth/set-password" element={<SetPasswordPage />} />

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
                <Route path="/admin/pedidos" element={<AbsenceRequestsPage />} />
                <Route path="/admin/suporte" element={<SupportTicketsPage />} />
                <Route path="/admin/acessos" element={<AccessesPage />} />
                <Route path="/admin/ponto" element={<TimeClockAdminPage />} />
                <Route path="/admin/documentos" element={<DocumentsAdminPage />} />
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
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  </GlobalErrorBoundary>
);

export default App;
