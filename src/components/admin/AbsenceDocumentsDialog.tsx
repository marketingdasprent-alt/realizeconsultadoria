import { useState, useEffect } from "react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Download, ExternalLink, FileText, Image as ImageIcon, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AbsenceDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface AbsenceDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  absenceId: string | null;
  employeeName?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AbsenceDocumentsDialog = ({
  open,
  onOpenChange,
  absenceId,
  employeeName,
}: AbsenceDocumentsDialogProps) => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<AbsenceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);

  useEffect(() => {
    if (open && absenceId) {
      fetchDocuments();
    } else {
      setDocuments([]);
      setPreviewUrl(null);
      setPreviewType(null);
    }
  }, [open, absenceId]);

  const fetchDocuments = async () => {
    if (!absenceId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("absence_documents")
        .select("*")
        .eq("absence_id", absenceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error("Error fetching documents:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os documentos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (doc: AbsenceDocument) => {
    setLoadingFile(doc.id);
    console.log("Iniciando download robusto para:", doc.file_name);
    
    try {
      let signedUrl = null;
      let finalBucket = "absence-documents";
      
      // Lista de buckets para tentar encontrar o ficheiro
      const buckets = [
        "absence-documents",
        "employee-files",
        "employees",
        "documents",
        "legal_documents"
      ];

      // Limpar o caminho do ficheiro (remover slash inicial se existir)
      const cleanPath = doc.file_path.startsWith('/') 
        ? doc.file_path.substring(1) 
        : doc.file_path;

      // 1. Tentar obter Signed URL em cada bucket
      for (const bucket of buckets) {
        console.log(`A tentar bucket: ${bucket}...`);
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(cleanPath, 60);

        if (data?.signedUrl) {
          signedUrl = data.signedUrl;
          finalBucket = bucket;
          console.log(`Sucesso! Ficheiro encontrado no bucket: ${bucket}`);
          break;
        }
      }

      // 2. Se falhar Signed URL, tentar URL Público como fallback
      if (!signedUrl) {
        console.log("Signed URL falhou em todos os buckets. A tentar URL público...");
        for (const bucket of buckets) {
          const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
          if (data?.publicUrl) {
            // Verificar se o ficheiro existe mesmo (HEAD request)
            try {
              const res = await fetch(data.publicUrl, { method: 'HEAD' });
              if (res.ok) {
                signedUrl = data.publicUrl;
                console.log(`Ficheiro encontrado via URL público no bucket: ${bucket}`);
                break;
              }
            } catch (e) {
              continue;
            }
          }
        }
      }

      if (signedUrl) {
        const response = await fetch(signedUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Download concluído",
          description: `Ficheiro recuperado de: ${finalBucket}`,
        });
      } else {
        throw new Error("Ficheiro não encontrado em nenhum local conhecido.");
      }
    } catch (error: any) {
      console.error("Download error:", error);
      toast({
        title: "Erro no download",
        description: error.message || "Não foi possível descarregar o ficheiro.",
        variant: "destructive",
      });
    } finally {
      setLoadingFile(null);
    }
  };

  const handlePreview = async (doc: AbsenceDocument) => {
    setLoadingFile(doc.id);
    try {
      // Usar a mesma lógica de busca para o preview
      const buckets = ["absence-documents", "employee-files", "employees", "documents"];
      const cleanPath = doc.file_path.startsWith('/') ? doc.file_path.substring(1) : doc.file_path;
      let previewUrl = null;

      for (const bucket of buckets) {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(cleanPath, 3600);
        if (data?.signedUrl) {
          previewUrl = data.signedUrl;
          break;
        }
      }

      if (previewUrl) {
        if (doc.mime_type === "application/pdf") {
          window.open(previewUrl, "_blank");
        } else {
          setPreviewUrl(previewUrl);
          setPreviewType(doc.mime_type);
        }
      } else {
        toast({
          title: "Erro na pré-visualização",
          description: "Não foi possível localizar o ficheiro para visualização.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Preview error:", error);
    } finally {
      setLoadingFile(null);
    }
  };

  const isImage = (mimeType: string) => mimeType.startsWith("image/");
  const isPDF = (mimeType: string) => mimeType === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Documentos do Pedido
            {employeeName && (
              <span className="text-muted-foreground font-normal text-base block mt-1">
                {employeeName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Image Preview */}
        {previewUrl && previewType && isImage(previewType) && (
          <div className="relative bg-secondary rounded-lg overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-auto max-h-[400px] object-contain"
            />
          </div>
        )}

        {/* Documents List */}
        <div className="space-y-3 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum documento anexado.</p>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 p-3 bg-secondary rounded-lg"
              >
                {/* Icon */}
                <div className="w-10 h-10 flex-shrink-0 rounded bg-muted flex items-center justify-center">
                  {isPDF(doc.mime_type) ? (
                    <FileText className="h-5 w-5 text-red-500" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-blue-500" />
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(doc.file_size)} •{" "}
                    {format(new Date(doc.created_at), "dd MMM yyyy", { locale: pt })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handlePreview(doc)}
                    disabled={loadingFile === doc.id}
                    title={isPDF(doc.mime_type) ? "Abrir" : "Pré-visualizar"}
                  >
                    {loadingFile === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(doc)}
                    disabled={loadingFile === doc.id}
                    title="Descarregar"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AbsenceDocumentsDialog;
