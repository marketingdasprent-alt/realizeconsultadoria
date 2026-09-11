import { useState, useEffect, useCallback } from 'react';
import { Plus, Wifi, Search, Trash2, Pencil, Sparkles, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { ServiceModal, ServiceData } from '@/components/admin/services/ServiceModal';
import {
  advanceRenewalDate,
  isCyclePaid,
  getCycleStatus,
  getFidelityStatus,
  type ServiceType,
  type StatusTone,
} from '@/lib/recurring-services';

interface Company {
  id: string;
  name: string;
}

interface ServicesTabProps {
  canManage: boolean;
  companies: Company[];
  companyFilter: string;
  setCompanyFilter: (value: string) => void;
}

/** Cores de cada nível de gravidade, partilhadas pelo estado do ciclo e da fidelização. */
const TONE_CLASSES: Record<StatusTone, string> = {
  ok: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  soon: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  urgent: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  ended: 'bg-muted text-muted-foreground',
};

const TYPE_LABELS: Record<ServiceType, string> = {
  internet: 'Internet',
  subscription: 'Assinatura',
};

const CYCLE_LABELS = {
  monthly: '/mês',
  yearly: '/ano',
} as const;

const formatEuro = (value: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);

const StatusPill = ({ label, tone }: { label: string; tone: StatusTone }) => (
  <span
    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TONE_CLASSES[tone]}`}
  >
    {label}
  </span>
);

export default function ServicesTab({
  canManage,
  companies,
  companyFilter,
  setCompanyFilter,
}: ServicesTabProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [services, setServices] = useState<ServiceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<ServiceType | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceData | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);

  const fetchServices = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        let query = supabase
          .from('recurring_services')
          .select('*, companies(name)')
          .order('renewal_date', { ascending: true });

        if (companyFilter !== 'all') {
          query = query.eq('company_id', companyFilter);
        }

        const { data, error } = await query;

        if (error) throw error;
        setServices((data as unknown as ServiceData[]) || []);
      } catch (error: any) {
        toast({
          title: 'Erro ao carregar serviços',
          description: error.message,
          variant: 'destructive',
        });
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [companyFilter, toast]
  );

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleDelete = async () => {
    if (!serviceToDelete) return;

    try {
      const { error } = await supabase
        .from('recurring_services')
        .delete()
        .eq('id', serviceToDelete);

      if (error) throw error;

      toast({ title: 'Serviço removido com sucesso!' });
      fetchServices();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setServiceToDelete(null);
    }
  };

  /**
   * Marcar como pago avança a data da próxima renovação um período (mês ou ano, conforme
   * o ciclo) e regista o período pago. Voltar a clicar desfaz, para corrigir enganos.
   */
  const handleTogglePaid = async (service: ServiceData, currentPaid: boolean) => {
    // Desfazer restaura a data guardada em vez de recuar um período: recuar perderia o dia
    // nos fins de mês (31/01 avança para 28/02, mas 28/02 recuaria para 28/01).
    const newRenewal = currentPaid
      ? service.last_paid_date!
      : advanceRenewalDate(service.renewal_date, service.billing_cycle);
    const newPaidDate = currentPaid ? null : service.renewal_date;

    // Optimistic UI update
    setServices(prev =>
      prev.map(s =>
        s.id === service.id ? { ...s, renewal_date: newRenewal, last_paid_date: newPaidDate } : s
      )
    );

    try {
      const { error } = await supabase
        .from('recurring_services')
        .update({ renewal_date: newRenewal, last_paid_date: newPaidDate })
        .eq('id', service.id);

      if (error) throw error;

      toast({
        title: currentPaid
          ? 'Pagamento anulado'
          : `Pagamento registado — próximo a ${format(parseISO(newRenewal), 'dd/MM/yyyy')}`,
      });

      fetchServices(true);
    } catch (error: any) {
      fetchServices(true); // Revert on error
      toast({
        title: 'Erro ao atualizar estado',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const query = searchQuery.toLowerCase();
  const filteredServices = services.filter(service => {
    if (typeFilter !== 'all' && service.service_type !== typeFilter) return false;
    return (
      service.name.toLowerCase().includes(query) ||
      (service.provider ?? '').toLowerCase().includes(query) ||
      (service.location ?? '').toLowerCase().includes(query)
    );
  });

  const renderActions = (service: ServiceData) => (
    <div className="flex justify-end gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setSelectedService(service);
          setIsModalOpen(true);
        }}
        className="h-8 w-8 hover:text-gold hover:bg-gold/10"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setServiceToDelete(service.id!)}
        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  const renderPaidBadge = (service: ServiceData, paid: boolean) => (
    <Badge
      className="cursor-pointer hover:bg-opacity-80 transition-colors"
      variant="outline"
      onClick={() => handleTogglePaid(service, paid)}
      title={
        paid
          ? 'Clique para anular o pagamento (recua a renovação um período)'
          : 'Clique ao pagar (avança a data um período)'
      }
      style={
        paid
          ? { backgroundColor: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }
          : { backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fde68a' }
      }
    >
      {paid ? 'Pago' : 'Pendente'}
    </Badge>
  );

  const renderDesktopTable = () => (
    <div className="rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="font-semibold">Designação</TableHead>
              <TableHead className="font-semibold">Tipo</TableHead>
              <TableHead className="font-semibold">Fornecedor</TableHead>
              {companyFilter === 'all' && <TableHead className="font-semibold">Empresa</TableHead>}
              <TableHead className="font-semibold text-center">Valor</TableHead>
              <TableHead className="font-semibold text-center">Próxima Renovação</TableHead>
              <TableHead className="font-semibold text-center">Fidelização</TableHead>
              <TableHead className="font-semibold text-center">Estado</TableHead>
              <TableHead className="font-semibold text-center">Pago</TableHead>
              {canManage && <TableHead className="font-semibold text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredServices.map(service => {
              const cycle = getCycleStatus(service.renewal_date);
              const fidelity = getFidelityStatus(service.fidelity_end);
              const paid = isCyclePaid({
                renewal_date: service.renewal_date,
                billing_cycle: service.billing_cycle,
                last_paid_date: service.last_paid_date ?? null,
              });

              return (
                <TableRow key={service.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium text-foreground">
                    {service.name}
                    {service.location && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {service.location}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      {service.service_type === 'internet' ? (
                        <Wifi className="h-3.5 w-3.5" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      {TYPE_LABELS[service.service_type]}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{service.provider || '—'}</TableCell>
                  {companyFilter === 'all' && (
                    <TableCell className="text-muted-foreground">
                      {service.companies?.name || '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-center whitespace-nowrap">
                    {formatEuro(service.amount)}
                    <span className="text-xs text-muted-foreground">
                      {CYCLE_LABELS[service.billing_cycle]}
                    </span>
                  </TableCell>
                  <TableCell className="text-center font-medium whitespace-nowrap">
                    {format(parseISO(service.renewal_date), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-center">
                    {fidelity ? <StatusPill label={fidelity.label} tone={fidelity.tone} /> : '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusPill label={cycle.label} tone={cycle.tone} />
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center">{renderPaidBadge(service, paid)}</div>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">{renderActions(service)}</TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderMobileCards = () => (
    <div className="space-y-3">
      {filteredServices.map(service => {
        const cycle = getCycleStatus(service.renewal_date);
        const fidelity = getFidelityStatus(service.fidelity_end);
        const paid = isCyclePaid({
          renewal_date: service.renewal_date,
          billing_cycle: service.billing_cycle,
          last_paid_date: service.last_paid_date ?? null,
        });

        return (
          <Card key={service.id} className="p-4 min-w-0 overflow-hidden">
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm flex items-center gap-2 truncate">
                  {service.service_type === 'internet' ? (
                    <Wifi className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">{service.name}</span>
                </h4>
                <p className="text-xs text-muted-foreground truncate">
                  {[service.provider, companyFilter === 'all' ? service.companies?.name : null]
                    .filter(Boolean)
                    .join(' · ') || TYPE_LABELS[service.service_type]}
                </p>
              </div>
              <div className="shrink-0">{canManage && renderActions(service)}</div>
            </div>

            {service.location && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                {service.location}
              </p>
            )}

            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-24 shrink-0">Valor:</span>
                <span className="text-xs font-medium">
                  {formatEuro(service.amount)}
                  <span className="text-muted-foreground">
                    {CYCLE_LABELS[service.billing_cycle]}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-24 shrink-0">Renovação:</span>
                <span className="text-xs font-medium">
                  {format(parseISO(service.renewal_date), 'dd/MM/yyyy')}
                </span>
              </div>
              {fidelity && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24 shrink-0">Fidelização:</span>
                  <StatusPill label={fidelity.label} tone={fidelity.tone} />
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill label={cycle.label} tone={cycle.tone} />
                {renderPaidBadge(service, paid)}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-gold" />
            Gestão de Serviços
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Instalações de internet e assinaturas: valores, renovações e fidelizações.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setSelectedService(null);
              setIsModalOpen(true);
            }}
            variant="gold"
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Serviço
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar serviço..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>

          <Select
            value={typeFilter}
            onValueChange={(value: ServiceType | 'all') => setTypeFilter(value)}
          >
            <SelectTrigger className="w-full sm:w-[180px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="internet">Internet</SelectItem>
              <SelectItem value="subscription">Assinaturas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-full sm:w-[200px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {companies.map(company => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
            A carregar serviços...
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground rounded-xl border bg-muted/5">
            Nenhum serviço encontrado.
          </div>
        ) : isMobile ? (
          renderMobileCards()
        ) : (
          renderDesktopTable()
        )}
      </CardContent>

      <ServiceModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        service={selectedService}
        companies={companies}
        onSave={fetchServices}
      />

      <AlertDialog open={!!serviceToDelete} onOpenChange={() => setServiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar Serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja apagar este serviço? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sim, apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
