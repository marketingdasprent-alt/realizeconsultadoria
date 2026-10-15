import { useState } from 'react';
import { format } from 'date-fns';
import { ExternalLink, FileText, FolderOpen, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  formatPeriodMonth,
  getDocumentCategoryLabel,
  PAYSLIP_CATEGORY,
  type EmployeeDocument,
} from '@/lib/documents';
import { getErrorMessage } from '@/lib/timeclock';
import { AdminUploadDocumentDialog } from '@/modules/documents/components/admin/AdminUploadDocumentDialog';
import { DocumentStatusBadge, ExpiryBadge } from '@/modules/documents/components/DocumentBadges';
import { useDocumentDownload } from '@/modules/documents/hooks/useDocumentDownload';
import { useEmployeeDocuments } from '@/modules/documents/hooks/useEmployeeDocuments';
import { documentService } from '@/modules/documents/services/documentService';

interface EmployeeDocumentsTabProps {
  employeeId: string;
}

/** Ficha do colaborador (BO): todos os documentos, com estado e validade. */
const EmployeeDocumentsTab = ({ employeeId }: EmployeeDocumentsTabProps) => {
  const { toast } = useToast();
  const { all, isLoading, refetch } = useEmployeeDocuments(employeeId);
  const { openingId, open } = useDocumentDownload();
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleDelete = async (doc: EmployeeDocument) => {
    if (!window.confirm(`Eliminar "${doc.file_name}"?`)) return;
    const { error } = await documentService.remove(doc);
    if (error) {
      toast({
        title: 'Erro ao eliminar',
        description: getErrorMessage(error, ''),
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Documento eliminado' });
    refetch();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="font-display text-xl flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-gold" />
            Documentos
          </CardTitle>
          <Button variant="gold" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Carregar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
            </div>
          ) : all.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum documento</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead className="hidden md:table-cell">Nº / Mês</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden sm:table-cell">Data</TableHead>
                  <TableHead className="w-[90px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {all.map(doc => (
                  <TableRow
                    key={doc.id}
                    className={doc.status === 'approved' && !doc.is_current ? 'opacity-60' : ''}
                  >
                    <TableCell>
                      <p className="font-medium">{getDocumentCategoryLabel(doc.category)}</p>
                      <p className="max-w-[240px] truncate text-xs text-muted-foreground">
                        {doc.file_name}
                        {doc.uploaded_by_role === 'employee' && ' · enviado pelo colaborador'}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {doc.category === PAYSLIP_CATEGORY
                        ? formatPeriodMonth(doc.period_month)
                        : (doc.document_number ?? '—')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <DocumentStatusBadge status={doc.status} />
                        {doc.is_current && doc.status === 'approved' && (
                          <ExpiryBadge expiryDate={doc.expiry_date} />
                        )}
                        {doc.status === 'approved' &&
                          !doc.is_current &&
                          doc.category !== PAYSLIP_CATEGORY && (
                            <span className="text-xs text-muted-foreground">substituído</span>
                          )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">
                      {format(new Date(doc.created_at), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => open(doc)}
                          disabled={openingId === doc.id}
                          aria-label="Abrir"
                        >
                          {openingId === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ExternalLink className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(doc)}
                          className="text-destructive hover:text-destructive"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AdminUploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        employeeId={employeeId}
        onUploaded={refetch}
      />
    </div>
  );
};

export default EmployeeDocumentsTab;
