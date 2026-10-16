import React from 'react';
import { ExternalLink, FileText, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileRowProps {
  title: string;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  onOpen?: () => void;
  isOpening?: boolean;
  onDelete?: () => void;
  /** Botões extra (ex.: Aprovar / Rejeitar). */
  actions?: React.ReactNode;
  muted?: boolean;
}

/** Linha de um ficheiro: ícone, nome, detalhes, estado e ações (abrir, apagar…). */
export const FileRow: React.FC<FileRowProps> = ({
  title,
  subtitle,
  badges,
  onOpen,
  isOpening,
  onDelete,
  actions,
  muted,
}) => (
  <li
    className={cn(
      'flex items-center gap-3 rounded-2xl p-2.5 hover:bg-rz-canvas',
      muted && 'opacity-60'
    )}
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rz-primary-soft text-rz-primary">
      <FileText className="h-[18px] w-[18px]" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[14px] font-semibold">{title}</p>
      {subtitle && <p className="truncate text-[12.5px] text-rz-muted">{subtitle}</p>}
      {badges && <div className="mt-1 flex flex-wrap gap-1">{badges}</div>}
    </div>
    <div className="flex shrink-0 items-center gap-1">
      {actions}
      {onOpen && (
        <button
          type="button"
          onClick={onOpen}
          disabled={isOpening}
          className="flex h-9 w-9 items-center justify-center rounded-full text-rz-muted hover:bg-white hover:text-rz-ink"
          aria-label={`Abrir ${title}`}
        >
          {isOpening ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="flex h-9 w-9 items-center justify-center rounded-full text-rz-muted hover:bg-red-50 hover:text-red-600"
          aria-label={`Apagar ${title}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  </li>
);

/** Cartão de uma secção de ficheiros, com título, contagem e botão à direita. */
export const FileSection: React.FC<{
  title: string;
  description?: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, count, action, children }) => (
  <section className="rounded-[24px] bg-white p-4 shadow-rz-soft ring-1 ring-rz-line sm:p-5">
    <header className="mb-2 flex flex-wrap items-center gap-2 px-1">
      <div className="min-w-0 flex-1">
        <h3 className="text-[15.5px] font-extrabold">
          {title}
          {count !== undefined && <span className="ml-1.5 text-rz-muted">{count}</span>}
        </h3>
        {description && <p className="text-[12.5px] text-rz-muted">{description}</p>}
      </div>
      {action}
    </header>
    {children}
  </section>
);
