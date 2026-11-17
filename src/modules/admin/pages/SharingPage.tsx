import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, Inbox, KeyRound, Link2, Users } from 'lucide-react';
import { AdminPageTitle } from '@/components/admin/AdminPageHeader';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupPanel } from '../components/sharing/GroupPanel';
import { QueryState } from '../components/sharing/QueryState';
import { RequestShareDialog } from '../components/sharing/RequestShareDialog';
import { RequestsPanel } from '../components/sharing/RequestsPanel';
import { ShareCodeCard } from '../components/sharing/ShareCodeCard';
import { SharesPanel } from '../components/sharing/SharesPanel';
import { ViewersPanel } from '../components/sharing/ViewersPanel';
import { useMyCompanies } from '../hooks/useSharing';
import { managesCompany } from '../lib/sharing';

const PAGE_TABS = [
  { value: 'codigo', label: 'Código', icon: KeyRound },
  { value: 'pedidos', label: 'Pedidos', icon: Inbox },
  { value: 'acesso', label: 'Quem tem acesso', icon: Link2 },
  { value: 'grupo', label: 'Grupo', icon: Users },
  { value: 'quem-ve', label: 'Quem pode ver', icon: Eye },
] as const;
type PageTab = (typeof PAGE_TABS)[number]['value'];

/** Partilha entre empresas: código, pedidos de ligação, quem tem acesso e grupo. */
const SharingPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const companies = useMyCompanies();
  // Só quem é administrador da empresa gere a partilha (rz_my_companies já só devolve pertenças ativas).
  const adminOf = (companies.data ?? []).filter(item => managesCompany(item.role));
  const [chosen, setChosen] = useState<string | null>(null);
  const company = adminOf.find(item => item.company_id === chosen) ?? adminOf[0];

  const asked = searchParams.get('tab');
  const tab: PageTab = PAGE_TABS.some(t => t.value === asked) ? (asked as PageTab) : 'codigo';
  const changeTab = (value: string) =>
    setSearchParams(value === 'codigo' ? {} : { tab: value }, { replace: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <AdminPageTitle
          title="Partilha entre empresas"
          description="Escolha o que cada empresa pode ver ou fazer nos dados da sua"
        />
        {company && <RequestShareDialog company={company.company_id} />}
      </div>

      <QueryState
        isLoading={companies.isLoading}
        error={companies.error}
        isEmpty={!company}
        emptyTitle="A sua conta não administra nenhuma empresa"
        emptyHint="Só os administradores de uma empresa podem gerir a partilha com outras empresas."
        onRetry={() => companies.refetch()}
      >
        {company && (
          <>
            {adminOf.length > 1 && (
              <div className="max-w-sm space-y-2">
                <Label htmlFor="sharing-company">Empresa</Label>
                <Select value={company.company_id} onValueChange={setChosen}>
                  <SelectTrigger id="sharing-company">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {adminOf.map(item => (
                      <SelectItem key={item.company_id} value={item.company_id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              <TabsContent value="codigo" className="mt-6">
                <ShareCodeCard key={company.company_id} company={company.company_id} />
              </TabsContent>
              <TabsContent value="pedidos" className="mt-6">
                <RequestsPanel key={company.company_id} company={company.company_id} />
              </TabsContent>
              <TabsContent value="acesso" className="mt-6">
                <SharesPanel key={company.company_id} company={company.company_id} />
              </TabsContent>
              <TabsContent value="grupo" className="mt-6">
                <GroupPanel key={company.company_id} company={company.company_id} />
              </TabsContent>
              <TabsContent value="quem-ve" className="mt-6">
                <ViewersPanel
                  key={company.company_id}
                  company={company.company_id}
                  name={company.name}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </QueryState>
    </div>
  );
};

export default SharingPage;
