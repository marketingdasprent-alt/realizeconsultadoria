import React, { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, FolderLock } from 'lucide-react';
import { WorkspacePage } from '@/modules/workspace/components/WorkspacePage';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';

/**
 * Documentos: reservado para o editor de documentos da empresa (a integrar). Os documentos
 * pessoais e os recibos passaram para Definições → Os meus documentos; os atalhos antigos
 * (?enviar=…, ?tab=…) seguem para lá.
 */
const MyDocumentsPage: React.FC = () => {
  const { basePath } = useWorkspace();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const personal = `${basePath}/definicoes/documentos`;

  useEffect(() => {
    if ([...params.keys()].length) navigate(`${personal}?${params.toString()}`, { replace: true });
  }, [params, navigate, personal]);

  return (
    <WorkspacePage>
      <h1 className="mb-4 text-[26px] font-extrabold">Documentos</h1>
      <section className="flex flex-col items-center rounded-[28px] bg-white px-6 py-14 text-center shadow-rz-soft ring-1 ring-rz-line">
        <span className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-amber-400 to-orange-500 text-white">
          <FileText className="h-8 w-8" />
        </span>
        <h2 className="mt-4 text-[18px] font-extrabold">Em breve</h2>
        <p className="mt-1 max-w-sm text-[14px] text-rz-muted">
          Aqui vai ficar o editor de documentos da empresa: criar e editar documentos, folhas de
          cálculo e PDF sem sair do Realize.
        </p>
        <Link
          to={personal}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-rz-canvas px-5 text-[14px] font-semibold text-rz-ink ring-1 ring-rz-line hover:bg-rz-primary-soft"
        >
          <FolderLock className="h-4 w-4 text-rz-primary" /> Os meus documentos e recibos
        </Link>
      </section>
    </WorkspacePage>
  );
};

export default MyDocumentsPage;
