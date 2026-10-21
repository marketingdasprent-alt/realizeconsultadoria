import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AdminPageTitle } from '@/components/admin/AdminPageHeader';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useToast } from '@/hooks/use-toast';
import { ROUTES } from '@/lib/constants';
import { ExpiringDocumentsTab } from '../components/admin/ExpiringDocumentsTab';
import { PayslipImportTab } from '../components/admin/PayslipImportTab';
import { PendingDocumentsTab } from '../components/admin/PendingDocumentsTab';
import { useDocumentReview } from '../hooks/useDocumentReview';

/** BackOffice: aprovação de documentos, recibos de vencimento e validades. */
const DocumentsAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canView, canExecuteTopic, isLoading: loadingPermissions } = useAdminPermissions();
  const { pending, expiring, isLoading, error, refetch } = useDocumentReview();

  useEffect(() => {
    if (!loadingPermissions && !canView('employees')) {
      toast({
        title: 'Acesso Negado',
        description: 'Não tem permissão para gerir documentos.',
        variant: 'destructive',
      });
      navigate(ROUTES.ADMIN.DASHBOARD);
    }
  }, [canView, loadingPermissions, navigate, toast]);

  if (loadingPermissions || !canView('employees')) return null;
  const canEdit = canExecuteTopic('employees', 'edit');

  return (
    <div className="space-y-6">
      <AdminPageTitle
        title="Documentos"
        description="Documentos enviados pelos colaboradores para aprovação, recibos de vencimento e validades."
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Tabs defaultValue="pending">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="pending" className="gap-2">
            Por aprovar
            {pending.length > 0 && (
              <Badge className="bg-amber-500 hover:bg-amber-500">{pending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="payslips">Recibos de vencimento</TabsTrigger>
          <TabsTrigger value="expiring" className="gap-2">
            Validades
            {expiring.length > 0 && <Badge variant="destructive">{expiring.length}</Badge>}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <PendingDocumentsTab pending={pending} canReview={canEdit} onChanged={refetch} />
          )}
        </TabsContent>
        <TabsContent value="payslips" className="mt-4">
          <PayslipImportTab canImport={canEdit} />
        </TabsContent>
        <TabsContent value="expiring" className="mt-4">
          <ExpiringDocumentsTab expiring={expiring} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DocumentsAdminPage;
