import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFileName } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import DocumentUploader from "./DocumentUploader";

interface SelectedFile {
  file: File;
  preview?: string;
}

interface AddDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  absenceId: string | null;
  onSuccess?: () => void;
}

const AddDocumentsDialog = ({
  open,
  onOpenChange,
  absenceId,
  onSuccess,
}: AddDocumentsDialogProps) => {
  const { toast } = useToast();
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleClose = () => {
    if (!isUploading) {
      // Clean up previews
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
      setFiles([]);
      onOpenChange(false);
    }
  };

  const handleUpload = async () => {
    if (!absenceId || files.length === 0) return;

    setIsUploading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Sessão expirada. Por favor, inicie sessão novamente.");
      }

      const uploadPromises = files.map(async (item) => {
        const filePath = `${session.user.id}/${absenceId}/${Date.now()}_${sanitizeFileName(item.file.name)}`;

        const { error: uploadError } = await supabase.storage
          .from("absence-documents")
          .upload(filePath, item.file);

        if (uploadError) {
          console.error("Storage upload error:", uploadError.message, uploadError);
          return { success: false, error: `Storage: ${uploadError.message}` };
        }

        const { error: docError } = await supabase
          .from("absence_documents")
          .insert({
            absence_id: absenceId,
            file_name: item.file.name,
            file_path: filePath,
            file_size: item.file.size,
            mime_type: item.file.type,
            uploaded_by: session.user.id,
          });

        if (docError) {
          console.error("DB insert error:", docError.message, docError);
          // Clean up the uploaded file since DB insert failed
          await supabase.storage.from("absence-documents").remove([filePath]);
          return { success: false, error: `Base de dados: ${docError.message}` };
        }

        return { success: true, error: null };
      });

      const results = await Promise.all(uploadPromises);
      const successCount = results.filter((r) => r.success).length;
      const failedResults = results.filter((r) => !r.success);
      const failedCount = failedResults.length;

      if (successCount > 0) {
        toast({
          title: "Documentos enviados",
          description: `${successCount} documento(s) anexado(s) com sucesso.`,
        });
        onSuccess?.();
        handleClose();
      }

      if (failedCount > 0 && successCount === 0) {
        const firstError = failedResults[0]?.error;
        toast({
          title: "Erro ao enviar documentos",
          description: firstError || "Não foi possível enviar os documentos.",
          variant: "destructive",
        });
      } else if (failedCount > 0) {
        toast({
          title: "Aviso",
          description: `${failedCount} documento(s) não foram carregados.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Anexar Documentos
          </DialogTitle>
          <DialogDescription>
            Adicione documentos justificativos a este pedido de ausência.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <DocumentUploader
            files={files}
            onFilesChange={setFiles}
            disabled={isUploading}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancelar
            </Button>
            <Button
              variant="gold"
              onClick={handleUpload}
              disabled={isUploading || files.length === 0}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A enviar...
                </>
              ) : (
                "Enviar"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddDocumentsDialog;
