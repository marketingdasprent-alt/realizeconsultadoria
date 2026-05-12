import { Building2, Users, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const DashboardQuickActions = () => {
  return (
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
  );
};
