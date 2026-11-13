import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MIN_GAP_MS,
  isMailSoundOn,
  playMailSound,
  primeMailSound,
  resetMailSoundForTests,
  setMailSoundOn,
} from '../mailSound';

const started: number[] = [];
let state: 'running' | 'suspended';
let resumable: boolean;
const resume = vi.fn();

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  get state() {
    return state;
  }
  resume = resume.mockImplementation(async () => {
    if (resumable) state = 'running';
    else throw new Error('bloqueado pelo navegador');
  });
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }
  createOscillator() {
    const oscillator = {
      type: '',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(() => started.push(oscillator.frequency.value)),
      stop: vi.fn(),
    };
    return oscillator;
  }
}

describe('som do popup de email novo', () => {
  beforeEach(() => {
    started.length = 0;
    state = 'running';
    resumable = true;
    resume.mockClear();
    window.localStorage.clear();
    resetMailSoundForTests();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-13T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('vem ligado por omissão e guarda a escolha', () => {
    expect(isMailSoundOn()).toBe(true);
    setMailSoundOn(false);
    expect(isMailSoundOn()).toBe(false);
    setMailSoundOn(true);
    expect(isMailSoundOn()).toBe(true);
  });

  it('toca um sinal curto de duas notas', async () => {
    expect(await playMailSound()).toBe(true);
    expect(started).toHaveLength(2);
  });

  it('não toca com o som desligado', async () => {
    setMailSoundOn(false);
    expect(await playMailSound()).toBe(false);
    expect(started).toHaveLength(0);
  });

  it('não repete em emails seguidos: um som a cada poucos segundos', async () => {
    expect(await playMailSound()).toBe(true);
    vi.advanceTimersByTime(MIN_GAP_MS - 1);
    expect(await playMailSound()).toBe(false);
    vi.advanceTimersByTime(2);
    expect(await playMailSound()).toBe(true);
    expect(started).toHaveLength(4);
  });

  it('dois emails no mesmo instante tocam uma vez só', async () => {
    const [a, b] = await Promise.all([playMailSound(), playMailSound()]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it('quem acabou de ligar o som ouve-o já (sem esperar o intervalo)', async () => {
    await playMailSound();
    expect(await playMailSound({ force: true })).toBe(true);
  });

  it('se o navegador bloquear o áudio, fica em silêncio e sem erro', async () => {
    state = 'suspended';
    resumable = false;
    await expect(playMailSound()).resolves.toBe(false);
    expect(started).toHaveLength(0);
    // desbloqueado depois (a pessoa interagiu): volta a tocar logo, sem esperar o intervalo
    state = 'running';
    expect(await playMailSound()).toBe(true);
  });

  it('sem interação da pessoa o resume() fica pendente: não toca atrasado mais tarde', async () => {
    state = 'suspended';
    let release: () => void = () => undefined;
    resume.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          release = () => {
            state = 'running';
            resolve();
          };
        })
    );
    const result = playMailSound();
    await vi.advanceTimersByTimeAsync(400);
    await expect(result).resolves.toBe(false);
    release(); // a pessoa clica minutos depois: nada soa por um email antigo
    await vi.advanceTimersByTimeAsync(10);
    expect(started).toHaveLength(0);
  });

  it('sem suporte de áudio no navegador, também não dá erro', async () => {
    window.AudioContext = undefined as unknown as typeof AudioContext;
    await expect(playMailSound()).resolves.toBe(false);
  });

  it('no primeiro toque na app, prepara o áudio (uma vez só)', async () => {
    state = 'suspended';
    primeMailSound();
    window.dispatchEvent(new Event('pointerdown'));
    window.dispatchEvent(new Event('keydown'));
    expect(resume).toHaveBeenCalledTimes(1);
  });
});
