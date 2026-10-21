import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PendingDocumentsTab } from '@/modules/documents/components/admin/PendingDocumentsTab';
import type { EmployeeDocumentWithEmployee } from '@/modules/documents/services/documentService';

interface PendingDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: EmployeeDocumentWithEmployee[];
  canReview: boolean;
  onChanged: () => void;
}

/** Documentos enviados pelos colaboradores à espera de aprovação, de todos, num só sítio. */
export const PendingDocumentsDialog: React.FC<PendingDocumentsDialogProps> = ({
  open,
  onOpenChange,
  pending,
  canReview,
  onChanged,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-3xl flex-col gap-4 overflow-hidden rounded-[24px] font-jakarta">
      <DialogHeader>
        <DialogTitle className="text-[20px] font-extrabold">Documentos por aprovar</DialogTitle>
        <DialogDescription>
          Enviados pelos colaboradores na app. Ao aprovar, confirme o tipo, o número e a validade.
        </DialogDescription>
      </DialogHeader>
      <div className="rz-scroll -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
        <PendingDocumentsTab pending={pending} canReview={canReview} onChanged={onChanged} />
      </div>
    </DialogContent>
  </Dialog>
);
