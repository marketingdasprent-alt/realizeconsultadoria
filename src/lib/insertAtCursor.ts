/**
 * Põe texto (ex.: um emoji) onde está o cursor de uma caixa de texto, em vez de no fim.
 * Devolve o texto novo; o cursor volta a ficar logo a seguir ao que entrou.
 */
export const insertAtCursor = (
  field: HTMLTextAreaElement | HTMLInputElement | null,
  value: string,
  text: string
): string => {
  const start = field?.selectionStart ?? value.length;
  const end = field?.selectionEnd ?? value.length;
  const caret = start + text.length;
  requestAnimationFrame(() => {
    field?.focus();
    field?.setSelectionRange(caret, caret);
  });
  return value.slice(0, start) + text + value.slice(end);
};
