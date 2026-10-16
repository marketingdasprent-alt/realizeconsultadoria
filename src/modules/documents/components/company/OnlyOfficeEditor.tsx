import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Eye, Loader2 } from 'lucide-react';
import { baseName } from '../../../../../supabase/functions/_shared/company-files';
import { loadDocsApi, type DocEditorInstance } from '../../lib/onlyoffice';
import { companyFilesService } from '../../services/companyFilesService';

interface OnlyOfficeEditorProps {
  /** Caminho do ficheiro, relativo a D:\Shares. */
  path: string;
  onClose: () => void;
}

type EditorState =
  | { status: 'loading' }
  | { status: 'ready'; readOnly: boolean }
  | { status: 'error'; message: string };

let editorCount = 0;

/**
 * Ficheiro aberto no ONLYOFFICE, em ecrã inteiro. As alterações gravam-se sozinhas em
 * D:\Shares (o ONLYOFFICE chama o agente do servidor); "Guardar" grava logo.
 */
export const OnlyOfficeEditor: React.FC<OnlyOfficeEditorProps> = ({ path, onClose }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<EditorState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let editor: DocEditorInstance | null = null;
    const host = hostRef.current;
    setState({ status: 'loading' });

    (async () => {
      const { data, error } = await companyFilesService.open(path);
      if (cancelled) return;
      if (error || !data) return setState({ status: 'error', message: error ?? '' });
      try {
        const api = await loadDocsApi(data.apiUrl);
        if (cancelled || !host) return;
        // O ONLYOFFICE troca este elemento por um iframe: fica fora do controlo do React
        const placeholder = document.createElement('div');
        placeholder.id = `rz-office-editor-${++editorCount}`;
        host.replaceChildren(placeholder);
        editor = new api.DocEditor(placeholder.id, {
          ...data.config,
          width: '100%',
          height: '100%',
          type: window.innerWidth < 768 ? 'mobile' : 'desktop',
          events: {
            onError: (event: { data?: { errorDescription?: string } }) =>
              setState({
                status: 'error',
                message: event.data?.errorDescription || 'O editor deu um erro.',
              }),
          },
        });
        setState({ status: 'ready', readOnly: data.mode === 'view' });
      } catch {
        if (!cancelled)
          setState({
            status: 'error',
            message: 'Não foi possível ligar ao editor de documentos. Tente daqui a pouco.',
          });
      }
    })();

    return () => {
      cancelled = true;
      editor?.destroyEditor();
      host?.replaceChildren();
    };
  }, [path]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-white">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-rz-line px-2 md:px-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Voltar aos documentos"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-rz-canvas"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{baseName(path)}</p>
        {state.status === 'ready' && state.readOnly && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rz-canvas px-3 py-1 text-[12px] font-semibold text-rz-muted">
            <Eye className="h-3.5 w-3.5" /> Só leitura
          </span>
        )}
      </header>
      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="h-full w-full" />
        {state.status !== 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white px-6 text-center">
            {state.status === 'loading' ? (
              <Loader2 className="h-7 w-7 animate-spin text-rz-primary" />
            ) : (
              <>
                <p className="max-w-sm text-[14.5px] text-rose-600">{state.message}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-4 h-10 rounded-full bg-rz-canvas px-5 text-sm font-semibold ring-1 ring-rz-line"
                >
                  Voltar
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
