// Estado da conta que vive fora do React (rascunho de email, anexos copiados, URLs assinados…):
// sobrevive a sair e entrar com outra conta no mesmo separador. Cada módulo regista aqui como se
// esquece; a app chama resetSessionMemory() ao terminar a sessão e quando entra outra conta.

const cleanups = new Set<() => void>();

// Muda a cada reset. Um pedido em voo da conta anterior que responde depois da troca compara a
// época que guardou antes do pedido: se mudou, não escreve na memória (já é a da conta nova).
let epoch = 0;
export const sessionEpoch = (): number => epoch;

/** Regista como esquecer o estado de um módulo. Devolve a função que retira o registo. */
export const onSessionReset = (cleanup: () => void): (() => void) => {
  cleanups.add(cleanup);
  return () => {
    cleanups.delete(cleanup);
  };
};

/** Esquece o estado em memória de todos os módulos registados (um que falhe não trava os outros). */
export const resetSessionMemory = (): void => {
  epoch += 1;
  cleanups.forEach(cleanup => {
    try {
      cleanup();
    } catch (err) {
      // um módulo que falha a limpar não pode deixar os outros com dados da conta anterior
      console.error('Erro ao limpar a memória da sessão:', err);
    }
  });
};
