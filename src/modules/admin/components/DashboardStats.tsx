import { useNavigate } from 'react-router-dom';
import { Building2, Users, Calendar, Clock, Headset } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardStatsData {
  totalCompanies: number;
  totalEmployees: number;
  pendingAbsences: number;
  activeAbsences: number;
  openTickets: number;
}

interface DashboardStatsProps {
  stats: DashboardStatsData;
  isLoading: boolean;
}

export const DashboardStats = ({ stats, isLoading }: DashboardStatsProps) => {
  const navigate = useNavigate();

  const statsCards = [
    {
      title: 'Empresas',
      value: stats.totalCompanies,
      icon: Building2,
      description: 'Total de empresas registadas',
      color: 'text-gold',
      bgColor: 'bg-gold/10',
    },
    {
      title: 'Colaboradores',
      value: stats.totalEmployees,
      icon: Users,
      description: 'Colaboradores ativos',
      color: 'text-blue-600',
      bgColor: 'bg-blue-600/10',
    },
    {
      title: 'Pedidos Pendentes',
      value: stats.pendingAbsences,
      icon: Clock,
      description: 'Férias/ausências por aprovar',
      color: 'text-orange-600',
      bgColor: 'bg-orange-600/10',
      onClick: () => navigate('/admin/pedidos?status=pending'),
    },
    {
      title: 'Tickets em Aberto',
      value: stats.openTickets,
      icon: Headset,
      description: 'Pedidos de suporte ativos',
      color: 'text-purple-600',
      bgColor: 'bg-purple-600/10',
      onClick: () => navigate('/admin/suporte'),
    },
    {
      title: 'Ausências Hoje',
      value: stats.activeAbsences,
      icon: Calendar,
      description: 'Colaboradores ausentes hoje',
      color: 'text-green-600',
      bgColor: 'bg-green-600/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {statsCards.map(card => (
        <Card
          key={card.title}
          className={`shadow-card ${card.onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
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
            <div className="text-3xl font-bold">{isLoading ? '...' : card.value}</div>
            <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
