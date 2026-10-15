import { useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { DEMO_MAIL_ACCOUNTS } from '../lib/demoData';
import { patchDemoMail, setDemoMail } from '../lib/demoStore';
import { textToHtml } from '../lib/mailFormat';
import { mailErrorText, mailService, type MailError } from '../services/mailService';
import type { ComposeInput, MailSummary } from '../types';

type ListData = InfiniteData<{ messages: MailSummary[] }>;

/** Atualiza já as listas em cache (antes da resposta do fornecedor). */
const patchLists = (
  qc: QueryClient,
  target: MailSummary,
  patch: Partial<MailSummary> | 'remove'
) => {
  qc.setQueriesData<ListData>({ queryKey: ['mail', 'list'] }, data =>
    data
      ? {
          ...data,
          pages: data.pages.map(page => ({
            ...page,
            messages:
              patch === 'remove'
                ? page.messages.filter(
                    m => !(m.id === target.id && m.accountId === target.accountId)
                  )
                : page.messages.map(m =>
                    m.id === target.id && m.accountId === target.accountId ? { ...m, ...patch } : m
                  ),
          })),
        }
      : data
  );
};

const fail = (error: MailError | null, fallback: string): void => {
  toast({
    title: 'Não foi possível',
    description: mailErrorText(error) || fallback,
    variant: 'destructive',
  });
};

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** Ler/não lido, estrela, lixo, enviar e descarregar anexos. */
export const useMailActions = () => {
  const { isPreview } = useWorkspace();
  const qc = useQueryClient();

  const setRead = async (mail: MailSummary, read: boolean) => {
    if (mail.unread === !read) return;
    if (isPreview) return patchDemoMail(mail.id, { unread: !read });
    patchLists(qc, mail, { unread: !read });
    const { error } = await mailService.setRead(mail.accountId, mail.id, read);
    if (error) fail(error, 'O estado do email não foi alterado.');
  };

  return {
    setRead,

    toggleStar: async (mail: MailSummary) => {
      if (isPreview) return patchDemoMail(mail.id, { starred: !mail.starred });
      patchLists(qc, mail, { starred: !mail.starred });
      const { error } = await mailService.setStarred(mail.accountId, mail.id, !mail.starred);
      if (error) fail(error, 'A estrela não foi guardada.');
    },

    trash: async (mail: MailSummary) => {
      if (isPreview) return patchDemoMail(mail.id, { folder: 'trash' });
      patchLists(qc, mail, 'remove');
      const { error } = await mailService.trash(mail.accountId, mail.id);
      if (error) {
        fail(error, 'O email não foi para o lixo.');
        await qc.invalidateQueries({ queryKey: ['mail', 'list'] });
      }
    },

    send: async (input: ComposeInput) => {
      if (isPreview) {
        const account = DEMO_MAIL_ACCOUNTS.find(a => a.id === input.accountId);
        setDemoMail(s => ({
          ...s,
          mails: [
            {
              id: `sent-${Date.now()}`,
              accountId: input.accountId,
              folder: 'sent',
              threadId: null,
              from: { name: account?.displayName ?? null, email: account?.email ?? '' },
              to: input.to.map(email => ({ name: null, email })),
              cc: input.cc.map(email => ({ name: null, email })),
              replyTo: [],
              subject: input.subject || '(sem assunto)',
              snippet: input.text.slice(0, 140),
              date: new Date().toISOString(),
              unread: false,
              starred: false,
              hasAttachments: input.attachments.length > 0,
              html: null,
              text: input.text,
              attachments: [],
            },
            ...s.mails,
          ],
        }));
        toast({ title: 'Email enviado' });
        return true;
      }
      const { error } = await mailService.send(input, textToHtml(input.text));
      if (error) {
        fail(error, 'O email não foi enviado.');
        return false;
      }
      toast({ title: 'Email enviado' });
      await qc.invalidateQueries({ queryKey: ['mail', 'list'] });
      return true;
    },

    download: async (mail: MailSummary, attachmentId: string) => {
      if (isPreview) {
        toast({ title: 'Pré-visualização', description: 'Os anexos de exemplo não existem.' });
        return;
      }
      const { data, error } = await mailService.attachment(mail.accountId, mail.id, attachmentId);
      if (error || !data) return fail(error, 'O anexo não foi descarregado.');
      const bytes = Uint8Array.from(atob(data.base64), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: data.mime }));
      const link = document.createElement('a');
      link.href = url;
      link.download = data.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },

    toBase64,
  };
};
