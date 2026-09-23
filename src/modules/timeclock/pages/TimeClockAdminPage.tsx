import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useToast } from '@/hooks/use-toast';
import { ROUTES } from '@/lib/constants';
import { HistoryTab } from '../components/admin/HistoryTab';
import { LocationsTab } from '../components/admin/LocationsTab';
import { ReviewTab } from '../components/admin/ReviewTab';
import { TimesheetTab } from '../components/admin/TimesheetTab';

const TimeClockAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canView, canExecuteTopic, isLoading } = useAdminPermissions();

  useEffect(() => {
    if (!isLoading && !canView('timeclock')) {
      toast({
        title: 'Acesso Negado',
        description: 'Não tem permissão para aceder ao controlo de ponto.',
        variant: 'destructive',
      });
      navigate(ROUTES.ADMIN.DASHBOARD);
    }
  }, [canView, isLoading, navigate, toast]);

  if (isLoading || !canView('timeclock')) return null;

  const canEdit = canExecuteTopic('timeclock', 'edit');
  const canManageLocations = canExecuteTopic('timeclock', 'locations');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-semibold flex items-center gap-2">
          <Clock className="h-6 w-6 text-gold" /> Controlo de Ponto
        </h1>
        <p className="text-muted-foreground mt-1">
          Folha de ponto dos colaboradores, registos em revisão, locais e tags NFC.
        </p>
      </div>

      <Tabs defaultValue="timesheet">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="timesheet">Folha de Ponto</TabsTrigger>
          <TabsTrigger value="review">Revisão</TabsTrigger>
          <TabsTrigger value="locations">Locais & Tags</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="timesheet" className="mt-4">
          <TimesheetTab canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="review" className="mt-4">
          <ReviewTab canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="locations" className="mt-4">
          <LocationsTab canManage={canManageLocations} />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TimeClockAdminPage;
