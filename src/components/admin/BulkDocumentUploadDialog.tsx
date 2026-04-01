import { useState, useEffect, useRef } from "react";
import { Upload, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BulkDocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DOCUMENT_CATEGORIES = [
  { value: "contrato", label: "Contrato" },
  { value: "ficha_admissao", label: "Ficha de Admissão" },
  { value: "certificado", label: "Certificado" },
  { value: "documento_identificacao", label: "Documento de Identificação" },
  { value: "comunicado", label: "Comunicado" },
  { value: "outro", label: "Outro" },
];

const BulkDocumentUploadDialog = ({ open, onOpenChange }: BulkDocumentUploadDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCompanies();
    }
  }, [open]);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    setCompanies(data || []);
  };

  const sanitizeFileName = (fileName: string): string => {
    const normalized = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return normalized.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "");
  };

  const resetForm = () => {
    setSelectedCompanyId("");
    setSelectedCategory("");
    setDescription("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!selectedCompanyId || !selectedFile) return;

    setIsSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Utilizador não autenticado");

      // 1. Upload file once
      const sanitizedName = sanitizeFileName(selectedFile.name);
      const filePath = `company/${selectedCompanyId}/bulk/${Date.now()}_${sanitizedName}`;
      const { error: uploadError } = await supabase.storage
        .from("employee-files")
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // 2. Get active employees for the company
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("id")
        .eq("company_id", selectedCompanyId)
        .eq("is_active", true);

      if (empError) throw empError;
      if (!employees || employees.length === 0) {
        toast({
          title: "Sem colaboradores",
          description: "Esta empresa não tem colaboradores ativos.",
          variant: "destructive",
        });
        // Clean up uploaded file
        await supabase.storage.from("employee-files").remove([filePath]);
        setIsSubmitting(false);
        return;
      }

      // 3. Batch insert documents
      const records = employees.map((emp) => ({
        employee_id: emp.id,
        file_name: selectedFile.name,
        file_path: filePath,
        file_size: selectedFile.size,
        mime_type: selectedFile.type || "application/octet-stream",
        category: selectedCategory || null,
        description: description || null,
        uploaded_by: userData.user.id,
      }));

      const { error: insertError } = await supabase
        .from("employee_documents")
        .insert(records);

      if (insertError) throw insertError;

      toast({
        title: "Documento enviado!",
        description: `Documento enviado para ${employees.length} colaborador${employees.length > 1 ? "es" : ""}.`,
      });

      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-gold" />
            Enviar Documento por Empresa
          </DialogTitle>
          <DialogDescription>
            O documento será associado a todos os colaboradores ativos da empresa selecionada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Company Select */}
          <div className="space-y-2">
            <Label>Empresa *</Label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a empresa..." />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Select */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do documento..."
            />
          </div>

          {/* File Select */}
          <div className="space-y-2">
            <Label>Ficheiro *</Label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full justify-start"
              type="button"
            >
              <FileText className="h-4 w-4 mr-2" />
              {selectedFile ? selectedFile.name : "Selecionar ficheiro..."}
            </Button>
          </div>

          {/* Submit */}
          <Button
            variant="gold"
            onClick={handleSubmit}
            disabled={!selectedCompanyId || !selectedFile || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                A enviar...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Enviar Documento
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BulkDocumentUploadDialog;
