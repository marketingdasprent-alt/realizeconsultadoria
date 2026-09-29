import React from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EXPIRY_WARNING_DAYS, getDocumentCategoryLabel } from '@/lib/documents';
import { useDocumentDownload } from '../../hooks/useDocumentDownload';
import type { EmployeeDocumentWithEmployee } from '../../services/documentService';
import { ExpiryBadge } from '../DocumentBadges';

interface ExpiringDocumentsTabProps {
  expiring: EmployeeDocumentWithEmployee[];
}

/** Documentos atuais expirados ou a expirar nos próximos 60 dias. */
export const ExpiringDocumentsTab: React.FC<ExpiringDocumentsTabProps> = ({ expiring }) => {
  const { openingId, open } = useDocumentDownload();

  if (expiring.length === 0) {
    return (
      <p className="py-10 text-center text-muted-foreground">
        Nenhum documento expira nos próximos {EXPIRY_WARNING_DAYS} dias.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Colaborador</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Nº</TableHead>
            <TableHead>Validade</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {expiring.map(doc => (
            <TableRow key={doc.id}>
              <TableCell>
                <p className="font-medium">{doc.employee?.name}</p>
                <p className="text-xs text-muted-foreground">{doc.employee?.companies?.name}</p>
              </TableCell>
              <TableCell>{getDocumentCategoryLabel(doc.category)}</TableCell>
              <TableCell className="text-sm">{doc.document_number ?? '—'}</TableCell>
              <TableCell>
                <ExpiryBadge expiryDate={doc.expiry_date} />
              </TableCell>
              <TableCell className="text-right">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
