// A mensagem que se está a escrever sobrevive a sair do Email (ir às Mensagens e voltar):
// fica aqui em memória, com os anexos, e reabre minimizada quando se volta ao Email.
import type { ComposeDraft } from '../types';

let current: ComposeDraft | null = null;

export const composeSession = {
  get: () => current,
  /** A mensagem como está agora (null quando é enviada ou descartada). */
  set: (draft: ComposeDraft | null) => {
    current = draft;
  },
};
