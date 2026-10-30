import React from 'react';
import { AiRewriteBar } from '@/modules/webmail/components/AiRewriteBar';
import { useAiRewrite } from '@/modules/webmail/hooks/useAiRewrite';
import type { BroadcastDraft } from '../../lib/broadcast';

interface BroadcastAiProps {
  draft: BroadcastDraft;
  onChange: (patch: Partial<BroadcastDraft>) => void;
}

/** "Usar IA" no comunicado: o Realize AI reescreve a mensagem e sugere o assunto. */
export const BroadcastAi: React.FC<BroadcastAiProps> = ({ draft, onChange }) => {
  const ai = useAiRewrite(result => onChange({ message: result.text, subject: result.subject }));
  return (
    <AiRewriteBar
      empty={!draft.message.trim()}
      busy={ai.busy}
      canUndo={!!ai.undoFor(draft.message)}
      onRun={mode => void ai.run(mode, { text: draft.message, subject: draft.subject }, '')}
      onUndo={() => {
        const before = ai.undoFor(draft.message);
        if (before) onChange({ message: before.text, subject: before.subject });
        ai.clearUndo();
      }}
    />
  );
};
