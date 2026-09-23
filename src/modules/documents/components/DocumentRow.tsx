import React from 'react';
import { format } from 'date-fns';
import { ExternalLink, FileText, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatFileSize, type EmployeeDocument } from '@/lib/documents';

interface DocumentRowProps {
  doc: EmployeeDocument;
  title: string;
  /** Linhas de detalhe (nº, validade, quem submeteu...). */
  meta?: React.ReactNode;
  badges?: React.ReactNode;
  isOpening: boolean;
  onOpen: () => void;
  onDelete?: () => void;
}

/** Linha de documento reutilizada no portal do colaborador (toque grande, 1 coluna). */
export const DocumentRow: React.FC<DocumentRowProps> = ({
  doc,
  title,
  meta,
  badges,
  isOpening,
  onOpen,
  onDelete,
}) => (
  <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium">{title}</p>
      <p className="truncate text-xs text-muted-foreground">
        {doc.file_name} · {formatFileSize(doc.file_size)} ·{' '}
        {format(new Date(doc.created_at), 'dd/MM/yyyy')}
      </p>
      {meta && <div className="mt-1 text-sm text-muted-foreground">{meta}</div>}
      {badges && <div className="mt-1.5 flex flex-wrap gap-1">{badges}</div>}
    </div>
    <div className="flex shrink-0 items-center">
      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11"
        onClick={onOpen}
        disabled={isOpening}
        aria-label={`Abrir ${doc.file_name}`}
      >
        {isOpening ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ExternalLink className="h-5 w-5" />
        )}
      </Button>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 text-destructive hover:text-destructive"
          onClick={onDelete}
          aria-label={`Eliminar ${doc.file_name}`}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      )}
    </div>
  </div>
);
