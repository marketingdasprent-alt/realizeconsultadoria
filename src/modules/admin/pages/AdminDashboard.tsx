import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import PWAInstallBanner from '@/components/PWAInstallBanner';
import { DashboardStats } from '../components/DashboardStats';
import { DashboardQuickActions } from '../components/DashboardQuickActions';

interface DashboardStatsData {
  totalCompanies: number;
  totalEmployees: number;
  pendingAbsences: number;
  activeAbsences: number;
  openTickets: number;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<DashboardStatsData>({
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
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const [companiesRes, employeesRes, pendingRes, activeAbsencesRes, ticketsRes] =
          await Promise.all([
            supabase.from('companies').select('id', { count: 'exact', head: true }),
            supabase
              .from('employees')
              .select('id', { count: 'exact', head: true })
              .eq('is_active', true),
            supabase
              .from('absences')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'pending'),
            supabase
              .from('absences')
              .select(
                'id, employee_id, status, start_date, end_date, absence_periods(start_date, end_date, status)'
              )
              .in('status', ['approved', 'partially_approved'])
              .lte('start_date', todayStr)
              .gte('end_date', todayStr),
            supabase
              .from('support_tickets')
              .select('id', { count: 'exact', head: true })
              .in('status', ['open', 'in_progress']),
          ]);

        const absentEmployeesToday = new Set<string>();

        if (activeAbsencesRes.data) {
          for (const absence of activeAbsencesRes.data) {
            const periods = absence.absence_periods as Array<{
              start_date: string;
              end_date: string;
              status: string;
            }> | null;

            if (periods && periods.length > 0) {
              const hasApprovedPeriodToday = periods.some(
                period =>
                  period.status === 'approved' &&
                  period.start_date <= todayStr &&
                  period.end_date >= todayStr
              );
              if (hasApprovedPeriodToday) {
                absentEmployeesToday.add(absence.employee_id);
              }
            } else if (absence.status === 'approved') {
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

  return (
    <>
      <div className="space-y-8">
        {/* PWA Install Banner */}
        <PWAInstallBanner />

        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral da sua plataforma de gestão</p>
        </div>

        {/* Stats Grid */}
        <DashboardStats stats={stats} isLoading={isLoading} />

        {/* Quick Actions */}
        <DashboardQuickActions />
      </div>
    </>
  );
};

export default AdminDashboard;
