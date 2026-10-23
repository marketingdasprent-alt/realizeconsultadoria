import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import { loadAttachment } from '../lib/attachments';
import { DEMO_MAIL_ACCOUNTS } from '../lib/demoData';
import { setDemoMail } from '../lib/demoStore';
import { composeWithSignature } from '../lib/signature';
import { contactService } from '../services/contactService';
import { mailErrorText, mailService, type MailError } from '../services/mailService';
import type { ComposeInput, MailFolder, MailSummary } from '../types';
import { useMailChanges, type MailChange } from './useMailChanges';

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

/**
 * Ler/não lido, estrela, lixo (um email ou os selecionados), enviar e descarregar anexos.
 * `folder`: a pasta à vista (para acertar já os "por ler" da Entrada).
 */
export const useMailActions = (folder?: MailFolder) => {
  const { isPreview } = useWorkspace();
  const qc = useQueryClient();
  const apply = useMailChanges(folder);
  const one = async (mail: MailSummary, kind: MailChange, fallback: string) => {
    const [error] = await apply([mail], kind);
    if (error) fail(error, fallback);
  };

  return {
    setRead: (mail: MailSummary, read: boolean) =>
      one(mail, read ? 'read' : 'unread', 'O estado do email não foi alterado.'),

    toggleStar: (mail: MailSummary) =>
      one(mail, mail.starred ? 'unstar' : 'star', 'A estrela não foi guardada.'),

    trash: (mail: MailSummary) => one(mail, 'trash', 'O email não foi para o lixo.'),

    /** Ação sobre os emails selecionados: um só aviso com quantos falharam. */
    bulk: async (mails: MailSummary[], kind: MailChange) => {
      const errors = await apply(mails, kind);
      if (!errors.length) return;
      const count =
        errors.length === 1
          ? '1 email não foi alterado'
          : `${errors.length} emails não foram alterados`;
      toast({
        title: 'Não foi possível',
        description: `${count}. ${mailErrorText(errors[0])}`.trim(),
        variant: 'destructive',
      });
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
        // Enviado: o rascunho guardado já não faz falta.
        if (input.draft) void mailService.deleteDraft(input.draft.accountId, input.draft.id);
        return true;
      }
      // O compositor já fechou: o aviso mostra o progresso e o resultado.
      const progress = toast({ title: 'A enviar…', description: input.subject || undefined });
      const composed = composeWithSignature(
        input.text,
        input.signatureHtml ?? null,
        input.quotedHtml ?? null
      );
      const { error } = await mailService.send({ ...input, text: composed.text }, composed.html);
      progress.dismiss();
      if (error) {
        fail(error, 'O email não foi enviado. O rascunho voltou a abrir.');
        return false;
      }
      toast({ title: 'Email enviado' });
      // Sem esperar: as listas atualizam-se em segundo plano e quem recebeu passa a ser sugerido.
      void qc.invalidateQueries({ queryKey: ['mail', 'list'] });
      void contactService
        .remember([...input.to, ...input.cc, ...input.bcc].map(email => ({ email })))
        .then(() => qc.invalidateQueries({ queryKey: ['mail', 'contacts'] }));
      return true;
    },

    download: async (mail: MailSummary, attachmentId: string) => {
      if (isPreview) {
        toast({ title: 'Pré-visualização', description: 'Os anexos de exemplo não existem.' });
        return;
      }
      // O servidor lê o email inteiro para tirar o anexo (pode demorar): mostra que está a andar.
      const progress = toast({ title: 'A descarregar o anexo…' });
      let loaded;
      try {
        // Com o email aberto sabe-se o nome do ficheiro (as caixas IMAP descarregam só esse anexo).
        const filename =
          'attachments' in mail
            ? (mail as { attachments: { id: string; filename: string }[] }).attachments.find(
                a => a.id === attachmentId
              )?.filename
            : undefined;
        loaded = await loadAttachment(mail.accountId, mail.id, attachmentId, filename);
      } catch (error) {
        progress.dismiss();
        return fail(error as MailError, 'O anexo não foi descarregado. Tente outra vez.');
      }
      progress.dismiss();
      const url = URL.createObjectURL(loaded.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = loaded.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },

    toBase64,
  };
};
