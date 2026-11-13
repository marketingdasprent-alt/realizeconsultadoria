import { describe, expect, it } from 'vitest';
import { clampFloat, dockedPosition, floatSize, isOutsideViewport } from '../useFloatingWindow';

const desktop = { width: 1280, height: 800 };

describe('janela solta do email', () => {
  it('tem um tamanho que cabe ao lado da lista e nunca passa do ecrã', () => {
    expect(floatSize(desktop)).toEqual({ width: 640, height: 680 });
    expect(floatSize({ width: 600, height: 500 })).toEqual({ width: 584, height: 484 });
  });

  it('não deixa a barra de título sair do ecrã', () => {
    expect(clampFloat({ x: -5000, y: -40 }, desktop)).toEqual({ x: 120 - 640, y: 0 });
    expect(clampFloat({ x: 9000, y: 9000 }, desktop)).toEqual({ x: 1280 - 120, y: 800 - 680 });
  });

  it('deixa passar uma posição que já está dentro do ecrã', () => {
    expect(clampFloat({ x: 300, y: 120 }, desktop)).toEqual({ x: 300, y: 120 });
  });

  it('solta no canto inferior direito, dentro do ecrã', () => {
    const { x, y } = dockedPosition(desktop);
    expect(x + 640).toBeLessThanOrEqual(desktop.width);
    expect(y + 680).toBeLessThanOrEqual(desktop.height);
    expect(x).toBeGreaterThan(desktop.width / 2 - 640);
  });
});

describe('arrastar para fora do navegador', () => {
  it('só conta como "fora" quando o rato sai da área da página', () => {
    expect(isOutsideViewport(640, 400, desktop)).toBe(false);
    expect(isOutsideViewport(0, 0, desktop)).toBe(false);
    expect(isOutsideViewport(-1, 400, desktop)).toBe(true);
    expect(isOutsideViewport(1281, 400, desktop)).toBe(true);
    expect(isOutsideViewport(640, -30, desktop)).toBe(true);
    expect(isOutsideViewport(640, 801, desktop)).toBe(true);
  });
});
