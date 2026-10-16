/** Nome automático de um grupo sem nome: "Ana, Rui e Marta" (até 4 nomes; o resto "+N"). */
export const groupTitle = (names: string[]): string => {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] ?? 'Grupo';
  const shown = list.slice(0, 4);
  const rest = list.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} +${rest}`;
  return `${shown.slice(0, -1).join(', ')} e ${shown[shown.length - 1]}`;
};
