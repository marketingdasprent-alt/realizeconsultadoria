import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Eye, Inbox, KeyRound, Link2, Users } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GroupPanel } from '../sharing/GroupPanel';
import { RequestShareDialog } from '../sharing/RequestShareDialog';
import { RequestsPanel } from '../sharing/RequestsPanel';
import { ShareCodeCard } from '../sharing/ShareCodeCard';
import { SharesPanel } from '../sharing/SharesPanel';
import { ViewersPanel } from '../sharing/ViewersPanel';
import { parseShareSub, type ShareSub } from '../../lib/companyTabs';
import { companyLabel } from '../../lib/sharing';

const SUBS: { value: ShareSub; label: string; icon: typeof KeyRound }[] = [
  { value: 'codigo', label: 'Código', icon: KeyRound },
  { value: 'pedidos', label: 'Pedidos', icon: Inbox },
  { value: 'acesso', label: 'Quem tem acesso', icon: Link2 },
  { value: 'grupo', label: 'Grupo', icon: Users },
  { value: 'quem-ve', label: 'Quem pode ver', icon: Eye },
];

interface CompanySharingProps {
  company: { id: string; name: string };
}

/**
 * Partilha de uma empresa (o que era a página "Partilha entre empresas"): código de ligação,
 * pedidos, quem tem acesso, grupo e quem pode ver. A empresa vem da ficha, já fixada.
 */
export const CompanySharing: React.FC<CompanySharingProps> = ({ company }) => {
  const [params, setParams] = useSearchParams();
  const sub = parseShareSub(params.get('sub'));
  const change = (value: string) =>
    setParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (value === 'codigo') next.delete('sub');
        else next.set('sub', value);
        return next;
      },
      { replace: true }
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-[220px] flex-1 text-[14px] text-rz-muted">
          Escolha o que cada empresa pode ver ou fazer nos dados desta.
        </p>
        <RequestShareDialog company={company.id} />
      </div>
      <Tabs value={sub} onValueChange={change} className="w-full">
        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <TabsList className="inline-flex h-10 w-auto">
            {SUBS.map(({ value, label, icon: Icon }) => (
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
          <ShareCodeCard key={company.id} company={company.id} />
        </TabsContent>
        <TabsContent value="pedidos" className="mt-6">
          <RequestsPanel key={company.id} company={company.id} />
        </TabsContent>
        <TabsContent value="acesso" className="mt-6">
          <SharesPanel key={company.id} company={company.id} />
        </TabsContent>
        <TabsContent value="grupo" className="mt-6">
          <GroupPanel key={company.id} company={company.id} />
        </TabsContent>
        <TabsContent value="quem-ve" className="mt-6">
          <ViewersPanel key={company.id} company={company.id} name={companyLabel(company.name)} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
