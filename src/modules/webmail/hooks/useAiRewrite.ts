import { useEffect, useRef, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { AiError, rewriteText, type RewriteMode } from '@/modules/ai/services/aiService';
import { composeSession } from '../lib/composeSession';

export interface AiDraft {
  text: string;
  subject: string;
}

/** Respostas e reencaminhamentos mantêm o assunto (o "Re:"/"Fwd:" liga a conversa). */
export const keepsSubject = (subject: string) => /^\s*(re|fw|fwd|enc|res)\s*:/i.test(subject);

/**
 * "Usar IA" no email: o pedido vive no compositor (não no botão), por isso continua com a
 * janela minimizada; se a pessoa sair do Email entretanto, o resultado vai para a mensagem
 * guardada e aparece quando voltar.
 */
export const useAiRewrite = (apply: (draft: AiDraft) => void) => {
  const [busy, setBusy] = useState(false);
  // Antes e depois da IA: enquanto não se mexer no texto, dá para desfazer.
  const [undo, setUndo] = useState<{ before: AiDraft; after: AiDraft } | null>(null);
  const mounted = useRef(true);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = async (mode: RewriteMode, before: AiDraft, context: string) => {
    if (!before.text.trim() || busy) return;
    setBusy(true);
    try {
      const result = await rewriteText({ ...before, mode, context: context.trim() });
      const after = {
        text: result.text,
        subject: keepsSubject(before.subject) || !result.subject ? before.subject : result.subject,
      };
      if (mounted.current) {
        setUndo({ before, after });
        applyRef.current(after);
      } else {
        const saved = composeSession.get();
        if (saved && (saved.body ?? '') === before.text)
          composeSession.set({ ...saved, body: after.text, subject: after.subject });
      }
    } catch (error: unknown) {
      toast({
        title: 'A IA não conseguiu reescrever',
        description: error instanceof AiError ? error.message : 'Tente outra vez daqui a pouco.',
        variant: 'destructive',
      });
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return {
    busy,
    run,
    /** Desfazer só enquanto o texto é o que a IA escreveu. */
    undoFor: (text: string) => (undo && undo.after.text === text ? undo.before : null),
    clearUndo: () => setUndo(null),
  };
};
