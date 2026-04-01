import { useState, useEffect, useRef } from "react";
import { Upload, Paperclip, Trash2, Download, Loader2, User, Building2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeFileName } from "@/lib/utils";

interface EmployeeAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  source: string;
  description: string | null;
  created_at: string;
}

interface EmployeeAttachmentsTabProps {
  employeeId: string;
}

const EmployeeAttachmentsTab = ({ employeeId }: EmployeeAttachmentsTabProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<EmployeeAttachment[]>([]);
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchAttachments();
  }, [employeeId]);

  const fetchAttachments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_attachments")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error) {
      console.error("Error fetching attachments:", error);
    } finally {
      setIsLoading(false);
    }
  };


  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Utilizador não autenticado");

      // Upload to storage with sanitized filename
      const sanitizedName = sanitizeFileName(file.name);
      const filePath = `${employeeId}/attachments/${Date.now()}_${sanitizedName}`;
      const { error: uploadError } = await supabase.storage
        .from("employee-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save metadata
      const { error: dbError } = await supabase
        .from("employee_attachments")
        .insert({
          employee_id: employeeId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          source: "admin",
          description: description || null,
          uploaded_by: userData.user.id,
        });

      if (dbError) throw dbError;

      toast({ title: "Anexo carregado com sucesso!" });
      setDescription("");
      fetchAttachments();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDownload = async (attachment: EmployeeAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from("employee-files")
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
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

  const handleDelete = async (attachment: EmployeeAttachment) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("employee-files")
        .remove([attachment.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("employee_attachments")
        .delete()
        .eq("id", attachment.id);

      if (dbError) throw dbError;

      toast({ title: "Anexo eliminado!" });
      fetchAttachments();
    } catch (error: any) {
      toast({
        title: "Erro ao eliminar",
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

  return (
    <div className="space-y-6">
      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl flex items-center gap-2">
            <Upload className="h-5 w-5 text-gold" />
            Adicionar Anexo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição opcional..."
              />
            </div>
            <div className="flex items-end">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="gold"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    A carregar...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Selecionar
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attachments List */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl flex items-center gap-2">
            <Paperclip className="h-5 w-5 text-gold" />
            Anexos do Colaborador
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
            </div>
          ) : attachments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Paperclip className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum anexo encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ficheiro</TableHead>
                  <TableHead className="hidden sm:table-cell">Origem</TableHead>
                  <TableHead className="hidden md:table-cell">Tamanho</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attachments.map((attachment) => (
                  <TableRow key={attachment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium truncate max-w-[200px]">
                            {attachment.file_name}
                          </p>
                          {attachment.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {attachment.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge 
                        variant={
                          attachment.source === "employee" 
                            ? "default" 
                            : attachment.source === "absence" 
                              ? "outline" 
                              : "secondary"
                        }
                      >
                        {attachment.source === "employee" ? (
                          <>
                            <User className="h-3 w-3 mr-1" />
                            Colaborador
                          </>
                        ) : attachment.source === "absence" ? (
                          <>
                            <Calendar className="h-3 w-3 mr-1" />
                            Ausência
                          </>
                        ) : (
                          <>
                            <Building2 className="h-3 w-3 mr-1" />
                            Admin
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatFileSize(attachment.file_size)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatDate(attachment.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(attachment)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(attachment)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeAttachmentsTab;
