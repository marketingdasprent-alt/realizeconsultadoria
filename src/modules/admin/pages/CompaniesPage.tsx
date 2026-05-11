import { useState } from 'react';
import { Plus, Search, Edit, Trash2, MoreHorizontal, Loader2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useCompanies } from '@/hooks/useCompanies';
import { CompanyForm } from '../components/CompanyForm';
import type { Company } from '@/modules/admin/services/companyService';
import type { CreateCompanyInput } from '@/lib/schemas';

const CompaniesPage = () => {
  const { toast } = useToast();
  const { canExecuteTopic } = useAdminPermissions();
  const canManage = canExecuteTopic('companies', 'manage');

  const { companies, isLoading, createCompany, updateCompany, deleteCompany, toggleStatus } =
    useCompanies();

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const handleSubmit = async (data: CreateCompanyInput) => {
    setIsActionLoading(true);
    try {
      if (editingCompany) {
        const { error } = await updateCompany(editingCompany.id, data);
        if (error) throw error;
        toast({ title: 'Empresa atualizada com sucesso!' });
      } else {
        const { error } = await createCompany(data);
        if (error) throw error;
        toast({ title: 'Empresa criada com sucesso!' });
      }
      setIsDialogOpen(false);
      setEditingCompany(null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao guardar.',
        variant: 'destructive',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setIsDialogOpen(true);
  };

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
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao eliminar.',
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
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar estado',
        description: error.message || 'Ocorreu um erro ao alterar o estado.',
        variant: 'destructive',
      });
    }
  };

  const filteredCompanies = companies.filter(
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
          <div>
            <h1 className="font-display text-3xl font-semibold">Empresas</h1>
            <p className="text-muted-foreground mt-1">Gerir empresas clientes</p>
          </div>

          <Dialog
            open={isDialogOpen}
            onOpenChange={open => {
              setIsDialogOpen(open);
              if (!open) setEditingCompany(null);
            }}
          >
            {canManage && (
              <DialogTrigger asChild>
                <Button variant="gold">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Empresa
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl">
                  {editingCompany ? 'Editar Empresa' : 'Nova Empresa'}
                </DialogTitle>
              </DialogHeader>
              <CompanyForm
                initialData={editingCompany}
                onSubmit={handleSubmit}
                onCancel={() => setIsDialogOpen(false)}
                isLoading={isActionLoading}
              />
            </DialogContent>
          </Dialog>
        </div>

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
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex justify-center items-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredCompanies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma empresa encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCompanies.map(company => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>{company.nif}</TableCell>
                      <TableCell className="hidden md:table-cell">{company.email}</TableCell>
                      <TableCell className="hidden md:table-cell">{company.city || '-'}</TableCell>
                      <TableCell
                        className="py-1 px-2"
                        onClick={e => {
                          if (canManage) {
                            e.stopPropagation();
                            handleToggleStatus(company);
                          }
                        }}
                      >
                        <Badge
                          variant={company.is_active ? 'default' : 'secondary'}
                          className={`text-xs py-0 ${canManage ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                        >
                          {company.is_active ? 'Ativa' : 'Desativada'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canManage && (
                              <DropdownMenuItem onClick={() => handleEdit(company)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {canManage && (
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(company)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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
