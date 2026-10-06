import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useToast } from '@/hooks/use-toast';
import { ROUTES } from '@/lib/constants';
import { HistoryTab } from '../components/admin/HistoryTab';
import { LocationsTab } from '../components/admin/LocationsTab';
import { ReviewTab } from '../components/admin/ReviewTab';
import { TimesheetTab } from '../components/admin/TimesheetTab';
import { useTimeClockReview } from '../hooks/useTimeClockReview';

/** ?tab= em português (usado no link dos emails de aprovação). */
const TAB_PARAMS: Record<string, string> = {
  folha: 'timesheet',
  revisao: 'review',
  locais: 'locations',
  historico: 'history',
};
const PARAM_BY_TAB = Object.fromEntries(Object.entries(TAB_PARAMS).map(([k, v]) => [v, k]));

const TimeClockAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canView, canExecuteTopic, isLoading } = useAdminPermissions();
  const allowed = !isLoading && canView('timeclock');
  const review = useTimeClockReview(allowed);

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

  if (!allowed) return null;

  const canEdit = canExecuteTopic('timeclock', 'edit');
  const canManageLocations = canExecuteTopic('timeclock', 'locations');
  const tab = TAB_PARAMS[searchParams.get('tab') ?? ''] ?? 'timesheet';
  const toReview = review.pending.length + review.flagged.length;

  const changeTab = (value: string) => {
    // Decisões tomadas na folha de ponto também mudam a lista de revisão.
    if (value === 'review') review.refetch();
    setSearchParams(value === 'timesheet' ? {} : { tab: PARAM_BY_TAB[value] }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-semibold flex items-center gap-2">
          <Clock className="h-6 w-6 text-gold" /> Controlo de Ponto
        </h1>
        <p className="text-muted-foreground mt-1">
          Folha de ponto dos colaboradores, aprovações, locais e tags NFC.
        </p>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="timesheet">Folha de Ponto</TabsTrigger>
          <TabsTrigger value="review" className="gap-2">
            Revisão
            {toReview > 0 && (
              <span className="rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground">
                {toReview}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="locations">Locais & Tags</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="timesheet" className="mt-4">
          <TimesheetTab canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="review" className="mt-4">
          <ReviewTab canEdit={canEdit} review={review} />
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
