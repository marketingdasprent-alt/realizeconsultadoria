// Messenger da pré-visualização: a mesma interface que o servidor real, mas em memória.
import { toast } from '@/hooks/use-toast';
import { useCallback, useMemo, useState } from 'react';
import {
  DEMO_CONVERSATIONS,
  DEMO_DIRECTORY,
  DEMO_IMAGES,
  DEMO_ME,
  DEMO_MESSAGES,
  DEMO_ONLINE,
} from '../lib/demoData';
import { baseMime } from '../lib/files';
import type { ChatMessage, ConversationSummary, MessengerApi, SendInput } from '../types';

const preview = (input: SendInput): string =>
  input.audio ? '🎤 Mensagem de voz' : input.file ? `📎 ${input.file.name}` : (input.text ?? '');

export const useDemoMessenger = (): MessengerApi => {
  const [conversations, setConversations] = useState<ConversationSummary[]>(() =>
    DEMO_CONVERSATIONS.map(c => ({ ...c, online: !!c.peerUserId && DEMO_ONLINE.has(c.peerUserId) }))
  );
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(DEMO_MESSAGES);
  const [activeId, setActiveId] = useState<string | null>(null);

  const patchConversation = useCallback(
    (id: string, patch: Partial<ConversationSummary>) =>
      setConversations(list => list.map(c => (c.id === id ? { ...c, ...patch } : c))),
    []
  );
  const patchMessage = useCallback(
    (id: string, patch: (m: ChatMessage) => ChatMessage) =>
      setMessages(all =>
        Object.fromEntries(
          Object.entries(all).map(([key, list]) => [
            key,
            list.map(m => (m.id === id ? patch(m) : m)),
          ])
        )
      ),
    []
  );

  const setActive = useCallback(
    (id: string | null) => {
      setActiveId(id);
      if (id) patchConversation(id, { unread: 0 });
    },
    [patchConversation]
  );

  const send = useCallback(
    async (input: SendInput) => {
      if (!activeId) return;
      const blob = input.audio?.blob ?? input.file;
      const mime = blob ? baseMime(blob.type) : '';
      const all = messages[activeId] ?? [];
      const reply = all.find(m => m.id === input.replyToId);
      const created: ChatMessage = {
        id: `demo-${Date.now()}`,
        conversationId: activeId,
        senderId: DEMO_ME.userId,
        authorName: 'Eu',
        isMine: true,
        kind: input.audio
          ? 'audio'
          : input.file
            ? mime.startsWith('image/')
              ? 'image'
              : 'file'
            : 'text',
        text: input.text,
        attachment: blob
          ? {
              path: URL.createObjectURL(blob),
              name: input.file?.name ?? 'voz.webm',
              size: blob.size,
              mime,
            }
          : undefined,
        durationSec: input.audio?.durationSec,
        createdAt: new Date().toISOString(),
        replyTo: reply
          ? { id: reply.id, authorName: reply.authorName, text: reply.text ?? 'Anexo' }
          : undefined,
        reactions: [],
      };
      setMessages(current => ({ ...current, [activeId]: [...(current[activeId] ?? []), created] }));
      patchConversation(activeId, {
        lastMessage: preview(input),
        lastAuthor: 'Eu',
        lastAt: created.createdAt,
      });
    },
    [activeId, messages, patchConversation]
  );

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) =>
      patchMessage(messageId, m => {
        const list = m.reactions ?? [];
        const existing = list.find(r => r.emoji === emoji);
        const next = existing
          ? list
              .map(r =>
                r.emoji === emoji ? { ...r, count: r.count + (r.mine ? -1 : 1), mine: !r.mine } : r
              )
              .filter(r => r.count > 0)
          : [...list, { emoji, count: 1, mine: true }];
        return { ...m, reactions: next };
      }),
    [patchMessage]
  );

  const startDirect = useCallback(
    async (userId: string) => {
      const person = DEMO_DIRECTORY.find(p => p.userId === userId);
      if (!person) return null;
      if (!conversations.some(c => c.id === userId)) {
        setConversations(list => [
          {
            id: userId,
            kind: 'direct',
            title: person.name,
            subtitle: [person.position, person.department].filter(Boolean).join(' · '),
            lastMessage: 'Sem mensagens',
            lastAt: new Date().toISOString(),
            unread: 0,
            peerUserId: userId,
            online: DEMO_ONLINE.has(userId),
            canPost: true,
          },
          ...list,
        ]);
      }
      setActiveId(userId);
      return userId;
    },
    [conversations]
  );

  const createGroup = useCallback(async (title: string, userIds: string[]) => {
    const id = `grupo-${Date.now()}`;
    setConversations(list => [
      {
        id,
        kind: 'group',
        title,
        subtitle: `${userIds.length + 1} membros`,
        lastMessage: 'Grupo criado',
        lastAt: new Date().toISOString(),
        unread: 0,
        memberCount: userIds.length + 1,
        canPost: true,
      },
      ...list,
    ]);
    setActiveId(id);
    return id;
  }, []);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.muted ? 0 : c.unread), 0),
    [conversations]
  );

  return {
    isLoading: false,
    error: null,
    me: DEMO_ME,
    conversations,
    directory: DEMO_DIRECTORY,
    isOnline: (userId: string) => DEMO_ONLINE.has(userId),
    unreadTotal,
    activeId,
    setActive,
    messages: activeId ? (messages[activeId] ?? []) : [],
    messagesLoading: false,
    hasOlder: false,
    loadOlder: () => undefined,
    typing: [],
    notifyTyping: () => undefined,
    send,
    editMessage: async (id, text) =>
      patchMessage(id, m => ({ ...m, text, editedAt: new Date().toISOString() })),
    deleteMessage: async id =>
      patchMessage(id, m => ({ ...m, deleted: true, text: undefined, attachment: undefined })),
    toggleReaction,
    setFlag: async (id, flag, value) => patchConversation(id, { [flag]: value }),
    startDirect,
    createGroup,
    renameGroup: async (id, title) => patchConversation(id, { title }),
    // Na pré-visualização o "caminho" de um ficheiro enviado já é um URL local.
    getFileUrl: async path => (path.startsWith('blob:') ? path : (DEMO_IMAGES[path] ?? null)),
    forwardMessage: async (_message, conversationIds) => {
      toast({
        title: 'Mensagem encaminhada',
        description: `Pré-visualização: ${conversationIds.length} conversa(s).`,
      });
    },
  };
};
