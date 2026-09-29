import React, { useEffect, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { EMPLOYEE_SUBMITTABLE_CATEGORIES } from '@/lib/documents';
import { getErrorMessage } from '@/lib/timeclock';
import { toServiceFields, useDocumentMetadata } from '../../hooks/useDocumentMetadata';
import { documentService } from '../../services/documentService';
import { DocumentMetadataFields } from '../DocumentMetadataFields';
import { FilePickerButtons } from './FilePickerButtons';

interface SubmitDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  /** Tipo pré-selecionado (ex.: "Atualizar Cartão de Cidadão"). */
  presetCategory?: string | null;
  onSubmitted: () => void;
}

const MAX_SIZE_MB = 15;

/** Envio de documento pelo colaborador (fica a aguardar aprovação). */
export const SubmitDocumentDialog: React.FC<SubmitDocumentDialogProps> = ({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  presetCategory,
  onSubmitted,
}) => {
  const { toast } = useToast();
  const { metadata, update, reset } = useDocumentMetadata({ category: presetCategory ?? '' });
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) reset({ category: presetCategory ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao abrir / mudar o tipo pré-definido
  }, [open, presetCategory]);

  const submit = async () => {
    const problem = !metadata.category
      ? 'Escolha o tipo de documento'
      : !file
        ? 'Escolha o ficheiro ou tire uma foto'
        : file.size > MAX_SIZE_MB * 1024 * 1024
          ? `Ficheiro acima de ${MAX_SIZE_MB} MB`
          : null;
    if (problem || !file) {
      toast({ title: problem ?? 'Dados em falta', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    const { error } = await documentService.submitAsEmployee({
      employeeId,
      employeeName,
      file,
      description: description || null,
      ...toServiceFields(metadata),
    });
    setIsSubmitting(false);
    if (error) {
      toast({
        title: 'Erro ao enviar',
        description: getErrorMessage(error, ''),
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Documento enviado',
      description: 'Fica a aguardar aprovação dos Recursos Humanos.',
    });
    setDescription('');
    setFile(null);
    onOpenChange(false);
    onSubmitted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar documento</DialogTitle>
          <DialogDescription>
            Depois de aprovado pelos RH passa a ser o seu documento atual.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <DocumentMetadataFields
            categories={EMPLOYEE_SUBMITTABLE_CATEGORIES}
            value={metadata}
            onChange={update}
            tall
            idPrefix="sub"
          />
          <div className="space-y-1">
            <Label htmlFor="sub-desc">Observações</Label>
            <Input
              id="sub-desc"
              className="h-11"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <FilePickerButtons file={file} onChange={setFile} />
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="gold" className="h-11" onClick={submit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
