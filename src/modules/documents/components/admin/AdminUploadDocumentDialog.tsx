import React, { useState } from 'react';
import { FileText, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ADMIN_UPLOAD_CATEGORIES } from '@/lib/documents';
import { getErrorMessage } from '@/lib/timeclock';
import { toServiceFields, useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { documentService } from '../../services/documentService';
import { DocumentMetadataFields } from '../DocumentMetadataFields';

interface AdminUploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  onUploaded: () => void;
}

/** Upload pelo BackOffice: fica aprovado e passa a ser o documento atual do tipo. */
export const AdminUploadDocumentDialog: React.FC<AdminUploadDocumentDialogProps> = ({
  open,
  onOpenChange,
  employeeId,
  onUploaded,
}) => {
  const { toast } = useToast();
  const { metadata, update, reset } = useDocumentMetadata();
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    if (!metadata.category || !file) {
      toast({ title: 'Indique o tipo e o ficheiro', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const { error } = await documentService.uploadAsAdmin({
      employeeId,
      file,
      description: description || null,
      ...toServiceFields(metadata),
    });
    setIsSaving(false);
    if (error) {
      toast({ title: 'Erro', description: getErrorMessage(error, ''), variant: 'destructive' });
      return;
    }
    toast({ title: 'Documento carregado' });
    reset();
    setDescription('');
    setFile(null);
    onOpenChange(false);
    onUploaded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carregar documento</DialogTitle>
          <DialogDescription>Fica aprovado e visível ao colaborador de imediato.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <DocumentMetadataFields
            categories={ADMIN_UPLOAD_CATEGORIES}
            value={metadata}
            onChange={update}
            showIssueDate
            idPrefix="au"
          />
          <div className="space-y-1">
            <Label htmlFor="au-desc">Descrição</Label>
            <Input
              id="au-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="space-y-1">
            <Label>Ficheiro *</Label>
            <label className="flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
              <FileText className="h-4 w-4" />
              <span className="truncate">{file ? file.name : 'Selecionar ficheiro…'}</span>
              <input
                type="file"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Carregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
