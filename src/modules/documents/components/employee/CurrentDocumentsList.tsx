import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getDocumentCategory,
  getDocumentCategoryLabel,
  type EmployeeDocument,
} from '@/lib/documents';
import { useDocumentDownload } from '../../hooks/useDocumentDownload';
import { ExpiryBadge } from '../DocumentBadges';
import { DocumentRow } from '../DocumentRow';

interface CurrentDocumentsListProps {
  documents: EmployeeDocument[];
  archived: EmployeeDocument[];
  onUpdate: (category: string) => void;
}

/** Documentos aprovados e em vigor, com nº e validade. */
export const CurrentDocumentsList: React.FC<CurrentDocumentsListProps> = ({
  documents,
  archived,
  onUpdate,
}) => {
  const { openingId, open } = useDocumentDownload();

  if (documents.length === 0 && archived.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Ainda não tem documentos aprovados. Envie o seu Cartão de Cidadão, NIF, NISS e comprovativo
        de IBAN para os RH validarem.
      </p>
    );
  }

  const renderRow = (doc: EmployeeDocument, allowUpdate: boolean) => (
    <DocumentRow
      key={doc.id}
      doc={doc}
      title={getDocumentCategoryLabel(doc.category)}
      meta={
        <>
          {doc.document_number && <span>Nº {doc.document_number}</span>}
          {doc.description && <span className="block">{doc.description}</span>}
        </>
      }
      badges={
        <>
          <ExpiryBadge expiryDate={doc.expiry_date} />
          {allowUpdate && getDocumentCategory(doc.category)?.employeeCanSubmit && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => onUpdate(doc.category ?? '')}
            >
              <RefreshCw className="mr-1 h-3 w-3" /> Enviar versão atualizada
            </Button>
          )}
        </>
      }
      isOpening={openingId === doc.id}
      onOpen={() => open(doc)}
    />
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">{documents.map(doc => renderRow(doc, true))}</div>
      {archived.length > 0 && (
        <details className="rounded-lg border border-dashed border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Outros documentos da empresa ({archived.length})
          </summary>
          <div className="mt-3 space-y-2">{archived.map(doc => renderRow(doc, false))}</div>
        </details>
      )}
    </div>
  );
};
