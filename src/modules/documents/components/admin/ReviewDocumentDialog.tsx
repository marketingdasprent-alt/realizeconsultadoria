import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { DOCUMENT_CATEGORIES, PAYSLIP_CATEGORY } from '@/lib/documents';
import { getErrorMessage } from '@/lib/timeclock';
import { toServiceFields, useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { documentService, type EmployeeDocumentWithEmployee } from '../../services/documentService';
import { DocumentMetadataFields } from '../DocumentMetadataFields';

interface ReviewDocumentDialogProps {
  doc: EmployeeDocumentWithEmployee;
  onClose: () => void;
  onReviewed: () => void;
}

/** Aprovar um documento submetido: confirmar tipo e preencher nº/validade. */
export const ReviewDocumentDialog: React.FC<ReviewDocumentDialogProps> = ({
  doc,
  onClose,
  onReviewed,
}) => {
  const { toast } = useToast();
  const { metadata, update } = useDocumentMetadata({
    category: doc.category ?? '',
    documentNumber: doc.document_number ?? '',
    issueDate: doc.issue_date ?? '',
    expiryDate: doc.expiry_date ?? '',
    periodMonth: doc.period_month?.slice(0, 7) ?? '',
  });
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const approve = async () => {
    if (!metadata.category) {
      toast({ title: 'Indique o tipo de documento', variant: 'destructive' });
      return;
    }
    if (metadata.category === PAYSLIP_CATEGORY && !metadata.periodMonth) {
      toast({ title: 'Indique o mês do recibo', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const { error } = await documentService.review(doc.id, {
      decision: 'approved',
      notes: notes || null,
      ...toServiceFields(metadata),
    });
    setIsSaving(false);
    if (error) {
      toast({
        title: 'Erro ao aprovar',
        description: getErrorMessage(error, ''),
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Documento aprovado',
      description: 'Passou a ser o documento atual do colaborador.',
    });
    onReviewed();
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aprovar documento</DialogTitle>
          <DialogDescription>
            {doc.employee?.name} · {doc.file_name}
            {doc.description && ` · "${doc.description}"`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <DocumentMetadataFields
            categories={DOCUMENT_CATEGORIES}
            value={metadata}
            onChange={update}
            showIssueDate
            idPrefix="rv"
          />
          <div className="space-y-1">
            <Label htmlFor="rv-notes">Notas internas</Label>
            <Textarea
              id="rv-notes"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={approve} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
