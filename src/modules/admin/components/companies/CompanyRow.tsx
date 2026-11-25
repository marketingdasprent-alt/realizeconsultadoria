import React from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { CompanyLogo } from '@/components/admin/CompanyLogo';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import { companyLabel } from '@/lib/companyName';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Company } from '@/modules/admin/services/companyService';
import type { CompanyFacts } from '../../hooks/useCompanyListFacts';

interface CompanyRowProps {
  company: Company;
  facts?: CompanyFacts;
  /** Pode abrir a ficha (a linha inteira é clicável). */
  canManage: boolean;
  /** Pode ativar, desativar e eliminar (só o super admin). */
  canAdministerPlatform: boolean;
  onOpen: (company: Company) => void;
  onToggleStatus: (company: Company) => void;
  onDelete: (company: Company) => void;
}

/** Cliques nestes elementos têm a sua própria ação: não abrem a ficha. */
const OWN_ACTION = '[data-row-action],a,button,[role=menuitem]';

/**
 * Uma empresa na lista. A linha inteira abre a ficha com o rato; com o teclado o nome é a ligação
 * (Tab e Enter). O estado e os 3 pontos têm a sua ação e não abrem a ficha.
 */
export const CompanyRow: React.FC<CompanyRowProps> = ({
  company,
  facts,
  canManage,
  canAdministerPlatform,
  onOpen,
  onToggleStatus,
  onDelete,
}) => {
  const name = companyLabel(company.name);
  return (
    <TableRow
      onClick={event => {
        if (!canManage || (event.target as HTMLElement).closest(OWN_ACTION)) return;
        // Ctrl/Cmd/Shift/Alt+clique, botão do meio ou direito: não são "abrir".
        if (
          event.button !== 0 ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        // Duplo clique (o 2.º clique) e cliques que terminam uma seleção de texto também não.
        if (event.detail > 1 || window.getSelection()?.toString()) return;
        onOpen(company);
      }}
      className={cn(canManage && 'cursor-pointer focus-within:bg-muted/50')}
    >
      <TableCell className="font-medium">
        <div className="flex items-center gap-3">
          <CompanyLogo name={company.name} logoPath={company.logo_path} size="sm" />
          {canManage ? (
            <Link
              to={ROUTES.ADMIN.COMPANY_EDIT.replace(':id', company.id)}
              className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rz-primary"
            >
              {name}
            </Link>
          ) : (
            name
          )}
        </div>
      </TableCell>
      <TableCell>{company.nif}</TableCell>
      <TableCell className="hidden md:table-cell">{company.email}</TableCell>
      <TableCell className="hidden md:table-cell">{company.city || '-'}</TableCell>
      <TableCell className="hidden lg:table-cell">{facts?.group ?? '—'}</TableCell>
      <TableCell className="hidden lg:table-cell">{facts?.admins ?? '—'}</TableCell>
      <TableCell className="py-1 px-2">
        {canAdministerPlatform ? (
          <button
            type="button"
            data-row-action
            onClick={() => onToggleStatus(company)}
            aria-label={`${company.is_active ? 'Ativa' : 'Desativada'}: ${company.is_active ? 'desativar' : 'ativar'} ${name}`}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rz-primary"
          >
            {/* span (o Badge é um div, que não pode estar dentro de um botão) com o mesmo aspeto */}
            <span
              className={cn(
                badgeVariants({ variant: company.is_active ? 'default' : 'secondary' }),
                'cursor-pointer py-0 text-xs transition-opacity hover:opacity-80'
              )}
            >
              {company.is_active ? 'Ativa' : 'Desativada'}
            </span>
          </button>
        ) : (
          <Badge variant={company.is_active ? 'default' : 'secondary'} className="py-0 text-xs">
            {company.is_active ? 'Ativa' : 'Desativada'}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {canAdministerPlatform && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-row-action
                aria-label={`Mais ações de ${name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            {/* O menu está num portal, mas os cliques sobem pela árvore do React até à linha */}
            <DropdownMenuContent align="end" onClick={event => event.stopPropagation()}>
              <DropdownMenuItem onClick={() => onDelete(company)} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
};
