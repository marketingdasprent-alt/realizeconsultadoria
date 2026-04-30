import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Users, Calendar, Clock, TrendingUp, Headset } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import PWAInstallBanner from "@/components/PWAInstallBanner";

interface DashboardStats {
  totalCompanies: number;
  totalEmployees: number;
  pendingAbsences: number;
  activeAbsences: number;
  openTickets: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalCompanies: 0,
    totalEmployees: 0,
    pendingAbsences: 0,
    activeAbsences: 0,
    openTickets: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Get today's date in local format (YYYY-MM-DD)
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const [companiesRes, employeesRes, pendingRes, activeAbsencesRes, ticketsRes] = await Promise.all([
          supabase.from('companies').select('id', { count: 'exact', head: true }),
          supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('absences').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          // Fetch absences that could be active today (approved or partially_approved)
          supabase.from('absences')
            .select('id, employee_id, status, start_date, end_date, absence_periods(start_date, end_date, status)')
            .in('status', ['approved', 'partially_approved'])
            .lte('start_date', todayStr)
            .gte('end_date', todayStr),
          // Fetch open support tickets
          supabase.from('support_tickets')
            .select('id', { count: 'exact', head: true })
            .in('status', ['open', 'in_progress']),
        ]);

        // Calculate unique employees absent today
        const absentEmployeesToday = new Set<string>();
        
        if (activeAbsencesRes.data) {
          for (const absence of activeAbsencesRes.data) {
            const periods = absence.absence_periods as Array<{ start_date: string; end_date: string; status: string }> | null;
            
            if (periods && periods.length > 0) {
              // Check if any approved period includes today
              const hasApprovedPeriodToday = periods.some(period => 
                period.status === 'approved' && 
                period.start_date <= todayStr && 
                period.end_date >= todayStr
              );
              if (hasApprovedPeriodToday) {
                absentEmployeesToday.add(absence.employee_id);
              }
            } else if (absence.status === 'approved') {
              // No periods, use absence dates directly (only if fully approved)
              absentEmployeesToday.add(absence.employee_id);
            }
          }
        }

        setStats({
          totalCompanies: companiesRes.count || 0,
          totalEmployees: employeesRes.count || 0,
          pendingAbsences: pendingRes.count || 0,
          activeAbsences: absentEmployeesToday.size,
          openTickets: ticketsRes.count || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statsCards = [
    {
      title: "Empresas",
      value: stats.totalCompanies,
      icon: Building2,
      description: "Total de empresas registadas",
      color: "text-gold",
      bgColor: "bg-gold/10",
    },
    {
      title: "Colaboradores",
      value: stats.totalEmployees,
      icon: Users,
      description: "Colaboradores ativos",
      color: "text-blue-600",
      bgColor: "bg-blue-600/10",
    },
    {
      title: "Pedidos Pendentes",
      value: stats.pendingAbsences,
      icon: Clock,
      description: "Férias/ausências por aprovar",
      color: "text-orange-600",
      bgColor: "bg-orange-600/10",
      onClick: () => navigate("/admin/pedidos?status=pending"),
    },
    {
      title: "Tickets em Aberto",
      value: stats.openTickets,
      icon: Headset,
      description: "Pedidos de suporte ativos",
      color: "text-purple-600",
      bgColor: "bg-purple-600/10",
      onClick: () => navigate("/admin/suporte"),
    },
    {
      title: "Ausências Hoje",
      value: stats.activeAbsences,
      icon: Calendar,
      description: "Colaboradores ausentes hoje",
      color: "text-green-600",
      bgColor: "bg-green-600/10",
    },
  ];

  return (
    <>
      <div className="space-y-8">
        {/* PWA Install Banner */}
        <PWAInstallBanner />
        
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral da sua plataforma de gestão
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {statsCards.map((card) => (
            <Card 
              key={card.title} 
              className={`shadow-card ${card.onClick ? "cursor-pointer hover:shadow-lg transition-shadow" : ""}`}
              onClick={card.onClick}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {isLoading ? "..." : card.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-xl">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <a 
                href="/admin/empresas" 
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <Building2 className="h-5 w-5 text-gold" />
                <span className="font-medium">Adicionar Nova Empresa</span>
              </a>
              <a 
                href="/admin/colaboradores" 
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <Users className="h-5 w-5 text-gold" />
                <span className="font-medium">Registar Colaborador</span>
              </a>
              <a 
                href="/admin/calendario" 
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <Calendar className="h-5 w-5 text-gold" />
                <span className="font-medium">Ver Calendário Geral</span>
              </a>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="font-display text-xl">Resumo do Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-3 text-gold/50" />
                  <p>Dados estatísticos serão exibidos aqui</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
