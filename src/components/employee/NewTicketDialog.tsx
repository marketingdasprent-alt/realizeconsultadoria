import { useState, useEffect, useRef } from "react";
import { Loader2, Paperclip, X, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sanitizeFileName } from "@/lib/utils";

interface SupportSubject {
  id: string;
  label: string;
  default_priority: string;
  department_id: string | null;
}

interface SupportDepartment {
  id: string;
  name: string;
}

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  companyId: string;
  employeeName: string;
  employeeEmail: string;
  companyName: string;
  onSuccess?: () => void;
}

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const NewTicketDialog = ({
  open,
  onOpenChange,
  employeeId,
  companyId,
  employeeName,
  employeeEmail,
  companyName,
  onSuccess,
}: NewTicketDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subjects, setSubjects] = useState<SupportSubject[]>([]);
  const [departments, setDepartments] = useState<SupportDepartment[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const loadSubjects = async () => {
    setIsLoadingSubjects(true);
    const { data, error } = await supabase
      .from("support_ticket_subjects")
      .select("id, label, default_priority, department_id")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error loading subjects:", error);
    } else {
      setSubjects(data || []);
    }
    setIsLoadingSubjects(false);
  };

  const loadDepartments = async () => {
    setIsLoadingDepartments(true);
    const { data, error } = await supabase
      .from("support_departments")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error loading departments:", error);
    } else {
      setDepartments(data || []);
    }
    setIsLoadingDepartments(false);
  };

  useEffect(() => {
    if (open) {
      loadSubjects();
      loadDepartments();
    }
  }, [open]);

  const filteredSubjects = subjects.filter(
    (s) => s.department_id === selectedDepartment
  );

  const handleDepartmentChange = (value: string) => {
    setSelectedDepartment(value);
    setSubject("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_FILES - selectedFiles.length;

    const validFiles: File[] = [];
    for (const file of files.slice(0, remaining)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast({
          title: "Tipo de ficheiro não aceite",
          description: `"${file.name}" não é suportado. Use imagens (JPG, PNG, WebP, GIF) ou PDF.`,
          variant: "destructive",
        });
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "Ficheiro demasiado grande",
          description: `"${file.name}" excede o limite de 10MB.`,
          variant: "destructive",
        });
        continue;
      }
      validFiles.push(file);
    }

    if (files.length > remaining) {
      toast({
        title: "Limite de ficheiros",
        description: `Máximo ${MAX_FILES} ficheiros por ticket.`,
        variant: "destructive",
      });
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedDepartment) {
      toast({ title: "Erro", description: "Por favor selecione o departamento.", variant: "destructive" });
      return;
    }
    if (!subject.trim()) {
      toast({ title: "Erro", description: "Por favor indique o assunto.", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Erro", description: "Por favor descreva o seu problema.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const selectedSubject = subjects.find((s) => s.label === subject);
    const priority = selectedSubject?.default_priority || "medium";

    try {
      const { data: ticketData, error } = await supabase
        .from("support_tickets")
        .insert({
          employee_id: employeeId,
          company_id: companyId,
          subject: subject.trim(),
          message: message.trim(),
          priority,
          department_id: selectedDepartment,
        })
        .select("id")
        .single();

      if (error) throw error;

      const ticketId = ticketData.id;

      // Upload attachments
      if (selectedFiles.length > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          for (const file of selectedFiles) {
            const filePath = `${ticketId}/${Date.now()}_${sanitizeFileName(file.name)}`;
            const { error: uploadError } = await supabase.storage
              .from("ticket-attachments")
              .upload(filePath, file);

            if (uploadError) {
              console.error("Upload error:", uploadError);
              continue;
            }

            await supabase.from("support_ticket_attachments").insert({
              ticket_id: ticketId,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              content_type: file.type,
              uploaded_by: session.user.id,
            });
          }
        }
      }

      // Send notification email
      const { error: notificationError } = await supabase.functions.invoke(
        "send-ticket-notification",
        {
          body: {
            employeeName,
            employeeEmail,
            companyName,
            subject: subject.trim(),
            priority,
            message: message.trim(),
            departmentId: selectedDepartment,
          },
        }
      );

      if (notificationError) {
        console.error("Ticket notification failed:", notificationError);
      }

      toast({ title: "Ticket criado com sucesso!" });
      onOpenChange(false);
      setSelectedDepartment("");
      setSubject("");
      setMessage("");
      setSelectedFiles([]);
      onSuccess?.();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedDepartment("");
    setSubject("");
    setMessage("");
    setSelectedFiles([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-lg h-[90dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl lg:text-2xl">
            Novo Ticket de Suporte
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-2">Departamento *</label>
            {isLoadingDepartments ? (
              <div className="flex items-center gap-2 h-11 sm:h-10 px-3 border border-input rounded-md bg-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">A carregar departamentos...</span>
              </div>
            ) : departments.length === 0 ? (
              <div className="h-11 sm:h-10 px-3 border border-input rounded-md bg-muted flex items-center">
                <span className="text-sm text-muted-foreground">Nenhum departamento disponível.</span>
              </div>
            ) : (
              <Select value={selectedDepartment} onValueChange={handleDepartmentChange} disabled={isSubmitting}>
                <SelectTrigger className="h-11 sm:h-10">
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Assunto *</label>
            {!selectedDepartment ? (
              <div className="h-11 sm:h-10 px-3 border border-input rounded-md bg-muted flex items-center">
                <span className="text-sm text-muted-foreground">Selecione primeiro um departamento</span>
              </div>
            ) : isLoadingSubjects ? (
              <div className="flex items-center gap-2 h-11 sm:h-10 px-3 border border-input rounded-md bg-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">A carregar assuntos...</span>
              </div>
            ) : filteredSubjects.length === 0 ? (
              <div className="h-11 sm:h-10 px-3 border border-input rounded-md bg-muted flex items-center">
                <span className="text-sm text-muted-foreground">Nenhum assunto disponível para este departamento.</span>
              </div>
            ) : (
              <Select value={subject} onValueChange={setSubject} disabled={isSubmitting}>
                <SelectTrigger className="h-11 sm:h-10">
                  <SelectValue placeholder="Selecione um assunto" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.label}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Descrição *</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva o problema em detalhe..."
              rows={5}
              disabled={isSubmitting}
              className="min-h-[120px] sm:min-h-[100px]"
            />
          </div>

          {/* File Attachments */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Anexos <span className="text-muted-foreground font-normal">(opcional, máx. {MAX_FILES} ficheiros, 10MB cada)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
              disabled={isSubmitting || selectedFiles.length >= MAX_FILES}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting || selectedFiles.length >= MAX_FILES}
              className="w-full sm:w-auto h-10"
            >
              <Paperclip className="h-4 w-4 mr-2" />
              Anexar ficheiros
            </Button>

            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 border border-border rounded-md bg-muted/30"
                  >
                    {file.type.startsWith("image/") ? (
                      <Image className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatFileSize(file.size)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removeFile(index)}
                      disabled={isSubmitting}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting} className="w-full sm:w-auto h-11 sm:h-10">
              Cancelar
            </Button>
            <Button variant="gold" onClick={handleSubmit} disabled={isSubmitting} className="w-full sm:w-auto h-11 sm:h-10">
              {isSubmitting ? "A enviar..." : "Enviar Ticket"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewTicketDialog;
