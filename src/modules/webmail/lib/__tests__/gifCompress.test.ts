import { describe, expect, it } from 'vitest';
import { markUnchanged } from '../gifCompress';

describe('GIF comprimido: só grava o que muda', () => {
  const palette = [
    [255, 255, 255],
    [0, 0, 0],
    [250, 250, 250],
  ];

  it('o primeiro quadro fica todo; nos seguintes o que não mudou fica transparente', () => {
    const shown = new Uint8Array(3 * 3);
    const first = new Uint8Array([0, 1, 0]);
    markUnchanged(first, palette, shown, 9, true);
    expect([...first]).toEqual([0, 1, 0]);

    // Ponto 0 igual, ponto 1 mudou (preto → branco), ponto 2 quase igual (250 vs 255).
    const next = new Uint8Array([0, 0, 2]);
    markUnchanged(next, palette, shown, 9, false);
    expect([...next]).toEqual([9, 0, 9]);
    expect([...shown.slice(3, 6)]).toEqual([255, 255, 255]);
  });
});
