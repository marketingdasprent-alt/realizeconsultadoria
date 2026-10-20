import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Lock, Mail, Package, Wifi } from 'lucide-react';
import { AdminPageTitle } from '@/components/admin/AdminPageHeader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { supabase } from '@/integrations/supabase/client';
import { CredentialsTab } from '../components/accesses/CredentialsTab';
import { EmailsTab } from '../components/accesses/EmailsTab';
import { EquipmentArea } from '../components/accesses/EquipmentArea';
import { PaidServicesTab } from '../components/paid-services/PaidServicesTab';

/** Abas da página (?tab=): emails, outras credenciais, material e serviços pagos. */
const PAGE_TABS = [
  { value: 'emails', label: 'Emails', icon: Mail },
  { value: 'acessos', label: 'Acessos', icon: Lock },
  { value: 'equipamentos', label: 'Equipamentos', icon: Package },
  { value: 'servicos', label: 'Serviços pagos', icon: Wifi },
] as const;
type PageTab = (typeof PAGE_TABS)[number]['value'];

/** Empresas ativas (para os filtros e formulários de equipamentos e serviços). */
const useActiveCompanies = () =>
  useQuery({
    queryKey: ['admin', 'companies-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

/** Acessos: emails (e a ligação ao Webmail), credenciais, equipamentos e serviços pagos. */
const AccessesPage: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { canExecuteTopic, isSuperAdmin, isLoading } = useAdminPermissions();
  const canManage = canExecuteTopic('accesses', 'manage');
  const [searchParams, setSearchParams] = useSearchParams();
  const [companyFilter, setCompanyFilter] = useState('all');
  const companies = useActiveCompanies().data ?? [];

  // Página só para super administradores.
  useEffect(() => {
    if (!isLoading && !isSuperAdmin) {
      navigate('/admin');
      toast({
        title: 'Acesso negado',
        description: 'Esta página é exclusiva para Super Administradores.',
        variant: 'destructive',
      });
    }
  }, [isLoading, isSuperAdmin, navigate, toast]);

  const asked = searchParams.get('tab');
  const tab: PageTab = PAGE_TABS.some(t => t.value === asked) ? (asked as PageTab) : 'emails';
  const changeTab = (value: string) =>
    setSearchParams(value === 'emails' ? {} : { tab: value }, { replace: true });

  if (isLoading || !isSuperAdmin) return null;

  return (
    <div className="space-y-6">
      <AdminPageTitle
        title="Acessos"
        description="Emails e Webmail, credenciais, equipamentos e serviços pagos"
      />
      <Tabs value={tab} onValueChange={changeTab} className="w-full">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-10 w-auto">
            {PAGE_TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-1.5 px-3 text-xs sm:px-4 sm:text-sm"
              >
                <Icon className="hidden h-4 w-4 sm:inline" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollArea>

        <TabsContent value="emails" className="mt-6">
          <EmailsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="acessos" className="mt-6">
          <CredentialsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="equipamentos" className="mt-6">
          <EquipmentArea
            canManage={canManage}
            companies={companies}
            companyFilter={companyFilter}
            setCompanyFilter={setCompanyFilter}
          />
        </TabsContent>
        <TabsContent value="servicos" className="mt-6">
          <PaidServicesTab canManage={canManage} companies={companies} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AccessesPage;
