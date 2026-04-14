import { useState, useEffect } from "react";
import { FileText, Download, Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EmployeeDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  category: string | null;
  description: string | null;
  created_at: string;
}

const DOCUMENT_CATEGORIES = [
  { value: "contrato", label: "Contrato" },
  { value: "ficha_admissao", label: "Ficha de Admissão" },
  { value: "certificado", label: "Certificado" },
  { value: "documento_identificacao", label: "Documento de Identificação" },
  { value: "comunicado", label: "Comunicado" },
  { value: "outro", label: "Outro" },
];

interface EmployeeDocumentsSectionProps {
  employeeId: string;
}

const EmployeeDocumentsSection = ({ employeeId }: EmployeeDocumentsSectionProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);

  useEffect(() => {
    fetchDocuments();
  }, [employeeId]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (doc: EmployeeDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from("employee-files")
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Erro ao descarregar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getCategoryLabel = (value: string | null) => {
    if (!value) return null;
    return DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label || value;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="py-10 lg:py-12 text-center">
          <FileText className="h-10 w-10 lg:h-12 lg:w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-sm lg:text-base">
            Ainda não tem documentos disponíveis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 lg:space-y-4">
      {documents.map((doc) => {
        const category = getCategoryLabel(doc.category);
        return (
          <Card key={doc.id} className="shadow-card">
            <CardContent className="p-3 lg:p-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <FileText className="h-5 w-5 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm lg:text-base truncate">
                    {doc.file_name}
                  </p>
                  {doc.description && (
                    <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {doc.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    {category && (
                      <span className="bg-muted px-2 py-0.5 rounded-full">{category}</span>
                    )}
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={() => handleDownload(doc)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default EmployeeDocumentsSection;
