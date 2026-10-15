import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderOpen, Loader2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CurrentDocumentsList } from '@/modules/documents/components/employee/CurrentDocumentsList';
import { PayslipsList } from '@/modules/documents/components/employee/PayslipsList';
import { SubmissionsList } from '@/modules/documents/components/employee/SubmissionsList';
import { SubmitDocumentDialog } from '@/modules/documents/components/employee/SubmitDocumentDialog';
import { useEmployeeDocuments } from '@/modules/documents/hooks/useEmployeeDocuments';
import { useEmployeeOutlet } from '../hooks/useEmployeeOutlet';

/** Documentos do colaborador: atuais, recibos e os que enviou. */
const EmployeeDocumentsPage: React.FC = () => {
  const { employee } = useEmployeeOutlet();
  const [searchParams, setSearchParams] = useSearchParams();
  const { current, archived, payslips, submissions, isLoading, error, refetch } =
    useEmployeeDocuments(employee.id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [presetCategory, setPresetCategory] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('enviar')) {
      setPresetCategory(searchParams.get('tipo'));
      setDialogOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openSubmit = (category: string | null = null) => {
    setPresetCategory(category);
    setDialogOpen(true);
  };

  const pendingCount = submissions.filter(s => s.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-xl font-semibold">
          <FolderOpen className="h-5 w-5 text-gold" /> Documentos
        </h1>
        <Button variant="gold" className="h-11" onClick={() => openSubmit()}>
          <Upload className="mr-2 h-4 w-4" /> Enviar
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : (
        <Tabs defaultValue="current">
          <TabsList className="grid h-11 w-full grid-cols-3">
            <TabsTrigger value="current">Atuais</TabsTrigger>
            <TabsTrigger value="payslips">Recibos</TabsTrigger>
            <TabsTrigger value="submissions" className="gap-1">
              Enviados
              {pendingCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="current" className="mt-4">
            <CurrentDocumentsList documents={current} archived={archived} onUpdate={openSubmit} />
          </TabsContent>
          <TabsContent value="payslips" className="mt-4">
            <PayslipsList payslips={payslips} />
          </TabsContent>
          <TabsContent value="submissions" className="mt-4">
            <SubmissionsList submissions={submissions} onChanged={refetch} />
          </TabsContent>
        </Tabs>
      )}

      <SubmitDocumentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employeeId={employee.id}
        employeeName={employee.name}
        presetCategory={presetCategory}
        onSubmitted={refetch}
      />
    </div>
  );
};

export default EmployeeDocumentsPage;
