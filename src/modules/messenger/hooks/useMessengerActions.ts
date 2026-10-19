// Ações do Messenger com servidor real: enviar (texto, ficheiro, áudio), editar,
// eliminar, reagir, fixar/silenciar/arquivar e começar conversas.
import React, { useCallback, useRef } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { extensionFor, normalizeMime, validateFile } from '../lib/files';
import {
  messengerService,
  type ConversationRow,
  type MessageRow,
  type ReactionRow,
} from '../services/messengerService';
import type { ChatMessage, MessengerApi, SendInput } from '../types';
import { CHAT_KEYS, upsertThreadRow } from '../lib/cache';
import type { LiveMessengerUser } from './useLiveMessenger';

interface ActionsInput {
  user: LiveMessengerUser;
  activeId: string | null;
  setActive: (id: string | null) => void;
  setPending: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  reactions: ReactionRow[];
  notifyReactions: (messageId: string) => void;
  refreshList: () => void;
}

type Actions = Pick<
  MessengerApi,
  | 'send'
  | 'editMessage'
  | 'deleteMessage'
  | 'toggleReaction'
  | 'setFlag'
  | 'startDirect'
  | 'createGroup'
  | 'renameGroup'
  | 'getFileUrl'
  | 'forwardMessage'
  | 'retryMessage'
  | 'discardMessage'
>;

const fail = (description: string): void => {
  toast({ title: 'Não foi possível', description, variant: 'destructive' });
};

