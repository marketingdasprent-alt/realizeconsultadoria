import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import {
  AiError,
  chat,
  executeProposal,
  type AiMessage,
  type AiProposal,
} from '../services/aiService';

const MAX_KEPT = 40;

const storageKey = (userId: string) => `rz-ai-chat:${userId}`;

const load = (userId: string): AiMessage[] => {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (m): m is AiMessage =>
            !!m &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string' &&
            m.content.trim() !== ''
        )
      : [];
  } catch {
    return [];
  }
};

/** Resposta de exemplo da pré-visualização (sem servidor). */
const demoReply = (text: string): { reply: string; proposals: AiProposal[] } => {
  const wantsEvent = /marc|reuni|evento|agend/i.test(text);
  return {
    reply: wantsEvent
      ? 'Preparei a reunião. Basta confirmar no cartão.'
      : 'Esta é uma resposta de exemplo da pré-visualização. No sistema real, o Realize AI responde com o modelo da empresa e prepara eventos, tarefas e lembretes.',
    proposals: wantsEvent
      ? [
          {
            id: crypto.randomUUID(),
            tool: 'event',
            title: 'Reunião de equipa',
            lines: ['amanhã, 10:00 até 11:00', 'Convidados: Ana Ferreira'],
            args: {},
            status: 'pending',
          },
        ]
      : [],
  };
};

/** Conversa com o Realize AI: guardada neste dispositivo, com cartões para confirmar. */
export const useAiChat = () => {
  const { user, isPreview } = useWorkspace();
  const [messages, setMessages] = useState<AiMessage[]>(() => load(user.userId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey(user.userId),
        JSON.stringify(messages.filter(m => m.content.trim()).slice(-MAX_KEPT))
      );
    } catch {
      // sem armazenamento (janela privada): a conversa só vive nesta sessão
    }
  }, [messages, user.userId]);

  useEffect(() => () => abort.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      const history: AiMessage[] = [
        ...messages.filter(m => m.content.trim()),
        { role: 'user', content },
      ];
      setMessages(history);
      setError(null);
      setBusy(true);
      const controller = new AbortController();
      abort.current = controller;
      try {
        let answer: { reply: string; proposals: AiProposal[] };
        if (isPreview) {
          await new Promise(resolve => setTimeout(resolve, 600));
          answer = demoReply(content);
        } else {
          const result = await chat(
            history.slice(-30).map(({ role, content: body }) => ({ role, content: body })),
            controller.signal
          );
          answer = {
            reply: result.reply,
            proposals: result.proposals.map(p => ({ ...p, status: 'pending' as const })),
          };
        }
        if (!answer.reply.trim()) {
          setError('O assistente não respondeu. Tente outra vez.');
        } else {
          setMessages(list => [
            ...list,
            {
              role: 'assistant',
              content: answer.reply,
              proposals: answer.proposals.length ? answer.proposals : undefined,
            },
          ]);
        }
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
          setError(
            caught instanceof AiError ? caught.message : 'O assistente não está disponível agora.'
          );
        }
      } finally {
        setBusy(false);
        abort.current = null;
      }
    },
    [messages, busy, isPreview]
  );

  const patchProposal = useCallback((id: string, patch: Partial<AiProposal>) => {
    setMessages(list =>
      list.map(m =>
        m.proposals?.some(p => p.id === id)
          ? { ...m, proposals: m.proposals.map(p => (p.id === id ? { ...p, ...patch } : p)) }
          : m
      )
    );
  }, []);

  /** Grava o que o assistente preparou (com as regras da própria pessoa). */
  const confirm = useCallback(
    async (proposal: AiProposal) => {
      patchProposal(proposal.id, { status: 'saving' });
      try {
        if (isPreview) {
          await new Promise(resolve => setTimeout(resolve, 400));
          patchProposal(proposal.id, { status: 'done', note: 'Criado (pré-visualização)' });
          return;
        }
        const result = await executeProposal(proposal);
        patchProposal(proposal.id, { status: 'done', note: result.message, link: result.link });
      } catch (caught) {
        patchProposal(proposal.id, {
          status: 'error',
          note: caught instanceof AiError ? caught.message : 'Não foi possível guardar.',
        });
      }
    },
    [isPreview, patchProposal]
  );

  const cancel = useCallback(
    (id: string) => patchProposal(id, { status: 'cancelled' }),
    [patchProposal]
  );
  const stop = useCallback(() => abort.current?.abort(), []);
  const clear = useCallback(() => {
    abort.current?.abort();
    setMessages([]);
    setError(null);
  }, []);

  return { messages, busy, error, send, stop, clear, confirm, cancel };
};
