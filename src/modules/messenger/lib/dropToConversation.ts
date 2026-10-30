// Largar ficheiros em cima de uma conversa da lista: abrem nessa conversa, prontos a enviar.
// A conversa pode ainda não estar aberta, por isso ficam guardados até ela os ir buscar.

const EVENT = 'rz-chat-drop';
let pending: { conversationId: string; files: File[] } | null = null;

export const dropToConversation = (conversationId: string, files: File[]) => {
  if (!files.length) return;
  pending = { conversationId, files };
  window.dispatchEvent(new CustomEvent(EVENT));
};

/** Os ficheiros largados para esta conversa (e esquece-os). */
export const takeDropped = (conversationId: string): File[] => {
  if (pending?.conversationId !== conversationId) return [];
  const { files } = pending;
  pending = null;
  return files;
};

/** Avisa quando alguém larga ficheiros numa conversa (a aberta vai buscá-los). */
export const onDropped = (listener: () => void) => {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};

export const dragHasFiles = (transfer: DataTransfer | null) =>
  !!transfer && Array.from(transfer.types).includes('Files');
