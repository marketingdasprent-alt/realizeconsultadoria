import { describe, expect, it } from 'vitest';
import { mapPerGroup } from '../concurrency';

const tick = () => new Promise(resolve => setTimeout(resolve, 1));

describe('mapPerGroup', () => {
  it('nunca passa o limite por grupo e devolve pela ordem dos itens', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i, box: i % 2 ? 'b' : 'a' }));
    const running = new Map<string, number>();
    const peak = new Map<string, number>();
    const results = await mapPerGroup(
      items,
      item => item.box,
      3,
      async item => {
        running.set(item.box, (running.get(item.box) ?? 0) + 1);
        peak.set(item.box, Math.max(peak.get(item.box) ?? 0, running.get(item.box) ?? 0));
        await tick();
        running.set(item.box, (running.get(item.box) ?? 0) - 1);
        return item.id * 10;
      }
    );
    expect(results).toEqual(items.map(item => item.id * 10));
    expect(peak.get('a')).toBe(3);
    expect(peak.get('b')).toBe(3);
  });

  it('os grupos correm em paralelo', async () => {
    let concurrent = 0;
    let max = 0;
    await mapPerGroup(
      ['x', 'y', 'z'],
      item => item,
      1,
      async () => {
        concurrent += 1;
        max = Math.max(max, concurrent);
        await tick();
        concurrent -= 1;
      }
    );
    expect(max).toBe(3);
  });

  it('lista vazia', async () => {
    expect(
      await mapPerGroup(
        [],
        () => 'a',
        3,
        async () => 1
      )
    ).toEqual([]);
  });
});
