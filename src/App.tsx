import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminLayout from "./components/layout/AdminLayout";
import ComingSoonPage from "./pages/ComingSoonPage";
import Index from "./pages/Index";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import CookiesPolicyPage from "./pages/CookiesPolicyPage";
import TermsPage from "./pages/TermsPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CompaniesPage from "./pages/admin/CompaniesPage";
import EmployeesPage from "./pages/admin/EmployeesPage";
import EmployeeFormPage from "./pages/admin/EmployeeFormPage";
import CalendarPage from "./pages/admin/CalendarPage";
import SettingsPage from "./pages/admin/SettingsPage";
import AbsenceRequestsPage from "./pages/admin/AbsenceRequestsPage";
import SupportTicketsPage from "./pages/admin/SupportTicketsPage";
import AccessesPage from "./pages/admin/AccessesPage";
import LegalPage from "./pages/admin/LegalPage";
import EmployeeLoginPage from "./pages/employee/EmployeeLoginPage";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeTicketsPage from "./pages/employee/EmployeeTicketsPage";
import EmployeeDocumentsPage from "./pages/employee/EmployeeDocumentsPage";
import AuthCallbackPage from "./pages/auth/AuthCallbackPage";
import SetPasswordPage from "./pages/auth/SetPasswordPage";
import InstallPage from "./pages/InstallPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
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
          
          {/* Auth Callback */}
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/set-password" element={<SetPasswordPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route element={<AdminLayout />}>
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
          <Route path="/colaborador" element={<EmployeeDashboard />} />
          <Route path="/colaborador/tickets" element={<EmployeeTicketsPage />} />
          <Route path="/colaborador/documentos" element={<EmployeeDocumentsPage />} />
          
          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
