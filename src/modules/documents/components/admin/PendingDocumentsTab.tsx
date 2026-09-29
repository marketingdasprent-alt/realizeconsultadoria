import React, { useState } from 'react';
import { format } from 'date-fns';
import { Check, ExternalLink, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatFileSize, getDocumentCategoryLabel } from '@/lib/documents';
import { useDocumentDownload } from '../../hooks/useDocumentDownload';
import type { EmployeeDocumentWithEmployee } from '../../services/documentService';
import { RejectDocumentDialog } from './RejectDocumentDialog';
import { ReviewDocumentDialog } from './ReviewDocumentDialog';

interface PendingDocumentsTabProps {
  pending: EmployeeDocumentWithEmployee[];
  canReview: boolean;
  onChanged: () => void;
}

type DialogState = { mode: 'approve' | 'reject'; doc: EmployeeDocumentWithEmployee } | null;

/** Fila de documentos submetidos pelos colaboradores, à espera de decisão. */
export const PendingDocumentsTab: React.FC<PendingDocumentsTabProps> = ({
  pending,
  canReview,
  onChanged,
}) => {
  const { openingId, open } = useDocumentDownload();
  const [dialog, setDialog] = useState<DialogState>(null);

  if (pending.length === 0) {
    return (
      <p className="py-10 text-center text-muted-foreground">
        Nenhum documento à espera de aprovação.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map(doc => (
        <Card key={doc.id} className="shadow-card">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{doc.employee?.name ?? 'Colaborador'}</span>
                <span className="text-xs text-muted-foreground">
                  {doc.employee?.companies?.name}
                </span>
                <Badge variant="secondary">{getDocumentCategoryLabel(doc.category)}</Badge>
              </div>
              <p className="mt-1 truncate text-sm">
                {doc.file_name}{' '}
                <span className="text-muted-foreground">
                  · {formatFileSize(doc.file_size)} · enviado{' '}
                  {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}
                </span>
              </p>
              {(doc.document_number || doc.expiry_date || doc.description) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {doc.document_number && <>Nº indicado: {doc.document_number} · </>}
                  {doc.expiry_date && (
                    <>Validade indicada: {format(new Date(doc.expiry_date), 'dd/MM/yyyy')} · </>
                  )}
                  {doc.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => open(doc)}
                disabled={openingId === doc.id}
              >
                {openingId === doc.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-1 h-4 w-4" />
                )}
                Ver
              </Button>
              {canReview && (
                <>
                  <Button size="sm" onClick={() => setDialog({ mode: 'approve', doc })}>
                    <Check className="mr-1 h-4 w-4" /> Aprovar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDialog({ mode: 'reject', doc })}
                  >
                    <X className="mr-1 h-4 w-4" /> Rejeitar
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {dialog?.mode === 'approve' && (
        <ReviewDocumentDialog
          doc={dialog.doc}
          onClose={() => setDialog(null)}
          onReviewed={() => {
            setDialog(null);
            onChanged();
          }}
        />
      )}
      {dialog?.mode === 'reject' && (
        <RejectDocumentDialog
          doc={dialog.doc}
          onClose={() => setDialog(null)}
          onReviewed={() => {
            setDialog(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
};
