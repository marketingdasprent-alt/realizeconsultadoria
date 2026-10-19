import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { applyAppManifest } from '@/lib/app-manifest';

/** Mantém o manifest certo (colaborador ou admin) ao mudar de página. */
export const AppManifestSync = (): null => {
  const { pathname } = useLocation();
  useEffect(() => applyAppManifest(pathname), [pathname]);
  return null;
};
