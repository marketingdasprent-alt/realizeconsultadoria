import { useState, useRef } from "react";
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelectedFile {
  file: File;
  preview?: string;
}

interface DocumentUploaderProps {
  files: SelectedFile[];
  onFilesChange: (files: SelectedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DocumentUploader = ({
  files,
  onFilesChange,
  maxFiles = 5,
  maxSizeMB = 20,
  disabled = false,
}: DocumentUploaderProps) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const validFiles: SelectedFile[] = [];
    const errors: string[] = [];

    Array.from(newFiles).forEach((file) => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: tipo não permitido`);
        return;
      }
      if (file.size > maxSizeBytes) {
        errors.push(`${file.name}: excede ${maxSizeMB}MB`);
        return;
      }
      if (files.length + validFiles.length >= maxFiles) {
        errors.push(`Limite de ${maxFiles} ficheiros atingido`);
        return;
      }

      // Create preview for images
      const isImage = file.type.startsWith("image/");
      validFiles.push({
        file,
        preview: isImage ? URL.createObjectURL(file) : undefined,
      });
    });

    if (validFiles.length > 0) {
      onFilesChange([...files, ...validFiles]);
    }

    if (errors.length > 0) {
      console.warn("File upload errors:", errors);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemove = (index: number) => {
    const file = files[index];
    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const isPDF = (file: File) => file.type === "application/pdf";

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">
        Documentos (opcional)
      </label>

      {/* Drop zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        } ${disabled ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(",")}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled}
        />
        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Arraste ficheiros ou clique para selecionar
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, JPG, PNG, WEBP • Máx 20MB • Até {maxFiles} ficheiros
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-secondary rounded-lg"
            >
              {/* Preview */}
              <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
                {item.preview ? (
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : isPDF(item.file) ? (
                  <FileText className="h-5 w-5 text-red-500" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(item.file.size)}
                </p>
              </div>

              {/* Remove button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(index);
                }}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;
