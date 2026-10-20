import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { useWorkspaceTabs } from '@/modules/workspace/hooks/useWorkspaceTabs';
import { fileOfTab, isFileTab } from '@/modules/workspace/lib/tabs';
import { parentPath } from '../../../../../supabase/functions/_shared/company-files';
import { useCompanyDownload } from '../../hooks/useCompanyDownload';
import { CompanyFilePreview } from './CompanyFilePreview';
import { OnlyOfficeEditor } from './OnlyOfficeEditor';

/**
 * Ficheiros abertos dos Documentos, um por aba: continuam carregados ao mudar de aba (só o da
 * aba atual se vê), por isso voltar a um documento é imediato. ← ou ✕ fecham a aba.
 */
const OpenFilesHost: React.FC = () => {
  const { tabs, active, close } = useWorkspaceTabs();
  const { basePath, isPreview } = useWorkspace();
  const navigate = useNavigate();
  const download = useCompanyDownload();
  if (isPreview) return null;

  const documentsUrl = (path: string, extra = '') =>
    `${basePath}/documentos?pasta=${encodeURIComponent(parentPath(path))}${extra}`;

  return (
    <>
      {tabs
        .filter(tab => isFileTab(tab.key))
        .map(tab => {
          const file = fileOfTab(tab.url);
          if (!file) return null;
          const isActive = tab.key === active;
          const back = () => close(tab.key, documentsUrl(file.path));
          return (
            <div
              key={tab.key}
              aria-hidden={!isActive}
              className={cn('absolute inset-0 z-30', !isActive && 'pointer-events-none invisible')}
            >
              {file.mode === 'edit' ? (
                <OnlyOfficeEditor path={file.path} onClose={back} />
              ) : (
                <CompanyFilePreview
                  path={file.path}
                  active={isActive}
                  onNavigate={next =>
                    navigate(documentsUrl(next, `&ver=${encodeURIComponent(next)}`), {
                      replace: true,
                    })
                  }
                  onClose={back}
                  onDownload={download}
                />
              )}
            </div>
          );
        })}
    </>
  );
};

export default OpenFilesHost;
