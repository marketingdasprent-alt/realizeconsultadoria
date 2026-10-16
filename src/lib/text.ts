// Comparação de texto sem maiúsculas/minúsculas nem acentos: "Contabilidade" = "contabilidade",
// "Férias" = "ferias". Usar em todas as pesquisas e agrupamentos por texto.

/** Sem acentos, em minúsculas e sem espaços nas pontas. */
export const fold = (text: string | null | undefined): string =>
  (text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** O termo aparece em algum dos campos (termo vazio corresponde a tudo). */
export const matchesText = (term: string, ...fields: (string | null | undefined)[]): boolean => {
  const needle = fold(term);
  return !needle || fields.some(field => !!field && fold(field).includes(needle));
};

export const sameText = (a: string | null | undefined, b: string | null | undefined): boolean =>
  fold(a) === fold(b);

/** Ordenação alfabética que ignora maiúsculas e acentos. */
export const compareText = (a: string, b: string): number =>
  fold(a).localeCompare(fold(b), 'pt') || a.localeCompare(b, 'pt');

/**
 * Agrupa nomes que só diferem em maiúsculas/acentos ("contabilidade", "Contabilidade") e
 * escolhe como mostrar cada grupo: a grafia mais usada, preferindo a que começa em maiúscula.
 */
export const canonicalLabels = (values: (string | null | undefined)[]): Map<string, string> => {
  const counts = new Map<string, Map<string, number>>();
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = fold(value);
    const variants = counts.get(key) ?? new Map<string, number>();
    variants.set(value, (variants.get(value) ?? 0) + 1);
    counts.set(key, variants);
  }
  const labels = new Map<string, string>();
  for (const [key, variants] of counts) {
    const best = [...variants.entries()].sort(
      (a, b) =>
        Number(/^\p{Lu}/u.test(b[0])) - Number(/^\p{Lu}/u.test(a[0])) ||
        b[1] - a[1] ||
        a[0].localeCompare(b[0])
    )[0][0];
    labels.set(key, best);
  }
  return labels;
};
