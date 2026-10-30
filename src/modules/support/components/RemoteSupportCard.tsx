import React from 'react';
import { ChevronDown, Download, MonitorSmartphone } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { remoteSupportFor } from '../lib/remoteSupport';

/**
 * Apoio remoto: descarregar o programa de suporte (Windows) da organização da pessoa, para a
 * equipa de TI poder ajudar à distância. A da empresa da ficha vem primeiro.
 */
export const RemoteSupportCard: React.FC = () => {
  const { user } = useWorkspace();
  const { orgs, mine } = remoteSupportFor(user.companyName);
  const main = orgs[0];

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-rz-canvas px-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rz-primary shadow-sm">
        <MonitorSmartphone className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold">Apoio remoto</span>
        <span className="block text-[11.5px] leading-snug text-rz-muted">
          Instale no computador (Windows) para a equipa de TI o poder ajudar.
        </span>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-rz-primary px-3 text-[12.5px] font-semibold text-white"
          >
            <Download className="h-3.5 w-3.5" /> Instalar <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-2xl p-1.5">
          <p className="px-2 pb-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-rz-muted">
            Escolha a sua organização
          </p>
          {orgs.map(org => (
            <DropdownMenuItem key={org.key} asChild className="rounded-xl">
              <a href={org.url} target="_blank" rel="noopener noreferrer">
                <span className="flex-1 font-semibold">{org.name}</span>
                {org.key === mine && (
                  <span className="text-[11px] font-semibold text-rz-primary">a sua empresa</span>
                )}
              </a>
            </DropdownMenuItem>
          ))}
          {!mine && main && (
            <p className="px-2 pb-1 pt-1.5 text-[11px] text-rz-muted">
              Não sabe qual? Pergunte à equipa de TI.
            </p>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
