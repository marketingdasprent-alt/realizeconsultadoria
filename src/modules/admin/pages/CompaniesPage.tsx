import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Loader2 } from 'lucide-react';
import { AdminPageTitle } from '@/components/admin/AdminPageHeader';
import { CompanyScopeNotice } from '@/components/admin/CompanyScopeNotice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useCompanies } from '@/hooks/useCompanies';
import type { Company } from '@/modules/admin/services/companyService';
import { ROUTES } from '@/lib/constants';
import { AllGroupsPanel } from '../components/sharing/AllGroupsPanel';
import { CompanyRow } from '../components/companies/CompanyRow';
import { PlatformTeamPanel } from '../components/platform/PlatformTeamPanel';
import { useCompanyScope } from '../context/CompanyScopeContext';
import { useCompanyListFacts } from '../hooks/useCompanyListFacts';
import { parseListTab, type ListTab } from '../lib/companyTabs';
import { inScope } from '../lib/companyScope';

const CompaniesPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { canExecuteTopic, isSuperAdmin } = useAdminPermissions();
  const canManage = canExecuteTopic('companies', 'manage');
  // Criar, eliminar e ativar/desativar empresas é da plataforma: o admin de empresa só edita a sua.
  const canAdministerPlatform = canManage && isSuperAdmin;

  const { companies, isLoading, deleteCompany, toggleStatus } = useCompanies();
  const { ids: scopeIds } = useCompanyScope();
  const [params, setParams] = useSearchParams();
  // "Grupos" (criar grupos, pôr e tirar empresas) é só do super admin.
  const listTab = parseListTab(params.get('tab'), isSuperAdmin);
  const changeListTab = (tab: ListTab) =>
    setParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (tab === 'empresas') next.delete('tab');
        else next.set('tab', tab);
        return next;
      },
      { replace: true }
    );
  const facts = useCompanyListFacts(
    companies.map(company => company.id),
    isSuperAdmin
  );

  const [searchTerm, setSearchTerm] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Criar e editar abrem a página completa da empresa (não há pop-up)
  const handleEdit = (company: Company) =>
    navigate(ROUTES.ADMIN.COMPANY_EDIT.replace(':id', company.id));

  const openDeleteDialog = (company: Company) => {
    setCompanyToDelete(company);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!companyToDelete) return;

    setIsActionLoading(true);
    try {
      const { error } = await deleteCompany(companyToDelete.id);
      if (error) throw error;
      toast({ title: 'Empresa eliminada com sucesso!' });
      setDeleteDialogOpen(false);
      setCompanyToDelete(null);
    } catch (error: unknown) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Ocorreu um erro ao eliminar.',
        variant: 'destructive',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleStatus = async (company: Company) => {
    try {
      const { error } = await toggleStatus(company.id, !company.is_active);
      if (error) throw error;

      toast({
        title: 'Estado atualizado',
        description: `A empresa ${company.name} está agora ${!company.is_active ? 'Ativa' : 'Desativada'}.`,
      });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar estado',
        description:
          error instanceof Error ? error.message : 'Ocorreu um erro ao alterar o estado.',
        variant: 'destructive',
      });
    }
  };

  // O menu pode limitar a uma empresa ou grupo: só as empresas dessa escolha.
  const filteredCompanies = companies
    .filter(company => inScope(scopeIds, company.id))
    .filter(
      company =>
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.nif.includes(searchTerm) ||
        company.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <AdminPageTitle title="Empresas" description="Gerir empresas clientes" />

          {canAdministerPlatform && (
            <Button variant="gold" onClick={() => navigate(ROUTES.ADMIN.COMPANY_NEW)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>
          )}
        </div>

        {isSuperAdmin && (
          <nav className="flex gap-1" aria-label="Empresas">
            {(
              [
                ['empresas', 'Empresas'],
                ['grupos', 'Grupos'],
                ['equipa', 'Equipa da plataforma'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => changeListTab(key)}
                aria-current={listTab === key ? 'page' : undefined}
                className={`h-9 rounded-full px-4 text-[13.5px] font-semibold transition-colors ${
                  listTab === key
                    ? 'bg-rz-ink text-white'
                    : 'text-rz-muted hover:bg-white hover:text-rz-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        )}

        {listTab === 'grupos' ? (
          <AllGroupsPanel />
        ) : listTab === 'equipa' ? (
          <PlatformTeamPanel />
        ) : (
          <>
            <CompanyScopeNotice />

            {/* Search */}
            <Card className="shadow-card">
              <CardContent className="pt-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    autoComplete="off"
                    placeholder="Pesquisar por nome, NIF ou email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card className="shadow-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>NIF</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead className="hidden md:table-cell">Cidade</TableHead>
                      <TableHead className="hidden lg:table-cell">Grupo</TableHead>
                      <TableHead className="hidden lg:table-cell">Administradores</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <div className="flex justify-center items-center">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredCompanies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhuma empresa encontrada
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCompanies.map(company => (
                        <CompanyRow
                          key={company.id}
                          company={company}
                          facts={facts.get(company.id)}
                          canManage={canManage}
                          canAdministerPlatform={canAdministerPlatform}
                          onOpen={handleEdit}
                          onToggleStatus={handleToggleStatus}
                          onDelete={openDeleteDialog}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={open => {
            setDeleteDialogOpen(open);
            if (!open) setCompanyToDelete(null);
          }}
          title="Eliminar Empresa"
          description="Tem a certeza que deseja eliminar esta empresa?"
          itemName={companyToDelete?.name}
          onConfirm={handleDelete}
          isLoading={isActionLoading}
        />
      </div>
    </>
  );
};

export default CompaniesPage;
