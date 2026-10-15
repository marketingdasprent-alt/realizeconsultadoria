import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ROUTES } from '@/lib/constants';
import ChangePasswordDialog from '@/components/employee/ChangePasswordDialog';
import PWAInstallBanner from '@/components/PWAInstallBanner';
import type { EmployeeOutletContext, EmployeeProfile } from '../../hooks/useEmployeeOutlet';
import { employeeProfileService } from '../../services/employeeProfileService';
import { EmployeeBottomNav } from './EmployeeBottomNav';
import { EmployeeHeader } from './EmployeeHeader';

/**
 * Casca da app do colaborador: cabeçalho, navegação em tabs e o colaborador
 * autenticado partilhado com as páginas (via Outlet context).
 */
const EmployeeLayout: React.FC = () => {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [sessionEmail, setSessionEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await employeeProfileService.getCurrent();
    if (!data) {
      navigate(ROUTES.EMPLOYEE.LOGIN);
      return;
    }
    setEmployee(data.employee);
    setSessionEmail(data.email);
    setIsLoading(false);
  }, [navigate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    navigate(standalone ? ROUTES.EMPLOYEE.LOGIN : ROUTES.PUBLIC.HOME);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-card">
          <CardContent className="pt-6 text-center">
            <p className="mb-4 text-muted-foreground">
              A sua conta ainda não está associada a uma empresa. Por favor contacte o
              administrador.
            </p>
            <Button variant="gold" onClick={handleLogout}>
              Terminar sessão
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const context: EmployeeOutletContext = { employee, sessionEmail, refresh };

  return (
    <div className="min-h-screen bg-secondary">
      <EmployeeHeader
        name={employee.name}
        companyName={employee.companies?.name ?? null}
        onChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={handleLogout}
      />
      <EmployeeBottomNav />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 lg:pb-10">
        <PWAInstallBanner />
        <Outlet context={context} />
      </main>
      <ChangePasswordDialog
        open={isChangePasswordOpen}
        onOpenChange={setIsChangePasswordOpen}
        employeeEmail={sessionEmail}
      />
    </div>
  );
};

export default EmployeeLayout;
