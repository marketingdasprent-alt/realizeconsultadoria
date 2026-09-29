import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { getDocumentCategoryLabel, type EmployeeDocument } from '@/lib/documents';
import { getErrorMessage } from '@/lib/timeclock';
import { useDocumentDownload } from '../../hooks/useDocumentDownload';
import { documentService } from '../../services/documentService';
import { DocumentStatusBadge, ExpiryBadge } from '../DocumentBadges';
import { DocumentRow } from '../DocumentRow';

interface SubmissionsListProps {
  submissions: EmployeeDocument[];
  onChanged: () => void;
}

/** Tudo o que o colaborador enviou, com o estado da aprovação. */
export const SubmissionsList: React.FC<SubmissionsListProps> = ({ submissions, onChanged }) => {
  const { toast } = useToast();
  const { openingId, open } = useDocumentDownload();

  const remove = async (doc: EmployeeDocument) => {
    if (!window.confirm(`Eliminar "${doc.file_name}"?`)) return;
    const { error } = await documentService.remove(doc);
    if (error) {
      toast({ title: 'Erro', description: getErrorMessage(error, ''), variant: 'destructive' });
      return;
    }
    toast({ title: 'Documento eliminado' });
    onChanged();
  };

  if (submissions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">Ainda não enviou documentos.</p>
    );
  }

  return (
    <div className="space-y-2">
      {submissions.map(doc => (
        <DocumentRow
          key={doc.id}
          doc={doc}
          title={getDocumentCategoryLabel(doc.category)}
          meta={
            <>
              {doc.document_number && <span>Nº {doc.document_number}</span>}
              {doc.description && <span className="block">{doc.description}</span>}
              {doc.status === 'rejected' && doc.review_notes && (
                <span className="block text-destructive">Motivo: {doc.review_notes}</span>
              )}
              {doc.status === 'approved' && !doc.is_current && (
                <span className="block">Substituído por uma versão mais recente.</span>
              )}
            </>
          }
          badges={
            <>
              <DocumentStatusBadge status={doc.status} />
              {doc.status === 'approved' && <ExpiryBadge expiryDate={doc.expiry_date} />}
            </>
          }
          isOpening={openingId === doc.id}
          onOpen={() => open(doc)}
          onDelete={doc.status === 'pending' ? () => remove(doc) : undefined}
        />
      ))}
    </div>
  );
};
