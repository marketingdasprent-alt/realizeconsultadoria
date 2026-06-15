import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
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
import EmployeeDashboard from './modules/employee/pages/EmployeeDashboard';
import EmployeeTicketsPage from './modules/employee/pages/EmployeeTicketsPage';
import EmployeeDocumentsPage from './modules/employee/pages/EmployeeDocumentsPage';
import AuthCallbackPage from './pages/auth/AuthCallbackPage';
import SetPasswordPage from './pages/auth/SetPasswordPage';
import InstallPage from './pages/InstallPage';
import DeleteAccountPage from './pages/DeleteAccountPage';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

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
                <Route path="/admin/configuracoes" element={<SettingsPage />} />
              </Route>

              {/* Employee Routes */}
              <Route path="/colaborador/login" element={<EmployeeLoginPage />} />
              <Route
                element={
                  <ProtectedRoute requiredRole="employee">
                    <div style={{ width: '100%' }}>
                      {/* Employee layout wrapper */}
                      <Outlet />
                    </div>
                  </ProtectedRoute>
                }
              >
                <Route path="/colaborador" element={<EmployeeDashboard />} />
                <Route path="/colaborador/tickets" element={<EmployeeTicketsPage />} />
                <Route path="/colaborador/documentos" element={<EmployeeDocumentsPage />} />
              </Route>

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
