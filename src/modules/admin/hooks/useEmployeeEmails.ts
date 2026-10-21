import { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { isDepartmentCategory, type Credential, type CredentialEmployee } from '../lib/credentials';
import { emailsOfEmployee, type EmployeeEmail } from '../lib/emailRows';
import { credentialService } from '../services/credentialService';
import { useCredentials } from './useCredentials';

/** Ficha do colaborador → Emails: as caixas dele, ligar uma existente e tirar. */
export const useEmployeeEmails = (employeeId: string) => {
  const { toast } = useToast();
  const data = useCredentials();
  const [busy, setBusy] = useState<string | null>(null);
  const employee: CredentialEmployee | null = data.employees.find(e => e.id === employeeId) ?? null;
  const emails = useMemo(() => emailsOfEmployee(employeeId, data), [employeeId, data]);

  const run = async (id: string, action: () => Promise<boolean>) => {
    setBusy(id);
    try {
      return await action();
    } finally {
      setBusy(null);
      void data.refresh();
      // A caixa é criada em segundo plano: volta a ler o estado daqui a pouco.
      setTimeout(() => void data.refresh(), 8000);
    }
  };

  const link = async (credential: Credential) => {
    const { members, error } = await credentialService.linkMailbox(credential.id);
    toast(
      error
        ? { title: `${credential.username} não ligou`, description: error, variant: 'destructive' }
        : {
            title: `${credential.username} ligada`,
            description: `No Webmail de ${members} pessoa(s).`,
          }
    );
    return !error;
  };

  /** Email pessoal sem dono → passa a ser dele; outro qualquer → é partilhado com ele. */
  const add = (credential: Credential) =>
    run(credential.id, async () => {
      const department = isDepartmentCategory(credential.access_categories?.name);
      const shares = data.shares.get(credential.id) ?? [];
      const { ok } =
        !department && !credential.employee_id
          ? await credentialService.setOwner(credential.id, employeeId)
          : await credentialService.setShares(credential.id, [...shares, employeeId]);
      if (!ok) {
        toast({ title: 'Erro ao ligar o email', variant: 'destructive' });
        return false;
      }
      return employee?.user_id ? link(credential) : true;
    });

  const remove = (email: EmployeeEmail) =>
    run(email.credential.id, async () => {
      const shares = data.shares.get(email.credential.id) ?? [];
      const { ok } =
        email.role === 'owner'
          ? await credentialService.setOwner(email.credential.id, null)
          : await credentialService.setShares(
              email.credential.id,
              shares.filter(id => id !== employeeId)
            );
      toast(
        ok
          ? {
              title: `${email.credential.username} tirado`,
              description: 'Deixa de aparecer no Webmail dele.',
            }
          : { title: 'Erro ao tirar', variant: 'destructive' }
      );
      return ok;
    });

  const test = (email: EmployeeEmail) => run(email.credential.id, () => link(email.credential));

  return { data, employee, emails, busy, add, remove, test };
};
