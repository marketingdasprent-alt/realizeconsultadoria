// As mensagens que se estão a escrever sobrevivem a sair do Email (ir às Mensagens e voltar):
// ficam aqui em memória, com os anexos, e reabrem minimizadas quando se volta ao Email.
// Várias ao mesmo tempo (como no Gmail e no Outlook), cada uma com a sua chave.
import { onSessionReset } from '@/lib/session-memory';
import type { ComposeDraft } from '../types';

const current = new Map<string, ComposeDraft>();

// Outra conta no mesmo separador não herda os rascunhos (nem os anexos) da anterior.
onSessionReset(() => {
  current.clear();
});

export const composeSession = {
  /** Todas as mensagens a meio, pela ordem em que foram abertas. */
  all: (): [string, ComposeDraft][] => [...current.entries()],
  get: (key: string) => current.get(key) ?? null,
  /** A mensagem como está agora (null quando é enviada ou descartada). */
  set: (key: string, draft: ComposeDraft | null) => {
    if (draft) current.set(key, draft);
    else current.delete(key);
  },
};