export const useMessengerActions = ({
  user,
  activeId,
  setActive,
  setPending,
  reactions,
  notifyReactions,
  refreshList,
}: ActionsInput): Actions => {
  const qc = useQueryClient();
  // Envios que falharam: o que se pediu, para "Tentar outra vez" (por id temporário).
  const failedRef = useRef(new Map<string, { input: SendInput; conversationId: string }>());

  const send = useCallback(
    async (input: SendInput, retryOf?: { tempId: string; conversationId: string }) => {
      const conversationId = retryOf?.conversationId ?? activeId;
      if (!conversationId) return;
      const blob = input.audio?.blob ?? input.file;
      // ZIP do Windows, ficheiros sem tipo…: o tipo é normalizado antes de validar e enviar.
      const mime = blob ? normalizeMime(blob.type, input.file?.name ?? '') : '';
      if (blob) {
        const problem = validateFile(blob.size, mime);
        if (problem) return fail(problem);
      }
      const name = input.file?.name ?? `voz-${Date.now()}.${extensionFor(mime)}`;
      const kind = input.audio
        ? 'audio'
        : input.file
          ? mime.startsWith('image/')
            ? 'image'
            : 'file'
          : 'text';
      const tempId = retryOf?.tempId ?? `tmp-${crypto.randomUUID()}`;
      const localUrl = blob ? URL.createObjectURL(blob) : undefined;
      setPending(list => [
        ...list.filter(m => m.id !== tempId),
        {
          id: tempId,
          conversationId,
          senderId: user.userId,
          authorName: 'Eu',
          isMine: true,
          kind,
          text: input.text,
          attachment: blob ? { path: '', name, size: blob.size, mime } : undefined,
          durationSec: input.audio?.durationSec,
          createdAt: new Date().toISOString(),
          pending: true,
          localUrl,
        },
      ]);
      try {
        let path: string | null = null;
        if (blob) {
          const upload = await messengerService.uploadFile(conversationId, blob, name, mime);
          if (upload.error || !upload.data) throw upload.error ?? new Error('upload');
          path = upload.data;
        }
        const { data, error } = await messengerService.insertMessage({
          conversation_id: conversationId,
          sender_id: user.userId,
          kind,
          body: input.text?.trim() || null,
          attachment_path: path,
          attachment_name: blob ? name : null,
          attachment_size: blob ? blob.size : null,
          attachment_mime: blob ? mime : null,
          duration_sec: input.audio ? Math.round(input.audio.durationSec * 10) / 10 : null,
          reply_to_id: input.replyToId ?? null,
        });
        if (error || !data) throw error ?? new Error('insert');
        qc.setQueryData(CHAT_KEYS.thread(conversationId), (cache: InfiniteData<MessageRow[]>) =>
          upsertThreadRow(cache, data)
        );
        refreshList();
        failedRef.current.delete(tempId);
        setPending(list => list.filter(m => m.id !== tempId));
        if (localUrl) setTimeout(() => URL.revokeObjectURL(localUrl), 60_000);
      } catch {
        // A mensagem fica na conversa marcada como não enviada (o texto não se perde).
        failedRef.current.set(tempId, { input, conversationId });
        setPending(list =>
          list.map(m => (m.id === tempId ? { ...m, pending: false, failed: true } : m))
        );
        fail('A mensagem não foi enviada. Toque em "Tentar outra vez".');
      }
    },
    [activeId, user.userId, setPending, qc, refreshList]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      const failed = failedRef.current.get(messageId);
      if (!failed) return;
      await send(failed.input, { tempId: messageId, conversationId: failed.conversationId });
    },
    [send]
  );

  const discardMessage = useCallback(
    (messageId: string) => {
      failedRef.current.delete(messageId);
      setPending(list => list.filter(m => m.id !== messageId));
    },
    [setPending]
  );

  const reloadThread = useCallback(
    () => qc.invalidateQueries({ queryKey: CHAT_KEYS.thread(activeId) }),
    [qc, activeId]
  );

  const editMessage = useCallback(
    async (messageId: string, text: string) => {
      const { error } = await messengerService.editMessage(messageId, text.trim());
      if (error) return fail('A mensagem não foi editada.');
      reloadThread();
      refreshList();
    },
    [reloadThread, refreshList]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      // O ficheiro também sai do armazenamento (deixa de estar acessível a quem tinha o link).
      const rows = qc.getQueryData<InfiniteData<MessageRow[]>>(CHAT_KEYS.thread(activeId));
      const path = rows?.pages.flat().find(row => row.id === messageId)?.attachment_path;
      const { error } = await messengerService.deleteMessage(messageId);
      if (error) return fail('A mensagem não foi eliminada.');
      if (path) await messengerService.deleteFile(path);
      reloadThread();
      refreshList();
    },
    [qc, activeId, reloadThread, refreshList]
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!activeId) return;
      const mine = reactions.some(
        r => r.message_id === messageId && r.user_id === user.userId && r.emoji === emoji
      );
      // Na hora no ecrã; o servidor confirma em fundo (se falhar, volta ao estado real).
      const key = CHAT_KEYS.reactions(activeId);
      qc.setQueryData<ReactionRow[]>(key, rows => {
        const list = rows ?? [];
        return mine
          ? list.filter(
              r => !(r.message_id === messageId && r.user_id === user.userId && r.emoji === emoji)
            )
          : [...list, { message_id: messageId, user_id: user.userId, emoji }];
      });
      notifyReactions(messageId);
      const { error } = mine
        ? await messengerService.removeReaction(messageId, user.userId, emoji)
        : await messengerService.addReaction({
            message_id: messageId,
            conversation_id: activeId,
            user_id: user.userId,
            emoji,
          });
      if (error) {
        void qc.invalidateQueries({ queryKey: key });
        return fail('A reação não foi guardada.');
      }
      notifyReactions(messageId);
    },
    [activeId, reactions, user.userId, qc, notifyReactions]
  );

  const setFlag = useCallback<Actions['setFlag']>(
    async (conversationId, flag, value) => {
      // Na hora no ecrã (fixar, silenciar, arquivar); o servidor confirma em fundo.
      const column =
        flag === 'pinned' ? 'is_pinned' : flag === 'muted' ? 'is_muted' : 'is_archived';
      qc.setQueryData(CHAT_KEYS.conversations, (rows: ConversationRow[] | undefined) =>
        rows?.map(row => (row.id === conversationId ? { ...row, [column]: value } : row))
      );
      const { error } = await messengerService.setFlag(conversationId, user.userId, flag, value);
      if (error) {
        void qc.invalidateQueries({ queryKey: CHAT_KEYS.conversations });
        return fail('A alteração não foi guardada.');
      }
    },
    [qc, user.userId]
  );

  const openNew = useCallback(
    async (result: { data: string | null; error: unknown }, message: string) => {
      if (result.error || !result.data) {
        fail(message);
        return null;
      }
      await qc.invalidateQueries({ queryKey: CHAT_KEYS.conversations });
      setActive(result.data);
      return result.data;
    },
    [qc, setActive]
  );

  const startDirect = useCallback(
    async (userId: string) =>
      openNew(await messengerService.startDirect(userId), 'A conversa não foi criada.'),
    [openNew]
  );

  const createGroup = useCallback(
    async (title: string, userIds: string[]) =>
      openNew(await messengerService.createGroup(title, userIds), 'O grupo não foi criado.'),
    [openNew]
  );

  const forwardMessage = useCallback<Actions['forwardMessage']>(
    async (message, conversationIds) => {
      let failed = 0;
      for (const conversationId of conversationIds) {
        try {
          const attachment = message.attachment;
          let path: string | null = null;
          if (attachment?.path) {
            const copy = await messengerService.copyFile(
              attachment.path,
              conversationId,
              attachment.name
            );
            if (copy.error || !copy.data) throw copy.error ?? new Error('copy');
            path = copy.data;
          }
          const { data, error } = await messengerService.insertMessage({
            conversation_id: conversationId,
            sender_id: user.userId,
            kind: message.kind,
            body: message.text?.trim() || null,
            attachment_path: path,
            attachment_name: path ? attachment?.name : null,
            attachment_size: path ? attachment?.size : null,
            attachment_mime: path ? attachment?.mime : null,
            duration_sec: message.durationSec ?? null,
            reply_to_id: null,
          });
          if (error || !data) throw error ?? new Error('insert');
          qc.setQueryData(CHAT_KEYS.thread(conversationId), (cache: InfiniteData<MessageRow[]>) =>
            cache ? upsertThreadRow(cache, data) : cache
          );
        } catch {
          failed += 1;
        }
      }
      refreshList();
      if (failed)
        fail(
          failed === conversationIds.length
            ? 'Não foi encaminhada.'
            : 'Algumas conversas não receberam a mensagem.'
        );
      else
        toast({
          title: conversationIds.length > 1 ? 'Mensagem encaminhada' : 'Mensagem encaminhada',
          description:
            conversationIds.length > 1
              ? `Enviada a ${conversationIds.length} conversas.`
              : undefined,
        });
    },
    [user.userId, qc, refreshList]
  );

  const renameGroup = useCallback<Actions['renameGroup']>(
    async (conversationId, title) => {
      // Na hora na lista e no cabeçalho; volta atrás se o servidor recusar.
      qc.setQueryData(
        CHAT_KEYS.conversations,
        (rows: { id: string; title: string | null }[] | undefined) =>
          rows?.map(row => (row.id === conversationId ? { ...row, title } : row))
      );
      const { error } = await messengerService.renameGroup(conversationId, title);
      if (error) {
        fail('O nome do grupo não foi alterado.');
        void qc.invalidateQueries({ queryKey: CHAT_KEYS.conversations });
      }
    },
    [qc]
  );

  const getFileUrl = useCallback(
    async (path: string) => (await messengerService.getFileUrl(path)).data,
    []
  );

  return {
    send,
    editMessage,
    deleteMessage,
    toggleReaction,
    setFlag,
    startDirect,
    createGroup,
    renameGroup,
    getFileUrl,
    forwardMessage,
    retryMessage,
    discardMessage,
  };
};
