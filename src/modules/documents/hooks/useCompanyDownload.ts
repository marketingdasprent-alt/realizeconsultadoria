import { useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { companyFilesService, type CompanyEntry } from '../services/companyFilesService';

/** Descarregar um ficheiro dos Documentos da empresa (link direto do servidor, 5 minutos). */
export const useCompanyDownload = () =>
  useCallback(async (entry: Pick<CompanyEntry, 'path'>) => {
    // A janela abre já (no clique), senão o browser bloqueia-a depois do pedido
    const win = window.open('', '_blank');
    const { data, error } = await companyFilesService.downloadUrl(entry.path);
    if (error || !data) {
      win?.close();
      toast({
        title: 'Não foi possível descarregar',
        description: error ?? '',
        variant: 'destructive',
      });
      return;
    }
    if (win) {
      win.opener = null;
      win.location.href = data.url;
    } else window.location.assign(data.url);
  }, []);
