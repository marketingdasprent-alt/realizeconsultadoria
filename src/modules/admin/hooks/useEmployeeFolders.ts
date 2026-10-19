import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { folderAccessService, type FolderPermission } from '../services/folderAccessService';

const key = (employeeId: string) => ['admin', 'employee-folders', employeeId] as const;

const fail = (description: string) =>
  toast({ title: 'Não foi possível', description, variant: 'destructive' });

/** Pastas do servidor de ficheiros atribuídas a um colaborador, com atribuir/mudar/retirar. */
export const useEmployeeFolders = (employeeId: string) => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: key(employeeId),
    queryFn: async () => {
      const { data, error } = await folderAccessService.listForEmployee(employeeId);
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key(employeeId) });

  return {
    folders: query.data ?? [],
    isLoading: query.isLoading,

    /** Devolve a mensagem de erro, ou null se correu bem. */
    assign: async (path: string, permission: FolderPermission): Promise<string | null> => {
      const { error } = await folderAccessService.assign(employeeId, path, permission);
      if (error) return 'A pasta não foi atribuída.';
      await refresh();
      toast({ title: 'Acesso dado', description: path });
      return null;
    },

    setPermission: async (id: string, permission: FolderPermission) => {
      const { error } = await folderAccessService.setPermission(id, permission);
      if (error) fail('A permissão não foi alterada.');
      await refresh();
    },

    remove: async (id: string) => {
      const { error } = await folderAccessService.remove(id);
      if (error) fail('O acesso não foi retirado.');
      await refresh();
    },
  };
};
