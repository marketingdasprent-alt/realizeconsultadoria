import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { attachmentService, type EmployeeAttachment } from '../services/attachmentService';

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';

/** Anexos de um colaborador: lista em cache, carregar, abrir e apagar. */
export const useEmployeeAttachments = (employeeId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const key = ['admin', 'attachments', employeeId];
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await attachmentService.list(employeeId);
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  const upload = async (file: File, description: string) => {
    setIsUploading(true);
    const { error } = await attachmentService.upload(employeeId, file, description.trim() || null);
    setIsUploading(false);
    if (error) {
      toast({ title: 'Erro ao carregar', description: message(error), variant: 'destructive' });
      return false;
    }
    toast({ title: 'Anexo carregado' });
    refresh();
    return true;
  };

  const open = async (attachment: EmployeeAttachment) => {
    // A janela abre já (no clique), senão o browser bloqueia-a depois do pedido.
    const win = window.open('', '_blank');
    setOpeningId(attachment.id);
    const url = await attachmentService.signedUrl(attachment);
    setOpeningId(null);
    if (!url) {
      win?.close();
      toast({ title: 'Ficheiro não encontrado', variant: 'destructive' });
      return;
    }
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else window.location.assign(url);
  };

  const remove = async (attachment: EmployeeAttachment) => {
    const { error } = await attachmentService.remove(attachment);
    if (error) {
      toast({ title: 'Erro ao apagar', description: message(error), variant: 'destructive' });
      return false;
    }
    toast({ title: 'Anexo apagado' });
    refresh();
    return true;
  };

  return {
    attachments: query.data ?? [],
    isLoading: query.isLoading,
    isUploading,
    upload,
    open,
    openingId,
    remove,
  };
};
