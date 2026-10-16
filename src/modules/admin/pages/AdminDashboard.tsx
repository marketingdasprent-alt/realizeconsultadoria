import { useAuth } from '@/contexts/AuthContext';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { DashboardStats } from '../components/DashboardStats';
import { DashboardShortcuts } from '../components/DashboardShortcuts';
import { AbsentTodayCard } from '../components/AbsentTodayCard';
import { useDashboardOverview } from '../hooks/useDashboardOverview';

const greeting = (hour: number) => (hour < 12 ? 'Bom dia' : hour < 20 ? 'Boa tarde' : 'Boa noite');

/** "thiago.sousa@…" → "Thiago". */
const firstName = (email: string | undefined) => {
  const part = email?.split('@')[0]?.split(/[._-]/)[0] ?? '';
  return part ? part.charAt(0).toUpperCase() + part.slice(1) : '';
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const { data } = useDashboardOverview();
  const name = firstName(user?.email);
  const today = new Date().toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`${greeting(new Date().getHours())}${name ? `, ${name}` : ''}`}
        description={<span className="first-letter:uppercase">{today}</span>}
      />

      <DashboardStats data={data} />

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardShortcuts />
        <AbsentTodayCard absent={data?.absentToday} />
      </div>
    </div>
  );
};

export default AdminDashboard;
