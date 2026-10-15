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
import { getErrorMessage } from '@/lib/timeclock';
import { documentService, type EmployeeDocumentWithEmployee } from '../../services/documentService';

interface RejectDocumentDialogProps {
  doc: EmployeeDocumentWithEmployee;
  onClose: () => void;
  onReviewed: () => void;
}

/** Rejeitar com motivo; o colaborador vê o motivo na app e pode reenviar. */
export const RejectDocumentDialog: React.FC<RejectDocumentDialogProps> = ({
  doc,
  onClose,
  onReviewed,
}) => {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const reject = async () => {
    if (reason.trim().length < 3) {
      toast({ title: 'Indique o motivo (visível ao colaborador)', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const { error } = await documentService.review(doc.id, {
      decision: 'rejected',
      notes: reason.trim(),
    });
    setIsSaving(false);
    if (error) {
      toast({ title: 'Erro', description: getErrorMessage(error, ''), variant: 'destructive' });
      return;
    }
    toast({ title: 'Documento rejeitado' });
    onReviewed();
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rejeitar documento</DialogTitle>
          <DialogDescription>
            {doc.employee?.name} · {doc.file_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="rj-reason">Motivo *</Label>
          <Textarea
            id="rj-reason"
            rows={3}
            placeholder="Ex.: imagem ilegível, falta a frente do cartão…"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={reject} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Rejeitar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
