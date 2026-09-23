import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Bell,
  ChevronRight,
  Download,
  Headset,
  LogOut,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ROUTES } from '@/lib/constants';
import { getSafetyCheckupStatus } from '@/lib/employee-home';
import { maskTail } from '../lib/home-summaries';
import { useEmployeeOutlet } from '../hooks/useEmployeeOutlet';

const Row: React.FC<{ label: string; value: string | null | undefined }> = ({ label, value }) =>
  value ? (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  ) : null;

const LinkRow: React.FC<{ to: string; icon: React.ElementType; label: string }> = ({
  to,
  icon: Icon,
  label,
}) => (
  <Link to={to} className="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-muted/50">
    <Icon className="h-5 w-5 text-gold" />
    <span className="flex-1 font-medium">{label}</span>
    <ChevronRight className="h-4 w-4 text-muted-foreground" />
  </Link>
);

/** "Mais": os meus dados, medicina do trabalho, suporte e conta. */
const EmployeeMorePage: React.FC = () => {
  const { employee, sessionEmail } = useEmployeeOutlet();
  const navigate = useNavigate();
  const safety = getSafetyCheckupStatus(
    employee.safety_checkup_date,
    employee.safety_checkup_renewal_months
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate(ROUTES.EMPLOYEE.LOGIN);
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="font-display text-lg">Os meus dados</CardTitle>
          <p className="text-xs text-muted-foreground">
            Para corrigir algum dado, abra um pedido de ajuda aos RH.
          </p>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <Row label="Nome" value={employee.name} />
          <Row label="Empresa" value={employee.companies?.name} />
          <Row label="Cargo" value={employee.position} />
          <Row label="Departamento" value={employee.department} />
          <Row
            label="Data de entrada"
            value={employee.hire_date ? format(new Date(employee.hire_date), 'dd/MM/yyyy') : null}
          />
          <Row label="Email" value={employee.email || sessionEmail} />
          <Row label="Telefone" value={employee.phone} />
          <Row label="Nacionalidade" value={employee.nationality} />
          <Row label="Documento" value={maskTail(employee.document_number)} />
          <Row label="IBAN" value={maskTail(employee.iban)} />
        </CardContent>
      </Card>

      {safety && (
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-3 p-4">
            <Stethoscope className="h-5 w-5 shrink-0 text-gold" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Medicina do trabalho · próximo exame</p>
              <p className="font-medium">{format(safety.nextDate, 'dd/MM/yyyy')}</p>
            </div>
            {safety.state !== 'ok' && (
              <Badge variant={safety.state === 'overdue' ? 'destructive' : 'secondary'}>
                {safety.state === 'overdue' ? 'Em atraso' : `${safety.daysLeft} dias`}
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardContent className="divide-y divide-border p-0">
          <LinkRow to={ROUTES.EMPLOYEE.TICKETS} icon={Headset} label="Suporte e pedidos de ajuda" />
          <LinkRow to={ROUTES.EMPLOYEE.NOTICES} icon={Bell} label="Avisos" />
          <LinkRow to={ROUTES.PUBLIC.INSTALL} icon={Download} label="Instalar a app no telemóvel" />
          <LinkRow to={ROUTES.PUBLIC.PRIVACY} icon={ShieldCheck} label="Política de privacidade" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-destructive hover:bg-muted/50"
          >
            <LogOut className="h-5 w-5" />
            <span className="flex-1 font-medium">Terminar sessão</span>
          </button>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeMorePage;
