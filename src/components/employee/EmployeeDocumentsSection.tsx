import { useState, useEffect, useRef } from 'react';
import { FileText, Download, Loader2, Upload, Trash2, Building2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmployeeDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  category: string | null;
  description: string | null;
  created_at: string;
  uploaded_by: string;
  uploaded_by_role: string | null;
  uploaded_by_name: string | null;
}

const DOCUMENT_CATEGORIES = [
  { value: 'contrato', label: 'Contrato' },
  { value: 'ficha_admissao', label: 'Ficha de Admissão' },
  { value: 'certificado', label: 'Certificado' },
  { value: 'documento_identificacao', label: 'Documento de Identificação' },
  { value: 'comunicado', label: 'Comunicado' },
  { value: 'outro', label: 'Outro' },
];

interface EmployeeDocumentsSectionProps {
  employeeId: string;
  /** Name of the logged-in employee, recorded as the submitter on self uploads. */
  employeeName?: string;
}

const EmployeeDocumentsSection = ({ employeeId, employeeName }: EmployeeDocumentsSectionProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [employeeId]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sanitizeFileName = (fileName: string): string => {
    const normalized = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalized.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Utilizador não autenticado');

      // Upload to the employee's own folder in the same bucket the company uses.
      // The "<employeeId>/..." prefix is what the storage RLS policy authorizes
      // the employee to write to.
      const sanitizedName = sanitizeFileName(file.name);
      const filePath = `${employeeId}/documents/${Date.now()}_${sanitizedName}`;
      const { error: uploadError } = await supabase.storage
        .from('employee-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Mark the row as an employee self-upload so it shows up as
      // "Submetido por: <nome> (Colaborador)" and can be removed by the employee.
      const { error: dbError } = await supabase.from('employee_documents').insert({
        employee_id: employeeId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        category: selectedCategory || null,
        description: description || null,
        uploaded_by: session.user.id,
        uploaded_by_role: 'employee',
        uploaded_by_name: employeeName || null,
      });

      if (dbError) throw dbError;

      toast({ title: 'Documento submetido com sucesso!' });
      setSelectedCategory('');
      setDescription('');
      fetchDocuments();
    } catch (error: any) {
      toast({
        title: 'Erro ao submeter',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownload = async (doc: EmployeeDocument) => {
    try {
      const cleanPath = doc.file_path.startsWith('/') ? doc.file_path.substring(1) : doc.file_path;
      const buckets = [
        'employee-files',
        'absence-documents',
        'equipment_invoices',
        'legal_documents',
        'employees',
        'documents',
      ];

      let signedUrl = null;
      let finalError = null;

      for (const bucket of buckets) {
        console.log(`A tentar bucket '${bucket}':`, cleanPath);

        // Tentativa 1: URL Assinada (Privado)
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(cleanPath, 60);

        if (!error && data?.signedUrl) {
          signedUrl = data.signedUrl;
          console.log(`Ficheiro encontrado no bucket '${bucket}' (via URL assinada)`);
          break;
        }

        // Tentativa 2: URL Pública (Caso o bucket seja público)
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(cleanPath);

        if (publicData?.publicUrl) {
          try {
            const resp = await fetch(publicData.publicUrl, { method: 'HEAD' });
            if (resp.ok) {
              signedUrl = publicData.publicUrl;
              console.log(`Ficheiro encontrado no bucket '${bucket}' (via URL pública)`);
              break;
            }
          } catch (e) {
            // Ignorar erro de fetch head
          }
        }

        if (error) {
          finalError = error;
        }
      }

      if (!signedUrl) {
        throw finalError || new Error('Ficheiro não encontrado em nenhum local de armazenamento.');
      }

      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Erro crítico no download:', error);
      toast({
        title: 'Erro ao descarregar',
        description: `Não foi possível encontrar o ficheiro. (Caminho: ${doc.file_path})`,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (doc: EmployeeDocument) => {
    try {
      // Only one record references a self-uploaded file, so it is safe to remove
      // the physical file from storage along with the database row.
      const { error: storageError } = await supabase.storage
        .from('employee-files')
        .remove([doc.file_path]);

      // A missing storage object should not block deleting the row.
      if (storageError) console.warn('Erro ao remover ficheiro do storage:', storageError);

      const { error: dbError } = await supabase
        .from('employee_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) throw dbError;

      toast({ title: 'Documento eliminado!' });
      fetchDocuments();
    } catch (error: any) {
      toast({
        title: 'Erro ao eliminar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getCategoryLabel = (value: string | null) => {
    if (!value) return null;
    return DOCUMENT_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  // Human-readable submitter line shown on every document card.
  const getSubmitter = (doc: EmployeeDocument) => {
    if (doc.uploaded_by_role === 'employee') {
      const name = doc.uploaded_by_name || 'Colaborador';
      return { icon: UserRound, label: `Submetido por: ${name} (Colaborador)` };
    }
    // Anything not self-uploaded (admin uploads or legacy rows) is shown as a
    // company submission.
    return { icon: Building2, label: 'Submetido pela empresa' };
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Upload Card — employee self-service submission */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base lg:text-xl flex items-center gap-2">
            <Upload className="h-4 w-4 lg:h-5 lg:w-5 text-gold" />
            Submeter Documento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="sm:col-span-2 md:col-span-1">
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 md:col-span-2">
              <label className="block text-sm font-medium mb-1">Descrição</label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
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
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />A submeter...
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

      {/* Documents List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : documents.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-10 lg:py-12 text-center">
            <FileText className="h-10 w-10 lg:h-12 lg:w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm lg:text-base">
              Ainda não tem documentos disponíveis.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 lg:space-y-4">
          {documents.map(doc => {
            const category = getCategoryLabel(doc.category);
            const submitter = getSubmitter(doc);
            const SubmitterIcon = submitter.icon;
            const canDelete = doc.uploaded_by_role === 'employee';
            return (
              <Card key={doc.id} className="shadow-card">
                <CardContent className="p-3 lg:p-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      <FileText className="h-5 w-5 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm lg:text-base truncate">{doc.file_name}</p>
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
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                        <SubmitterIcon className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{submitter.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => handleDownload(doc)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(doc)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EmployeeDocumentsSection;
