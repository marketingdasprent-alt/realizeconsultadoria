import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Loader2, X } from 'lucide-react';
import { baseName, parentPath } from '../../../../../supabase/functions/_shared/company-files';
import { useCompanyFolder } from '../../hooks/useCompanyFolder';
import { previewKind } from '../../lib/companyFiles';
import { companyFilesService, type CompanyEntry } from '../../services/companyFilesService';

interface CompanyFilePreviewProps {
  path: string;
  /** Aba visível (só então responde ao teclado). */
  active?: boolean;
  onNavigate: (path: string) => void;
  onClose: () => void;
  onDownload: (entry: CompanyEntry) => void;
}

const ARROW =
  'absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20';

/**
 * Ver uma imagem, um vídeo ou um áudio da pasta sem o descarregar (como no Windows), na aba
 * do ficheiro: ← → para os outros da mesma pasta, Esc para fechar.
 */
export const CompanyFilePreview: React.FC<CompanyFilePreviewProps> = ({
  path,
  active = true,
  onNavigate,
  onClose,
  onDownload,
}) => {
  const name = baseName(path);
  const kind = previewKind({ name, type: 'file' });
  const folder = useCompanyFolder(parentPath(path));
  const items = (folder.data?.entries ?? []).filter(entry => previewKind(entry));
  const index = items.findIndex(entry => entry.path === path);
  const prev = index > 0 ? items[index - 1] : null;
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : null;

  // Link de leitura (vale 5 minutos; pede-se outro ao fim de 4).
  const url = useQuery({
    queryKey: ['company-files', 'url', path],
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const { data, error } = await companyFilesService.downloadUrl(path);
      if (error || !data) throw new Error(error ?? '');
      return data.url;
    },
  });

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && prev) onNavigate(prev.path);
      if (event.key === 'ArrowRight' && next) onNavigate(next.path);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, prev, next, onClose, onNavigate]);

  return (
    <div
      role="dialog"
      aria-label={name}
      className="absolute inset-0 flex flex-col bg-black/95 text-white"
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{name}</p>
        {items.length > 1 && index >= 0 && (
          <span className="text-[13px] text-white/60">
            {index + 1} de {items.length}
          </span>
        )}
        <button
          type="button"
          onClick={() => onDownload({ name, type: 'file', path })}
          aria-label={`Descarregar ${name}`}
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
        >
          <Download className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {prev && (
          <button
            type="button"
            onClick={() => onNavigate(prev.path)}
            aria-label="Anterior"
            className={`${ARROW} left-4`}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {url.isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin text-white/70" />
        ) : url.error || !url.data ? (
          <p className="text-[14px] text-rose-300">
            {url.error?.message || 'Não foi possível abrir o ficheiro.'}
          </p>
        ) : kind === 'image' ? (
          <img
            key={url.data}
            src={url.data}
            alt={name}
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
        ) : kind === 'video' ? (
          <video
            key={url.data}
            src={url.data}
            controls
            autoPlay
            className="max-h-full max-w-full rounded-lg"
          />
        ) : (
          <audio key={url.data} src={url.data} controls autoPlay className="w-full max-w-xl" />
        )}
        {next && (
          <button
            type="button"
            onClick={() => onNavigate(next.path)}
            aria-label="Seguinte"
            className={`${ARROW} right-4`}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
};
