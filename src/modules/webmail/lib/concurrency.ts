/**
 * Corre `fn` para cada item com, no máximo, `limit` pedidos de cada vez por grupo (por caixa:
 * o Microsoft Graph recusa mais de 4 pedidos em simultâneo na mesma caixa). Os grupos correm
 * em paralelo e os resultados vêm pela ordem dos itens.
 */
export const mapPerGroup = async <T, R>(
  items: readonly T[],
  groupOf: (item: T) => string,
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  const groups = new Map<string, number[]>();
  items.forEach((item, index) => {
    const key = groupOf(item);
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  await Promise.all(
    [...groups.values()].map(async indexes => {
      let next = 0;
      const worker = async () => {
        while (next < indexes.length) {
          const index = indexes[next++];
          results[index] = await fn(items[index]);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(Math.max(1, limit), indexes.length) }, worker)
      );
    })
  );
  return results;
};
