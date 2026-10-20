import React, { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FolderLock } from 'lucide-react';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { CompanyFilesBrowser } from '../components/company/CompanyFilesBrowser';
import { opensInEditor, previewKind } from '../lib/companyFiles';
import { useCompanyDownload } from '../hooks/useCompanyDownload';
import { preloadEditor } from '../lib/onlyoffice';
import type { CompanyEntry } from '../services/companyFilesService';

/**
 * Documentos da empresa: as pastas do servidor de ficheiros (D:\Shares) atribuídas ao
 * colaborador, abertas e editadas no ONLYOFFICE sem sair do Realize. A pasta aberta fica em
 * ?pasta=; cada ficheiro aberto (?abrir= no editor, ?ver= imagens e vídeos) fica na sua aba
 * (OpenFilesHost, na estrutura) e continua carregado ao voltar aqui para abrir outro. Os documentos
 * pessoais e os recibos estão em Definições → Os meus documentos (os atalhos antigos
 * ?enviar=… e ?tab=… seguem para lá).
 */
const MyDocumentsPage: React.FC = () => {
  const { basePath, isPreview } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const personal = `${basePath}/definicoes/documentos`;
  const folder = params.get('pasta');

  useEffect(() => {
    if (params.has('enviar') || params.has('tab'))
      navigate(`${personal}?${params.toString()}`, { replace: true });
  }, [params, navigate, personal]);

  const show = (
    next: { pasta?: string | null; abrir?: string | null; ver?: string | null },
    replace = false
  ) => {
    const search = new URLSearchParams();
    const pasta = next.pasta === undefined ? folder : next.pasta;
    if (pasta) search.set('pasta', pasta);
    if (next.abrir) search.set('abrir', next.abrir);
    if (next.ver) search.set('ver', next.ver);
    setParams(search, { replace });
  };

  const download = useCompanyDownload();

  // O editor (ONLYOFFICE) começa a carregar já: o primeiro documento abre mais depressa.
  useEffect(() => {
    if (!isPreview) preloadEditor();
  }, [isPreview]);

  // Documentos no editor; imagens, vídeos e áudio na visualização; o resto descarrega-se.
  const openFile = (entry: CompanyEntry) =>
    opensInEditor(entry)
      ? show({ abrir: entry.path })
      : previewKind(entry)
        ? show({ ver: entry.path })
        : download(entry);

  return (
    <WorkspacePage>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[26px] font-extrabold">Documentos</h1>
        <Link
          to={personal}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13.5px] font-semibold text-rz-ink ring-1 ring-rz-line hover:bg-rz-primary-soft"
        >
          <FolderLock className="h-4 w-4 text-rz-primary" /> Os meus documentos e recibos
        </Link>
      </div>

      {isPreview ? (
        <p className="rounded-[28px] bg-white px-6 py-10 text-center text-[14px] text-rz-muted shadow-rz-soft ring-1 ring-rz-line">
          Pré-visualização: os documentos da empresa só abrem com uma conta real.
        </p>
      ) : (
        <CompanyFilesBrowser
          path={folder}
          onNavigate={path => show({ pasta: path, abrir: null })}
          onOpenFile={openFile}
          onDownload={download}
        />
      )}
    </WorkspacePage>
  );
};

export default MyDocumentsPage;
