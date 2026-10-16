import React, { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FolderLock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { CompanyFilesBrowser } from '../components/company/CompanyFilesBrowser';
import { OnlyOfficeEditor } from '../components/company/OnlyOfficeEditor';
import { opensInEditor } from '../lib/companyFiles';
import { companyFilesService, type CompanyEntry } from '../services/companyFilesService';

/**
 * Documentos da empresa: as pastas do servidor de ficheiros (D:\Shares) atribuídas ao
 * colaborador, abertas e editadas no ONLYOFFICE sem sair do Realize. A pasta aberta fica em
 * ?pasta= e o ficheiro aberto em ?abrir=, para o "voltar" do browser funcionar. Os documentos
 * pessoais e os recibos estão em Definições → Os meus documentos (os atalhos antigos
 * ?enviar=… e ?tab=… seguem para lá).
 */
const MyDocumentsPage: React.FC = () => {
  const { basePath, isPreview } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const personal = `${basePath}/definicoes/documentos`;
  const folder = params.get('pasta');
  const opened = params.get('abrir');

  useEffect(() => {
    if (params.has('enviar') || params.has('tab'))
      navigate(`${personal}?${params.toString()}`, { replace: true });
  }, [params, navigate, personal]);

  const show = (next: { pasta?: string | null; abrir?: string | null }) => {
    const search = new URLSearchParams();
    const pasta = next.pasta === undefined ? folder : next.pasta;
    if (pasta) search.set('pasta', pasta);
    if (next.abrir) search.set('abrir', next.abrir);
    setParams(search);
  };

  const download = async (entry: CompanyEntry) => {
    // A janela abre já (no clique), senão o browser bloqueia-a depois do pedido
    const win = window.open('', '_blank');
    const { data, error } = await companyFilesService.downloadUrl(entry.path);
    if (error || !data) {
      win?.close();
      return toast({
        title: 'Não foi possível descarregar',
        description: error ?? '',
        variant: 'destructive',
      });
    }
    if (win) {
      win.opener = null;
      win.location.href = data.url;
    } else window.location.assign(data.url);
  };

  const openFile = (entry: CompanyEntry) =>
    opensInEditor(entry) ? show({ abrir: entry.path }) : download(entry);

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

      {opened && !isPreview && (
        <OnlyOfficeEditor path={opened} onClose={() => show({ abrir: null })} />
      )}
    </WorkspacePage>
  );
};

export default MyDocumentsPage;
